
import React, { useState, useMemo, useEffect } from 'react';
import type { MealPlan, SavedMeal, NutritionInfo, MealPlanItem } from '../types';
import { PlusIcon, UserCircleIcon, GlobeAltIcon, StarIcon, CameraIcon, BeakerIcon, ShareIcon, XIcon } from './icons';
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

const MealSlotCard: React.FC<{
    slotLabel: string;
    items: MealPlanItem[];
    onLogIt: () => void;
    onRemove: (id: number) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
}> = ({ slotLabel, items, onLogIt, onRemove, onDragOver, onDrop }) => {
    return (
        <div 
            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 mb-4 flex flex-col"
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragLeave={(e) => e.preventDefault()}
        >
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-slate-800 text-lg">{slotLabel}</h3>
                <button className="text-slate-400 hover:text-slate-600 transition-colors">
                    <ShareIcon />
                </button>
            </div>

            <div className="flex-grow flex flex-col items-center justify-center py-6 border-2 border-dashed border-slate-100 rounded-xl mb-4 min-h-[120px]">
                {items.length === 0 ? (
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                        <XIcon />
                    </div>
                ) : (
                    <div className="w-full space-y-2 px-2">
                        {items.map(item => (
                            <div key={item.id} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg w-full">
                                <div className="flex items-center gap-2">
                                    {item.meal.hasImage && item.meal.imageUrl ? (
                                        <div className="w-8 h-8 bg-slate-200 rounded-md bg-cover bg-center" style={{backgroundImage: `url(${item.meal.imageUrl})`}}></div>
                                    ) : (
                                        <div className="w-8 h-8 bg-slate-200 rounded-md flex items-center justify-center text-slate-400 text-xs"><CameraIcon /></div>
                                    )}
                                    <div className="flex flex-col text-left">
                                        <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{item.meal.mealName}</span>
                                        <span className="text-[10px] text-slate-500">{Math.round(item.meal.totalCalories)} kcal</span>
                                    </div>
                                </div>
                                <button onClick={() => onRemove(item.id)} className="text-slate-300 hover:text-red-500">&times;</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <button 
                onClick={onLogIt}
                className="w-full bg-slate-900 text-white font-bold py-2 rounded-full hover:bg-slate-800 transition-colors shadow-sm"
            >
                Log It
            </button>
        </div>
    );
};

export const MealPlanManager: React.FC<MealPlanManagerProps> = ({ 
    plans, activePlanId, savedMeals, onPlanChange, onCreatePlan, onAddToPlan, onRemoveFromPlan, onQuickAdd 
}) => {
    const [viewMode, setViewMode] = useState<'plan' | 'community'>('plan');
    const [selectedDay, setSelectedDay] = useState<string>(DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);
    const [isDrawerOpen, setIsDrawerOpen] = useState(true);
    
    // Creation State
    const [isCreating, setIsCreating] = useState(false);
    const [newPlanName, setNewPlanName] = useState('');

    // Medical Planner State
    const [isMedicalModalOpen, setIsMedicalModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState(0);
    const [generationStatus, setGenerationStatus] = useState('');
    
    const [activeMedicalConditions, setActiveMedicalConditions] = useState<DiseaseTemplate[]>([]);
    const [recommendations, setRecommendations] = useState<any[]>([]);

    useEffect(() => {
        // Fetch recommendations on mount
        apiService.getKitRecommendations().then(setRecommendations).catch(console.error);
    }, []);

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
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e: React.DragEvent, slot: string) => {
        e.preventDefault();
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
        setIsGenerating(true);
        setGenerationProgress(0);
        setGenerationStatus("Initializing Medical AI...");
        setActiveMedicalConditions(diseases);

        try {
            // 1. Create Plan
            const planName = `Medical Plan - ${new Date().toLocaleDateString()} (${Math.floor(Math.random() * 1000)})`;
            const newPlan = await apiService.createMealPlan(planName);
            
            // 2. Determine Days to Generate
            const targetDays = duration === 'week' ? DAYS : [selectedDay];
            const totalSteps = targetDays.length;

            // 3. Client-Side Chaining (Loop)
            // We request one day at a time to prevent timeouts
            for (let i = 0; i < totalSteps; i++) {
                const currentDay = targetDays[i];
                
                setGenerationStatus(`Analyzing & Drafting: ${currentDay}...`);
                setGenerationProgress(Math.round(((i) / totalSteps) * 100));

                // Call for specific day
                const generatedMeals = await apiService.generateMedicalPlan(diseases, cuisine, duration, currentDay);
                
                // Add items locally to plan
                for (const meal of generatedMeals) {
                    const sanitizedIngredients = (meal.ingredients || []).map(ing => ({
                        ...ing,
                        calories: ing.calories || 0,
                        protein: ing.protein || 0,
                        carbs: ing.carbs || 0,
                        fat: ing.fat || 0,
                        weightGrams: ing.weightGrams || 100
                    }));

                    const nutritionInfo: NutritionInfo = {
                        ...meal,
                        ingredients: sanitizedIngredients,
                        source: 'medical-ai'
                    };

                    await apiService.addMealFromHistoryToPlan(newPlan.id, nutritionInfo, {
                        day: meal.suggestedDay, // AI should return correct day now
                        slot: meal.suggestedSlot,
                        portion: 1,
                        context: 'Medical Plan',
                        addToGrocery: true
                    });
                }
            }
            
            setGenerationProgress(100);
            setGenerationStatus("Finalizing...");
            await new Promise(r => setTimeout(r, 800)); // Brief pause for UX completion feel
            
            // Reload to see new plan
            window.location.reload();

        } catch (error: any) {
            console.error(error);
            alert("Partial generation failed. Some meals may be missing.");
        } finally {
            setIsGenerating(false);
            setIsMedicalModalOpen(false);
        }
    };

    const handleLogItClick = (slot: string) => {
        if (!activePlanId) {
            setIsCreating(true);
            return;
        }
        // Open the general add modal (via the main onAddToPlan handler usually used for adding from history)
        // Since we don't have a specific item, we can trigger a capture or library view.
        // For now, we'll open the medical planner as a placeholder for "Advanced Logging" or alert
        // In a real flow, this would likely open a "What did you eat?" search/camera modal.
        // Reusing onAddToPlan with a dummy "New Meal" to trigger the flow is one option, 
        // but let's just use the medical modal or alert for this prototype phase if no direct scan flow is wired here.
        // BETTER: Just alert for now as per "Empty State" focus.
        alert(`Open logging for ${slot} in ${activePlan?.name || 'New Plan'}`);
    };

    // --- Community Recipes View ---
    if (viewMode === 'community') {
        return (
            <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden min-h-[600px] flex flex-col">
                <div className="flex border-b border-slate-200 bg-white">
                     <button 
                        onClick={() => setViewMode('plan')} 
                        className="flex-1 py-4 text-center font-bold text-slate-400 hover:text-slate-600 border-b-2 border-transparent transition-colors"
                    >
                        Meal Planning
                    </button>
                     <button 
                        className="flex-1 py-4 text-center font-bold text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/10"
                    >
                        Community Recipes
                    </button>
                </div>
                <div className="p-6 md:p-8 text-center flex-grow bg-slate-50/50">
                     <div className="max-w-5xl mx-auto">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {/* Mock Community Cards */}
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow group relative cursor-pointer">
                                    <div className="aspect-square bg-slate-200 relative overflow-hidden">
                                        <img 
                                            src={`https://source.unsplash.com/random/400x400?food,meal&sig=${i}`} 
                                            alt={`Community Meal ${i}`}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                            onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxIDEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNlN2U1ZTQiLz48L3N2Zz4=' }}
                                        />
                                        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md px-2 py-1 rounded-full text-[10px] font-bold text-white flex items-center gap-1">
                                            <GlobeAltIcon /> @Chef{i}
                                        </div>
                                    </div>
                                    <div className="p-3 text-left">
                                        <h3 className="font-bold text-slate-800 text-sm truncate">Artisan Bowl {i}</h3>
                                        <p className="text-[10px] text-slate-500 mb-2">450 kcal • High Protein</p>
                                        <button 
                                            className="w-full bg-slate-100 hover:bg-emerald-500 hover:text-white text-slate-600 font-bold py-2 rounded-lg text-xs transition-colors"
                                            onClick={() => onAddToPlan({ 
                                                mealName: `Community Meal ${i}`, 
                                                totalCalories: 450, totalProtein: 20, totalCarbs: 50, totalFat: 15, ingredients: [], source: 'community' 
                                            })}
                                        >
                                            Add to Plan
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                     </div>
                </div>
            </div>
        );
    }

    // --- Meal Planning View (Slots) ---
    return (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden min-h-[600px] flex flex-col md:flex-row">
            
            {isMedicalModalOpen && (
                <MedicalPlannerModal 
                    onClose={() => setIsMedicalModalOpen(false)}
                    onGenerate={handleMedicalGenerate}
                    isLoading={isGenerating}
                    progress={generationProgress}
                    status={generationStatus}
                    recommendations={recommendations}
                />
            )}

            {/* Main Board Area */}
            <div className={`flex-grow flex flex-col transition-all duration-300 ${isDrawerOpen ? 'md:w-2/3' : 'w-full'}`}>
                
                {/* Tab Navigation */}
                <div className="flex border-b border-slate-200 bg-white">
                     <button 
                        className="flex-1 py-4 text-center font-bold text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/10"
                    >
                        Meal Planning
                    </button>
                     <button 
                        onClick={() => setViewMode('community')} 
                        className="flex-1 py-4 text-center font-bold text-slate-400 hover:text-slate-600 border-b-2 border-transparent transition-colors"
                    >
                        Community Recipes
                    </button>
                </div>

                {/* Sub-Header: Day & Plan Selector */}
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    {/* Day Selector */}
                    <div className="flex overflow-x-auto no-scrollbar gap-2 max-w-full">
                        {DAYS.map(day => (
                            <button
                                key={day}
                                onClick={() => setSelectedDay(day)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors whitespace-nowrap ${
                                    selectedDay === day 
                                    ? 'bg-slate-900 text-white shadow-md' 
                                    : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                {day.substring(0, 3)}
                            </button>
                        ))}
                    </div>

                    {/* Plan Actions */}
                    <div className="flex items-center gap-2">
                        {plans.length > 0 && (
                            <select
                                value={activePlanId ?? ''}
                                onChange={(e) => onPlanChange(Number(e.target.value))}
                                className="p-1.5 border border-slate-300 rounded-lg text-xs bg-white min-w-[120px]"
                            >
                                {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        )}
                        
                        {!isCreating ? (
                            <>
                                <button 
                                    onClick={() => setIsCreating(true)}
                                    className="bg-white border border-slate-300 text-slate-600 p-1.5 rounded-lg hover:bg-slate-50"
                                    title="Create New Plan"
                                >
                                    <PlusIcon />
                                </button>
                                <button 
                                    onClick={() => setIsMedicalModalOpen(true)}
                                    className="bg-indigo-600 text-white font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-700 flex items-center space-x-1 shadow-sm text-xs"
                                >
                                    <BeakerIcon />
                                    <span>AI Plan</span>
                                </button>
                            </>
                        ) : (
                            <form onSubmit={handleCreateSubmit} className="flex items-center gap-2">
                                <input 
                                    type="text" 
                                    autoFocus
                                    placeholder="Name..." 
                                    className="p-1.5 border border-slate-300 rounded-lg text-xs w-24"
                                    value={newPlanName}
                                    onChange={e => setNewPlanName(e.target.value)}
                                />
                                <button type="submit" className="text-emerald-600 font-bold text-xs">Save</button>
                                <button type="button" onClick={() => setIsCreating(false)} className="text-slate-400 font-bold text-lg leading-none">&times;</button>
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

                {/* Fixed Slots Board */}
                {plans.length > 0 && (
                    <div className="p-4 md:p-6 space-y-2 bg-slate-50/30 flex-grow overflow-y-auto">
                        {SLOTS.map(slot => (
                            <MealSlotCard
                                key={slot}
                                slotLabel={slot}
                                items={getItemsForSlot(slot)}
                                onLogIt={() => handleLogItClick(slot)}
                                onRemove={onRemoveFromPlan}
                                onDragOver={(e) => handleDragOver(e)}
                                onDrop={(e) => handleDrop(e, slot)}
                            />
                        ))}
                    </div>
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
