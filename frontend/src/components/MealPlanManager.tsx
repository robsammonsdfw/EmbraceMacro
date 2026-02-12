
import React, { useState, useEffect } from 'react';
import type { MealPlan, SavedMeal } from '../types';
import { BeakerIcon, PlusIcon, TrashIcon, BookOpenIcon, CameraOffIcon, SearchIcon, XIcon, UtensilsIcon } from './icons';
import { MedicalPlannerModal } from './MedicalPlannerModal';

interface MealPlanManagerProps {
    plans: MealPlan[];
    activePlanId: number | null;
    savedMeals: SavedMeal[];
    onPlanChange: (id: number) => void;
    onCreatePlan: (name: string) => void;
    onRemoveFromPlan: (itemId: number) => void;
    onQuickAdd: (planId: number, meal: SavedMeal, day: string, slot: string) => void;
    onGenerateMedical: (diseases: any[], cuisine: string, duration: 'day' | 'week') => Promise<void>;
    medicalPlannerState: { isLoading: boolean; progress: number; status: string };
    initialMedicalParams?: { conditions: string[], cuisine: string, duration: string };
}

const FIXED_SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const MealPlanManager: React.FC<MealPlanManagerProps> = ({ 
    plans, activePlanId, savedMeals, onPlanChange, onCreatePlan, onRemoveFromPlan, onQuickAdd,
    onGenerateMedical, medicalPlannerState, initialMedicalParams
}) => {
    const [isMedicalModalOpen, setIsMedicalModalOpen] = useState(false);
    const [newPlanName, setNewPlanName] = useState('');
    const [isCreatingPlan, setIsCreatingPlan] = useState(false);
    const [draggingMealId, setDraggingMealId] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDay, setSelectedDay] = useState<string>(DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);
    const [isMobileLibraryOpen, setIsMobileLibraryOpen] = useState(false);
    const [pendingSlot, setPendingSlot] = useState<string | null>(null);

    // Auto-launch medical planner if params provided (e.g. from Article)
    useEffect(() => {
        if (initialMedicalParams) {
            setIsMedicalModalOpen(true);
        }
    }, [initialMedicalParams]);

    const activePlan = plans.find(p => p.id === activePlanId);

    const filteredSavedMeals = savedMeals.filter(m => 
        m.mealName.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
        const mealIdString = e.dataTransfer.getData('mealId');
        if (!mealIdString) return;
        
        const mealId = parseInt(mealIdString, 10);
        const meal = savedMeals.find(m => m.id === mealId);
        
        if (meal && activePlanId) {
            onQuickAdd(activePlanId, meal, selectedDay, slot);
        }
        setDraggingMealId(null);
    };

    const handleSlotClick = (slot: string, hasItem: boolean) => {
        if (!hasItem) {
            setPendingSlot(slot);
            setIsMobileLibraryOpen(true);
        }
    };

    const handleMealSelect = (meal: SavedMeal) => {
        if (activePlanId && pendingSlot) {
            onQuickAdd(activePlanId, meal, selectedDay, pendingSlot);
            setIsMobileLibraryOpen(false);
            setPendingSlot(null);
        }
    };

    const handleCreatePlanSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newPlanName.trim()) {
            onCreatePlan(newPlanName);
            setNewPlanName('');
            setIsCreatingPlan(false);
        }
    };

    const handleDoMedicalGeneration = async (diseases: any[], cuisine: string, duration: 'day' | 'week') => {
        await onGenerateMedical(diseases, cuisine, duration);
        setIsMedicalModalOpen(false);
    };

    const LibraryContent = (
        <div className="flex flex-col h-full bg-white">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
                <div className="flex justify-between items-center mb-3 lg:block">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <BookOpenIcon className="text-indigo-600 w-5 h-5" /> My Library
                    </h3>
                    <button 
                        onClick={() => { setIsMobileLibraryOpen(false); setPendingSlot(null); }}
                        className="lg:hidden p-2 text-slate-400 hover:text-slate-600 bg-white rounded-lg border border-slate-200 shadow-sm"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>
                {pendingSlot && (
                    <div className="mb-3 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-md border border-indigo-100 flex items-center justify-between">
                        <span>Adding to {pendingSlot}</span>
                        <button onClick={() => setPendingSlot(null)} className="text-indigo-400 hover:text-indigo-600">Cancel</button>
                    </div>
                )}
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Search meals..." 
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <div className="absolute left-3 top-3 text-slate-400">
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
                        onClick={() => handleMealSelect(meal)}
                        className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm cursor-pointer lg:cursor-grab active:cursor-grabbing hover:shadow-md hover:border-indigo-300 transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-100">
                                {meal.imageUrl ? (
                                    <img src={meal.imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300 scale-75"><CameraOffIcon /></div>
                                )}
                            </div>
                            <div className="flex-grow min-w-0">
                                <div className="flex justify-between items-start">
                                    <p className="font-black text-slate-800 text-xs uppercase truncate leading-tight">{meal.mealName}</p>
                                    <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-black border border-emerald-100 shrink-0 ml-2">ADD</span>
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{Math.round(meal.totalCalories)} kcal</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-100px)] animate-fade-in relative overflow-hidden">
            {isMedicalModalOpen && (
                <MedicalPlannerModal 
                    onClose={() => setIsMedicalModalOpen(false)}
                    onGenerate={handleDoMedicalGeneration} 
                    isLoading={medicalPlannerState.isLoading}
                    progress={medicalPlannerState.progress}
                    status={medicalPlannerState.status}
                    initialDiseases={initialMedicalParams?.conditions}
                />
            )}

            <div className={`fixed inset-y-0 right-0 z-50 w-72 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-slate-200 lg:hidden ${isMobileLibraryOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                {LibraryContent}
            </div>

            {isMobileLibraryOpen && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => { setIsMobileLibraryOpen(false); setPendingSlot(null); }} />}

            <div className="hidden lg:flex w-1/3 flex-col bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
                {LibraryContent}
            </div>

            <div className="w-full lg:w-2/3 flex flex-col">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm mb-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Meal Planner</h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Curate your metabolic day</p>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            {isCreatingPlan ? (
                                <form onSubmit={handleCreatePlanSubmit} className="flex gap-2 w-full sm:w-auto animate-fade-in">
                                    <input type="text" value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)} placeholder="Plan Name" className="border-2 border-indigo-100 rounded-xl px-4 py-2.5 text-sm font-bold w-full focus:border-indigo-500 outline-none" autoFocus />
                                    <button type="submit" className="bg-indigo-600 text-white px-4 rounded-xl text-xs font-black uppercase tracking-widest">Save</button>
                                    <button type="button" onClick={() => setIsCreatingPlan(false)} className="bg-slate-100 text-slate-400 px-3 rounded-xl hover:bg-slate-200 transition-colors">X</button>
                                </form>
                            ) : (
                                <div className="flex gap-2 w-full">
                                    <select className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-tighter bg-slate-50 text-slate-700 flex-grow sm:flex-grow-0 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={activePlanId || ''} onChange={(e) => onPlanChange(Number(e.target.value))}>
                                        {plans.length === 0 && <option value="">No Active Plans</option>}
                                        {plans.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                                    </select>
                                    <button onClick={() => setIsCreatingPlan(true)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all shadow-md active:scale-95"><PlusIcon className="w-4 h-4" /> New</button>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Day Picker with better feedback */}
                    <div className="flex overflow-x-auto no-scrollbar gap-2 pb-2">
                        {DAYS.map(day => (
                            <button 
                                key={day} 
                                onClick={() => setSelectedDay(day)} 
                                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-2 active:scale-95 ${
                                    selectedDay === day 
                                    ? 'bg-emerald-500 border-emerald-600 text-white shadow-lg shadow-emerald-100' 
                                    : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                {day}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-grow space-y-4 overflow-y-auto pr-1 pb-24 lg:pb-10 no-scrollbar">
                    {FIXED_SLOTS.map((slot) => {
                        const slotItem = activePlan?.items.find(item => item.metadata?.slot === slot && item.metadata?.day === selectedDay);
                        const isPending = pendingSlot === slot;
                        return (
                            <div key={slot} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, slot)} onClick={() => handleSlotClick(slot, !!slotItem)} className={`relative p-5 rounded-3xl border-2 transition-all min-h-[140px] flex flex-col justify-center cursor-pointer shadow-sm ${draggingMealId && !slotItem ? 'border-dashed border-indigo-400 bg-indigo-50/50' : ''} ${!slotItem && isPending ? 'border-emerald-500 ring-4 ring-emerald-50 bg-emerald-50/20' : 'border-slate-100 bg-white'} ${!slotItem && !isPending ? 'hover:border-indigo-200 hover:bg-slate-50 group' : ''} ${slotItem ? 'bg-slate-50 border-transparent shadow-none' : ''}`}>
                                <div className="absolute top-4 left-6 flex items-center gap-2 pointer-events-none">
                                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${isPending ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>{slot}</span>
                                    {slotItem && <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black px-1.5 py-0.5 rounded border border-emerald-100 uppercase">Tracked</span>}
                                </div>
                                {slotItem ? (
                                    <div className="flex items-center justify-between mt-5 animate-fade-in">
                                        <div className="flex items-center gap-5">
                                            <div className="w-16 h-16 rounded-2xl bg-white overflow-hidden flex-shrink-0 shadow-sm border border-slate-100">{slotItem.meal.imageUrl ? (<img src={slotItem.meal.imageUrl} alt="" className="w-full h-full object-cover" />) : (<div className="flex items-center justify-center h-full text-slate-200"><UtensilsIcon className="w-6 h-6" /></div>)}</div>
                                            <div><h4 className="font-black text-slate-800 text-sm uppercase tracking-tight leading-tight">{slotItem.meal.mealName}</h4><div className="flex items-center gap-3 mt-1.5"><span className="text-emerald-600 font-black text-xs">{Math.round(slotItem.meal.totalCalories)} KCAL</span><span className="w-1 h-1 rounded-full bg-slate-300"></span><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{Math.round(slotItem.meal.totalProtein)}g Pro</span></div></div>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); onRemoveFromPlan(slotItem.id); }} className="p-3 text-slate-300 hover:text-rose-500 hover:bg-white rounded-2xl transition-all shadow-none hover:shadow-sm"><TrashIcon className="w-5 h-5" /></button>
                                    </div>
                                ) : (<div className="flex flex-col items-center justify-center text-slate-400 mt-5 pointer-events-none">{draggingMealId ? (<div className="flex flex-col items-center gap-2 animate-bounce"><PlusIcon className="w-8 h-8 text-indigo-500" /><span className="text-indigo-600 font-black uppercase text-[10px] tracking-widest">Drop Meal Here</span></div>) : (<div className="flex flex-col items-center gap-2"><div className={`p-4 rounded-2xl transition-all ${isPending ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-200 animate-pulse' : 'bg-slate-50 text-slate-300 group-hover:text-indigo-500 group-hover:bg-indigo-50'}`}><PlusIcon className="w-6 h-6" /></div><span className={`text-[10px] font-black uppercase tracking-widest mt-2 ${isPending ? 'text-emerald-700' : 'text-slate-300'}`}>{isPending ? 'Select from Library' : 'Empty Slot'}</span></div>)}</div>)}
                            </div>
                        );
                    })}
                    <button onClick={() => setIsMedicalModalOpen(true)} className="w-full py-6 mt-8 border-4 border-dashed border-indigo-100 bg-indigo-50/20 rounded-[2.5rem] text-indigo-500 font-black uppercase tracking-[0.2em] text-[10px] hover:bg-indigo-50 hover:border-indigo-200 transition-all flex items-center justify-center gap-3 shadow-sm"><BeakerIcon className="w-5 h-5" /> Generate AI Plan</button>
                </div>
            </div>
        </div>
    );
};
