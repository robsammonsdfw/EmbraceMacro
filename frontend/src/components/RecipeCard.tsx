
import React, { useState } from 'react';
import type { Recipe } from '../types';
import { PlusIcon, UtensilsIcon } from './icons';
import { CookModeModal } from './CookModeModal';

const MacroPill: React.FC<{ label: string; value: number; unit: string; color: string }> = ({ label, value, unit, color }) => (
  <div className={`text-center p-2 rounded-lg ${color}`}>
    <p className="text-xs font-medium text-white/90">{label}</p>
    <p className="text-lg font-bold text-white">{Math.round(value)}{unit}</p>
  </div>
);

export const RecipeCard: React.FC<{ recipe: Recipe; onAddToPlan: () => void; }> = ({ recipe, onAddToPlan }) => {
  const [isCookMode, setIsCookMode] = useState(false);

  return (
    <>
        {isCookMode && <CookModeModal recipe={recipe} onClose={() => setIsCookMode(false)} />}
        
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-fade-in flex flex-col h-full">
          <div className="p-6 flex-grow">
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-2xl font-bold text-slate-800 leading-tight">{recipe.recipeName}</h3>
                <button 
                    onClick={() => setIsCookMode(true)}
                    className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 p-2 rounded-lg transition-colors"
                    title="Enter Cook Mode"
                >
                    <UtensilsIcon />
                </button>
            </div>
            
            <p className="text-slate-600 mt-1 mb-4 line-clamp-3">{recipe.description}</p>

            <div className="grid grid-cols-4 gap-2 mb-6">
              <div className="text-center p-2 rounded-lg bg-emerald-500">
                  <p className="text-xs font-medium text-white/90">Cals</p>
                  <p className="text-lg font-bold text-white">{Math.round(recipe.nutrition.totalCalories)}</p>
              </div>
              <MacroPill label="Pro" value={recipe.nutrition.totalProtein} unit="g" color="bg-sky-500" />
              <MacroPill label="Carb" value={recipe.nutrition.totalCarbs} unit="g" color="bg-amber-500" />
              <MacroPill label="Fat" value={recipe.nutrition.totalFat} unit="g" color="bg-rose-500" />
            </div>

            <div className="space-y-3">
                <details className="bg-slate-50 p-3 rounded-lg open:ring-2 open:ring-emerald-200 group">
                    <summary className="font-semibold text-slate-700 cursor-pointer text-sm flex items-center justify-between">
                        <span>Ingredients ({recipe.ingredients.length})</span>
                        <span className="text-slate-400 text-xs group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <ul className="mt-3 list-disc list-inside space-y-1 text-slate-600 text-sm">
                        {recipe.ingredients.map((ing: { name: string; quantity: string }, index: number) => (
                            <li key={index}>
                               <span className="font-medium text-slate-800">{ing.name}:</span> {ing.quantity}
                            </li>
                        ))}
                    </ul>
                </details>
                <details className="bg-slate-50 p-3 rounded-lg open:ring-2 open:ring-emerald-200 group">
                    <summary className="font-semibold text-slate-700 cursor-pointer text-sm flex items-center justify-between">
                        <span>Instructions ({recipe.instructions.length} steps)</span>
                        <span className="text-slate-400 text-xs group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <ol className="mt-3 list-decimal list-inside space-y-2 text-slate-600 text-sm">
                        {recipe.instructions.map((step: string, index: number) => (
                            <li key={index} className="pl-1">{step}</li>
                        ))}
                    </ol>
                </details>
            </div>
          </div>
           <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3">
            <button
              onClick={() => setIsCookMode(true)}
              className="flex-1 bg-indigo-100 text-indigo-700 font-bold py-3 px-4 rounded-lg hover:bg-indigo-200 transition-colors flex items-center justify-center space-x-2"
            >
              <UtensilsIcon />
              <span>Cook Mode</span>
            </button>
            <button
              onClick={onAddToPlan}
              className="flex-1 bg-emerald-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center space-x-2"
            >
              <PlusIcon />
              <span>Plan It</span>
            </button>
          </div>
        </div>
    </>
  );
};
