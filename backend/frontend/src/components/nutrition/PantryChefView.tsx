
import React, { useState, useEffect, useRef } from 'react';
import { CameraIcon, ChefHatIcon, ClockIcon, BookOpenIcon } from '../icons';
import * as apiService from '../../services/apiService';
import type { SavedMeal, Recipe, PantryLogEntry } from '../../types';
import { RecipeCard } from '../RecipeCard';
import { ImageViewModal } from '../ImageViewModal';
import { Loader } from '../Loader';

interface PantryChefViewProps {
    savedMeals: SavedMeal[];
    onSaveMeal: (meal: any) => void;
}

export const PantryChefView: React.FC<PantryChefViewProps> = ({ savedMeals, onSaveMeal }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [pantryLog, setPantryLog] = useState<PantryLogEntry[]>([]);
    const [generatedRecipes, setGeneratedRecipes] = useState<Recipe[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [viewImageId, setViewImageId] = useState<number | null>(null);

    // Initial Load
    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const history = await apiService.getPantryLog();
            setPantryLog(history);
        } catch (e) {
            console.error("Failed to load pantry history", e);
        }
    };

    const handleCameraClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setStatus('Analyzing ingredients...');
        setGeneratedRecipes([]);

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = (reader.result as string).split(',')[1];
            try {
                // 1. Save to Pantry Log
                await apiService.savePantryLogEntry(base64String);
                loadHistory();

                // 2. Generate Recipes
                setStatus('Chef AI creating recipes...');
                const recipes = await apiService.getRecipesFromImage(base64String, file.type);
                setGeneratedRecipes(recipes);
            } catch (err) {
                alert("Failed to process pantry image.");
            } finally {
                setIsLoading(false);
                setStatus('');
            }
        };
        reader.readAsDataURL(file);
        // Reset input
        e.target.value = '';
    };

    const handleSaveRecipe = (recipe: Recipe) => {
        // Convert Recipe to NutritionInfo/SavedMeal format for saving
        const mealToSave = {
            mealName: recipe.recipeName,
            totalCalories: recipe.nutrition.totalCalories,
            totalProtein: recipe.nutrition.totalProtein,
            totalCarbs: recipe.nutrition.totalCarbs,
            totalFat: recipe.nutrition.totalFat,
            imageUrl: recipe.imageUrl, // Capture the AI generated image if it exists
            ingredients: recipe.ingredients.map(i => ({ 
                name: i.name, 
                weightGrams: 0, 
                calories: 0, protein: 0, carbs: 0, fat: 0 
            })),
            recipe: recipe,
            source: 'pantry' // Explicitly mark source
        };
        onSaveMeal(mealToSave);
        alert("Recipe saved to Library!");
    };

    // Filter SavedMeals to show only those marked as 'pantry' or have recipe data (fallback)
    // AND prioritize checking the source field if it exists
    const savedRecipes = savedMeals.filter(m => m.source === 'pantry' || (!m.source && m.recipe));

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-fade-in">
            {viewImageId && <ImageViewModal itemId={viewImageId} type="pantry" onClose={() => setViewImageId(null)} />}
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

            <header className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 text-amber-600 rounded-full">
                    <ChefHatIcon className="w-8 h-8" />
                </div>
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Pantry Chef</h2>
                    <p className="text-slate-500 font-medium">Turn ingredients into gourmet meals instantly.</p>
                </div>
            </header>

            {/* Action Area */}
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden group">
                <div className="absolute -right-10 -bottom-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
                    <ChefHatIcon className="w-64 h-64" />
                </div>
                
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="text-center md:text-left">
                        <h3 className="text-2xl font-black mb-2">What's in your fridge?</h3>
                        <p className="text-orange-100 font-medium max-w-md">Take a photo of your open fridge or pantry shelf. AI will identify ingredients and suggest 3 unique recipes.</p>
                    </div>
                    <button 
                        onClick={handleCameraClick}
                        className="bg-white text-orange-600 font-black px-8 py-4 rounded-2xl shadow-lg hover:bg-orange-50 active:scale-95 transition-all flex items-center gap-3"
                    >
                        <CameraIcon className="w-6 h-6" />
                        <span>Snap & Cook</span>
                    </button>
                </div>
            </div>

            {isLoading && <Loader message={status} />}

            {/* Generated Results */}
            {generatedRecipes.length > 0 && !isLoading && (
                <div className="space-y-6">
                    <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs border-b border-slate-200 pb-2">Fresh Suggestions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {generatedRecipes.map((recipe, idx) => (
                            <RecipeCard 
                                key={idx} 
                                recipe={recipe} 
                                onAddToPlan={(updatedRecipe) => handleSaveRecipe(updatedRecipe)} 
                            />
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Saved Recipes */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-full flex flex-col">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                        <BookOpenIcon className="w-5 h-5 text-indigo-500" /> Saved Recipes
                    </h3>
                    {savedRecipes.length > 0 ? (
                        <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 flex-grow">
                            {savedRecipes.map(meal => (
                                <div key={meal.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors">
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{meal.mealName}</p>
                                        <p className="text-xs text-slate-500">{Math.round(meal.totalCalories)} kcal • {meal.recipe?.ingredients.length || 0} ingredients</p>
                                    </div>
                                    <button className="text-xs font-bold text-indigo-600 bg-white border border-indigo-100 px-3 py-1.5 rounded-lg shadow-sm">View</button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex-grow flex flex-col items-center justify-center text-slate-400 py-10">
                            <BookOpenIcon className="w-10 h-10 mb-2 opacity-30" />
                            <p className="text-xs font-bold uppercase">No pantry recipes saved</p>
                        </div>
                    )}
                </div>

                {/* Photo History */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-full flex flex-col">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                        <ClockIcon className="w-5 h-5 text-emerald-500" /> Fridge Scans
                    </h3>
                    {pantryLog.length > 0 ? (
                        <div className="grid grid-cols-3 gap-3 overflow-y-auto max-h-[400px] pr-2 flex-grow content-start">
                            {pantryLog.map(entry => (
                                <button 
                                    key={entry.id} 
                                    onClick={() => setViewImageId(entry.id)}
                                    className="aspect-square bg-slate-100 rounded-xl flex flex-col items-center justify-center hover:bg-slate-200 transition-colors border border-slate-200"
                                >
                                    <CameraIcon className="w-6 h-6 text-slate-400 mb-1" />
                                    <span className="text-[9px] font-bold text-slate-500">{new Date(entry.created_at).toLocaleDateString()}</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="flex-grow flex flex-col items-center justify-center text-slate-400 py-10">
                            <CameraIcon className="w-10 h-10 mb-2 opacity-30" />
                            <p className="text-xs font-bold uppercase">No scan history</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
