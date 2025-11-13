import React from 'react';
import type { MealLogEntry, NutritionInfo } from '../types';
import { PlusIcon, BookmarkIcon, ClockIcon } from './icons';

interface MealHistoryProps {
  logEntries: MealLogEntry[];
  onAddToPlan: (mealData: NutritionInfo) => void;
  onSaveMeal: (mealData: NutritionInfo) => void;
}

const HistoryEntryCard: React.FC<{ entry: MealLogEntry; onAdd: () => void; onSave: () => void; }> = ({ entry, onAdd, onSave }) => (
    <div className="bg-slate-50 p-4 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between hover:bg-slate-100 transition-colors">
        <div className="flex items-center space-x-4 mb-4 sm:mb-0">
            {entry.imageUrl && <img src={entry.imageUrl} alt={entry.mealName} className="w-20 h-20 rounded-md object-cover" />}
            <div>
                <p className="font-bold text-slate-800">{entry.mealName}</p>
                <p className="text-sm text-slate-500">{Math.round(entry.totalCalories)} kcal</p>
                <p className="text-xs text-slate-500">
                    P:{Math.round(entry.totalProtein)}g C:{Math.round(entry.totalCarbs)}g F:{Math.round(entry.totalFat)}g
                </p>
            </div>
        </div>
        <div className="flex items-center justify-end space-x-2">
            <button
                onClick={onSave}
                className="p-2 text-slate-500 bg-white border border-slate-300 hover:bg-slate-200 rounded-full transition-colors"
                aria-label={`Save ${entry.mealName} to My Meals`}
            >
                <BookmarkIcon />
            </button>
            <button
                onClick={onAdd}
                className="p-2 text-emerald-500 bg-emerald-100 hover:bg-emerald-200 rounded-full transition-colors"
                aria-label={`Add ${entry.mealName} to today's plan`}
            >
                <PlusIcon />
            </button>
        </div>
    </div>
);

const groupEntriesByDate = (entries: MealLogEntry[]) => {
    return entries.reduce((acc, entry) => {
        const date = new Date(entry.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(entry);
        return acc;
    }, {} as Record<string, MealLogEntry[]>);
};

export const MealHistory: React.FC<MealHistoryProps> = ({ logEntries, onAddToPlan, onSaveMeal }) => {
  const groupedEntries = groupEntriesByDate(logEntries);
  const dates = Object.keys(groupedEntries);

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-800 mb-4">Meal History</h2>
      {logEntries.length > 0 ? (
        <div className="space-y-6">
          {dates.map((date) => (
            <div key={date}>
                <h3 className="font-semibold text-slate-600 mb-2 pb-1 border-b border-slate-200">{date}</h3>
                <ul className="space-y-3">
                    {groupedEntries[date].map((entry) => (
                        <li key={entry.id}>
                            <HistoryEntryCard 
                                entry={entry} 
                                onAdd={() => onAddToPlan(entry)} 
                                onSave={() => onSaveMeal(entry)} 
                            />
                        </li>
                    ))}
                </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 px-4 bg-slate-50 rounded-lg">
            <div className="mx-auto bg-slate-100 text-slate-500 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                <ClockIcon />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mt-2">Your meal history is empty.</h3>
            <p className="text-slate-500 mt-1">Analyze a meal to get started. Your results will show up here.</p>
        </div>
      )}
    </div>
  );
};
