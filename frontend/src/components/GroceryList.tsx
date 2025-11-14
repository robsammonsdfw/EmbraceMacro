import React, { useState } from 'react';
import type { GroceryItem, MealPlan } from '../types';
import { ClipboardListIcon, TrashIcon } from './icons';

interface GroceryListProps {
  items: GroceryItem[];
  mealPlans: MealPlan[];
  onGenerate: (planIds: number[]) => void;
  onToggle: (id: number, checked: boolean) => void;
  onClear: (type: 'checked' | 'all') => void;
}

export const GroceryList: React.FC<GroceryListProps> = ({ items, mealPlans, onGenerate, onToggle, onClear }) => {
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<number>>(new Set());

  const handlePlanSelection = (planId: number) => {
    setSelectedPlanIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(planId)) {
            newSet.delete(planId);
        } else {
            newSet.add(planId);
        }
        return newSet;
    });
  };

  const handleGenerate = () => {
    onGenerate(Array.from(selectedPlanIds));
  };
  
  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Grocery List</h2>
        <p className="text-slate-500">Select one or more meal plans to generate a consolidated shopping list.</p>
      </div>

      <div className="space-y-4">
        <div className="p-4 border border-slate-200 rounded-lg">
            <h3 className="font-bold text-slate-700 mb-3">1. Select Meal Plans</h3>
            {mealPlans.length > 0 ? (
                <div className="space-y-2">
                    {mealPlans.map(plan => (
                        <label key={plan.id} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-md cursor-pointer hover:bg-slate-100">
                             <input 
                                type="checkbox"
                                checked={selectedPlanIds.has(plan.id)}
                                onChange={() => handlePlanSelection(plan.id)}
                                className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                             />
                            <span className="font-medium text-slate-800">{plan.name}</span>
                            <span className="text-sm text-slate-500">({plan.items.length} meals)</span>
                        </label>
                    ))}
                </div>
            ) : (
                <p className="text-center text-slate-500 py-4">Create a meal plan to get started.</p>
            )}
        </div>
        
        <button
            onClick={handleGenerate}
            disabled={selectedPlanIds.size === 0}
            className="w-full bg-emerald-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center space-x-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
            <ClipboardListIcon />
            <span>Generate List from {selectedPlanIds.size} Plan(s)</span>
        </button>
      </div>
      
      {items.length > 0 && (
        <div className="border-t border-slate-200 pt-6">
             <h3 className="font-bold text-slate-700 mb-3">2. Your Shopping List</h3>
            <ul className="space-y-2 mt-4">
            {items.map((item) => (
                <li
                    key={item.id}
                    onClick={() => onToggle(item.id, !item.checked)}
                    className="flex items-center space-x-3 p-3 bg-slate-50 rounded-md cursor-pointer hover:bg-slate-100"
                >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${item.checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                        {item.checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className={`flex-1 ${item.checked ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}>
                        {item.name}
                    </span>
                </li>
            ))}
            </ul>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 border-t border-slate-200 pt-4">
                <button
                    onClick={() => onClear('checked')}
                    disabled={!items.some(item => item.checked)}
                    className="w-full text-sm bg-amber-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-600 transition-colors flex items-center justify-center space-x-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                    <TrashIcon />
                    <span>Clear Checked Items</span>
                </button>
                <button
                    onClick={() => onClear('all')}
                    className="w-full text-sm bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center space-x-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                    <TrashIcon />
                    <span>Clear Entire List</span>
                </button>
            </div>
        </div>
      )}
    </div>
  );
};