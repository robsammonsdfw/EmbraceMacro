import React from 'react';
import type { NutritionInfo } from '../types.ts';
import { PlusIcon, BookmarkIcon } from './icons.tsx';

interface NutritionCardProps {
  data: NutritionInfo;
  onAddToPlan: () => void;
  onSaveMeal: () => void;
}

const MacroPill: React.FC<{ label: string; value: number; unit: string; color: string }> = ({ label, value, unit, color }) => (
  <div className={`text-center p-3 rounded-lg ${color}`}>
    <p className="text-sm font-medium text-white/90">{label}</p>
    <p className="text-2xl font-bold text-white">{Math.round(value)}{unit}</p>
  </div>
);

const ScoreBadge: React.FC<{ score?: string, type: 'nutri' | 'eco' }> = ({ score, type }) => {
  if (!score) return null;

  const scoreColors: { [key: string]: string } = {
    'a': 'bg-green-500', 'b': 'bg-lime-500', 'c': 'bg-yellow-500', 'd': 'bg-orange-500', 'e': 'bg-red-500',
  };
  const color = scoreColors[score.toLowerCase()] || 'bg-slate-400';
  const label = type === 'nutri' ? 'Nutri-Score' : 'Eco-Score';

  return (
    <div className="flex items-center space-x-2">
      <span className={`text-white font-bold text-lg uppercase px-3 py-1 rounded-full ${color}`}>{score}</span>
      <span className="text-sm text-slate-600 font-semibold">{label}</span>
    </div>
  );
};

export const NutritionCard: React.FC<NutritionCardProps> = ({ data, onAddToPlan, onSaveMeal }) => {
  const showIngredients = !(data.ingredients.length === 1 && data.ingredients[0].name === data.mealName);
  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-fade-in">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">{data.mealName}</h2>
        <p className="text-4xl font-extrabold text-emerald-500 mb-4">{Math.round(data.totalCalories)} <span className="text-2xl text-slate-500">kcal</span></p>

        <div className="flex items-center space-x-6 mb-6">
            <ScoreBadge score={data.nutriScore} type="nutri" />
            <ScoreBadge score={data.ecoScore} type="eco" />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <MacroPill label="Protein" value={data.totalProtein} unit="g" color="bg-sky-500" />
          <MacroPill label="Carbs" value={data.totalCarbs} unit="g" color="bg-amber-500" />
          <MacroPill label="Fat" value={data.totalFat} unit="g" color="bg-rose-500" />
        </div>

        {(data.totalSugar !== undefined || data.totalFiber !== undefined || data.totalSodium !== undefined) && (
             <div className="grid grid-cols-3 gap-3 mb-6 p-3 bg-slate-50 rounded-lg">
                {data.totalSugar !== undefined && <div className="text-center"><p className="text-slate-500 text-sm">Sugar</p><p className="font-bold text-slate-700">{Math.round(data.totalSugar)}g</p></div>}
                {data.totalFiber !== undefined && <div className="text-center"><p className="text-slate-500 text-sm">Fiber</p><p className="font-bold text-slate-700">{Math.round(data.totalFiber)}g</p></div>}
                {data.totalSodium !== undefined && <div className="text-center"><p className="text-slate-500 text-sm">Sodium</p><p className="font-bold text-slate-700">{Math.round(data.totalSodium * 1000)}mg</p></div>}
            </div>
        )}

        {showIngredients && (
            <>
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
            </>
        )}
        
        {data.allergens && data.allergens.length > 0 && (
            <div className="p-3 bg-amber-100 border border-amber-200 rounded-lg">
                <p className="font-semibold text-amber-800">Contains Allergens:</p>
                <p className="text-sm text-amber-700">{data.allergens.join(', ')}</p>
            </div>
        )}
      </div>
      
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
        <button
          onClick={onSaveMeal}
          className="w-full bg-slate-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center space-x-2"
        >
          <BookmarkIcon />
          <span>Save to My Meals</span>
        </button>
        <button
          onClick={onAddToPlan}
          className="w-full bg-emerald-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center space-x-2"
        >
          <PlusIcon />
          <span>Add to Today's Plan</span>
        </button>
      </div>
    </div>
  );
};