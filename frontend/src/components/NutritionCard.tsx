import React, { useState, useEffect } from 'react';
import type { NutritionInfo } from '../types';
import { ArchiveIcon, CheckIcon, LightBulbIcon } from './icons';

interface NutritionCardProps {
  data: NutritionInfo;
  onSaveToHistory: (updatedData: NutritionInfo) => void;
}

export const NutritionCard: React.FC<NutritionCardProps> = ({ data, onSaveToHistory }) => {
  const [localData, setLocalData] = useState<NutritionInfo>(data);
  const [tweakingIdx, setTweakingIdx] = useState<number | null>(null);
  const [showMicros, setShowMicros] = useState(false);

  // Recalculate totals whenever ingredients change
  useEffect(() => {
    const ingredients = localData.ingredients;
    const totals = ingredients.reduce((acc, ing) => ({
      calories: acc.calories + ing.calories,
      protein: acc.protein + ing.protein,
      carbs: acc.carbs + ing.carbs,
      fat: acc.fat + ing.fat,
      potassium: acc.potassium + (ing.potassium || 0),
      magnesium: acc.magnesium + (ing.magnesium || 0),
      vitaminD: acc.vitaminD + (ing.vitaminD || 0),
      calcium: acc.calcium + (ing.calcium || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0, potassium: 0, magnesium: 0, vitaminD: 0, calcium: 0 });

    setLocalData(prev => ({
      ...prev,
      totalCalories: totals.calories,
      totalProtein: totals.protein,
      totalCarbs: totals.carbs,
      totalFat: totals.fat,
      totalPotassium: totals.potassium,
      totalMagnesium: totals.magnesium,
      totalVitaminD: totals.vitaminD,
      totalCalcium: totals.calcium
    }));
  }, [localData.ingredients]);

  const handleWeightChange = (idx: number, newWeight: number) => {
    const ingredients = [...localData.ingredients];
    const ing = ingredients[idx];
    const originalWeight = data.ingredients[idx].weightGrams;
    const multiplier = newWeight / originalWeight;

    // Scale all macros based on new weight relative to AI estimate
    ingredients[idx] = {
      ...ing,
      weightGrams: newWeight,
      calories: data.ingredients[idx].calories * multiplier,
      protein: data.ingredients[idx].protein * multiplier,
      carbs: data.ingredients[idx].carbs * multiplier,
      fat: data.ingredients[idx].fat * multiplier,
      potassium: (data.ingredients[idx].potassium || 0) * multiplier,
      magnesium: (data.ingredients[idx].magnesium || 0) * multiplier,
      vitaminD: (data.ingredients[idx].vitaminD || 0) * multiplier,
      calcium: (data.ingredients[idx].calcium || 0) * multiplier,
    };

    setLocalData(prev => ({ ...prev, ingredients }));
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden animate-fade-in mx-auto max-w-md relative">
      <div className="p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-3xl font-black text-slate-900 leading-tight">{localData.mealName}</h2>
            <div className="flex items-center gap-2 mt-1">
               <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
                 <CheckIcon className="w-2.5 h-2.5" /> AI Verified
               </span>
            </div>
          </div>
          <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-2xl font-black text-xl">
            {Math.round(localData.totalCalories)} <span className="text-xs uppercase">kcal</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8 text-center">
          <div className="bg-slate-50 p-3 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Protein</p><p className="font-black text-lg">{Math.round(localData.totalProtein)}g</p></div>
          <div className="bg-slate-50 p-3 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Carbs</p><p className="font-black text-lg">{Math.round(localData.totalCarbs)}g</p></div>
          <div className="bg-slate-50 p-3 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fat</p><p className="font-black text-lg">{Math.round(localData.totalFat)}g</p></div>
        </div>

        <div className="space-y-4 mb-8">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Adjust Quantities</h3>
          <div className="space-y-3">
            {localData.ingredients.map((item, idx) => (
              <div key={idx} className="space-y-2">
                <button 
                  onClick={() => setTweakingIdx(tweakingIdx === idx ? null : idx)}
                  className={`w-full flex justify-between items-center p-4 rounded-2xl transition-all ${tweakingIdx === idx ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 hover:bg-slate-100'}`}
                >
                  <div className="text-left">
                    <p className="font-black text-sm">{item.name}</p>
                    <p className={`text-[10px] font-bold uppercase ${tweakingIdx === idx ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {Math.round(item.weightGrams)}g • {Math.round(item.calories)} Cal
                    </p>
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${tweakingIdx === idx ? 'bg-white/20' : 'bg-slate-200 text-slate-500'}`}>
                    Tweak
                  </div>
                </button>
                
                {tweakingIdx === idx && (
                    <div className="p-4 bg-indigo-50 rounded-2xl animate-fade-in">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-black uppercase text-indigo-400">Weight Control</span>
                            <span className="text-sm font-black text-indigo-600">{Math.round(item.weightGrams)}g</span>
                        </div>
                        <input 
                            type="range" min="10" max="1000" step="5"
                            value={item.weightGrams}
                            onChange={(e) => handleWeightChange(idx, parseInt(e.target.value))}
                            className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                    </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Micronutrients Section */}
        <div className="border-t border-slate-100 pt-6">
            <button 
                onClick={() => setShowMicros(!showMicros)}
                className="w-full flex items-center justify-between group"
            >
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <LightBulbIcon className="w-3 h-3" /> Detailed Micronutrients
                </h3>
                <span className="text-slate-300 font-black group-hover:text-slate-500 transition-colors">{showMicros ? '−' : '+'}</span>
            </button>
            
            {showMicros && (
                <div className="grid grid-cols-2 gap-3 mt-4 animate-fade-in">
                    <div className="bg-slate-50 p-3 rounded-xl flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-500">Potassium</span>
                        <span className="text-xs font-black text-slate-700">{Math.round(localData.totalPotassium || 0)}mg</span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-500">Magnesium</span>
                        <span className="text-xs font-black text-slate-700">{Math.round(localData.totalMagnesium || 0)}mg</span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-500">Vitamin D</span>
                        <span className="text-xs font-black text-slate-700">{Math.round(localData.totalVitaminD || 0)}µg</span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-500">Calcium</span>
                        <span className="text-xs font-black text-slate-700">{Math.round(localData.totalCalcium || 0)}mg</span>
                    </div>
                </div>
            )}
        </div>
      </div>
      
      <div className="p-6 bg-slate-50 border-t border-slate-100">
        <button
          onClick={() => onSaveToHistory(localData)}
          className="w-full bg-slate-900 text-white font-black py-5 rounded-3xl hover:bg-black transition-all flex items-center justify-center space-x-3 shadow-xl group"
        >
          <ArchiveIcon className="group-hover:scale-110 transition-transform" />
          <span className="tracking-widest uppercase text-sm">Commit to Log</span>
        </button>
      </div>
    </div>
  );
};