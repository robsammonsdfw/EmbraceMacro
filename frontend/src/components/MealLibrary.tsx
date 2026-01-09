
import React, { useState, useMemo } from 'react';
import type { SavedMeal, NutritionInfo } from '../types';
import { PlusIcon, TrashIcon, BookOpenIcon, CameraIcon, CameraOffIcon, SearchIcon, TagIcon } from './icons';
import { ImageViewModal } from './ImageViewModal';

interface MealLibraryProps {
  meals: SavedMeal[];
  onAdd: (meal: SavedMeal) => void;
  onDelete: (id: number) => void;
  onSelectMeal: (meal: NutritionInfo) => void;
  onManualLibraryAdd?: (query: string) => void;
  onScanClick?: () => void;
}

const MealCard: React.FC<{ 
    meal: SavedMeal; 
    onAdd: (meal: SavedMeal) => void; 
    onDelete: (id: number) => void;
    onViewImage: () => void;
    onDetails: () => void;
}> = ({ meal, onAdd, onDelete, onViewImage, onDetails }) => {
    // Only trust the hasImage flag, ignore imageUrl in list view as it won't be there
    const hasImage = meal.hasImage;

    return (
        <div 
            onClick={onDetails}
            className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition-all break-inside-avoid mb-4 flex flex-col cursor-pointer group/card"
        >
            {/* Image Header */}
            <div className="relative h-40 bg-slate-100 group cursor-pointer">
                {hasImage ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 group-hover:bg-slate-100 transition-colors">
                        <CameraIcon className="w-8 h-8 mb-2 opacity-50 group-hover:opacity-80" />
                        <span className="text-xs font-bold uppercase tracking-widest opacity-60">View Photo</span>
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-50">
                        <CameraOffIcon />
                    </div>
                )}
                
                {/* Overlay Actions */}
                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onAdd(meal); }} 
                        className="bg-emerald-500 text-white p-3 rounded-full hover:scale-110 transition-transform shadow-lg"
                        title="Add to Plan"
                    >
                        <PlusIcon />
                    </button>
                    {hasImage && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onViewImage(); }} 
                            className="bg-white text-slate-700 p-3 rounded-full hover:scale-110 transition-transform shadow-lg"
                            title="View Full Image"
                        >
                            <CameraIcon />
                        </button>
                    )}
                </div>
            </div>

            <div className="p-4 flex-grow">
                <div className="flex justify-between items-start mb-2">
                    <h4 className="font-black text-slate-800 text-sm leading-tight uppercase group-hover/card:text-indigo-600 transition-colors">{meal.mealName}</h4>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(meal.id); }} 
                        className="text-slate-200 hover:text-rose-500 p-1 transition-colors"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-3">
                    <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-emerald-100">{Math.round(meal.totalCalories)} kcal</span>
                    <span className="bg-blue-50 text-blue-700 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-blue-100">{Math.round(meal.totalProtein)}g Pro</span>
                </div>

                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Tap for Details
                </p>
            </div>
        </div>
    );
};

