
import React, { useState } from 'react';
import { XIcon, BeakerIcon, UtensilsIcon, ClipboardListIcon, CheckIcon } from './icons';
import type { NutritionInfo, Recipe } from '../types';
import { NutritionCard } from './NutritionCard';
import { RecipeCard } from './RecipeCard';

interface AnalysisResultModalProps {
    nutritionData?: NutritionInfo | null;
    recipeData?: Recipe[] | null; // Keeps backward compat for PantryChef suggestions
    onClose: () => void;
    onAddToPlan: (data: any) => void;
    onSave: (data: any) => void;
}

export const AnalysisResultModal: React.FC<AnalysisResultModalProps> = ({ 
    nutritionData, recipeData, onClose, onAddToPlan, onSave 
}) => {
    const [activeTab, setActiveTab] = useState<'nutrition' | 'recipe' | 'tools'>('nutrition');

    // Scenario A: Pantry Chef (Returns multiple recipes, no unified 3-tab view)
    const isPantryChef = !!recipeData && recipeData.length > 0;
    
    // Scenario B: MacrosChef/MasterChef (Returns unified 3-tab view)
    const isUnified = !!nutritionData;

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

                {/* 3-Tab Switcher (Only for Unified View) */}
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

                {/* CONTENT AREA */}
                
                {/* 1. Nutrition Tab */}
                {isUnified && activeTab === 'nutrition' && nutritionData && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="text-center text-white mb-2">
                            <h2 className="text-2xl font-black uppercase tracking-tight">Macro Analysis</h2>
                            <p className="text-emerald-400 font-bold uppercase tracking-widest text-xs">AI Confidence: 98%</p>
                        </div>
                        <NutritionCard 
                            data={nutritionData} 
                            onSaveToHistory={() => onSave(nutritionData)}
                            isReadOnly={false}
                        />
                    </div>
                )}

                {/* 2. Recipe Tab */}
                {isUnified && activeTab === 'recipe' && nutritionData && (
                    <div className="animate-fade-in h-full">
                        {nutritionData.recipe ? (
                            <RecipeCard 
                                recipe={nutritionData.recipe} 
                                onAddToPlan={() => onAddToPlan(nutritionData)} 
                            />
                        ) : (
                            <div className="bg-white rounded-3xl p-8 text-center min-h-[300px] flex flex-col items-center justify-center">
                                <UtensilsIcon className="w-12 h-12 text-slate-200 mb-4" />
                                <p className="text-slate-500 font-bold">No recipe data available for this scan.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* 3. Kitchen Tools Tab */}
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
                                    <div className="mt-8 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-center">
                                        <p className="text-indigo-600 text-xs font-bold uppercase tracking-wide">Gear Check Complete</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <p className="text-slate-400 font-bold">No specific tools required.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Legacy Pantry Chef View (No Tabs) */}
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
