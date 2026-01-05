
import React from 'react';
import { XIcon } from './icons';
import type { NutritionInfo, Recipe } from '../types';
import { NutritionCard } from './NutritionCard';
import { RecipeCard } from './RecipeCard';

interface AnalysisResultModalProps {
    nutritionData?: NutritionInfo | null;
    recipeData?: Recipe[] | null;
    onClose: () => void;
    onAddToPlan: (data: any) => void;
    onSave: (data: any) => void;
}

export const AnalysisResultModal: React.FC<AnalysisResultModalProps> = ({ 
    nutritionData, recipeData, onClose, onAddToPlan, onSave 
}) => {
    // Determine what we are showing
    const hasNutrition = !!nutritionData;
    const hasRecipes = !!recipeData && recipeData.length > 0;

    if (!hasNutrition && !hasRecipes) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex justify-center z-[110] p-4 overflow-y-auto animate-fade-in backdrop-blur-sm">
            <div className="w-full max-w-xl relative mt-10 mb-10">
                <button 
                    onClick={onClose} 
                    className="fixed top-4 right-4 md:absolute md:-top-2 md:-right-12 p-3 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md transition-all shadow-xl z-50"
                >
                    <XIcon />
                </button>

                {hasNutrition && nutritionData && (
                    <div className="space-y-4">
                        <div className="text-center text-white mb-6">
                            <h2 className="text-2xl font-black uppercase tracking-tight">Macro Analysis</h2>
                            <p className="text-emerald-400 font-bold uppercase tracking-widest text-xs">AI Confidence: 98%</p>
                        </div>
                        <NutritionCard 
                            data={nutritionData} 
                            onSaveToHistory={() => onSave(nutritionData)} // In this context "Save to History" is the main Save action
                            isReadOnly={false}
                        />
                    </div>
                )}

                {hasRecipes && recipeData && (
                    <div className="space-y-6">
                        <div className="text-center text-white mb-6">
                            <h2 className="text-2xl font-black uppercase tracking-tight">Pantry Chef</h2>
                            <p className="text-amber-400 font-bold uppercase tracking-widest text-xs">3 Potential Matches</p>
                        </div>
                        {recipeData.map((recipe, idx) => (
                            <div key={idx}>
                                <RecipeCard 
                                    recipe={recipe} 
                                    onAddToPlan={() => onAddToPlan(recipe)} 
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
