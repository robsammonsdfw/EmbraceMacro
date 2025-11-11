import React from 'react';
import type { SavedMeal } from '../types.ts';
import { PlusIcon, TrashIcon, BookOpenIcon } from './icons.tsx';

interface MealLibraryProps {
  meals: SavedMeal[];
  onAdd: (meal: SavedMeal) => void;
  onDelete: (id: string) => void;
}

const MealCard: React.FC<{ meal: SavedMeal; onAdd: (meal: SavedMeal) => void; onDelete: (id: string) => void;}> = ({ meal, onAdd, onDelete }) => (
    <div className="bg-slate-50 p-4 rounded-lg flex items-center justify-between hover:bg-slate-100 transition-colors">
        <div className="flex items-center space-x-4">
            {meal.imageUrl && <img src={meal.imageUrl} alt={meal.mealName} className="w-16 h-16 rounded-md object-cover" />}
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


export const MealLibrary: React.FC<MealLibraryProps> = ({ meals, onAdd, onDelete }) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-800 mb-4">My Saved Meals</h2>
      {meals.length > 0 ? (
        <ul className="space-y-3">
          {meals.map((meal) => (
            <li key={meal.id}>
                <MealCard meal={meal} onAdd={onAdd} onDelete={onDelete} />
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