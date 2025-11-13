import React from 'react';
import type { MealPlanGroup } from '../types';
import { TrashIcon, PlusIcon } from './icons';

interface FoodPlanProps {
  planGroups: MealPlanGroup[];
  onRemove: (planGroupId: number) => void;
}

const MealGroupCard: React.FC<{ group: MealPlanGroup; onRemove: (id: number) => void; }> = ({ group, onRemove }) => {
    const meal = group.meal;
    return (
        <div className="bg-slate-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center space-x-3">
                    {meal.imageUrl && <img src={meal.imageUrl} alt={meal.mealName} className="w-12 h-12 rounded-md object-cover" />}
                    <div>
                        <h4 className="font-bold text-slate-800">{meal.mealName}</h4>
                        <p className="text-sm text-slate-500">{Math.round(meal.totalCalories)} kcal</p>
                    </div>
                </div>
                <button
                    onClick={() => onRemove(group.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-100 rounded-full transition-colors"
                    aria-label={`Remove ${meal.mealName}`}
                >
                    <TrashIcon />
                </button>
            </div>
            <ul className="space-y-1 pl-4 border-l-2 border-slate-200">
                {meal.ingredients.map((ing, index) => (
                    <li key={index} className="text-sm text-slate-600 flex justify-between">
                        <span>{ing.name} <span className="text-slate-400">({Math.round(ing.weightGrams)}g)</span></span>
                        <span>{Math.round(ing.calories)} kcal</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export const FoodPlan: React.FC<FoodPlanProps> = ({ planGroups, onRemove }) => {
  const totals = planGroups.reduce((acc, group) => {
    const meal = group.meal;
    acc.calories += meal.totalCalories;
    acc.protein += meal.totalProtein;
    acc.carbs += meal.totalCarbs;
    acc.fat += meal.totalFat;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  if (planGroups.length === 0) {
    return (
        <div className="text-center py-12 px-4 bg-white rounded-xl shadow-md border border-slate-200">
            <div className="mx-auto bg-slate-100 text-slate-500 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                <PlusIcon />
            </div>
            <h3 className="text-xl font-semibold text-slate-700 mt-2">Your plan is empty for today.</h3>
            <p className="text-slate-500 mt-1">Add meals from your History or Saved Meals to get started!</p>
        </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-800 mb-4">Today's Food Plan</h2>
      
      <div className="mb-6 p-4 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-lg text-white">
        <h3 className="text-lg font-bold">Total Intake</h3>
        <p className="text-3xl font-extrabold">{Math.round(totals.calories)} kcal</p>
        <div className="grid grid-cols-3 gap-2 mt-2 text-center text-sm font-medium">
          <div><span className="font-bold">{Math.round(totals.protein)}g</span><br/>Protein</div>
          <div><span className="font-bold">{Math.round(totals.carbs)}g</span><br/>Carbs</div>
          <div><span className="font-bold">{Math.round(totals.fat)}g</span><br/>Fat</div>
        </div>
      </div>

      <div className="space-y-4">
        {planGroups.map((group) => (
          <MealGroupCard key={group.id} group={group} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
};