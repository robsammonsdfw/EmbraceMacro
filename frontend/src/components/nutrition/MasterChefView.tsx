
import React, { useState, useEffect, useRef } from 'react';
import { CameraIcon, UtensilsIcon, ClockIcon, BookOpenIcon } from '../icons';
import * as apiService from '../../services/apiService';
import type { SavedMeal, NutritionInfo } from '../../types';
import { NutritionCard } from '../NutritionCard';
import { RecipeCard } from '../RecipeCard';
import { ImageViewModal } from '../ImageViewModal';
import { Loader } from '../Loader';

interface MasterChefViewProps {
    savedMeals: SavedMeal[];
    onSaveMeal: (meal: any) => void;
}

export const MasterChefView: React.FC<MasterChefViewProps> = ({ savedMeals, onSaveMeal }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [restaurantLog, setRestaurantLog] = useState<any[]>([]);
    const [analysisResult, setAnalysisResult] = useState<NutritionInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [viewImageId, setViewImageId] = useState<number | null>(null);

    // Initial Load
    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const history = await apiService.getRestaurantLog();
            setRestaurantLog(history);
        } catch (e) {
            console.error("Failed to load restaurant history", e);
        }
    };

    const handleCameraClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setStatus('Deconstructing dish...');
        setAnalysisResult(null);

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = (reader.result as string).split(',')[1];
            try {
                // 1. Save to Restaurant Log
                await apiService.saveRestaurantLogEntry(base64String);
                loadHistory();

                // 2. Analyze Meal
                const data = await apiService.analyzeRestaurantMeal(base64String, file.type);
                setAnalysisResult(data);
            } catch (err) {
                alert("Failed to analyze restaurant meal.");
            } finally {
                setIsLoading(false);
                setStatus('');
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleSaveAnalyzed = (meal: NutritionInfo) => {
        const mealToSave = { ...meal, source: 'restaurant' };
        onSaveMeal(mealToSave);
        alert("Recipe saved to Library!");
        setAnalysisResult(null); // Clear after save
    };

    // Filter SavedMeals to show only those marked as 'restaurant'
    const savedRecipes = savedMeals.filter(m => m.source === 'restaurant');

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-fade-in">
            {viewImageId && <ImageViewModal itemId={viewImageId} type="restaurant" onClose={() => setViewImageId(null)} />}
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

            <header className="flex items-center gap-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full">
                    <UtensilsIcon className="w-8 h-8" />
                </div>
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">MasterChef Replicator</h2>
                    <p className="text-slate-500 font-medium">Reverse-engineer restaurant dishes into recipes.</p>
                </div>
            </header>

            {/* Action Area */}
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden group">
                <div className="absolute -right-10 -bottom-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
                    <UtensilsIcon className="w-64 h-64" />
                </div>
                
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="text-center md:text-left">
                        <h3 className="text-2xl font-black mb-2">Dining Out?</h3>
                        <p className="text-indigo-100 font-medium max-w-md">Snap a photo of your meal. AI will analyze the macros and generate a replication recipe for home cooking.</p>
                    </div>
                    <button 
                        onClick={handleCameraClick}
                        className="bg-white text-indigo-600 font-black px-8 py-4 rounded-2xl shadow-lg hover:bg-indigo-50 active:scale-95 transition-all flex items-center gap-3"
                    >
                        <CameraIcon className="w-6 h-6" />
                        <span>Analyze Dish</span>
                    </button>
                </div>
            </div>

            {isLoading && <Loader message={status} />}

            {/* Analysis Result */}
            {analysisResult && !isLoading && (
                <div className="space-y-6">
                    <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs border-b border-slate-200 pb-2">Analysis Result</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <NutritionCard data={analysisResult} onSaveToHistory={() => handleSaveAnalyzed(analysisResult)} />
                        {analysisResult.recipe && (
                            <RecipeCard recipe={analysisResult.recipe} onAddToPlan={() => handleSaveAnalyzed(analysisResult)} />
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Saved MasterChef Recipes */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-full flex flex-col">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                        <BookOpenIcon className="w-5 h-5 text-indigo-500" /> Replicated Recipes
                    </h3>
                    {savedRecipes.length > 0 ? (
                        <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 flex-grow">
                            {savedRecipes.map(meal => (
                                <div key={meal.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors">
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{meal.mealName}</p>
                                        <p className="text-xs text-slate-500">{Math.round(meal.totalCalories)} kcal • Restaurant Style</p>
                                    </div>
                                    <button className="text-xs font-bold text-indigo-600 bg-white border border-indigo-100 px-3 py-1.5 rounded-lg shadow-sm">View</button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex-grow flex flex-col items-center justify-center text-slate-400 py-10">
                            <BookOpenIcon className="w-10 h-10 mb-2 opacity-30" />
                            <p className="text-xs font-bold uppercase">No replicated recipes yet</p>
                        </div>
                    )}
                </div>

                {/* Restaurant History */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-full flex flex-col">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                        <ClockIcon className="w-5 h-5 text-emerald-500" /> Dining History
                    </h3>
                    {restaurantLog.length > 0 ? (
                        <div className="grid grid-cols-3 gap-3 overflow-y-auto max-h-[400px] pr-2 flex-grow content-start">
                            {restaurantLog.map(entry => (
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
                            <p className="text-xs font-bold uppercase">No dining history</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
