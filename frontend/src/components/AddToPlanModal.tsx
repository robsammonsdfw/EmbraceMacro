

import React, { useState } from 'react';
import type { MealPlan, MealPlanItemMetadata } from '../types';
import { XIcon } from './icons';

interface AddToPlanModalProps {
    plans: MealPlan[];
    onSelectPlan: (planId: number, metadata: MealPlanItemMetadata) => void;
    onClose: () => void;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const CONTEXTS = ['Cooked at home', 'Restaurant', 'Ordered in', 'Leftovers'];

export const AddToPlanModal: React.FC<AddToPlanModalProps> = ({ plans, onSelectPlan, onClose }) => {
    const [selectedPlanId, setSelectedPlanId] = useState<number | null>(plans.length > 0 ? plans[0].id : null);
    
    // Micro-flow states
    const [day, setDay] = useState<string>(DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]); // Default to today
    const [slot, setSlot] = useState<string>('Lunch');
    const [portion, setPortion] = useState<number>(1.0);
    const [context, setContext] = useState<string>('Cooked at home');
    const [addToGrocery, setAddToGrocery] = useState<boolean>(true);

    const handleConfirm = () => {
        if (selectedPlanId !== null) {
            onSelectPlan(selectedPlanId, {
                day,
                slot,
                portion,
                context,
                addToGrocery
            });
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in" aria-modal="true" role="dialog">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md m-auto overflow-hidden">
                <div className="p-4 bg-emerald-600 text-white flex justify-between items-center">
                    <h2 className="text-lg font-bold">Log Meal</h2>
                    <button onClick={onClose} className="p-1 hover:bg-emerald-700 rounded-full" aria-label="Close modal">
                        <XIcon />
                    </button>
                </div>
                
                <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                    {/* Plan Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Target Plan</label>
                         {plans.length > 0 ? (
                            <select
                                value={selectedPlanId ?? ''}
                                onChange={(e) => setSelectedPlanId(Number(e.target.value))}
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                            >
                                {plans.map(plan => (
                                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                                ))}
                            </select>
                        ) : (
                            <p className="text-sm text-red-500">Please create a plan first.</p>
                        )}
                    </div>

                    {/* Day & Slot Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Day</label>
                            <select value={day} onChange={e => setDay(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm">
                                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Meal Slot</label>
                            <select value={slot} onChange={e => setSlot(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm">
                                {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Portion Slider */}
                    <div>
                         <div className="flex justify-between items-center mb-1">
                            <label className="text-sm font-semibold text-slate-700">Portion Size</label>
                            <span className="text-sm font-bold text-emerald-600">{portion}x</span>
                        </div>
                        <input 
                            type="range" 
                            min="0.5" 
                            max="2.0" 
                            step="0.25" 
                            value={portion}
                            onChange={e => setPortion(parseFloat(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <div className="flex justify-between text-xs text-slate-400 mt-1">
                            <span>Half</span>
                            <span>Standard</span>
                            <span>Double</span>
                        </div>
                    </div>

                    {/* Context Chips */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Context</label>
                        <div className="flex flex-wrap gap-2">
                            {CONTEXTS.map(ctx => (
                                <button
                                    key={ctx}
                                    onClick={() => setContext(ctx)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                        context === ctx 
                                        ? 'bg-indigo-100 border-indigo-200 text-indigo-700' 
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    {ctx}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Grocery Toggle */}
                    <div 
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer select-none"
                        onClick={() => setAddToGrocery(!addToGrocery)}
                    >
                        <span className="text-sm font-medium text-slate-700">Add ingredients to Grocery List?</span>
                        <div 
                            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${addToGrocery ? 'bg-emerald-500' : 'bg-slate-300'}`}
                        >
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${addToGrocery ? 'translate-x-5' : 'translate-x-0'}`}></div>
                        </div>
                    </div>

                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                    <button onClick={onClose} className="text-slate-600 font-bold py-2 px-4 hover:bg-slate-200 rounded-lg transition-colors text-sm">
                        Cancel
                    </button>
                    <button 
                        onClick={handleConfirm} 
                        disabled={selectedPlanId === null}
                        className="bg-emerald-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-emerald-700 transition-colors shadow-md disabled:bg-slate-300 text-sm"
                    >
                        Log Meal
                    </button>
                </div>
            </div>
        </div>
    );
};