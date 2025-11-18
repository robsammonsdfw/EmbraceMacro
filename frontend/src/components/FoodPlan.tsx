import React, { useState } from 'react';
import type { MealPlan, MealPlanItem } from '../types';
import { TrashIcon, PlusIcon, CameraIcon } from './icons';
import { ImageViewModal } from './ImageViewModal';

interface FoodPlanProps {
  plan: MealPlan | null;
  onRemove: (planItemId: number) => void;
}

const MealItemCard: React.FC<{ 
    item: MealPlanItem; 
    onRemove: (id: number) => void;
    onViewImage: () => void; 
}> = ({ item, onRemove, onViewImage }) => {
    const meal = item.meal;
    return (
        <div className="bg-slate-50 p-4 rounded-lg">
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-3">
                     <button 
                        onClick={onViewImage}
                        className="w-12 h-12 bg-slate-200 rounded-md flex flex-col items-center justify-center text-slate-500 hover:bg-slate-300 transition-colors flex-shrink-0"
                        title="View Image"
                    >
                        <CameraIcon />
                    </button>
                    <div>
                        <h4 className="font-bold text-slate-800">{meal.mealName}</h4>
                        <p className="text-sm text-slate-500">{Math.round(meal.totalCalories)} kcal</p>
                    </div>
                </div>
                <button
                    onClick={() => onRemove(item.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-100 rounded-full transition-colors flex-shrink-0"
                    aria-label={`Remove ${meal.mealName}`}
                >
                    <TrashIcon />
                </button>
            </div>
            {meal.ingredients.length > 0 &&
                <ul className="space-y-1 pl-4 border-l-2 border-slate-200">
                    {meal.ingredients.map((ing, index) => (
                        <li key={index} className="text-sm text-slate-600 flex justify-between">
                            <span>{ing.name} <span className="text-slate-400">({Math.round(ing.weightGrams)}g)</span></span>
                            <span>{Math.round(ing.calories)} kcal</span>
                        </li>
                    ))}
                </ul>
            }
        </div>
    );
};

export const FoodPlan: React.FC<FoodPlanProps> = ({ plan, onRemove }) => {
  const [viewImageId, setViewImageId] = useState<number | null>(null);

  const totals = plan?.items.reduce((acc, group) => {
    const meal = group.meal;
    acc.calories += meal.totalCalories;
    acc.protein += meal.totalProtein;
    acc.carbs += meal.totalCarbs;
    acc.fat += meal.totalFat;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 }) || { calories: 0, protein: 0, carbs: 0, fat: 0 };

  if (!plan || plan.items.length === 0) {
    return (
        <div className="text-center py-12 px-4 bg-white rounded-xl shadow-md border border-slate-200">
            <div className="mx-auto bg-slate-100 text-slate-500 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                <PlusIcon />
            </div>
            <h3 className="text-xl font-semibold text-slate-700 mt-2">This plan is empty.</h3>
            <p className="text-slate-500 mt-1">Add meals from your History or Saved Meals to fill it up!</p>
        </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-800 mb-4">Plan: <span className="text-emerald-600">{plan.name}</span></h2>
      
      {viewImageId && (
          <ImageViewModal 
            itemId={viewImageId} 
            type="saved" 
            onClose={() => setViewImageId(null)} 
          />
      )}

      <div className="mb-6 p-4 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-lg text-white">
        <h3 className="text-lg font-bold">Total Intake for this Plan</h3>
        <p className="text-3xl font-extrabold">{Math.round(totals.calories)} kcal</p>
        <div className="grid grid-cols-3 gap-2 mt-2 text-center text-sm font-medium">
          <div><span className="font-bold">{Math.round(totals.protein)}g</span><br/>Protein</div>
          <div><span className="font-bold">{Math.round(totals.carbs)}g</span><br/>Carbs</div>
          <div><span className="font-bold">{Math.round(totals.fat)}g</span><br/>Fat</div>
        </div>
      </div>

      <div className="space-y-4">
        {plan.items.map((item) => (
          <MealItemCard 
            key={item.id} 
            item={item} 
            onRemove={onRemove} 
            onViewImage={() => setViewImageId(item.meal.id)}
        />
        ))}
      </div>
    </div>
  );
};