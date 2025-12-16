
import React, { useState } from 'react';
import type { MealPlan, SavedMeal, NutritionInfo } from '../types';
import { PlusIcon, UserCircleIcon, GlobeAltIcon, StarIcon, CameraIcon, BeakerIcon, BookOpenIcon, UploadIcon } from './icons';
import { MedicalPlannerModal } from './MedicalPlannerModal';
import * as apiService from '../services/apiService';

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

export const MealPlanManager: React.FC<MealPlanManagerProps> = ({ 
    plans, activePlanId, savedMeals, onPlanChange, onCreatePlan, onAddToPlan, onRemoveFromPlan
}) => {
    const [activeTab, setActiveTab] = useState<'planning' | 'community'>('planning');
    const [isMedicalModalOpen, setIsMedicalModalOpen] = useState(false);

    const activePlan = plans.find(p => p.id === activePlanId);

    // Get item for specific slot (assuming 'Today' or single day view for simplicity as per wireframe implication)
    const getSlotItem = (slotName: string) => {
        if (!activePlan) return null;
        // Simple logic: Find first item matching the slot name in metadata, or just grab any if not strictly typed
        return activePlan.items.find(item => item.metadata?.slot === slotName);
    };

    return (
        <div className="animate-fade-in">
            {isMedicalModalOpen && (
                <MedicalPlannerModal 
                    onClose={() => setIsMedicalModalOpen(false)}
                    onGenerate={() => {}} 
                    isLoading={false}
                />
            )}

            {/* Phase 3: Tab Navigation */}
            <div className="flex space-x-8 border-b border-slate-200 mb-6">
                <button 
                    onClick={() => setActiveTab('planning')}
                    className={`pb-4 font-bold text-sm transition-colors relative ${activeTab === 'planning' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Meal Planning
                    {activeTab === 'planning' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900"></div>}
                </button>
                <button 
                    onClick={() => setActiveTab('community')}
                    className={`pb-4 font-bold text-sm transition-colors relative ${activeTab === 'community' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Community Recipes
                    {activeTab === 'community' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900"></div>}
                </button>
            </div>

            {activeTab === 'planning' ? (
                <div className="space-y-4">
                    {/* Phase 3: Fixed Slots */}
                    {FIXED_SLOTS.map((slot) => {
                        const item = getSlotItem(slot);
                        return (
                            <div key={slot} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between group hover:border-slate-300 transition-colors">
                                <div className="flex items-center space-x-4">
                                    {/* Placeholder / Image */}
                                    <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center text-slate-300 overflow-hidden">
                                        {item?.meal.imageUrl ? (
                                            <img src={item.meal.imageUrl} alt={item.meal.mealName} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-xl font-bold text-slate-300">X</span>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900">{slot}</h4>
                                        <p className="text-xs text-slate-500 font-medium">
                                            {item ? `${Math.round(item.meal.totalCalories)} kcal • ${item.meal.mealName}` : 'Nothing logged yet'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-3">
                                    {/* Share Icon placeholder */}
                                    <button className="text-slate-300 hover:text-slate-500">
                                        <UploadIcon />
                                    </button>
                                    
                                    {item ? (
                                        <button 
                                            onClick={() => onRemoveFromPlan(item.id)}
                                            className="bg-slate-100 text-slate-600 px-4 py-2 rounded-full text-xs font-bold hover:bg-red-50 hover:text-red-500 transition-colors"
                                        >
                                            Remove
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => onAddToPlan({ mealName: 'New Meal', totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, ingredients: [] })} // Placeholder trigger
                                            className="bg-slate-900 text-white px-6 py-2 rounded-full text-xs font-bold hover:bg-slate-700 transition-colors"
                                        >
                                            Log It
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    
                    <button 
                        onClick={() => setIsMedicalModalOpen(true)}
                        className="w-full py-4 mt-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold hover:border-emerald-300 hover:text-emerald-500 hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
                    >
                        <BeakerIcon /> Generate Full Day Plan with AI
                    </button>
                </div>
            ) : (
                /* Phase 3: Community Grid */
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="aspect-square bg-slate-200 rounded-xl relative overflow-hidden group cursor-pointer">
                            <img 
                                src={`https://source.unsplash.com/random/400x400?food&sig=${i}`} 
                                alt="Community Meal" 
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors"></div>
                            <div className="absolute bottom-2 left-2 right-2 text-white">
                                <p className="font-bold text-sm truncate">Superfood Bowl {i}</p>
                                <p className="text-[10px] opacity-80">by @SarahFit</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
