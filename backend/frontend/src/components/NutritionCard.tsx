
import React, { useState, useEffect, useRef } from 'react';
import type { NutritionInfo } from '../types';
import { ArchiveIcon, CheckIcon, LightBulbIcon } from './icons';

interface NutritionCardProps {
  data: NutritionInfo;
  onSaveToHistory: (updatedData: NutritionInfo) => void;
  isReadOnly?: boolean;
}

export const NutritionCard: React.FC<NutritionCardProps> = ({ data, onSaveToHistory, isReadOnly }) => {
  const [localData, setLocalData] = useState<NutritionInfo>(data);
  const [tweakingIdx, setTweakingIdx] = useState<number | null>(null);
  const [showMicros, setShowMicros] = useState(false);
  
  const isDirtyRef = useRef(false);

  useEffect(() => {
    if (!isDirtyRef.current) return;

    const ingredients = localData.ingredients;
    const totals = ingredients.reduce((acc, ing) => ({
      calories: acc.calories + (ing.calories || 0),
      protein: acc.protein + (ing.protein || 0),
      carbs: acc.carbs + (ing.carbs || 0),
      fat: acc.fat + (ing.fat || 0),
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
    if (isReadOnly) return;
    isDirtyRef.current = true;
    const ingredients = [...localData.ingredients];
    const ing = ingredients[idx];
    const originalWeight = data.ingredients[idx].weightGrams || 100;
    const multiplier = newWeight / originalWeight;

    ingredients[idx] = {
      ...ing,
      weightGrams: newWeight,
      calories: (data.ingredients[idx].calories || 0) * multiplier,
      protein: (data.ingredients[idx].protein || 0) * multiplier,
      carbs: (data.ingredients[idx].carbs || 0) * multiplier,
      fat: (data.ingredients[idx].fat || 0) * multiplier,
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
        <div className="mb-6 flex justify-between items-start">
            <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 shadow-sm animate-pulse">
                MacrosChef Engine v4.0
            </div>
            <div className="flex items-center gap-1 text-slate-300">
                <CheckIcon className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase">Clinical Verification</span>
            </div>
        </div>
        
        <div className="flex justify-between items-start mb-6">
          <div className="max-w-[70%]">
            <h2 className="text-3xl font-black text-slate-900 leading-tight break-words">{localData.mealName}</h2>
          </div>
          <div className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl font-black text-2xl shrink-0 shadow-lg">
            {Math.round(localData.totalCalories)} <span className="text-[10px] uppercase font-black opacity-60">kcal</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8 text-center">
          <div className="bg-slate-50 p-4 rounded-[2rem] border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Protein</p><p className="font-black text-xl text-indigo-600">{Math.round(localData.totalProtein)}g</p></div>
          <div className="bg-slate-50 p-4 rounded-[2rem] border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Carbs</p><p className="font-black text-xl text-amber-600">{Math.round(localData.totalCarbs)}g</p></div>
          <div className="bg-slate-50 p-4 rounded-[2rem] border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Fat</p><p className="font-black text-xl text-rose-600">{Math.round(localData.totalFat)}g</p></div>
        </div>

        <div className="space-y-4 mb-8">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Constituent Ingredients</h3>
          <div className="space-y-2">
            {localData.ingredients.map((item, idx) => (
              <div key={idx} className="space-y-2">
                <button 
                  onClick={() => !isReadOnly && setTweakingIdx(tweakingIdx === idx ? null : idx)}
                  className={`w-full flex justify-between items-center p-5 rounded-3xl transition-all ${tweakingIdx === idx ? 'bg-indigo-600 text-white shadow-xl scale-[1.02]' : 'bg-slate-50 hover:bg-slate-100 border border-slate-100'}`}
                >
                  <div className="text-left">
                    <p className="font-black text-sm uppercase tracking-tight">{item.name}</p>
                    <p className={`text-[10px] font-bold uppercase ${tweakingIdx === idx ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {Math.round(item.weightGrams)}g • {Math.round(item.calories || 0)} Cal
                    </p>
                  </div>
                  {!isReadOnly && (
                      <div className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase ${tweakingIdx === idx ? 'bg-white text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                        Adjust
                      </div>
                  )}
                </button>
                
                {tweakingIdx === idx && !isReadOnly && (
                    <div className="p-6 bg-indigo-50 rounded-[2rem] animate-fade-in border border-indigo-100 shadow-inner">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Weight Calibration</span>
                            <span className="text-lg font-black text-indigo-600">{Math.round(item.weightGrams)}g</span>
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

        <div className="border-t border-slate-50 pt-6">
            <button 
                onClick={() => setShowMicros(!showMicros)}
                className="w-full flex items-center justify-between group p-3 hover:bg-slate-50 rounded-2xl transition-colors"
            >
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <LightBulbIcon className="w-3 h-3 text-indigo-500" /> Micronutrient Insight
                </h3>
                <span className={`text-xl font-black transition-transform ${showMicros ? 'text-indigo-600 rotate-180' : 'text-slate-300'}`}>{showMicros ? '−' : '+'}</span>
            </button>
            
            {showMicros && (
                <div className="grid grid-cols-2 gap-3 mt-4 animate-fade-in">
                    <div className="bg-white p-4 rounded-2xl flex flex-col items-center justify-center border border-slate-100 shadow-sm">
                        <span className="text-[8px] font-black text-slate-400 uppercase mb-1">Potassium</span>
                        <span className="text-sm font-black text-slate-800">{Math.round(localData.totalPotassium || 0)}mg</span>
                    </div>
                    <div className="bg-white p-4 rounded-2xl flex flex-col items-center justify-center border border-slate-100 shadow-sm">
                        <span className="text-[8px] font-black text-slate-400 uppercase mb-1">Magnesium</span>
                        <span className="text-sm font-black text-slate-800">{Math.round(localData.totalMagnesium || 0)}mg</span>
                    </div>
                </div>
            )}
        </div>
      </div>
      
      <div className="p-8 bg-slate-50 border-t border-slate-100">
        <button
          onClick={() => onSaveToHistory(localData)}
          className={`w-full font-black py-6 rounded-[2rem] transition-all flex items-center justify-center space-x-3 shadow-2xl group active:scale-95 ${isReadOnly ? 'bg-slate-200 text-slate-500' : 'bg-slate-900 text-white hover:bg-black'}`}
        >
          <ArchiveIcon className="group-hover:scale-110 transition-transform" />
          <span className="tracking-[0.2em] uppercase text-xs">{isReadOnly ? 'Close Analysis' : 'Commit to Living Log'}</span>
        </button>
      </div>
    </div>
  );
};
