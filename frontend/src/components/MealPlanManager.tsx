


import React, { useState, useMemo } from 'react';
import type { MealPlan, SavedMeal, NutritionInfo } from '../types';
import { PlusIcon, UserCircleIcon, GlobeAltIcon, StarIcon, CameraIcon, BeakerIcon } from './icons';
import { MedicalPlannerModal } from './MedicalPlannerModal';
import { DiseaseTemplate } from '../data/chronicDiseases';
import * as apiService from '../services/apiService';

interface MealPlanManagerProps {
    plans: MealPlan[];
    activePlanId: number | null;
    savedMeals: SavedMeal[];
    onPlanChange: (id: number) => void;
    onCreatePlan: (name: string) => void;
    onAddToPlan: (meal: SavedMeal | NutritionInfo) => void; // Trigger modal
    onRemoveFromPlan: (itemId: number) => void;
    onQuickAdd: (planId: number, meal: SavedMeal, day: string, slot: string) => void;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export const MealPlanManager: React.FC<MealPlanManagerProps> = ({ 
    plans, activePlanId, savedMeals, onPlanChange, onCreatePlan, onAddToPlan, onRemoveFromPlan, onQuickAdd 
}) => {
    const [viewMode, setViewMode] = useState<'plan' | 'discover'>('plan');
    const [selectedDay, setSelectedDay] = useState<string>(DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);
    const [isDrawerOpen, setIsDrawerOpen] = useState(true);
    const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
    
    // Creation State
    const [isCreating, setIsCreating] = useState(false);
    const [newPlanName, setNewPlanName] = useState('');

    // Medical Planner State
    const [isMedicalModalOpen, setIsMedicalModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeMedicalConditions, setActiveMedicalConditions] = useState<DiseaseTemplate[]>([]);

    const activePlan = plans.find(p => p.id === activePlanId);

    // Filter items for the selected day
    const getItemsForSlot = (slot: string) => {
        if (!activePlan) return [];
        return activePlan.items.filter(item => {
            const itemDay = item.metadata?.day || 'Monday'; // Default to Monday if legacy data
            const itemSlot = item.metadata?.slot || 'Lunch';
            return itemDay === selectedDay && itemSlot === slot;
        });
    };

    // Calculate Medical Compliance (Simple Metric)
    const complianceStats = useMemo(() => {
        if (activeMedicalConditions.length === 0 || !activePlan) return null;
        
        // Average target macros
        const targetP = activeMedicalConditions.reduce((sum, d) => sum + d.macros.p, 0) / activeMedicalConditions.length;
        const targetC = activeMedicalConditions.reduce((sum, d) => sum + d.macros.c, 0) / activeMedicalConditions.length;
        const targetF = activeMedicalConditions.reduce((sum, d) => sum + d.macros.f, 0) / activeMedicalConditions.length;

        // Current Plan Totals
        const totalCals = activePlan.items.reduce((sum, i) => sum + i.meal.totalCalories, 0);
        if (totalCals === 0) return null;

        const totalP = activePlan.items.reduce((sum, i) => sum + i.meal.totalProtein * 4, 0); // cal from protein
        const totalC = activePlan.items.reduce((sum, i) => sum + i.meal.totalCarbs * 4, 0);
        const totalF = activePlan.items.reduce((sum, i) => sum + i.meal.totalFat * 9, 0);

        const currentP = (totalP / totalCals) * 100;
        const currentC = (totalC / totalCals) * 100;
        const currentF = (totalF / totalCals) * 100;

        // Simple deviation score (lower is better)
        const deviation = Math.abs(targetP - currentP) + Math.abs(targetC - currentC) + Math.abs(targetF - currentF);
        const score = Math.max(0, 100 - deviation);

        return { score, targetP, targetC, targetF };
    }, [activePlan, activeMedicalConditions]);


    // Drag & Drop Handlers
    const handleDragStart = (e: React.DragEvent, meal: SavedMeal) => {
        e.dataTransfer.setData('mealId', meal.id.toString());
        e.dataTransfer.effectAllowed = 'copy';
        // Add a ghost image or styling here if desired
    };

    const handleDragOver = (e: React.DragEvent, slot: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDragOverSlot(slot);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverSlot(null);
    };

    const handleDrop = (e: React.DragEvent, slot: string) => {
        e.preventDefault();
        setDragOverSlot(null);
        const mealId = parseInt(e.dataTransfer.getData('mealId'));
        const meal = savedMeals.find(m => m.id === mealId);
        
        if (meal && activePlanId) {
            onQuickAdd(activePlanId, meal, selectedDay, slot);
        }
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newPlanName.trim()) {
            onCreatePlan(newPlanName);
            setNewPlanName('');
            setIsCreating(false);
        }
    };

