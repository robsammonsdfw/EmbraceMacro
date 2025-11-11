import React from 'react';
import type { NutritionInfo, Ingredient } from '../types';
import { PlusIcon, BookmarkIcon } from './icons';

interface MealSuggestionCardProps {
  meal: NutritionInfo;
  onAddToPlan: (ingredients: Ingredient[]) => void;
  onSaveMeal: (meal: NutritionInfo) => void;
}

const MacroPill: React.FC<{ label: string; value: number; unit: string; color: string }> = ({ label, value, unit, color }) => (
    <div className={`text-center p-2 rounded-lg ${color}`}>
      <p className="text-xs font-medium text-white/90">{label}</p>
      <p className="text-lg font-bold text-white">{Math.round(value)}{unit}</p>
    </div>
);

export const MealSuggestionCard: React.FC<MealSuggestionCardProps> = ({ meal, onAddToPlan, onSaveMeal }) => {
  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-fade-in">
      <div className="p-5">
        <h3 className="text-xl font-bold text-slate-800 mb-2">{meal.mealName}</h3>
        
        {meal.justification && (
          <p className="text-sm text-slate-600 mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <span className="font-semibold text-emerald-700">Why it's a good choice:</span> {meal.justification}
          </p>
        )}

        <div className="flex items-center space-x-2 mb-4">
            <p className="text-2xl font-extrabold text-emerald-500">{Math.round(meal.totalCalories)}</p>
            <span className="text-lg text-slate-500 font-medium">kcal</span>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <MacroPill label="Protein" value={meal.totalProtein} unit="g" color="bg-sky-500" />
          <MacroPill label="Carbs" value={meal.totalCarbs} unit="g" color="bg-amber-500" />
          <MacroPill label="Fat" value={meal.totalFat} unit="g" color="bg-rose-500" />
        </div>
      </div>
      
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-2">
        <button
          onClick={() => onSaveMeal(meal)}
          className="w-full bg-slate-600 text-white font-bold py-2 px-3 rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center space-x-2 text-sm"
        >
          <BookmarkIcon />
          <span>Save Meal</span>
        </button>
        <button
          onClick={() => onAddToPlan(meal.ingredients)}
          className="w-full bg-emerald-500 text-white font-bold py-2 px-3 rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center space-x-2 text-sm"
        >
          <PlusIcon />
          <span>Add to Plan</span>
        </button>
      </div>
    </div>
  );
};