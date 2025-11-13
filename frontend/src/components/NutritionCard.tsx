import React from 'react';
import type { NutritionInfo } from '../types';
import { ArchiveIcon } from './icons';

interface NutritionCardProps {
  data: NutritionInfo;
  onSaveToHistory: () => void;
}

const MacroPill: React.FC<{ label: string; value: number; unit: string; color: string }> = ({ label, value, unit, color }) => (
  <div className={`text-center p-3 rounded-lg ${color}`}>
    <p className="text-sm font-medium text-white/90">{label}</p>
    <p className="text-2xl font-bold text-white">{Math.round(value)}{unit}</p>
  </div>
);

export const NutritionCard: React.FC<NutritionCardProps> = ({ data, onSaveToHistory }) => {
  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-fade-in">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">{data.mealName}</h2>
        <p className="text-4xl font-extrabold text-emerald-500 mb-4">{Math.round(data.totalCalories)} <span className="text-2xl text-slate-500">kcal</span></p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <MacroPill label="Protein" value={data.totalProtein} unit="g" color="bg-sky-500" />
          <MacroPill label="Carbs" value={data.totalCarbs} unit="g" color="bg-amber-500" />
          <MacroPill label="Fat" value={data.totalFat} unit="g" color="bg-rose-500" />
        </div>

        <h3 className="text-lg font-semibold text-slate-700 mb-3">Ingredients Breakdown</h3>
        <ul className="space-y-2 mb-4">
          {data.ingredients.map((item, index) => (
            <li key={index} className="flex justify-between items-center bg-slate-50 p-3 rounded-md">
              <div>
                <p className="font-semibold text-slate-800">{item.name}</p>
                <p className="text-sm text-slate-500">{Math.round(item.weightGrams)}g</p>
              </div>
              <div className="text-right">
                <p className="font-medium text-slate-700">{Math.round(item.calories)} kcal</p>
                <p className="text-xs text-slate-500">
                  P:{Math.round(item.protein)}g C:{Math.round(item.carbs)}g F:{Math.round(item.fat)}g
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      
      <div className="p-4 bg-slate-50 border-t border-slate-200">
        <button
          onClick={onSaveToHistory}
          className="w-full bg-emerald-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center space-x-2"
        >
          <ArchiveIcon />
          <span>Save to History</span>
        </button>
      </div>
    </div>
  );
};