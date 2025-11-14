import React from 'react';
import type { GroceryItem } from '../types';
import { ClipboardListIcon } from './icons';

interface GroceryListProps {
  items: GroceryItem[];
  savedMealsCount: number;
  onGenerate: () => void;
  onToggle: (id: number, checked: boolean) => void;
}

export const GroceryList: React.FC<GroceryListProps> = ({ items, savedMealsCount, onGenerate, onToggle }) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
        <h2 className="text-2xl font-bold text-slate-800 mb-2 sm:mb-0">Grocery List</h2>
        <button
            onClick={onGenerate}
            disabled={savedMealsCount === 0}
            className="w-full sm:w-auto bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center space-x-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
            <ClipboardListIcon />
            <span>Generate from My Meals</span>
        </button>
      </div>
      
      {savedMealsCount === 0 ? (
          <p className="text-center text-slate-500 py-4">Save some meals to your library to generate a grocery list.</p>
      ) : items.length > 0 ? (
        <ul className="space-y-2 mt-4">
          {items.map((item) => (
            <li
                key={item.id}
                onClick={() => onToggle(item.id, !item.checked)}
                className="flex items-center space-x-3 p-3 bg-slate-50 rounded-md cursor-pointer hover:bg-slate-100"
            >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${item.checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                    {item.checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className={`flex-1 ${item.checked ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}>
                    {item.name}
                </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-slate-500 py-4">Click the button to generate your shopping list from your saved meals.</p>
      )}
    </div>
  );
};