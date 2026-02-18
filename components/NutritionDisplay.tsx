
import React from 'react';
import type { NutritionInfo } from '../types';

export const NutritionDisplay: React.FC<{ data: NutritionInfo }> = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 rounded-3xl p-6 border border-slate-700/50 shadow-sm">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-2xl font-black tracking-tight">{data.mealName}</h3>
          <div className="bg-emerald-500 text-slate-950 px-3 py-1 rounded-full text-xs font-black uppercase">
            {data.totalCalories} kcal
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <MacroPill label="Protein" value={data.totalProtein} color="bg-blue-500" />
          <MacroPill label="Carbs" value={data.totalCarbs} color="bg-amber-500" />
          <MacroPill label="Fat" value={data.totalFat} color="bg-rose-500" />
        </div>

        <div className="space-y-3">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">Ingredient Breakdown</h4>
          {data.ingredients.map((ing, i) => (
            <div key={i} className="flex justify-between items-center p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
              <div className="flex flex-col">
                <span className="font-bold text-sm">{ing.name}</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase">{ing.weightGrams}g est.</span>
              </div>
              <div className="text-right">
                <span className="font-black text-slate-200">{ing.calories} kcal</span>
                <div className="text-[9px] text-slate-500 font-black uppercase flex gap-1">
                  <span>P:{ing.protein}</span>
                  <span>C:{ing.carbs}</span>
                  <span>F:{ing.fat}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-emerald-500/5 border border-emerald-500/10 p-5 rounded-3xl italic text-sm text-emerald-400/80 leading-relaxed">
        <span className="font-black not-italic text-emerald-500 uppercase text-[10px] tracking-widest block mb-2">AI Clinical Insight</span>
        "{data.insight}"
      </div>
    </div>
  );
};

const MacroPill = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <div className="bg-slate-900 rounded-2xl p-3 border border-slate-800 flex flex-col items-center">
    <div className={`w-1.5 h-1.5 rounded-full ${color} mb-2 shadow-[0_0_8px_${color}]`}></div>
    <span className="text-xl font-black">{Math.round(value)}g</span>
    <span className="text-[9px] font-black uppercase text-slate-500 mt-1">{label}</span>
  </div>
);
