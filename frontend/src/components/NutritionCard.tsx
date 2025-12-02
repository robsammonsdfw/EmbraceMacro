
import React, { useState } from 'react';
import type { NutritionInfo, GooglePlaceResult } from '../types';
import { ArchiveIcon, MapPinIcon } from './icons';
import { LocationPicker } from './LocationPicker';

interface NutritionCardProps {
  data: NutritionInfo;
  onSaveToHistory: (placeData?: GooglePlaceResult | null) => void;
}

const MacroPill: React.FC<{ label: string; value: number; unit: string; color: string }> = ({ label, value, unit, color }) => (
  <div className={`text-center p-3 rounded-lg ${color}`}>
    <p className="text-sm font-medium text-white/90">{label}</p>
    <p className="text-2xl font-bold text-white">{Math.round(value)}{unit}</p>
  </div>
);

export const NutritionCard: React.FC<NutritionCardProps> = ({ data, onSaveToHistory }) => {
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<GooglePlaceResult | null>(null);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-fade-in">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">{data.mealName}</h2>
        <p className="text-4xl font-extrabold text-emerald-500 mb-4">{Math.round(data.totalCalories)} <span className="text-2xl text-slate-500">kcal</span></p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <MacroPill label="Protein" value={data.totalProtein} unit="g" color="bg-sky-500" />
          <MacroPill label="Carbs" value={data.totalCarbs} unit="g" color="bg-amber-500" />
          <MacroPill label="Fat" value={data.totalFat} unit="g" color="bg-rose-500" />
        </div>

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

        {/* Location Tagging Section */}
        {selectedPlace ? (
            <div className="bg-emerald-50 p-3 rounded-lg flex justify-between items-center border border-emerald-100 mt-4">
                <div className="flex items-center gap-2 text-emerald-800">
                    <MapPinIcon />
                    <div>
                        <p className="font-bold text-sm">{selectedPlace.name}</p>
                        <p className="text-xs opacity-75 truncate max-w-[200px]">{selectedPlace.formatted_address}</p>
                    </div>
                </div>
                <button onClick={() => setSelectedPlace(null)} className="text-xs text-emerald-600 font-bold hover:underline">Change</button>
            </div>
        ) : showLocationPicker ? (
            <LocationPicker 
                onSelect={(place) => { setSelectedPlace(place); setShowLocationPicker(false); }} 
                onCancel={() => setShowLocationPicker(false)}
            />
        ) : (
             <button 
                onClick={() => setShowLocationPicker(true)}
                className="w-full mt-2 py-2 border border-dashed border-slate-300 rounded-lg text-slate-500 text-sm font-semibold hover:bg-slate-50 hover:border-emerald-400 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"
             >
                <MapPinIcon /> Tag Location (Optional)
             </button>
        )}

      </div>
      
      <div className="p-4 bg-slate-50 border-t border-slate-200">
        <button
          onClick={() => onSaveToHistory(selectedPlace)}
          className="w-full bg-emerald-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center space-x-2 relative group"
        >
          <ArchiveIcon />
          <span>Save to History</span>
          <span className="ml-2 bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/30 animate-pulse group-hover:animate-none">
              +50 pts
          </span>
        </button>
      </div>
    </div>
  );
};