export const MealLibrary: React.FC<MealLibraryProps> = ({ meals, onAdd, onDelete, onSelectMeal, onManualLibraryAdd, onScanClick }) => {
  const [viewImageId, setViewImageId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'high-protein' | 'low-carb'>('all');

  const handleManualAddSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (manualInput.trim() && onManualLibraryAdd) {
          onManualLibraryAdd(manualInput);
          setManualInput('');
      }
  };

  const filteredMeals = useMemo(() => {
      let result = meals;
      
      // Search
      if (search) {
          const lower = search.toLowerCase();
          result = result.filter(m => m.mealName.toLowerCase().includes(lower));
      }

      // Filter
      if (filterType === 'high-protein') {
          result = result.filter(m => m.totalProtein > 30);
      } else if (filterType === 'low-carb') {
          result = result.filter(m => m.totalCarbs < 20);
      }

      return result;
  }, [meals, search, filterType]);

  return (
    <div className="flex flex-col md:flex-row gap-6 min-h-[600px] animate-fade-in">
        {/* Sidebar Filters (Desktop) */}
        <div className="w-full md:w-64 flex-shrink-0 space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                    <SearchIcon className="w-4 h-4" /> Library Filter
                </h3>
                <input 
                    type="text" 
                    placeholder="Search meals..." 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold mb-4 focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                
                <div className="space-y-1">
                    <label className="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer p-2 hover:bg-slate-50 rounded-xl transition-colors">
                        <input 
                            type="radio" 
                            name="filter" 
                            checked={filterType === 'all'} 
                            onChange={() => setFilterType('all')}
                            className="w-4 h-4 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="font-bold">All Records</span>
                    </label>
                    <label className="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer p-2 hover:bg-slate-50 rounded-xl transition-colors">
                        <input 
                            type="radio" 
                            name="filter" 
                            checked={filterType === 'high-protein'} 
                            onChange={() => setFilterType('high-protein')}
                            className="w-4 h-4 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="font-bold">High Protein</span>
                    </label>
                    <label className="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer p-2 hover:bg-slate-50 rounded-xl transition-colors">
                        <input 
                            type="radio" 
                            name="filter" 
                            checked={filterType === 'low-carb'} 
                            onChange={() => setFilterType('low-carb')}
                            className="w-4 h-4 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="font-bold">Low Carb</span>
                    </label>
                </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl">
                <h4 className="text-indigo-800 font-black uppercase tracking-widest text-[10px] mb-3 flex items-center gap-1">
                    <TagIcon className="w-3 h-3" /> Quick Collections
                </h4>
                <div className="flex flex-wrap gap-2">
                    <span className="bg-white text-indigo-600 text-[10px] font-black uppercase px-2 py-1 rounded border border-indigo-100 shadow-sm">Breakfast</span>
                    <span className="bg-white text-indigo-600 text-[10px] font-black uppercase px-2 py-1 rounded border border-indigo-100 shadow-sm">Cheat Meals</span>
                    <span className="bg-white text-indigo-600 text-[10px] font-black uppercase px-2 py-1 rounded border border-indigo-100 shadow-sm">High Satiety</span>
                </div>
            </div>
        </div>

        {/* Main Grid */}
        <div className="flex-grow">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100 min-h-full">
                <div className="flex justify-between items-center mb-6 px-2">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Kitchen Library</h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{filteredMeals.length} Verified Entries</p>
                    </div>
                    <BookOpenIcon className="text-slate-200 w-8 h-8" />
                </div>

                {/* Add New Bar */}
                <form onSubmit={handleManualAddSubmit} className="flex gap-2 mb-8 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                    <button 
                        type="button" 
                        onClick={onScanClick}
                        className="bg-white text-emerald-500 p-3 rounded-xl shadow-sm hover:scale-105 transition-transform"
                    >
                        <CameraIcon className="w-5 h-5" />
                    </button>
                    <input 
                        type="text" 
                        placeholder="Add new meal by name..." 
                        value={manualInput}
                        onChange={e => setManualInput(e.target.value)}
                        className="flex-grow bg-transparent outline-none font-bold text-slate-700 px-2"
                    />
                    <button 
                        type="submit" 
                        disabled={!manualInput.trim()}
                        className="bg-slate-900 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-colors disabled:opacity-50"
                    >
                        Add
                    </button>
                </form>

                {viewImageId && (
                    <ImageViewModal 
                        itemId={viewImageId} 
                        type="saved" 
                        onClose={() => setViewImageId(null)} 
                    />
                )}

                {filteredMeals.length > 0 ? (
                    <div className="columns-1 md:columns-2 gap-6 space-y-6">
                        {filteredMeals.map((meal) => (
                            <MealCard 
                                key={meal.id} 
                                meal={meal} 
                                onAdd={onAdd} 
                                onDelete={onDelete} 
                                onViewImage={() => setViewImageId(meal.id)}
                                onDetails={() => onSelectMeal(meal)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-24 px-4 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                        <div className="mx-auto bg-white shadow-inner text-slate-300 rounded-full w-24 h-24 flex items-center justify-center mb-6">
                            <BookOpenIcon className="w-10 h-10" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 mb-2">No meals in this collection</h3>
                        <p className="text-slate-500 font-medium max-w-xs mx-auto">Use the bar above or the camera to populate your library.</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
