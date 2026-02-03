
import React, { useState } from 'react';
import type { MealLogEntry, NutritionInfo } from '../types';
import { PlusIcon, BookmarkIcon, ClockIcon, CameraIcon, CameraOffIcon, CheckIcon } from './icons';
import { ImageViewModal } from './ImageViewModal';

interface MealHistoryProps {
  logEntries: MealLogEntry[];
  onAddToPlan: (mealData: NutritionInfo) => void;
  onSaveMeal: (mealData: NutritionInfo) => void;
  onSelectMeal: (meal: NutritionInfo) => void;
  onManualLogAdd?: (query: string) => void;
  onScanClick?: () => void;
}

const HistoryEntryCard: React.FC<{ 
    entry: MealLogEntry; 
    onAdd: () => void; 
    onSave: () => void;
    onViewImage: () => void;
    onDetails: () => void;
}> = ({ entry, onAdd, onSave, onViewImage, onDetails }) => {
    // Rely on hasImage flag from backend
    const hasImage = entry.hasImage;

    return (
        <div 
            onClick={onDetails}
            className="bg-slate-50 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between hover:bg-white hover:shadow-lg hover:ring-2 hover:ring-indigo-100 transition-all cursor-pointer group/history"
        >
            <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 mb-4 sm:mb-0 w-full">
                {/* View Image Button / No Image Indicator */}
                {hasImage ? (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onViewImage(); }}
                        className="w-full sm:w-20 h-20 bg-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-600 hover:bg-slate-300 transition-colors flex-shrink-0 group shadow-sm hover:shadow-md"
                        title="View Meal Image"
                    >
                        <CameraIcon />
                        <span className="text-[10px] font-black mt-1 uppercase text-slate-500 group-hover:text-slate-700">View</span>
                    </button>
                ) : (
                     <div className="w-full sm:w-20 h-20 bg-white rounded-xl flex flex-col items-center justify-center text-slate-300 border border-slate-100 flex-shrink-0">
                        <CameraOffIcon />
                        <span className="text-[10px] font-bold mt-1 uppercase">No Photo</span>
                    </div>
                )}

                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <p className="font-black text-slate-800 uppercase tracking-tight text-sm group-hover/history:text-indigo-600 transition-colors">{entry.mealName}</p>
                        <CheckIcon className="w-3 h-3 text-emerald-500" />
                    </div>
                    <p className="text-[10px] font-black text-emerald-600 bg-emerald-50 w-fit px-1.5 py-0.5 rounded border border-emerald-100 mb-2 uppercase tracking-widest">{Math.round(entry.totalCalories)} KCAL</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        P:{Math.round(entry.totalProtein)}g • C:{Math.round(entry.totalCarbs)}g • F:{Math.round(entry.totalFat)}g
                    </p>
                </div>
            </div>
            <div className="flex items-center justify-end space-x-2">
                <button
                    onClick={(e) => { e.stopPropagation(); onSave(); }}
                    className="flex items-center space-x-1 p-2 pr-4 text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all shadow-sm group"
                >
                    <BookmarkIcon className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-tighter">Save</span>
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onAdd(); }}
                    className="flex items-center space-x-1 p-2 pr-4 text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 rounded-xl transition-all shadow-sm group"
                >
                    <PlusIcon className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-tighter">Plan</span>
                </button>
            </div>
        </div>
    );
};

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

export const MealHistory: React.FC<MealHistoryProps> = ({ logEntries, onAddToPlan, onSaveMeal, onSelectMeal, onManualLogAdd, onScanClick }) => {
  const groupedEntries = groupEntriesByDate(logEntries);
  const dates = Object.keys(groupedEntries);
  const [viewImageId, setViewImageId] = useState<number | null>(null);
  const [manualInput, setManualInput] = useState('');

  const handleManualLogSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (manualInput.trim() && onManualLogAdd) {
          onManualLogAdd(manualInput);
          setManualInput('');
      }
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 animate-fade-in">
      <div className="flex justify-between items-center mb-6">
          <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Timeline</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Chronological Metabolism</p>
          </div>
          <ClockIcon className="text-slate-200 w-8 h-8" />
      </div>

      {/* Manual Log Bar */}
      <form onSubmit={handleManualLogSubmit} className="flex gap-2 mb-10 bg-slate-50 p-2 rounded-2xl border border-slate-200">
            <button 
                type="button" 
                onClick={onScanClick}
                className="bg-white text-emerald-500 p-3 rounded-xl shadow-sm hover:scale-105 transition-transform"
            >
                <CameraIcon className="w-5 h-5" />
            </button>
            <input 
                type="text" 
                placeholder="Log a meal by name..." 
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                className="flex-grow bg-transparent outline-none font-bold text-slate-700 px-2"
            />
            <button 
                type="submit" 
                disabled={!manualInput.trim()}
                className="bg-slate-900 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-colors disabled:opacity-50"
            >
                Log
            </button>
      </form>

      {viewImageId && (
          <ImageViewModal 
            itemId={viewImageId} 
            type="history" 
            onClose={() => setViewImageId(null)} 
          />
      )}

      {logEntries.length > 0 ? (
        <div className="space-y-10">
          {dates.map((date) => (
            <div key={date}>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 pb-2 border-b border-slate-50 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-200"></div>
                    {date}
                </h3>
                <ul className="space-y-4">
                    {groupedEntries[date].map((entry) => (
                        <li key={entry.id}>
                            <HistoryEntryCard 
                                entry={entry} 
                                onAdd={() => onAddToPlan(entry)} 
                                onSave={() => onSaveMeal(entry)} 
                                onViewImage={() => setViewImageId(entry.id)}
                                onDetails={() => onSelectMeal(entry)}
                            />
                        </li>
                    ))}
                </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 px-4 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
            <div className="mx-auto bg-white shadow-inner text-slate-300 rounded-full w-24 h-24 flex items-center justify-center mb-6">
                <ClockIcon className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">Timeline Empty</h3>
            <p className="text-slate-500 font-medium max-w-xs mx-auto">Start logging your meals using the bar above or the main camera.</p>
        </div>
      )}
    </div>
  );
};
