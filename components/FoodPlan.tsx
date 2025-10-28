
import React from 'react';
import type { Ingredient } from '../types';
import { TrashIcon } from './icons';

interface FoodPlanProps {
  items: Ingredient[];
  onRemove: (index: number) => void;
}

export const FoodPlan: React.FC<FoodPlanProps> = ({ items, onRemove }) => {
  const totals = items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-800 mb-4">Today's Food Plan</h2>
      
      <div className="mb-6 p-4 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-lg text-white">
        <h3 className="text-lg font-bold">Total Intake</h3>
        <p className="text-3xl font-extrabold">{Math.round(totals.calories)} kcal</p>
        <div className="grid grid-cols-3 gap-2 mt-2 text-center text-sm">
          <div><span className="font-bold">{Math.round(totals.protein)}g</span> Protein</div>
          <div><span className="font-bold">{Math.round(totals.carbs)}g</span> Carbs</div>
          <div><span className="font-bold">{Math.round(totals.fat)}g</span> Fat</div>
        </div>
      </div>

      <ul className="space-y-3">
        {items.map((item, index) => (
          <li key={index} className="flex justify-between items-center bg-slate-50 p-3 rounded-md hover:bg-slate-100 transition-colors">
            <div>
              <p className="font-semibold text-slate-800">{item.name}</p>
              <p className="text-sm text-slate-500">{Math.round(item.calories)} kcal &bull; {Math.round(item.weightGrams)}g</p>
            </div>
            <button
              onClick={() => onRemove(index)}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-100 rounded-full transition-colors"
              aria-label={`Remove ${item.name}`}
            >
              <TrashIcon />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
