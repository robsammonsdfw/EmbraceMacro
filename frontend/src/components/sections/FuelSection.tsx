
import React, { useState, useEffect } from 'react';
import { MealPlanManager } from '../MealPlanManager';
import { MealLibrary } from '../MealLibrary';
import { GroceryList } from '../GroceryList';
import { MealHistory } from '../MealHistory';
import type { MealPlan, SavedMeal, NutritionInfo, MealLogEntry } from '../../types';
import { PlusIcon, BookOpenIcon, ClipboardListIcon, ClockIcon } from '../icons';

interface FuelSectionProps {
    plans: MealPlan[];
    activePlanId: number | null;
    savedMeals: SavedMeal[];
    mealLog: MealLogEntry[];
    onPlanChange: (id: number) => void;
    onCreatePlan: (name: string) => void;
    onRemoveFromPlan: (itemId: number) => void;
    onQuickAdd: (planId: number, meal: SavedMeal, day: string, slot: string) => void;
    onGenerateMedical: (diseases: any[], cuisine: string, duration: 'day' | 'week') => Promise<void>;
    medicalPlannerState: { isLoading: boolean; progress: number; status: string };
    onAddMealToLibrary: (meal: NutritionInfo) => void; 
    onDeleteMeal: (id: number) => void;
    onSelectMeal: (meal: NutritionInfo) => void;
    onManualLibraryAdd?: (query: string) => void;
    onManualLogAdd?: (query: string) => void;
    onScanClick?: () => void;
    defaultTab?: 'plan' | 'library' | 'grocery' | 'history';
}

export const FuelSection: React.FC<FuelSectionProps> = ({
    plans, activePlanId, savedMeals, mealLog, onPlanChange, onCreatePlan, onRemoveFromPlan, 
    onQuickAdd, onGenerateMedical, medicalPlannerState, onAddMealToLibrary, onDeleteMeal, onSelectMeal,
    onManualLibraryAdd, onManualLogAdd, onScanClick, defaultTab
}) => {
    const [activeTab, setActiveTab] = useState<'plan' | 'library' | 'grocery' | 'history'>('plan');

    // Sync defaultTab prop to local state when it changes
    useEffect(() => {
        if (defaultTab) {
            setActiveTab(defaultTab);
        }
    }, [defaultTab]);

    const handleHistoryAdd = (mealData: NutritionInfo) => {
        // Logic to add to plan from history
        if (activePlanId) {
            console.log("Add from history", mealData);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Sub-navigation Tabs */}
            <div className="flex p-1 bg-slate-200 rounded-xl w-full md:w-fit mx-auto md:mx-0 overflow-x-auto">
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
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <ClockIcon className="w-4 h-4" /> History
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
                        onAdd={onAddMealToLibrary}
                        onDelete={onDeleteMeal}
                        onSelectMeal={onSelectMeal}
                        onManualLibraryAdd={onManualLibraryAdd}
                        onScanClick={onScanClick}
                    />
                )}
                {activeTab === 'history' && (
                    <MealHistory 
                        logEntries={mealLog}
                        onAddToPlan={handleHistoryAdd}
                        onSaveMeal={onAddMealToLibrary}
                        onSelectMeal={onSelectMeal}
                        onManualLogAdd={onManualLogAdd}
                        onScanClick={onScanClick}
                    />
                )}
                {activeTab === 'grocery' && (
                    <GroceryList mealPlans={plans} />
                )}
            </div>
        </div>
    );
};
