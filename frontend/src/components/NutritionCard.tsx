
import React from 'react';
import type { NutritionInfo } from '../types';
import { ArchiveIcon, PlusIcon } from './icons';

interface NutritionCardProps {
  data: NutritionInfo;
  onSaveToHistory: () => void;
}

const MacroRing: React.FC<{ label: string; value: number; unit: string; color: string; percentage: number }> = ({ label, value, unit, color, percentage }) => {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="40" cy="40" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-100" />
          <circle 
            cx="40" cy="40" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" 
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={color}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-bold text-slate-800">{Math.round(value)}{unit}</span>
        </div>
      </div>
      <span className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
    </div>
  );
};

export const NutritionCard: React.FC<NutritionCardProps> = ({ data, onSaveToHistory }) => {
  // Simple calculation for ring percentages based on common 2000cal / 150g prot / 250g carb / 65g fat targets
  const pPct = Math.min(100, (data.totalProtein / 50) * 100); // per meal target
  const cPct = Math.min(100, (data.totalCarbs / 80) * 100);
  const fPct = Math.min(100, (data.totalFat / 25) * 100);

  return (
    <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-slide-up mx-auto max-w-md">
      <div className="p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-3xl font-black text-slate-900 leading-tight">{data.mealName}</h2>
            <p className="text-slate-500 font-medium text-sm mt-1">Estimated from photo analysis</p>
          </div>
          <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-2xl font-black text-xl">
            {Math.round(data.totalCalories)} <span className="text-xs uppercase">kcal</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <MacroRing label="Protein" value={data.totalProtein} unit="g" color="text-sky-500" percentage={pPct} />
          <MacroRing label="Carbs" value={data.totalCarbs} unit="g" color="text-amber-500" percentage={cPct} />
          <MacroRing label="Fat" value={data.totalFat} unit="g" color="text-rose-500" percentage={fPct} />
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Ingredients Detected</h3>
          <div className="space-y-2">
            {data.ingredients.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                <div>
                  <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                  <p className="text-xs text-slate-400 font-medium">{Math.round(item.weightGrams)}g</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-700 text-sm">{Math.round(item.calories)} <span className="text-[10px] font-bold text-slate-400">CAL</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {data.justification && (
          <div className="mt-6 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
             <p className="text-xs text-indigo-700 italic leading-relaxed">
               <span className="font-bold uppercase not-italic mr-1">AI Insight:</span>
               {data.justification}
             </p>
          </div>
        )}
      </div>
      
      <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
        <button
          onClick={onSaveToHistory}
          className="flex-grow bg-slate-900 text-white font-bold py-4 px-6 rounded-2xl hover:bg-black transition-all flex items-center justify-center space-x-2 shadow-lg active:scale-95"
        >
          <ArchiveIcon />
          <span>Add to Daily Log</span>
        </button>
      </div>
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
};