    const handleMedicalGenerate = async (diseases: DiseaseTemplate[], cuisine: string, duration: 'day' | 'week') => {
        if (!activePlanId) {
            alert("Please create or select a plan first.");
            return;
        }
        
        setIsGenerating(true);
        setActiveMedicalConditions(diseases);

        try {
            const generatedMeals = await apiService.generateMedicalPlan(diseases, cuisine, duration);
            
            // Iterate and add meals to the plan
            // Note: In a real app, use a batch endpoint. Here we loop for minimal backend changes.
            for (const meal of generatedMeals) {
                // Ensure the meal has the necessary NutritionInfo properties
                const nutritionInfo: NutritionInfo = {
                    mealName: meal.mealName,
                    totalCalories: meal.totalCalories,
                    totalProtein: meal.totalProtein,
                    totalCarbs: meal.totalCarbs,
                    totalFat: meal.totalFat,
                    ingredients: meal.ingredients || [],
                    justification: meal.justification,
                    source: 'medical-ai'
                };

                // Use the backend's helper to add and link
                await apiService.addMealFromHistoryToPlan(activePlanId, nutritionInfo, {
                    day: meal.suggestedDay,
                    slot: meal.suggestedSlot,
                    portion: 1,
                    context: 'Medical Plan',
                    addToGrocery: true
                });
            }
            
            // Ideally we reload plans here to refresh the view, but we'll rely on the parent or next render cycle
            // Or force a quick timeout reload if available props allowed it. 
            // For now, close modal. The parent App.tsx doesn't automatically refetch, 
            // so the UI might lag until next interaction without a refresh callback.
            // But since onQuickAdd updates local state in App.tsx, we are technically missing that here.
            // We will assume the user manually refreshes or navigates for now, or minimal complexity accepts this limitation.
            window.location.reload(); // Hard refresh to show new items (simplest solution given constraints)

        } catch (error) {
            console.error(error);
            alert("Failed to generate plan. Please try again.");
        } finally {
            setIsGenerating(false);
            setIsMedicalModalOpen(false);
        }
    };

