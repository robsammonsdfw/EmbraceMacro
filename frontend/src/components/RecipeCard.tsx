import React, { useState } from 'react';
import type { Recipe } from '../types';
import { PlusIcon, UtensilsIcon, FireIcon, CameraIcon, SparklesIcon } from './icons';
import { CookModeModal } from './CookModeModal';
import { CookOffModal } from './CookOffModal';
import * as apiService from '../services/apiService';

const MacroPill: React.FC<{ label: string; value: number; unit: string; color: string }> = ({ label, value, unit, color }) => (
  <div className={`text-center p-2 rounded-lg ${color}`}>
    <p className="text-xs font-medium text-white/90">{label}</p>
    <p className="text-lg font-bold text-white">{Math.round(value)}{unit}</p>
  </div>
);

interface RecipeCardProps {
    recipe: Recipe;
    onAddToPlan: (recipe: Recipe) => void;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onAddToPlan }) => {
  const [currentRecipe, setCurrentRecipe] = useState<Recipe>(recipe);
  const [isCookMode, setIsCookMode] = useState(false);
  const [isCookOff, setIsCookOff] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const handleGenerateImage = async () => {
      setIsGeneratingImage(true);
      try {
          const prompt = `${currentRecipe.recipeName}: ${currentRecipe.description}`;
          const result = await apiService.generateRecipeImage(prompt);
          const fullImageUrl = `data:image/jpeg;base64,${result.base64Image}`;
          setCurrentRecipe(prev => ({ ...prev, imageUrl: fullImageUrl }));
      } catch (err) {
          console.error("Image Gen Error", err);
          alert("Failed to generate photorealistic image. Please try again.");
      } finally {
          setIsGeneratingImage(false);
      }
  };

  return (
    <>
        {isCookMode && <CookModeModal recipe={currentRecipe} onClose={() => setIsCookMode(false)} />}
        {isCookOff && (
            <CookOffModal 
                recipeContext={`Recipe Name: ${currentRecipe.recipeName}. Description: ${currentRecipe.description}`} 
                recipeId={999} 
                onClose={() => setIsCookOff(false)} 
            />
        )}
        
        <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden animate-fade-in flex flex-col h-full">
          <div className="relative h-64 bg-slate-50 overflow-hidden group">
              {currentRecipe.imageUrl ? (
                  <img src={currentRecipe.imageUrl} alt={currentRecipe.recipeName} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                      <CameraIcon className="w-12 h-12 mb-2 opacity-20" />
                      {!isGeneratingImage && (
                          <button 
                              onClick={handleGenerateImage}
                              className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
                          >
                              <SparklesIcon className="w-4 h-4" />
                              Generate AI Photo
                          </button>
                      )}
                  </div>
              )}

              {isGeneratingImage && (
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center z-10 text-white">
                      <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mb-3"></div>
                      <p className="font-black uppercase text-[10px] tracking-widest">AI Plating Dish...</p>
                  </div>
              )}
          </div>

          <div className="p-8 flex-grow">
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-2xl font-black text-slate-800 leading-tight uppercase tracking-tight">{currentRecipe.recipeName}</h3>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsCookOff(true)}
                        className="text-orange-500 hover:text-orange-600 bg-orange-50 p-2 rounded-xl transition-colors group"
                        title="Join Cook-Off"
                    >
                        <FireIcon className="group-hover:scale-110 transition-transform" />
                    </button>
                </div>
            </div>
            
            <p className="text-slate-500 font-medium mb-6 line-clamp-3">{currentRecipe.description}</p>

            {currentRecipe.imageUrl && (
                <div className="mb-6">
                    <button 
                        onClick={handleGenerateImage}
                        disabled={isGeneratingImage}
                        className="text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:underline flex items-center gap-1.5 disabled:opacity-50"
                    >
                        <SparklesIcon className="w-3 h-3" />
                        {isGeneratingImage ? 'Plating...' : 'Regenerate Photorealistic Photo'}
                    </button>
                </div>
            )}

            <div className="grid grid-cols-4 gap-2 mb-8">
              <div className="text-center p-2 rounded-xl bg-emerald-500">
                  <p className="text-[9px] font-black text-white/90 uppercase">Cals</p>
                  <p className="text-lg font-black text-white">{Math.round(currentRecipe.nutrition.totalCalories)}</p>
              </div>
              <MacroPill label="Pro" value={currentRecipe.nutrition.totalProtein} unit="g" color="bg-sky-500" />
              <MacroPill label="Carb" value={currentRecipe.nutrition.totalCarbs} unit="g" color="bg-amber-500" />
              <MacroPill label="Fat" value={currentRecipe.nutrition.totalFat} unit="g" color="bg-rose-500" />
            </div>

            <div className="space-y-3">
                <details className="bg-slate-50 p-4 rounded-2xl open:ring-2 open:ring-indigo-100 group transition-all">
                    <summary className="font-black text-slate-700 cursor-pointer text-xs uppercase tracking-widest flex items-center justify-between">
                        <span>Ingredients ({currentRecipe.ingredients.length})</span>
                        <span className="text-slate-300 text-xs group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <ul className="mt-4 space-y-2 text-slate-600 text-sm font-medium">
                        {currentRecipe.ingredients.map((ing, index) => (
                            <li key={index} className="flex justify-between border-b border-slate-100 pb-1">
                               <span className="text-slate-800">{ing.name}</span>
                               <span className="text-indigo-600 font-bold">{ing.quantity}</span>
                            </li>
                        ))}
                    </ul>
                </details>
                <details className="bg-slate-50 p-4 rounded-2xl open:ring-2 open:ring-indigo-100 group transition-all">
                    <summary className="font-black text-slate-700 cursor-pointer text-xs uppercase tracking-widest flex items-center justify-between">
                        <span>Instructions ({currentRecipe.instructions.length} steps)</span>
                        <span className="text-slate-300 text-xs group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <ol className="mt-4 list-decimal list-inside space-y-3 text-slate-600 text-sm font-medium">
                        {currentRecipe.instructions.map((step, index) => (
                            <li key={index} className="pl-1 leading-relaxed">{step}</li>
                        ))}
                    </ol>
                </details>
            </div>
          </div>
           <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
            <button
              onClick={() => setIsCookMode(true)}
              className="flex-1 bg-white border border-slate-200 text-slate-900 font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <UtensilsIcon className="w-4 h-4" />
              <span>Cook Mode</span>
            </button>
            <button
              onClick={() => onAddToPlan(currentRecipe)}
              className="flex-1 bg-emerald-500 text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Plan It</span>
            </button>
          </div>
        </div>
    </>
  );
};
