import React, { useState } from 'react';
import type { MealPlan, SavedMeal, NutritionInfo } from '../types';
import { BeakerIcon, PlusIcon, TrashIcon, BookOpenIcon, CameraOffIcon, SearchIcon, XIcon } from './icons';
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
    const [selectedDay, setSelectedDay] = useState<string>('Monday');
    const [isMobileLibraryOpen, setIsMobileLibraryOpen] = useState(false);

    const activePlan = plans.find(p => p.id === activePlanId);

    // Filter meals for sidebar/drawer
    const filteredSavedMeals = savedMeals.filter(m => 
        m.mealName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // -- Drag & Drop Handlers --
    const handleDragStart = (e: React.DragEvent, meal: SavedMeal) => {
        setDraggingMealId(meal.id);
        e.dataTransfer.setData('mealId', meal.id.toString());
        e.dataTransfer.effectAllowed = 'copy';
        // On mobile, we might want to keep the drawer open during drag, 
        // but often dragging to a background element closes overlays.
        // For now we keep it simple.
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
        // Optional: close drawer after successful drop on mobile
        // setIsMobileLibraryOpen(false);
    };

    const handleCreatePlanSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newPlanName.trim()) {
            onCreatePlan(newPlanName);
            setNewPlanName('');
            setIsCreatingPlan(false);
        }
    };

    const LibraryContent = (
        <div className="flex flex-col h-full bg-white">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
                <div className="flex justify-between items-center mb-3 lg:block">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <BookOpenIcon /> My Library
                    </h3>
                    <button 
                        onClick={() => setIsMobileLibraryOpen(false)}
                        className="lg:hidden p-1 text-slate-400 hover:text-slate-600"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Search meals..." 
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <div className="absolute left-3 top-2.5 text-slate-400">
                        <SearchIcon className="w-4 h-4" />
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
                            <div className="w-10 h-10 rounded-md bg-slate-100 flex-shrink-0 overflow-hidden">
                                {meal.imageUrl ? (
                                    <img src={meal.imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300 scale-75"><CameraOffIcon /></div>
                                )}
                            </div>
                            <div className="flex-grow min-w-0">
                                <p className="font-semibold text-slate-800 text-xs truncate">{meal.mealName}</p>
                                <p className="text-[10px] text-slate-500">{Math.round(meal.totalCalories)} kcal</p>
                            </div>
                        </div>
                    </div>
                ))}
                {filteredSavedMeals.length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-xs">
                        No meals found.
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-100px)] animate-fade-in relative overflow-hidden">
            {isMedicalModalOpen && (
                <MedicalPlannerModal 
                    onClose={() => setIsMedicalModalOpen(false)}
                    onGenerate={() => {}} 
                    isLoading={false}
                />
            )}

            {/* MOBILE SLIDE-OUT DRAWER */}
            <div 
                className={`fixed inset-y-0 right-0 z-50 w-72 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-slate-200 lg:hidden ${
                    isMobileLibraryOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                {LibraryContent}
            </div>

            {/* DESKTOP SIDEBAR (Persistent) */}
            <div className="hidden lg:flex w-1/3 flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                {LibraryContent}
            </div>

            {/* MAIN PLAN AREA */}
            <div className="w-full lg:w-2/3 flex flex-col">
                {/* Header & Controls */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">Meal Planner</h2>
                            <p className="text-sm text-slate-500">Drag items to build your day.</p>
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
                                        <PlusIcon className="w-4 h-4" /> New
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Day Selector */}
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
                <div className="flex-grow space-y-4 overflow-y-auto pr-1 pb-10">
                    {FIXED_SLOTS.map((slot) => {
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
                                <div className="absolute top-3 left-4 flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider pointer-events-none">
                                        {slot}
                                    </span>
                                    {/* Mobile Library Trigger */}
                                    <button 
                                        onClick={() => setIsMobileLibraryOpen(true)}
                                        className="lg:hidden p-1 bg-slate-100 text-slate-500 rounded-md hover:bg-emerald-100 hover:text-emerald-600 transition-colors"
                                        title="Open Library"
                                    >
                                        <BookOpenIcon className="w-3 h-3" />
                                    </button>
                                </div>

                                {slotItem ? (
                                    <div className="flex items-center justify-between mt-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                                                {slotItem.meal.imageUrl ? (
                                                    <img src={slotItem.meal.imageUrl} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="flex items-center justify-center h-full text-slate-300"><UtensilsIcon className="w-5 h-5" /></div>
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-sm">{slotItem.meal.mealName}</h4>
                                                <p className="text-xs text-slate-500">
                                                    {Math.round(slotItem.meal.totalCalories)} kcal
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => onRemoveFromPlan(slotItem.id)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-slate-400 mt-4 pointer-events-none">
                                        {draggingMealId ? (
                                            <span className="text-emerald-600 font-bold animate-pulse text-sm">Drop here</span>
                                        ) : (
                                            <span className="text-sm">Empty Slot</span>
                                        )}
                                    </div>
                                )}
                                
                                {!slotItem && !draggingMealId && (
                                    <button 
                                        onClick={() => setIsMobileLibraryOpen(true)} 
                                        className="lg:hidden absolute bottom-3 right-3 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-full font-bold transition-colors"
                                    >
                                        + Drag Meal
                                    </button>
                                )}
                            </div>
                        );
                    })}

                    <button 
                        onClick={() => setIsMedicalModalOpen(true)}
                        className="w-full py-4 mt-4 border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-2xl text-indigo-500 font-bold hover:bg-indigo-100 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <BeakerIcon className="w-5 h-5" /> Generate Plan with AI
                    </button>
                </div>
            </div>
        </div>
    );
};

// Simple Utensils Icon for internal use
const UtensilsIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-6 w-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
);