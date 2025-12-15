
import React, { useState } from 'react';
import type { SavedMeal } from '../types';
import { PlusIcon, TrashIcon, BookOpenIcon, CameraIcon, CameraOffIcon } from './icons';
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
        <div className="bg-slate-50 p-4 rounded-lg flex items-center justify-between hover:bg-slate-100 transition-colors">
            <div className="flex items-center space-x-4">
                 {hasImage ? (
                    <button 
                        onClick={onViewImage}
                        className="w-16 h-16 bg-slate-200 rounded-md flex flex-col items-center justify-center text-slate-500 hover:bg-slate-300 transition-colors flex-shrink-0"
                        title="View Image"
                    >
                        <CameraIcon />
                    </button>
                 ) : (
                    <div className="w-16 h-16 bg-slate-100 rounded-md flex flex-col items-center justify-center text-slate-300 border border-slate-200 flex-shrink-0" title="No Image">
                        <CameraOffIcon />
                    </div>
                 )}
                <div>
                    <p className="font-bold text-slate-800">{meal.mealName}</p>
                    <p className="text-sm text-slate-500">{Math.round(meal.totalCalories)} kcal</p>
                    <p className="text-xs text-slate-500">
                        P:{Math.round(meal.totalProtein)}g C:{Math.round(meal.totalCarbs)}g F:{Math.round(meal.totalFat)}g
                    </p>
                </div>
            </div>
            <div className="flex items-center space-x-2">
                <button
                    onClick={() => onAdd(meal)}
                    className="p-2 text-emerald-500 hover:bg-emerald-100 rounded-full transition-colors"
                    aria-label={`Add ${meal.mealName} to today's plan`}
                >
                    <PlusIcon />
                </button>
                <button
                    onClick={() => onDelete(meal.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-100 rounded-full transition-colors"
                    aria-label={`Delete ${meal.mealName}`}
                >
                    <TrashIcon />
                </button>
            </div>
        </div>
    );
};


export const MealLibrary: React.FC<MealLibraryProps> = ({ meals, onAdd, onDelete }) => {
  const [viewImageId, setViewImageId] = useState<number | null>(null);

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-800 mb-4">My Saved Meals</h2>
      {viewImageId && (
          <ImageViewModal 
            itemId={viewImageId} 
            type="saved" 
            onClose={() => setViewImageId(null)} 
          />
      )}

      {meals.length > 0 ? (
        <ul className="space-y-3">
          {meals.map((meal) => (
            <li key={meal.id}>
                <MealCard 
                    meal={meal} 
                    onAdd={onAdd} 
                    onDelete={onDelete} 
                    onViewImage={() => setViewImageId(meal.id)}
                />
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-center py-10 px-4 bg-slate-50 rounded-lg">
            <div className="mx-auto bg-slate-100 text-slate-500 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                <BookOpenIcon />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mt-2">Your meal library is empty.</h3>
            <p className="text-slate-500 mt-1">Analyze a meal or scan a product and save it to get started!</p>
        </div>
      )}
    </div>
  );
};
