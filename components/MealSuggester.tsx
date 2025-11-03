import React, { useState } from 'react';
import type { NutritionInfo, Ingredient } from '../types';
import { MealSuggestionCard } from './MealSuggestionCard';
import { LightBulbIcon } from './icons';

interface MealSuggesterProps {
    onGetSuggestions: (condition: string) => void;
    suggestions: NutritionInfo[] | null;
    isLoading: boolean;
    error: string | null;
    onAddToPlan: (ingredients: Ingredient[]) => void;
    onSaveMeal: (meal: NutritionInfo) => void;
}

const conditions = [
    { id: 'diabetes', name: 'Diabetes', description: 'Focuses on low-glycemic foods to manage blood sugar.' },
    { id: 'high-blood-pressure', name: 'High Blood Pressure', description: 'Emphasizes low-sodium and potassium-rich meals.' },
    { id: 'high-cholesterol', name: 'High Cholesterol', description: 'Highlights meals low in saturated fats and high in fiber.' },
];

export const MealSuggester: React.FC<MealSuggesterProps> = ({ onGetSuggestions, suggestions, isLoading, error, onAddToPlan, onSaveMeal }) => {
    const [selectedCondition, setSelectedCondition] = useState<string | null>(null);
    
    const handleSelectCondition = (conditionId: string) => {
        setSelectedCondition(conditionId);
        onGetSuggestions(conditionId);
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 space-y-6">
            <div className="text-center">
                 <div className="mx-auto bg-amber-100 text-amber-600 rounded-full w-14 h-14 flex items-center justify-center mb-3">
                    <LightBulbIcon />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">AI Meal Ideas</h2>
                <p className="text-slate-600 mt-1">Get personalized meal suggestions for your dietary needs.</p>
            </div>

            <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-3 text-center">Select a dietary profile:</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {conditions.map(condition => (
                        <button
                            key={condition.id}
                            onClick={() => handleSelectCondition(condition.id)}
                            disabled={isLoading}
                            className={`p-4 border rounded-lg text-left transition-all duration-200 transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-wait ${
                                selectedCondition === condition.id ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-300' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
                            }`}
                        >
                            <p className="font-bold text-slate-800">{condition.name}</p>
                            <p className="text-sm text-slate-500 mt-1">{condition.description}</p>
                        </button>
                    ))}
                </div>
            </div>

            {isLoading && (
                 <div className="flex flex-col items-center justify-center p-8">
                    <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 text-slate-600 font-semibold">Generating fresh ideas for you...</p>
                </div>
            )}

            {error && !isLoading && (
                 <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                    <p className="font-bold">Couldn't get suggestions.</p>
                    <p>{error}</p>
                </div>
            )}

            {!isLoading && !error && suggestions && (
                <div>
                    <h3 className="text-xl font-bold text-slate-800 mb-4 border-t border-slate-200 pt-6">
                        Top Suggestions for <span className="text-emerald-500">{conditions.find(c => c.id === selectedCondition)?.name}</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {suggestions.map((meal, index) => (
                            <MealSuggestionCard 
                                key={index} 
                                meal={meal}
                                onAddToPlan={onAddToPlan}
                                onSaveMeal={onSaveMeal}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
