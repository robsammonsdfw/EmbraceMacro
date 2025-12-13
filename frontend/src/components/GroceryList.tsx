
import React, { useState, useEffect, useRef } from 'react';
import type { GroceryItem, GroceryList as GroceryListType, MealPlan } from '../types';
import * as apiService from '../services/apiService';
import { ClipboardListIcon, TrashIcon, PlusIcon, StarIcon, BeakerIcon, CameraIcon, MenuIcon } from './icons';

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
          
          // Find the active one, or default to first if none explicitly active
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
          
          // Refresh lists
          const updatedLists = await apiService.getGroceryLists();
          setLists(updatedLists);
          setActiveListId(newList.id); // Switch to new list
          
          // Reset UI
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

  const handleSetActive = async (id: number) => {
      try {
          await apiService.setActiveGroceryList(id);
          setLists(prev => prev.map(l => ({ ...l, is_active: l.id === id })));
          if (activeListId !== id) setActiveListId(id);
      } catch (err) {
          console.error("Failed to set active", err);
      }
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

  const handleCameraClick = () => {
      fileInputRef.current?.click();
  };

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
                  // Add each item to the list
                  const newItems: GroceryItem[] = [];
                  for (const itemName of result.items) {
                      const added = await apiService.addGroceryItem(activeListId, itemName);
                      newItems.push(added);
                  }
                  setCurrentItems(prev => [...prev, ...newItems]);
              } else {
                  alert("No items could be identified from the image.");
              }
          } catch (err) {
              console.error(err);
              alert("Failed to identify items from image.");
          } finally {
              setIsAnalyzingImage(false);
              // Reset input
              if (fileInputRef.current) fileInputRef.current.value = '';
          }
      };
      reader.readAsDataURL(file);
  };

  if (isLoading && lists.length === 0) return <div className="p-8 text-center text-slate-500">Loading your lists...</div>;

  const currentList = lists.find(l => l.id === activeListId);

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 min-h-[500px] flex flex-col md:flex-row gap-6">
      
      {/* Sidebar: List Management */}
      <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-200 pb-6 md:pb-0 md:pr-6">
          <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-800">My Lists</h2>
              <button 
                onClick={() => setIsCreating(!isCreating)}
                className="text-emerald-500 hover:bg-emerald-50 p-2 rounded-full"
                title="Create New List"
              >
                  <PlusIcon />
              </button>
          </div>

          {isCreating && (
              <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200 animate-fade-in">
                  <input 
                    type="text" 
                    placeholder="List Name (e.g. Fast Week)" 
                    className="w-full p-2 border border-slate-300 rounded mb-3 text-sm"
                    value={newListName}
                    onChange={e => setNewListName(e.target.value)}
                  />
                  <div className="flex gap-2">
                      <button 
                        onClick={handleCreateList} 
                        disabled={!newListName.trim()}
                        className="flex-1 bg-emerald-500 text-white text-sm font-bold py-2 rounded hover:bg-emerald-600 disabled:opacity-50"
                      >
                          Save
                      </button>
                      <button onClick={() => setIsCreating(false)} className="px-3 py-2 text-sm text-slate-500 hover:bg-slate-200 rounded">
                          Cancel
                      </button>
                  </div>
              </div>
          )}

          <ul className="space-y-2">
              {lists.map(list => (
                  <li 
                    key={list.id} 
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                        activeListId === list.id ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-slate-50 border border-transparent'
                    }`}
                    onClick={() => setActiveListId(list.id)}
                  >
                      <div className="flex items-center space-x-2">
                          {list.is_active && <StarIcon />}
                          <span className={`font-medium ${activeListId === list.id ? 'text-emerald-700' : 'text-slate-700'}`}>
                              {list.name}
                          </span>
                      </div>
                      <div className="flex items-center space-x-1" onClick={e => e.stopPropagation()}>
                           {!list.is_active && (
                               <button 
                                 onClick={() => handleSetActive(list.id)}
                                 className="text-xs text-slate-400 hover:text-emerald-600 px-2 py-1 rounded hover:bg-white"
                                 title="Set as Active List"
                               >
                                   Set Active
                               </button>
                           )}
                           <button 
                             onClick={() => handleDeleteList(list.id)}
                             className="text-slate-400 hover:text-red-500 p-1"
                             title="Delete List"
                           >
                               <TrashIcon />
                           </button>
                      </div>
                  </li>
              ))}
          </ul>
          {lists.length === 0 && !isCreating && (
              <p className="text-sm text-slate-500 text-center py-4">No lists yet. Create one!</p>
          )}
      </div>

      {/* Main Content: Active List Items */}
      <div className="w-full md:w-2/3">
          {currentList ? (
              <>
                  <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100 relative">
                      <div>
                          <h2 className="text-2xl font-bold text-slate-800">{currentList.name}</h2>
                          <p className="text-sm text-slate-500">
                              {currentList.is_active ? 'Currently Active List' : 'Inactive List'} • {currentItems.length} Items
                          </p>
                      </div>
                      
                      <div className="flex gap-2">
                          <button 
                            onClick={() => setIsImporting(!isImporting)}
                            className="text-emerald-600 text-sm font-bold flex items-center gap-1 hover:bg-emerald-50 px-3 py-1 rounded-lg transition"
                          >
                             <BeakerIcon /> <span>Import</span>
                          </button>
                          
                          <div className="relative">
                              <button 
                                onClick={() => setShowClearMenu(!showClearMenu)}
                                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100"
                              >
                                  <MenuIcon />
                              </button>
                              {showClearMenu && (
                                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 z-10 overflow-hidden animate-fade-in">
                                      <button 
                                        onClick={() => handleClearList('checked')}
                                        className="w-full text-left px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 hover:text-emerald-600 border-b border-slate-100"
                                      >
                                          Clear Checked Items
                                      </button>
                                      <button 
                                        onClick={() => handleClearList('all')}
                                        className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50 font-bold"
                                      >
                                          Clear Entire List
                                      </button>
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>

                  {/* Import Modal Area (Inline) */}
                  {isImporting && (
                      <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200 animate-fade-in relative">
                          <button onClick={() => setIsImporting(false)} className="absolute top-2 right-2 text-slate-400 hover:text-slate-600">&times;</button>
                          <h3 className="font-bold text-slate-700 mb-2">Select Meal Plans to Import</h3>
                          {mealPlans.length === 0 ? (
                              <p className="text-sm text-slate-500">No meal plans found. Create a plan first.</p>
                          ) : (
                              <div className="max-h-40 overflow-y-auto space-y-2 mb-3 bg-white p-2 rounded border border-slate-100">
                                   {mealPlans.map(plan => (
                                        <label key={plan.id} className="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer p-1 hover:bg-slate-50 rounded">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedPlansForImport.has(plan.id)}
                                                onChange={(e) => {
                                                    const newSet = new Set(selectedPlansForImport);
                                                    if (e.target.checked) newSet.add(plan.id);
                                                    else newSet.delete(plan.id);
                                                    setSelectedPlansForImport(newSet);
                                                }}
                                                className="text-emerald-500 rounded focus:ring-emerald-500"
                                            />
                                            <span>{plan.name}</span>
                                        </label>
                                    ))}
                              </div>
                          )}
                          <button 
                            onClick={handleImportIngredients}
                            disabled={selectedPlansForImport.size === 0}
                            className="w-full bg-emerald-500 text-white font-bold py-2 rounded-lg hover:bg-emerald-600 disabled:opacity-50 text-sm"
                          >
                              Import Ingredients
                          </button>
                      </div>
                  )}

                  {/* Smart Add Bar */}
                  <form onSubmit={handleAddItem} className="mb-4 flex gap-2 relative">
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        ref={fileInputRef} 
                        onChange={handleImageChange} 
                        className="hidden" 
                      />
                      
                      <button 
                        type="button" 
                        onClick={handleCameraClick}
                        disabled={isAnalyzingImage}
                        className="bg-indigo-500 text-white p-2 rounded-lg hover:bg-indigo-600 disabled:opacity-50 flex-shrink-0 w-12 flex items-center justify-center"
                        title="Add from Image"
                      >
                          {isAnalyzingImage ? (
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                              <CameraIcon />
                          )}
                      </button>

                      <input 
                        type="text" 
                        value={newItemName}
                        onChange={e => setNewItemName(e.target.value)}
                        placeholder="Add item..."
                        className="flex-grow p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
                      />
                      <button type="submit" disabled={!newItemName.trim()} className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 disabled:opacity-50">
                          Add
                      </button>
                  </form>

                  <ul className="space-y-2">
                    {currentItems.map((item) => (
                        <li
                            key={item.id}
                            className="flex items-center space-x-3 p-3 bg-slate-50 rounded-md group hover:bg-slate-100 transition-colors"
                        >
                            <div 
                                onClick={() => handleToggleItem(item.id, !item.checked)}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer ${item.checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}
                            >
                                {item.checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <span 
                                onClick={() => handleToggleItem(item.id, !item.checked)}
                                className={`flex-1 cursor-pointer select-none ${item.checked ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}
                            >
                                {item.name}
                            </span>
                            <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity px-2"
                            >
                                <TrashIcon />
                            </button>
                        </li>
                    ))}
                    {currentItems.length === 0 && (
                        <li className="text-center text-slate-400 py-8 italic">List is empty. Add items, import from plan, or snap a photo.</li>
                    )}
                  </ul>
              </>
          ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <ClipboardListIcon />
                  <p className="mt-2">Select or create a list to view items.</p>
              </div>
          )}
      </div>
    </div>
  );
};
