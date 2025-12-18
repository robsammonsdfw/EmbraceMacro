
import React from 'react';
import type { NutritionInfo } from '../types';
import { ArchiveIcon } from './icons';

interface NutritionCardProps {
  data: NutritionInfo;
  onSaveToHistory: () => void;
}

export const NutritionCard: React.FC<NutritionCardProps> = ({ data, onSaveToHistory }) => {
  return (
    <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-fade-in mx-auto max-w-md">
      <div className="p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-3xl font-black text-slate-900 leading-tight">{data.mealName}</h2>
            <p className="text-slate-500 font-medium text-sm mt-1">AI Photo Analysis</p>
          </div>
          <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-2xl font-black text-xl">
            {Math.round(data.totalCalories)} <span className="text-xs uppercase">kcal</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8 text-center">
          <div className="bg-slate-50 p-3 rounded-xl"><p className="text-xs font-bold text-slate-400">P</p><p className="font-black">{Math.round(data.totalProtein)}g</p></div>
          <div className="bg-slate-50 p-3 rounded-xl"><p className="text-xs font-bold text-slate-400">C</p><p className="font-black">{Math.round(data.totalCarbs)}g</p></div>
          <div className="bg-slate-50 p-3 rounded-xl"><p className="text-xs font-bold text-slate-400">F</p><p className="font-black">{Math.round(data.totalFat)}g</p></div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Ingredients</h3>
          <div className="space-y-2">
            {data.ingredients.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <div>
                  <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                  <p className="text-xs text-slate-400">{Math.round(item.weightGrams)}g</p>
                </div>
                <p className="font-black text-slate-700 text-sm">{Math.round(item.calories)} CAL</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="p-6 bg-slate-50 border-t border-slate-100">
        <button
          onClick={onSaveToHistory}
          className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-black transition-all flex items-center justify-center space-x-2 shadow-lg"
        >
          <ArchiveIcon />
          <span>Add to Daily Log</span>
        </button>
      </div>
    </div>
  );
};
