import React, { useState, useEffect, useRef } from 'react';
import type { GroceryItem, GroceryList as GroceryListType, MealPlan } from '../types';
import * as apiService from '../services/apiService';
// FIX: Updated imports - ShoppingCartIcon is defined locally, and CheckIcon was missing.
import { ClipboardListIcon, TrashIcon, PlusIcon, CameraIcon, MenuIcon, CheckIcon } from './icons';

interface GroceryListProps {
  mealPlans: MealPlan[];
}

export const GroceryList: React.FC<GroceryListProps> = ({ mealPlans }) => {
  const [lists, setLists] = useState<GroceryListType[]>([]);
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [currentItems, setCurrentItems] = useState<GroceryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Creation States
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState('');
  
  // Import States
  const [isImporting, setIsImporting] = useState(false);
  const [selectedPlansForImport, setSelectedPlansForImport] = useState<Set<number>>(new Set());

  const [newItemName, setNewItemName] = useState('');
  const [showClearMenu, setShowClearMenu] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial Load
  useEffect(() => {
    fetchLists();
  }, []);

  // Fetch Items when active ID changes
  useEffect(() => {
    if (activeListId) {
        fetchItems(activeListId);
    } else {
        setCurrentItems([]);
    }
  }, [activeListId]);

  const fetchLists = async () => {
      try {
          setIsLoading(true);
          const data = await apiService.getGroceryLists();
          setLists(data);
          
          const active = data.find(l => l.is_active);
          if (active) {
              setActiveListId(active.id);
          } else if (data.length > 0) {
              setActiveListId(data[0].id);
          }
      } catch (err) {
          console.error("Failed to load lists", err);
      } finally {
          setIsLoading(false);
      }
  };

  const fetchItems = async (id: number) => {
      try {
          const items = await apiService.getGroceryListItems(id);
          setCurrentItems(items);
      } catch (err) {
          console.error("Failed to load items", err);
      }
  };

  const handleCreateList = async () => {
      if (!newListName.trim()) return;
      try {
          const newList = await apiService.createGroceryList(newListName);
          const updatedLists = await apiService.getGroceryLists();
          setLists(updatedLists);
          setActiveListId(newList.id);
          setIsCreating(false);
          setNewListName('');
      } catch (err) {
          alert("Failed to create list.");
      }
  };

  const handleImportIngredients = async () => {
      if (!activeListId || selectedPlansForImport.size === 0) return;
      try {
          const updatedItems = await apiService.importIngredientsFromPlans(activeListId, Array.from(selectedPlansForImport));
          setCurrentItems(updatedItems);
          setIsImporting(false);
          setSelectedPlansForImport(new Set());
      } catch (err) {
          alert("Failed to import ingredients.");
      }
  };

  const handleExportToInstacart = () => {
      const items = currentItems.map(i => i.name).join(',');
      window.open(`https://www.instacart.com/store/partner_items?item_names[]=${encodeURIComponent(items)}`, '_blank');
  };

  const handleExportToAmazon = () => {
      // Simplified Amazon URL simulation
      window.open(`https://www.amazon.com/afx/ingredients/export?items=${encodeURIComponent(currentItems.map(i => i.name).join(','))}`, '_blank');
  };

  const handleDeleteList = async (id: number) => {
      if (!window.confirm("Are you sure you want to delete this list?")) return;
      try {
          await apiService.deleteGroceryList(id);
          const remaining = lists.filter(l => l.id !== id);
          setLists(remaining);
          if (activeListId === id) {
             const newActive = remaining.find(l => l.is_active) || (remaining.length > 0 ? remaining[0] : null);
             setActiveListId(newActive ? newActive.id : null);
          }
      } catch (err) {
          alert("Failed to delete list");
      }
  };

  const handleAddItem = async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!newItemName.trim() || !activeListId) return;
      try {
          const newItem = await apiService.addGroceryItem(activeListId, newItemName);
          setCurrentItems(prev => [...prev, newItem]);
          setNewItemName('');
      } catch (err) {
          console.error("Failed to add item", err);
      }
  };

  const handleToggleItem = async (itemId: number, checked: boolean) => {
      setCurrentItems(prev => prev.map(i => i.id === itemId ? { ...i, checked } : i));
      try {
          await apiService.updateGroceryItem(itemId, checked);
      } catch (err) {
           setCurrentItems(prev => prev.map(i => i.id === itemId ? { ...i, checked: !checked } : i));
      }
  };
  
  const handleDeleteItem = async (itemId: number) => {
      const oldItems = [...currentItems];
      setCurrentItems(prev => prev.filter(i => i.id !== itemId));
      try {
          await apiService.removeGroceryItem(itemId);
      } catch (err) {
          setCurrentItems(oldItems);
      }
  };

  const handleClearList = async (type: 'all' | 'checked') => {
      if (!activeListId) return;
      if (!window.confirm(`Are you sure you want to clear ${type === 'all' ? 'ALL' : 'checked'} items?`)) return;
      try {
          await apiService.clearGroceryListItems(activeListId, type);
          if (type === 'all') {
              setCurrentItems([]);
          } else {
              setCurrentItems(prev => prev.filter(i => !i.checked));
          }
          setShowClearMenu(false);
      } catch (err) {
          alert("Failed to clear items.");
      }
  };

  const handleCameraClick = () => { fileInputRef.current?.click(); };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !activeListId) return;
      setIsAnalyzingImage(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
          try {
              const base64String = (reader.result as string).split(',')[1];
              const result = await apiService.identifyGroceryItems(base64String, file.type);
              if (result && result.items && result.items.length > 0) {
                  for (const itemName of result.items) {
                      const added = await apiService.addGroceryItem(activeListId, itemName);
                      setCurrentItems(prev => [...prev, added]);
                  }
              }
          } catch (err) {
              alert("Failed to identify items.");
          } finally {
              setIsAnalyzingImage(false);
              if (fileInputRef.current) fileInputRef.current.value = '';
          }
      };
      reader.readAsDataURL(file);
  };

  if (isLoading && lists.length === 0) return <div className="p-8 text-center text-slate-500">Loading your lists...</div>;

  const currentList = lists.find(l => l.id === activeListId);

  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 min-h-[500px] flex flex-col md:flex-row gap-8">
      
      {/* Sidebar: List Management */}
      <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-100 pb-6 md:pb-0 md:pr-8">
          <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-slate-900">Pantry Hub</h2>
              <button 
                onClick={() => setIsCreating(!isCreating)}
                className="bg-slate-100 text-slate-600 hover:bg-slate-200 p-2 rounded-xl transition"
                title="Create New List"
              >
                  <PlusIcon />
              </button>
          </div>

          {isCreating && (
              <div className="mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-200 animate-fade-in shadow-inner">
                  <input 
                    type="text" 
                    placeholder="List Name" 
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl mb-3 text-sm font-bold"
                    value={newListName}
                    onChange={e => setNewListName(e.target.value)}
                  />
                  <div className="flex gap-2">
                      <button 
                        onClick={handleCreateList} 
                        disabled={!newListName.trim()}
                        className="flex-1 bg-emerald-500 text-white text-xs font-black uppercase tracking-widest py-3 rounded-xl hover:bg-emerald-600 disabled:opacity-50"
                      >
                          Create
                      </button>
                      <button onClick={() => setIsCreating(false)} className="px-4 py-3 text-xs font-black uppercase text-slate-400 hover:bg-slate-200 rounded-xl">
                          Cancel
                      </button>
                  </div>
              </div>
          )}

          <ul className="space-y-2">
              {lists.map(list => (
                  <li 
                    key={list.id} 
                    className={`group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border-2 ${
                        activeListId === list.id ? 'bg-indigo-50 border-indigo-200 shadow-md' : 'hover:bg-slate-50 border-transparent'
                    }`}
                    onClick={() => setActiveListId(list.id)}
                  >
                      <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${activeListId === list.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            <ClipboardListIcon className="w-4 h-4" />
                          </div>
                          <span className={`font-black text-sm uppercase tracking-tight ${activeListId === list.id ? 'text-indigo-900' : 'text-slate-700'}`}>
                              {list.name}
                          </span>
                      </div>
                      <div className="flex items-center space-x-1" onClick={e => e.stopPropagation()}>
                           <button 
                             onClick={() => handleDeleteList(list.id)}
                             className="text-slate-300 hover:text-rose-500 p-1 transition-colors opacity-0 group-hover:opacity-100"
                           >
                               <TrashIcon className="w-4 h-4" />
                           </button>
                      </div>
                  </li>
              ))}
          </ul>
      </div>

      {/* Main Content: Active List Items */}
      <div className="w-full md:w-2/3 flex flex-col">
          {currentList ? (
              <>
                  <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-50">
                      <div>
                          <h2 className="text-3xl font-black text-slate-900 leading-tight">{currentList.name}</h2>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">{currentItems.length} items to fulfill</span>
                             {currentList.is_active && <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-emerald-100">Live Sync</span>}
                          </div>
                      </div>
                      
                      <div className="flex gap-2">
                          <button 
                            onClick={() => setIsImporting(!isImporting)}
                            className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition"
                          >
                             Import
                          </button>
                          <div className="relative">
                              <button onClick={() => setShowClearMenu(!showClearMenu)} className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200"><MenuIcon /></button>
                              {showClearMenu && (
                                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 z-10 overflow-hidden animate-fade-in">
                                      <button onClick={() => handleClearList('checked')} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 border-b border-slate-50">Clear Checked</button>
                                      <button onClick={() => handleClearList('all')} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase text-rose-500 hover:bg-rose-50">Purge Entire List</button>
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>

                  {/* Export Branded Buttons */}
                  <div className="grid grid-cols-2 gap-4 mb-8">
                      <button 
                        onClick={handleExportToInstacart}
                        disabled={currentItems.length === 0}
                        className="bg-[#FF8200] hover:bg-[#e67500] text-white p-4 rounded-3xl flex items-center justify-center gap-2 shadow-lg shadow-orange-100 transition-all active:scale-95 disabled:opacity-50"
                      >
                         <ShoppingCartIcon className="w-5 h-5" />
                         <div className="text-left leading-tight">
                            <p className="text-[10px] font-black uppercase opacity-80">Export To</p>
                            <p className="font-black text-sm">Instacart</p>
                         </div>
                      </button>
                      <button 
                        onClick={handleExportToAmazon}
                        disabled={currentItems.length === 0}
                        className="bg-[#232F3E] hover:bg-[#1a232e] text-white p-4 rounded-3xl flex items-center justify-center gap-2 shadow-lg shadow-slate-200 transition-all active:scale-95 disabled:opacity-50"
                      >
                         <ShoppingCartIcon className="w-5 h-5" />
                         <div className="text-left leading-tight">
                            <p className="text-[10px] font-black uppercase opacity-80">Export To</p>
                            <p className="font-black text-sm">AmazonFresh</p>
                         </div>
                      </button>
                  </div>

                  {/* Import Modal */}
                  {isImporting && (
                      <div className="mb-6 bg-slate-50 p-6 rounded-3xl border border-slate-200 animate-fade-in relative shadow-inner">
                          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Meal Plan Importer</h3>
                          <div className="max-h-40 overflow-y-auto space-y-2 mb-6 pr-2">
                               {mealPlans.map(plan => (
                                    <label key={plan.id} className="flex items-center space-x-3 p-3 bg-white rounded-xl border border-slate-100 cursor-pointer hover:border-emerald-500 transition-all">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedPlansForImport.has(plan.id)}
                                            onChange={(e) => {
                                                const newSet = new Set(selectedPlansForImport);
                                                if (e.target.checked) newSet.add(plan.id);
                                                else newSet.delete(plan.id);
                                                setSelectedPlansForImport(newSet);
                                            }}
                                            className="w-5 h-5 rounded-lg text-emerald-500 focus:ring-emerald-500"
                                        />
                                        <span className="font-bold text-sm text-slate-700">{plan.name}</span>
                                    </label>
                                ))}
                                {mealPlans.length === 0 && <p className="text-xs font-bold text-slate-400 italic">No plans available to import.</p>}
                          </div>
                          <div className="flex gap-2">
                             <button onClick={handleImportIngredients} disabled={selectedPlansForImport.size === 0} className="flex-[2] bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-emerald-600 disabled:opacity-50 shadow-md">Execute Import</button>
                             <button onClick={() => setIsImporting(false)} className="flex-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-200 py-4 rounded-2xl">Cancel</button>
                          </div>
                      </div>
                  )}

                  <form onSubmit={handleAddItem} className="mb-6 flex gap-3">
                      <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleImageChange} className="hidden" />
                      <button type="button" onClick={handleCameraClick} disabled={isAnalyzingImage} className="bg-indigo-600 text-white p-4 rounded-2xl hover:bg-indigo-700 disabled:opacity-50 shadow-lg">
                          {isAnalyzingImage ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <CameraIcon />}
                      </button>
                      <input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Add specific ingredients..." className="flex-grow p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-bold text-sm transition-all" />
                      <button type="submit" disabled={!newItemName.trim()} className="bg-slate-900 text-white px-6 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all shadow-md">Add</button>
                  </form>

                  <div className="flex-grow overflow-y-auto space-y-2 pr-2">
                    {currentItems.map((item) => (
                        <div key={item.id} className={`flex items-center space-x-4 p-4 rounded-2xl border-2 transition-all ${item.checked ? 'bg-slate-50 border-transparent' : 'bg-white border-slate-50 shadow-sm'}`}>
                            <button 
                                onClick={() => handleToggleItem(item.id, !item.checked)}
                                className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all ${item.checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-200'}`}
                            >
                                {item.checked && <CheckIcon className="w-4 h-4 text-white" />}
                            </button>
                            <span onClick={() => handleToggleItem(item.id, !item.checked)} className={`flex-grow font-black text-sm uppercase tracking-tight cursor-pointer ${item.checked ? 'text-slate-300 line-through' : 'text-slate-800'}`}>
                                {item.name}
                            </span>
                            <button onClick={() => handleDeleteItem(item.id)} className="text-slate-200 hover:text-rose-500 p-1"><TrashIcon className="w-4 h-4" /></button>
                        </div>
                    ))}
                    {currentItems.length === 0 && <div className="h-64 flex flex-col items-center justify-center text-slate-300 opacity-60"><ShoppingCartIcon className="w-16 h-16 mb-4" /><p className="font-black uppercase tracking-widest text-[10px]">Your basket is empty</p></div>}
                  </div>
              </>
          ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4"><ClipboardListIcon className="w-16 h-16 opacity-20" /><p className="font-black uppercase tracking-widest text-xs">Select a list to continue</p></div>
          )}
      </div>
    </div>
  );
};

// Re-using ShoppingCartIcon
const ShoppingCartIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-6 w-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
);