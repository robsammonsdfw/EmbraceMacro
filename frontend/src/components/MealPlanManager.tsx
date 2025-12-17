
import React, { useState } from 'react';
import type { MealPlan, SavedMeal, NutritionInfo } from '../types';
import { BeakerIcon, PlusIcon, TrashIcon, BookOpenIcon, CameraOffIcon, SearchIcon } from './icons';
import { MedicalPlannerModal } from './MedicalPlannerModal';

interface MealPlanManagerProps {
    plans: MealPlan[];
    activePlanId: number | null;
    savedMeals: SavedMeal[];
    onPlanChange: (id: number) => void;
    onCreatePlan: (name: string) => void;
    onAddToPlan: (meal: SavedMeal | NutritionInfo) => void; 
    onRemoveFromPlan: (itemId: number) => void;
    onQuickAdd: (planId: number, meal: SavedMeal, day: string, slot: string) => void;
}

const FIXED_SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const MealPlanManager: React.FC<MealPlanManagerProps> = ({ 
    plans, activePlanId, savedMeals, onPlanChange, onCreatePlan, onAddToPlan, onRemoveFromPlan, onQuickAdd
}) => {
    const [isMedicalModalOpen, setIsMedicalModalOpen] = useState(false);
    const [newPlanName, setNewPlanName] = useState('');
    const [isCreatingPlan, setIsCreatingPlan] = useState(false);
    const [draggingMealId, setDraggingMealId] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDay, setSelectedDay] = useState<string>('Monday'); // Default to Monday for this view

    const activePlan = plans.find(p => p.id === activePlanId);

    // -- Drag & Drop Handlers --
    const handleDragStart = (e: React.DragEvent, meal: SavedMeal) => {
        setDraggingMealId(meal.id);
        e.dataTransfer.setData('mealId', meal.id.toString());
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e: React.DragEvent, slot: string) => {
        e.preventDefault();
        const mealId = parseInt(e.dataTransfer.getData('mealId'), 10);
        const meal = savedMeals.find(m => m.id === mealId);
        
        if (meal && activePlanId) {
            onQuickAdd(activePlanId, meal, selectedDay, slot);
        }
        setDraggingMealId(null);
    };

    const handleCreatePlanSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newPlanName.trim()) {
            onCreatePlan(newPlanName);
            setNewPlanName('');
            setIsCreatingPlan(false);
        }
    };

    // Filter meals for sidebar
    const filteredSavedMeals = savedMeals.filter(m => 
        m.mealName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-100px)] animate-fade-in">
            {isMedicalModalOpen && (
                <MedicalPlannerModal 
                    onClose={() => setIsMedicalModalOpen(false)}
                    onGenerate={() => {}} 
                    isLoading={false}
                />
            )}

            {/* LEFT COLUMN: Saved Meals (Draggable Source) */}
            <div className="w-full lg:w-1/3 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden order-2 lg:order-1">
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <BookOpenIcon /> My Kitchen Library
                    </h3>
                    <div className="mt-3 relative">
                        <input 
                            type="text" 
                            placeholder="Search saved meals..." 
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <div className="absolute left-3 top-2.5 text-slate-400">
                            <SearchIcon />
                        </div>
                    </div>
                </div>
                
                <div className="flex-grow overflow-y-auto p-3 space-y-3 bg-slate-50/50">
                    {filteredSavedMeals.map(meal => (
                        <div 
                            key={meal.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, meal)}
                            className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md hover:border-emerald-300 transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-md bg-slate-100 flex-shrink-0 overflow-hidden">
                                    {meal.imageUrl ? (
                                        <img src={meal.imageUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-300"><CameraOffIcon /></div>
                                    )}
                                </div>
                                <div className="flex-grow min-w-0">
                                    <p className="font-semibold text-slate-800 text-sm truncate">{meal.mealName}</p>
                                    <p className="text-xs text-slate-500">{Math.round(meal.totalCalories)} kcal • {Math.round(meal.totalProtein)}g Pro</p>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="bg-slate-100 p-1.5 rounded text-slate-400">
                                        <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
                                            <div className="bg-current rounded-[1px]"></div>
                                            <div className="bg-current rounded-[1px]"></div>
                                            <div className="bg-current rounded-[1px]"></div>
                                            <div className="bg-current rounded-[1px]"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredSavedMeals.length === 0 && (
                        <div className="text-center py-10 text-slate-400 text-sm">
                            No meals found. Save some meals first!
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT COLUMN: The Plan (Drop Zones) */}
            <div className="w-full lg:w-2/3 flex flex-col order-1 lg:order-2">
                {/* Header & Controls */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">Meal Planner</h2>
                            <p className="text-sm text-slate-500">Drag meals from the library to build your day.</p>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            {isCreatingPlan ? (
                                <form onSubmit={handleCreatePlanSubmit} className="flex gap-2 w-full sm:w-auto">
                                    <input 
                                        type="text" 
                                        value={newPlanName}
                                        onChange={(e) => setNewPlanName(e.target.value)}
                                        placeholder="Plan Name" 
                                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full"
                                        autoFocus
                                    />
                                    <button type="submit" className="bg-emerald-500 text-white px-3 py-2 rounded-lg text-sm font-bold">Save</button>
                                    <button type="button" onClick={() => setIsCreatingPlan(false)} className="bg-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm">X</button>
                                </form>
                            ) : (
                                <div className="flex gap-2 w-full">
                                    <select 
                                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold bg-slate-50 text-slate-700 flex-grow sm:flex-grow-0"
                                        value={activePlanId || ''}
                                        onChange={(e) => onPlanChange(Number(e.target.value))}
                                    >
                                        {plans.length === 0 && <option value="">No Plans</option>}
                                        {plans.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    <button 
                                        onClick={() => setIsCreatingPlan(true)}
                                        className="bg-slate-900 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1 hover:bg-slate-700 transition-colors whitespace-nowrap"
                                    >
                                        <PlusIcon /> New
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Day Selector (Visual Only for this demo, assuming standard week) */}
                    <div className="flex overflow-x-auto no-scrollbar gap-2 pb-2 border-b border-slate-100">
                        {DAYS.map(day => (
                            <button
                                key={day}
                                onClick={() => setSelectedDay(day)}
                                className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${
                                    selectedDay === day 
                                    ? 'bg-emerald-100 text-emerald-700' 
                                    : 'text-slate-500 hover:bg-slate-100'
                                }`}
                            >
                                {day}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Drop Zones */}
                <div className="flex-grow space-y-4 overflow-y-auto pr-1">
                    {FIXED_SLOTS.map((slot) => {
                        // Find item in this slot for the active plan
                        // NOTE: In a real app, we filter by day as well. 
                        // For this demo, we assume the 'items' array contains items for the *current* view or all.
                        // We will filter by slot name in metadata.
                        const slotItem = activePlan?.items.find(item => item.metadata?.slot === slot && item.metadata?.day === selectedDay);

                        return (
                            <div 
                                key={slot}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, slot)}
                                className={`
                                    relative p-4 rounded-xl border-2 transition-all min-h-[120px] flex flex-col justify-center
                                    ${draggingMealId && !slotItem ? 'border-dashed border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white shadow-sm'}
                                `}
                            >
                                <div className="absolute top-3 left-4 text-xs font-bold text-slate-400 uppercase tracking-wider pointer-events-none">
                                    {slot}
                                </div>

                                {slotItem ? (
                                    <div className="flex items-center justify-between mt-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                                                {slotItem.meal.imageUrl ? (
                                                    <img src={slotItem.meal.imageUrl} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="flex items-center justify-center h-full text-slate-300"><UtensilsIcon /></div>
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800">{slotItem.meal.mealName}</h4>
                                                <p className="text-sm text-slate-500">
                                                    {Math.round(slotItem.meal.totalCalories)} kcal • {Math.round(slotItem.meal.totalProtein)}g Pro
                                                </p>
                                                {slotItem.metadata?.portion && slotItem.metadata.portion !== 1 && (
                                                    <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-bold">
                                                        {slotItem.metadata.portion}x Portion
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => onRemoveFromPlan(slotItem.id)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                            title="Remove from plan"
                                        >
                                            <TrashIcon />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-slate-400 mt-4 pointer-events-none">
                                        {draggingMealId ? (
                                            <span className="text-emerald-600 font-bold animate-pulse">Drop here to assign</span>
                                        ) : (
                                            <>
                                                <span className="text-sm">Empty Slot</span>
                                            </>
                                        )}
                                    </div>
                                )}
                                
                                {/* Fallback "Add" button for non-drag interactions */}
                                {!slotItem && !draggingMealId && (
                                    <button 
                                        onClick={() => onAddToPlan({ mealName: '', totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, ingredients: [] })} 
                                        className="absolute bottom-3 right-3 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-full font-bold transition-colors"
                                    >
                                        + Log
                                    </button>
                                )}
                            </div>
                        );
                    })}

                    <button 
                        onClick={() => setIsMedicalModalOpen(true)}
                        className="w-full py-4 mt-4 border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-2xl text-indigo-500 font-bold hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                    >
                        <BeakerIcon /> Generate Full Day Plan with AI
                    </button>
                </div>
            </div>
        </div>
    );
};

// Simple Utensils Icon for internal use if missing from imports
const UtensilsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
);
    