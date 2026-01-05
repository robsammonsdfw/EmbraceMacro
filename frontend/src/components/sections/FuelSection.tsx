
import React, { useState } from 'react';
import { MealPlanManager } from '../MealPlanManager';
import { MealLibrary } from '../MealLibrary';
import { GroceryList } from '../GroceryList';
import type { MealPlan, SavedMeal, NutritionInfo } from '../../types';
import { PlusIcon, BookOpenIcon, ClipboardListIcon } from '../icons';

interface FuelSectionProps {
    plans: MealPlan[];
    activePlanId: number | null;
    savedMeals: SavedMeal[];
    onPlanChange: (id: number) => void;
    onCreatePlan: (name: string) => void;
    onRemoveFromPlan: (itemId: number) => void;
    onQuickAdd: (planId: number, meal: SavedMeal, day: string, slot: string) => void;
    onGenerateMedical: (diseases: any[], cuisine: string, duration: 'day' | 'week') => Promise<void>;
    medicalPlannerState: { isLoading: boolean; progress: number; status: string };
    onAddMealToLibrary: (meal: NutritionInfo) => void; // Usually opens modal
    onDeleteMeal: (id: number) => void;
    onSelectMeal: (meal: NutritionInfo) => void;
}

export const FuelSection: React.FC<FuelSectionProps> = ({
    plans, activePlanId, savedMeals, onPlanChange, onCreatePlan, onRemoveFromPlan, 
    onQuickAdd, onGenerateMedical, medicalPlannerState, onAddMealToLibrary, onDeleteMeal, onSelectMeal
}) => {
    const [activeTab, setActiveTab] = useState<'plan' | 'library' | 'grocery'>('plan');

    // Helper for library to adapt type
    const handleLibraryAdd = (meal: SavedMeal) => {
        // Just open the modal for logging, cast appropriately
        onAddMealToLibrary(meal);
    }

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Sub-navigation Tabs */}
            <div className="flex p-1 bg-slate-200 rounded-xl w-full md:w-fit mx-auto md:mx-0">
                <button 
                    onClick={() => setActiveTab('plan')}
                    className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'plan' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <PlusIcon className="w-4 h-4" /> Plan
                </button>
                <button 
                    onClick={() => setActiveTab('library')}
                    className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'library' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <BookOpenIcon className="w-4 h-4" /> Library
                </button>
                <button 
                    onClick={() => setActiveTab('grocery')}
                    className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'grocery' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <ClipboardListIcon className="w-4 h-4" /> Grocery
                </button>
            </div>

            {/* Content Area */}
            <div className="min-h-[600px]">
                {activeTab === 'plan' && (
                    <MealPlanManager 
                        plans={plans} 
                        activePlanId={activePlanId} 
                        savedMeals={savedMeals}
                        onPlanChange={onPlanChange}
                        onCreatePlan={onCreatePlan}
                        onRemoveFromPlan={onRemoveFromPlan}
                        onQuickAdd={onQuickAdd}
                        onGenerateMedical={onGenerateMedical}
                        medicalPlannerState={medicalPlannerState}
                    />
                )}
                {activeTab === 'library' && (
                    <MealLibrary 
                        meals={savedMeals}
                        onAdd={handleLibraryAdd}
                        onDelete={onDeleteMeal}
                        onSelectMeal={onSelectMeal}
                    />
                )}
                {activeTab === 'grocery' && (
                    <GroceryList mealPlans={plans} />
                )}
            </div>
        </div>
    );
};
