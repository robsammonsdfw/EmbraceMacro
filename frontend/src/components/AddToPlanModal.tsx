import React, { useState } from 'react';
import type { MealPlan } from '../types';
import { XIcon } from './icons';

interface AddToPlanModalProps {
    plans: MealPlan[];
    onSelectPlan: (planId: number) => void;
    onClose: () => void;
}

export const AddToPlanModal: React.FC<AddToPlanModalProps> = ({ plans, onSelectPlan, onClose }) => {
    const [selectedPlanId, setSelectedPlanId] = useState<number | null>(plans.length > 0 ? plans[0].id : null);

    const handleConfirm = () => {
        if (selectedPlanId !== null) {
            onSelectPlan(selectedPlanId);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in" aria-modal="true" role="dialog">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md m-auto">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800">Add to Meal Plan</h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full" aria-label="Close modal">
                        <XIcon />
                    </button>
                </div>
                <div className="p-6">
                    {plans.length > 0 ? (
                        <div className="space-y-4">
                            <label htmlFor="plan-select" className="font-semibold text-slate-700">Choose a plan:</label>
                            <select
                                id="plan-select"
                                value={selectedPlanId ?? ''}
                                onChange={(e) => setSelectedPlanId(Number(e.target.value))}
                                className="w-full p-3 border border-slate-300 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                            >
                                {plans.map(plan => (
                                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <p className="text-center text-slate-600">You don't have any meal plans yet. Go to the "Today's Plan" tab to create one!</p>
                    )}
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                    <button onClick={onClose} className="bg-white border border-slate-300 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-50 transition-colors">
                        Cancel
                    </button>
                    <button 
                        onClick={handleConfirm} 
                        disabled={selectedPlanId === null}
                        className="bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-emerald-600 transition-colors disabled:bg-slate-300"
                    >
                        Add to Plan
                    </button>
                </div>
            </div>
        </div>
    );
};