    // --- Discover View ---
    if (viewMode === 'discover') {
        return (
            <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden min-h-[600px] flex flex-col">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-center space-x-6">
                     <button onClick={() => setViewMode('plan')} className="text-slate-500 font-bold hover:text-emerald-600 transition-colors">My Plan</button>
                     <button className="text-emerald-600 font-bold border-b-2 border-emerald-500">Discover</button>
                </div>
                <div className="p-8 text-center flex-grow">
                     <div className="max-w-4xl mx-auto">
                        <h2 className="text-2xl font-bold text-slate-800 mb-6">Global Kitchen & Community</h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Mock Community Cards */}
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow">
                                    <div className="h-40 bg-slate-200 relative">
                                        <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded text-xs font-bold text-slate-600 flex items-center gap-1">
                                            <GlobeAltIcon /> Community
                                        </div>
                                    </div>
                                    <div className="p-4 text-left">
                                        <h3 className="font-bold text-slate-800">Spicy Tofu Bowl {i}</h3>
                                        <p className="text-xs text-slate-500 mb-3">by @ChefMike • 450 kcal</p>
                                        <div className="flex gap-2">
                                             <button 
                                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded text-xs"
                                                onClick={() => alert("Added to your Saved Meals (Mock)")}
                                             >
                                                Fork
                                             </button>
                                             <button 
                                                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 rounded text-xs"
                                                onClick={() => onAddToPlan({ 
                                                    mealName: `Community Meal ${i}`, 
                                                    totalCalories: 450, totalProtein: 20, totalCarbs: 50, totalFat: 15, ingredients: [], source: 'community' 
                                                })}
                                             >
                                                Add
                                             </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                     </div>
                </div>
            </div>
        );
    }

    // --- My Plan View ---
    return (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden min-h-[600px] flex flex-col md:flex-row">
            
            {isMedicalModalOpen && (
                <MedicalPlannerModal 
                    onClose={() => setIsMedicalModalOpen(false)}
                    onGenerate={handleMedicalGenerate}
                    isLoading={isGenerating}
                />
            )}

            {/* Main Board Area */}
            <div className={`flex-grow flex flex-col transition-all duration-300 ${isDrawerOpen ? 'md:w-2/3' : 'w-full'}`}>
                
                {/* Header: Toggle & Plan Selector */}
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex space-x-6">
                        <button className="text-emerald-600 font-bold border-b-2 border-emerald-500">My Plan</button>
                        <button onClick={() => setViewMode('discover')} className="text-slate-500 font-bold hover:text-emerald-600 transition-colors">Discover</button>
                    </div>

                    <div className="flex items-center gap-2">
                        {plans.length > 0 && (
                            <select
                                value={activePlanId ?? ''}
                                onChange={(e) => onPlanChange(Number(e.target.value))}
                                className="p-2 border border-slate-300 rounded-lg text-sm min-w-[150px]"
                            >
                                {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        )}
                        
                        {!isCreating ? (
                            <>
                                <button 
                                    onClick={() => setIsCreating(true)}
                                    className="bg-white border border-slate-300 text-slate-600 font-bold p-2 px-3 rounded-lg hover:bg-slate-50 flex items-center space-x-1"
                                    title="Create New Plan"
                                >
                                    <PlusIcon />
                                    <span className="text-xs">New</span>
                                </button>
                                <button 
                                    onClick={() => setIsMedicalModalOpen(true)}
                                    className="bg-indigo-600 text-white font-bold p-2 px-3 rounded-lg hover:bg-indigo-700 flex items-center space-x-1 shadow-sm"
                                    title="Medical AI Planner"
                                >
                                    <BeakerIcon />
                                    <span className="text-xs">Medical AI</span>
                                </button>
                            </>
                        ) : (
                            <form onSubmit={handleCreateSubmit} className="flex items-center gap-2">
                                <input 
                                    type="text" 
                                    autoFocus
                                    placeholder="Name..." 
                                    className="p-2 border border-slate-300 rounded-lg text-sm w-32"
                                    value={newPlanName}
                                    onChange={e => setNewPlanName(e.target.value)}
                                />
                                <button type="submit" className="text-emerald-600 font-bold text-sm">Save</button>
                                <button type="button" onClick={() => setIsCreating(false)} className="text-slate-400 font-bold text-lg">&times;</button>
                            </form>
                        )}
                    </div>
                </div>

                {/* Empty State if No Plans */}
                {plans.length === 0 && !isCreating && (
                    <div className="flex-grow flex flex-col items-center justify-center p-10 text-center">
                        <div className="bg-slate-100 p-6 rounded-full mb-4">
                            <PlusIcon />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">No Meal Plans Yet</h3>
                        <p className="text-slate-500 mb-6 max-w-sm">Create your first weekly plan or use the Medical AI to generate one.</p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setIsCreating(true)}
                                className="bg-emerald-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-emerald-600 shadow-md"
                            >
                                Create Empty Plan
                            </button>
                        </div>
                    </div>
                )}

                {/* Day Tabs (Only show if plans exist) */}
                {plans.length > 0 && (
                    <>
                        <div className="flex overflow-x-auto border-b border-slate-200 bg-white no-scrollbar">
                            {DAYS.map(day => (
                                <button
                                    key={day}
                                    onClick={() => setSelectedDay(day)}
                                    className={`flex-shrink-0 px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
                                        selectedDay === day 
                                        ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50' 
                                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    {day.substring(0, 3)}
                                </button>
                            ))}
                        </div>

                        {/* Slots Board */}
                        <div className="p-4 space-y-4 bg-slate-50/30 flex-grow overflow-y-auto">
                            {SLOTS.map(slot => {
                                const items = getItemsForSlot(slot);
                                const isOver = dragOverSlot === slot;
                                return (
                                    <div 
                                        key={slot} 
                                        className={`bg-white border rounded-xl p-4 transition-all ${
                                            isOver 
                                            ? 'border-emerald-400 ring-2 ring-emerald-200 bg-emerald-50' 
                                            : 'border-slate-200'
                                        }`}
                                        onDragOver={(e) => handleDragOver(e, slot)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, slot)}
                                    >
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex justify-between">
                                            {slot}
                                            {items.length > 0 && <span className="text-slate-300">{Math.round(items.reduce((sum, i) => sum + i.meal.totalCalories, 0))} kcal</span>}
                                        </h3>
                                        
                                        {items.length === 0 ? (
                                            <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-lg text-slate-400 text-sm">
                                                Drag from Favorites to Add
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {items.map(item => (
                                                    <div key={item.id} className="bg-white border border-slate-200 shadow-sm rounded-lg p-3 flex justify-between items-center group hover:border-emerald-300 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            {item.meal.hasImage && item.meal.imageUrl ? (
                                                                <div className="w-10 h-10 bg-slate-200 rounded-md bg-cover bg-center" style={{backgroundImage: `url(${item.meal.imageUrl})`}}></div>
                                                            ) : item.meal.hasImage ? (
                                                                <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded-md flex items-center justify-center text-slate-400">
                                                                    <div className="transform scale-75"><CameraIcon /></div>
                                                                </div>
                                                            ) : item.meal.source === 'medical-ai' ? (
                                                                <div className="w-10 h-10 bg-blue-50 border border-blue-200 text-blue-500 rounded-md flex items-center justify-center">
                                                                    <div className="transform scale-75"><BeakerIcon /></div>
                                                                </div>
                                                            ) : null}
                                                            <div>
                                                                <p className="font-bold text-slate-800 text-sm">{item.meal.mealName}</p>
                                                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                                                    <span className="font-medium text-emerald-600">{Math.round(item.meal.totalCalories)} kcal</span>
                                                                    {item.metadata?.portion && item.metadata.portion !== 1 && <span className="bg-slate-100 px-1 rounded">{item.metadata.portion}x</span>}
                                                                    {item.metadata?.context && <span className="text-slate-400">• {item.metadata.context}</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button onClick={() => onRemoveFromPlan(item.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            &times;
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Favorites Drawer (Right Side) */}
            <div className={`border-l border-slate-200 bg-white flex flex-col transition-all duration-300 ${isDrawerOpen ? 'md:w-1/3 min-w-[300px]' : 'w-12 items-center'}`}>
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    {isDrawerOpen && <h3 className="font-bold text-slate-700 flex items-center gap-2"><StarIcon /> Favorites</h3>}
                    <button onClick={() => setIsDrawerOpen(!isDrawerOpen)} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                        {isDrawerOpen ? '→' : '←'}
                    </button>
                </div>
                
                {isDrawerOpen && (
                    <div className="flex-grow overflow-y-auto p-4 space-y-3">
                        {/* Medical Compliance Tracker (If Active) */}
                        {complianceStats && (
                            <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                                <h4 className="text-xs font-bold text-indigo-800 uppercase mb-2 flex items-center gap-1">
                                    <BeakerIcon /> Medical Plan Tracker
                                </h4>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-indigo-700">Plan Adherence</span>
                                        <span className="font-bold text-indigo-900">{Math.round(complianceStats.score)}%</span>
                                    </div>
                                    <div className="w-full bg-indigo-200 rounded-full h-1.5">
                                        <div className="bg-indigo-600 h-1.5 rounded-full" style={{width: `${complianceStats.score}%`}}></div>
                                    </div>
                                    <p className="text-[10px] text-indigo-600 mt-1">
                                        Target: P{Math.round(complianceStats.targetP)}% / C{Math.round(complianceStats.targetC)}% / F{Math.round(complianceStats.targetF)}%
                                    </p>
                                </div>
                            </div>
                        )}

                        <p className="text-xs text-slate-400 text-center mb-2 uppercase tracking-wide">Drag to plan</p>
                        {savedMeals.length === 0 && (
                            <p className="text-sm text-slate-500 text-center py-10">No favorites yet. Save meals to drag them here!</p>
                        )}
                        {savedMeals.map(meal => (
                            <div 
                                key={meal.id} 
                                draggable
                                onDragStart={(e) => handleDragStart(e, meal)}
                                className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing group relative"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm">{meal.mealName}</h4>
                                        <div className="flex gap-2 mt-2">
                                             <span className="text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium">{Math.round(meal.totalCalories)} kcal</span>
                                             <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">{Math.round(meal.totalProtein)}g Pro</span>
                                        </div>
                                    </div>
                                    {/* Source Badge Mock */}
                                    <div className="bg-slate-100 p-1 rounded-full text-slate-400" title="Source: You">
                                        <UserCircleIcon />
                                    </div>
                                </div>
                                
                                {/* Hover Action Overlay (Mobile fall back or manual add) */}
                                <div className="absolute inset-0 bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button 
                                        onClick={() => onAddToPlan(meal)}
                                        className="bg-emerald-500 text-white text-xs font-bold py-2 px-4 rounded-full shadow-lg hover:bg-emerald-600 transform hover:scale-105 transition-all"
                                    >
                                        Add to {selectedDay}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                 {/* Vertical text when closed */}
                {!isDrawerOpen && (
                    <div className="mt-10 transform -rotate-90 whitespace-nowrap text-slate-400 font-bold text-sm tracking-widest cursor-pointer" onClick={() => setIsDrawerOpen(true)}>
                        FAVORITES
                    </div>
                )}
            </div>
        </div>
    );
};
