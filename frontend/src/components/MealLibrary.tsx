
import React, { useState, useMemo } from 'react';
import type { SavedMeal } from '../types';
import { PlusIcon, TrashIcon, BookOpenIcon, CameraIcon, CameraOffIcon, SearchIcon, TagIcon } from './icons';
import { ImageViewModal } from './ImageViewModal';

interface MealLibraryProps {
  meals: SavedMeal[];
  onAdd: (meal: SavedMeal) => void;
  onDelete: (id: number) => void;
}

const MealCard: React.FC<{ 
    meal: SavedMeal; 
    onAdd: (meal: SavedMeal) => void; 
    onDelete: (id: number) => void;
    onViewImage: () => void;
}> = ({ meal, onAdd, onDelete, onViewImage }) => {
    const hasImage = meal.hasImage;

    return (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition-all break-inside-avoid mb-4 flex flex-col">
            {/* Image Header */}
            <div className="relative h-40 bg-slate-100 group cursor-pointer" onClick={hasImage ? onViewImage : undefined}>
                {hasImage && meal.imageUrl ? (
                     <div className="w-full h-full bg-cover bg-center" style={{backgroundImage: `url(${meal.imageUrl})`}}></div>
                ) : hasImage ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                        <CameraIcon />
                        <span className="text-xs font-bold mt-1">View Image</span>
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-50">
                        <CameraOffIcon />
                    </div>
                )}
                
                {/* Overlay Actions */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button onClick={onAdd} className="bg-emerald-500 text-white p-2 rounded-full hover:scale-110 transition-transform"><PlusIcon /></button>
                </div>
            </div>

            <div className="p-4 flex-grow">
                <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-slate-800 text-lg leading-tight">{meal.mealName}</h4>
                    <button onClick={() => onDelete(meal.id)} className="text-slate-300 hover:text-red-500"><TrashIcon /></button>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-3">
                    <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2 py-1 rounded">{Math.round(meal.totalCalories)} kcal</span>
                    <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded">{Math.round(meal.totalProtein)}g Pro</span>
                </div>

                {meal.ingredients.length > 0 && (
                    <p className="text-xs text-slate-500 line-clamp-2">
                        {meal.ingredients.map(i => i.name).join(', ')}
                    </p>
                )}
            </div>
        </div>
    );
};

export const MealLibrary: React.FC<MealLibraryProps> = ({ meals, onAdd, onDelete }) => {
  const [viewImageId, setViewImageId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'high-protein' | 'low-carb'>('all');

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
    <div className="flex flex-col md:flex-row gap-6 min-h-[600px]">
        {/* Sidebar Filters (Desktop) */}
        <div className="w-full md:w-64 flex-shrink-0 space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <SearchIcon /> Filter
                </h3>
                <input 
                    type="text" 
                    placeholder="Search meals..." 
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm mb-4 focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                
                <div className="space-y-1">
                    <label className="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer p-2 hover:bg-slate-50 rounded">
                        <input 
                            type="radio" 
                            name="filter" 
                            checked={filterType === 'all'} 
                            onChange={() => setFilterType('all')}
                            className="text-emerald-500 focus:ring-emerald-500"
                        />
                        <span>All Meals</span>
                    </label>
                    <label className="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer p-2 hover:bg-slate-50 rounded">
                        <input 
                            type="radio" 
                            name="filter" 
                            checked={filterType === 'high-protein'} 
                            onChange={() => setFilterType('high-protein')}
                            className="text-emerald-500 focus:ring-emerald-500"
                        />
                        <span>High Protein {'>'} 30g</span>
                    </label>
                    <label className="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer p-2 hover:bg-slate-50 rounded">
                        <input 
                            type="radio" 
                            name="filter" 
                            checked={filterType === 'low-carb'} 
                            onChange={() => setFilterType('low-carb')}
                            className="text-emerald-500 focus:ring-emerald-500"
                        />
                        <span>Low Carb {'<'} 20g</span>
                    </label>
                </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
                <h4 className="text-indigo-800 font-bold text-sm mb-2 flex items-center gap-1">
                    <TagIcon /> Smart Categories
                </h4>
                <div className="flex flex-wrap gap-2">
                    <span className="bg-white text-indigo-600 text-xs px-2 py-1 rounded border border-indigo-100">Breakfast</span>
                    <span className="bg-white text-indigo-600 text-xs px-2 py-1 rounded border border-indigo-100">Quick</span>
                    <span className="bg-white text-indigo-600 text-xs px-2 py-1 rounded border border-indigo-100">Favorites</span>
                </div>
            </div>
        </div>

        {/* Main Grid */}
        <div className="flex-grow">
            <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 min-h-full">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-800">My Kitchen Library</h2>
                    <span className="text-sm text-slate-500">{filteredMeals.length} recipes</span>
                </div>

                {viewImageId && (
                    <ImageViewModal 
                        itemId={viewImageId} 
                        type="saved" 
                        onClose={() => setViewImageId(null)} 
                    />
                )}

                {filteredMeals.length > 0 ? (
                    <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
                        {filteredMeals.map((meal) => (
                            <MealCard 
                                key={meal.id} 
                                meal={meal} 
                                onAdd={onAdd} 
                                onDelete={onDelete} 
                                onViewImage={() => setViewImageId(meal.id)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 px-4">
                        <div className="mx-auto bg-slate-100 text-slate-400 rounded-full w-20 h-20 flex items-center justify-center mb-4">
                            <BookOpenIcon />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-700 mt-2">No meals found.</h3>
                        <p className="text-slate-500 mt-1 max-w-sm mx-auto">Try adjusting your filters or analyze a new meal to save it here.</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
