import React, { useState } from 'react';
import { XIcon, BeakerIcon, UtensilsIcon, ClipboardListIcon, CheckIcon, SparklesIcon } from './icons';
import type { NutritionInfo, Recipe } from '../types';
import { NutritionCard } from './NutritionCard';
import { RecipeCard } from './RecipeCard';
import * as apiService from '../services/apiService';

interface AnalysisResultModalProps {
    nutritionData?: NutritionInfo | null;
    recipeData?: Recipe[] | null; 
    onClose: () => void;
    onAddToPlan: (data: any) => void;
    onSave: (data: any) => void;
}

export const AnalysisResultModal: React.FC<AnalysisResultModalProps> = ({ 
    nutritionData: initialNutritionData, recipeData, onClose, onAddToPlan, onSave 
}) => {
    const [nutritionData, setNutritionData] = useState<NutritionInfo | null>(initialNutritionData || null);
    const [activeTab, setActiveTab] = useState<'nutrition' | 'recipe' | 'tools'>('nutrition');
    const [isGenerating, setIsGenerating] = useState(false);

    const isPantryChef = !!recipeData && recipeData.length > 0;
    const isUnified = !!nutritionData;

    const handleGenerateImage = async () => {
        if (!nutritionData) return;
        setIsGenerating(true);
        try {
            const prompt = `${nutritionData.mealName}. Photorealistic food photography, 4k. Ingredients: ${nutritionData.ingredients.map(i => i.name).join(', ')}`;
            const result = await apiService.generateRecipeImage(prompt);
            setNutritionData({ ...nutritionData, imageUrl: `data:image/jpeg;base64,${result.base64Image}` });
        } catch (e) {
            alert("Failed to generate image.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateMissingMetadata = async () => {
        if (!nutritionData) return;
        setIsGenerating(true);
        try {
            const updated = await apiService.generateMissingMetadata(nutritionData.mealName);
            setNutritionData({ ...nutritionData, ...updated });
        } catch (e) {
            alert("Failed to generate recipe data.");
        } finally {
            setIsGenerating(false);
        }
    };

    if (!isUnified && !isPantryChef) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex justify-center z-[110] p-4 overflow-y-auto animate-fade-in backdrop-blur-sm">
            <div className="w-full max-w-xl relative mt-10 mb-10">
                <button 
                    onClick={onClose} 
                    className="fixed top-4 right-4 md:absolute md:-top-2 md:-right-12 p-3 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md transition-all shadow-xl z-50"
                >
                    <XIcon />
                </button>

                {isUnified && (
                    <div className="flex bg-white/10 backdrop-blur-md p-1 rounded-2xl mb-6 border border-white/20 shadow-lg">
                        <button 
                            onClick={() => setActiveTab('nutrition')}
                            className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'nutrition' ? 'bg-emerald-500 text-white shadow-md' : 'text-white/60 hover:bg-white/10'}`}
                        >
                            <BeakerIcon className="w-4 h-4" /> Macros
                        </button>
                        <button 
                            onClick={() => setActiveTab('recipe')}
                            className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'recipe' ? 'bg-indigo-500 text-white shadow-md' : 'text-white/60 hover:bg-white/10'}`}
                        >
                            <UtensilsIcon className="w-4 h-4" /> Recipe
                        </button>
                        <button 
                            onClick={() => setActiveTab('tools')}
                            className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'tools' ? 'bg-amber-500 text-white shadow-md' : 'text-white/60 hover:bg-white/10'}`}
                        >
                            <ClipboardListIcon className="w-4 h-4" /> Tools
                        </button>
                    </div>
                )}

                {isUnified && activeTab === 'nutrition' && nutritionData && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex justify-end mb-2">
                             <button 
                                onClick={handleGenerateImage}
                                disabled={isGenerating}
                                className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
                            >
                                <SparklesIcon className="w-4 h-4" />
                                {isGenerating ? 'Plating...' : nutritionData.imageUrl ? 'Regenerate Photo' : 'Generate AI Photo'}
                            </button>
                        </div>
                        <NutritionCard 
                            data={nutritionData} 
                            onSaveToHistory={() => onSave(nutritionData)}
                            isReadOnly={false}
                        />
                    </div>
                )}

                {isUnified && activeTab === 'recipe' && nutritionData && (
                    <div className="animate-fade-in h-full">
                        {nutritionData.recipe && nutritionData.recipe.instructions.length > 0 ? (
                            <RecipeCard 
                                recipe={nutritionData.recipe} 
                                onAddToPlan={(updatedRecipe) => onAddToPlan({ ...nutritionData, recipe: updatedRecipe, imageUrl: updatedRecipe.imageUrl || nutritionData.imageUrl })} 
                            />
                        ) : (
                            <div className="bg-white rounded-[2.5rem] p-10 text-center min-h-[400px] flex flex-col items-center justify-center border border-slate-100 shadow-xl">
                                <div className="bg-indigo-50 p-6 rounded-full mb-6">
                                    <UtensilsIcon className="w-12 h-12 text-indigo-400" />
                                </div>
                                <h3 className="text-xl font-black text-slate-800 mb-2">Recipe Missing</h3>
                                <p className="text-slate-500 font-medium mb-8">This metabolic record is missing a culinary reconstruction.</p>
                                <button 
                                    onClick={handleGenerateMissingMetadata}
                                    disabled={isGenerating}
                                    className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 shadow-lg disabled:opacity-50 flex items-center gap-2"
                                >
                                    <SparklesIcon className="w-4 h-4" />
                                    {isGenerating ? 'Chef AI Thinking...' : 'Reconstruct Recipe via AI'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {isUnified && activeTab === 'tools' && nutritionData && (
                    <div className="animate-fade-in">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 min-h-[400px]">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Kitchen Armory</h3>
                                <div className="bg-amber-100 text-amber-600 p-3 rounded-full">
                                    <ClipboardListIcon className="w-6 h-6" />
                                </div>
                            </div>
                            
                            {nutritionData.kitchenTools && nutritionData.kitchenTools.length > 0 ? (
                                <div className="space-y-3">
                                    {nutritionData.kitchenTools.map((tool, idx) => (
                                        <div key={idx} className="flex items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-amber-200 transition-colors group">
                                            <div className="bg-white p-3 rounded-xl shadow-sm mr-4 text-slate-300 group-hover:text-amber-500 transition-colors">
                                                <CheckIcon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-black text-slate-800 text-sm uppercase">{tool.name}</h4>
                                                    {tool.essential && <span className="bg-rose-100 text-rose-600 text-[9px] font-black px-1.5 py-0.5 rounded border border-rose-200 uppercase">Required</span>}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-0.5 font-medium">{tool.use}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 flex flex-col items-center">
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-6">Tools analysis pending</p>
                                    <button 
                                        onClick={handleGenerateMissingMetadata}
                                        disabled={isGenerating}
                                        className="bg-amber-500 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-amber-600 shadow-lg disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <SparklesIcon className="w-4 h-4" />
                                        Identify Tools via AI
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {isPantryChef && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="text-center text-white mb-6">
                            <h2 className="text-2xl font-black uppercase tracking-tight">Pantry Chef</h2>
                            <p className="text-amber-400 font-bold uppercase tracking-widest text-xs">3 Potential Matches</p>
                        </div>
                        {recipeData.map((recipe, idx) => (
                            <div key={idx}>
                                <RecipeCard 
                                    recipe={recipe} 
                                    onAddToPlan={(updatedRecipe) => onAddToPlan(updatedRecipe)} 
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
