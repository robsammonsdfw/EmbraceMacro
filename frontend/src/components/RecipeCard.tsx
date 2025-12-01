import React from 'react';
import type { Recipe } from '../types';
import { PlusIcon } from './icons';

const MacroPill: React.FC<{ label: string; value: number; unit: string; color: string }> = ({ label, value, unit, color }) => (
  <div className={`text-center p-2 rounded-lg ${color}`}>
    <p className="text-xs font-medium text-white/90">{label}</p>
    <p className="text-lg font-bold text-white">{Math.round(value)}{unit}</p>
  </div>
);

export const RecipeCard: React.FC<{ recipe: Recipe; onAddToPlan: () => void; }> = ({ recipe, onAddToPlan }) => {
  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-fade-in">
      <div className="p-6">
        <h3 className="text-2xl font-bold text-slate-800">{recipe.recipeName}</h3>
        <p className="text-slate-600 mt-1 mb-4">{recipe.description}</p>

        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="text-center p-3 rounded-lg bg-emerald-500">
              <p className="text-sm font-medium text-white/90">Calories</p>
              <p className="text-2xl font-bold text-white">{Math.round(recipe.nutrition.totalCalories)}</p>
          </div>
          <MacroPill label="Protein" value={recipe.nutrition.totalProtein} unit="g" color="bg-sky-500" />
          <MacroPill label="Carbs" value={recipe.nutrition.totalCarbs} unit="g" color="bg-amber-500" />
          <MacroPill label="Fat" value={recipe.nutrition.totalFat} unit="g" color="bg-rose-500" />
        </div>

        <div className="space-y-4">
            <details className="bg-slate-50 p-4 rounded-lg open:ring-2 open:ring-emerald-200">
                <summary className="font-semibold text-slate-700 cursor-pointer">Ingredients</summary>
                <ul className="mt-3 list-disc list-inside space-y-1 text-slate-600">
                    {recipe.ingredients.map((ing: { name: string; quantity: string }, index: number) => (
                        <li key={index}>
                           <span className="font-medium text-slate-800">{ing.name}:</span> {ing.quantity}
                        </li>
                    ))}
                </ul>
            </details>
            <details className="bg-slate-50 p-4 rounded-lg open:ring-2 open:ring-emerald-200">
                <summary className="font-semibold text-slate-700 cursor-pointer">Instructions</summary>
                <ol className="mt-3 list-decimal list-inside space-y-2 text-slate-600">
                    {recipe.instructions.map((step: string, index: number) => (
                        <li key={index} className="pl-2">{step}</li>
                    ))}
                </ol>
            </details>
        </div>
      </div>
       <div className="p-4 bg-slate-50 border-t border-slate-200">
        <button
          onClick={onAddToPlan}
          className="w-full bg-emerald-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center space-x-2"
        >
          <PlusIcon />
          <span>Add to Today's Plan</span>
          <span className="ml-1 bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded border border-white/20">+5 pts</span>
        </button>
      </div>
    </div>
  );
};