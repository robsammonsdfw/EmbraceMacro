
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
          alert("Failed to generate image. Please try again.");
      } finally {
          setIsGeneratingImage(false);
      }
  };

  return (
    <>
        {isCookMode && <CookModeModal recipe={currentRecipe} onClose={() => setIsCookMode(false)} />}
        {isCookOff && (
            <CookOffModal 
                recipeContext={`Recipe Name: ${currentRecipe.recipeName}. Ingredients: ${JSON.stringify(currentRecipe.ingredients)}. Instructions: ${JSON.stringify(currentRecipe.instructions)}`} 
                recipeId={999} 
                onClose={() => setIsCookOff(false)} 
            />
        )}
        
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-fade-in flex flex-col h-full">
          {/* Top Image Section */}
          <div className="relative h-56 bg-slate-100 overflow-hidden group">
              {currentRecipe.imageUrl ? (
                  <img src={currentRecipe.imageUrl} alt={currentRecipe.recipeName} className="w-full h-full object-cover" />
              ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                      <CameraIcon className="w-12 h-12 mb-2 opacity-20" />
                      {!isGeneratingImage && (
                          <button 
                              onClick={handleGenerateImage}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
                          >
                              <SparklesIcon className="w-4 h-4" />
                              Generate AI Photo
                          </button>
                      )}
                  </div>
              )}

              {isGeneratingImage && (
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                      <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mb-3"></div>
                      <p className="text-indigo-200 font-black uppercase text-[10px] tracking-widest">AI Plating Dish...</p>
                  </div>
              )}
              
              {/* Optional: Regenerate Trigger inside hover */}
              {currentRecipe.imageUrl && !isGeneratingImage && (
                  <button 
                    onClick={handleGenerateImage}
                    className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 backdrop-blur-md p-2 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Regenerate Image"
                  >
                    <SparklesIcon className="w-4 h-4" />
                  </button>
              )}
          </div>

          <div className="p-6 flex-grow">
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-2xl font-bold text-slate-800 leading-tight">{currentRecipe.recipeName}</h3>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsCookOff(true)}
                        className="text-orange-500 hover:text-orange-600 bg-orange-50 p-2 rounded-lg transition-colors group"
                        title="Join Cook-Off"
                    >
                        <FireIcon className="group-hover:scale-110 transition-transform" />
                    </button>
                    <button 
                        onClick={() => setIsCookMode(true)}
                        className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 p-2 rounded-lg transition-colors"
                        title="Enter Cook Mode"
                    >
                        <UtensilsIcon />
                    </button>
                </div>
            </div>
            
            <p className="text-slate-600 mt-1 mb-4 line-clamp-3">{currentRecipe.description}</p>

            <div className="grid grid-cols-4 gap-2 mb-6">
              <div className="text-center p-2 rounded-lg bg-emerald-500">
                  <p className="text-xs font-medium text-white/90">Cals</p>
                  <p className="text-lg font-bold text-white">{Math.round(currentRecipe.nutrition.totalCalories)}</p>
              </div>
              <MacroPill label="Pro" value={currentRecipe.nutrition.totalProtein} unit="g" color="bg-sky-500" />
              <MacroPill label="Carb" value={currentRecipe.nutrition.totalCarbs} unit="g" color="bg-amber-500" />
              <MacroPill label="Fat" value={currentRecipe.nutrition.totalFat} unit="g" color="bg-rose-500" />
            </div>

            {/* Generate Link below description if image exists */}
            {currentRecipe.imageUrl && (
                <div className="mb-4">
                    <button 
                        onClick={handleGenerateImage}
                        disabled={isGeneratingImage}
                        className="text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:underline flex items-center gap-1.5 disabled:opacity-50"
                    >
                        <SparklesIcon className="w-3 h-3" />
                        {isGeneratingImage ? 'Plating...' : 'Regenerate Photorealistic Image'}
                    </button>
                </div>
            )}

            <div className="space-y-3">
                <details className="bg-slate-50 p-3 rounded-lg open:ring-2 open:ring-emerald-200 group">
                    <summary className="font-semibold text-slate-700 cursor-pointer text-sm flex items-center justify-between">
                        <span>Ingredients ({currentRecipe.ingredients.length})</span>
                        <span className="text-slate-400 text-xs group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <ul className="mt-3 list-disc list-inside space-y-1 text-slate-600 text-sm">
                        {currentRecipe.ingredients.map((ing, index) => (
                            <li key={index}>
                               <span className="font-medium text-slate-800">{ing.name}:</span> {ing.quantity}
                            </li>
                        ))}
                    </ul>
                </details>
                <details className="bg-slate-50 p-3 rounded-lg open:ring-2 open:ring-emerald-200 group">
                    <summary className="font-semibold text-slate-700 cursor-pointer text-sm flex items-center justify-between">
                        <span>Instructions ({currentRecipe.instructions.length} steps)</span>
                        <span className="text-slate-400 text-xs group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <ol className="mt-3 list-decimal list-inside space-y-2 text-slate-600 text-sm">
                        {currentRecipe.instructions.map((step, index) => (
                            <li key={index} className="pl-1">{step}</li>
                        ))}
                    </ol>
                </details>
            </div>
          </div>
           <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3">
            <button
              onClick={() => setIsCookMode(true)}
              className="flex-1 bg-indigo-100 text-indigo-700 font-bold py-3 px-4 rounded-lg hover:bg-indigo-200 transition-colors flex items-center justify-center space-x-2"
            >
              <UtensilsIcon />
              <span>Cook Mode</span>
            </button>
            <button
              onClick={() => onAddToPlan(currentRecipe)}
              className="flex-1 bg-emerald-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center space-x-2"
            >
              <PlusIcon />
              <span>Plan It</span>
            </button>
          </div>
        </div>
    </>
  );
};
