import React, { useState, useMemo } from 'react';
import type { SavedMeal } from '../types';
import { ClipboardListIcon } from './icons';

interface GroceryListProps {
  meals: SavedMeal[];
}

interface GroceryItem {
    name: string;
    checked: boolean;
}

export const GroceryList: React.FC<GroceryListProps> = ({ meals }) => {
    const [list, setList] = useState<GroceryItem[]>([]);
    
    const generateList = () => {
        const allIngredients = meals.flatMap(meal => meal.ingredients);
        const uniqueIngredientNames = [...new Set(allIngredients.map(ing => ing.name))];
        const newList = uniqueIngredientNames.sort().map(name => ({
            name,
            checked: false,
        }));
        setList(newList);
    };

    const toggleItem = (index: number) => {
        setList(prevList => {
            const newList = [...prevList];
            newList[index].checked = !newList[index].checked;
            return newList;
        });
    };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
        <h2 className="text-2xl font-bold text-slate-800 mb-2 sm:mb-0">Grocery List</h2>
        <button
            onClick={generateList}
            disabled={meals.length === 0}
            className="w-full sm:w-auto bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center space-x-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
            <ClipboardListIcon />
            <span>Generate from My Meals</span>
        </button>
      </div>
      
      {meals.length === 0 && (
          <p className="text-center text-slate-500 py-4">Save some meals to your library to generate a grocery list.</p>
      )}

      {list.length > 0 ? (
        <ul className="space-y-2 mt-4">
          {list.map((item, index) => (
            <li
                key={index}
                onClick={() => toggleItem(index)}
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
        meals.length > 0 && <p className="text-center text-slate-500 py-4">Click the button to generate your shopping list.</p>
      )}
    </div>
  );
};
