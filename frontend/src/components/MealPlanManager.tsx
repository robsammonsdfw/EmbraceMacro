import React, { useState } from 'react';
import type { MealPlan } from '../types';
import { PlusIcon } from './icons';

interface MealPlanManagerProps {
    plans: MealPlan[];
    activePlanId: number | null;
    onPlanChange: (id: number) => void;
    onCreatePlan: (name: string) => void;
}

export const MealPlanManager: React.FC<MealPlanManagerProps> = ({ plans, activePlanId, onPlanChange, onCreatePlan }) => {
    const [newPlanName, setNewPlanName] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (newPlanName.trim()) {
            onCreatePlan(newPlanName.trim());
            setNewPlanName('');
            setShowCreateForm(false);
        }
    };
    
    return (
        <div className="bg-white p-4 rounded-xl shadow-md border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="flex-grow w-full">
                    <label htmlFor="plan-selector" className="block text-sm font-medium text-slate-700 mb-1">Active Meal Plan</label>
                    <select
                        id="plan-selector"
                        value={activePlanId ?? ''}
                        onChange={(e) => onPlanChange(Number(e.target.value))}
                        disabled={plans.length === 0}
                        className="w-full p-2 border border-slate-300 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                    >
                        {plans.length > 0 ? (
                           plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)
                        ) : (
                            <option>No plans created yet</option>
                        )}
                    </select>
                </div>
                <div className="w-full sm:w-auto flex-shrink-0 pt-2 sm:pt-6">
                     <button
                        onClick={() => setShowCreateForm(s => !s)}
                        className="w-full bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center space-x-2"
                    >
                        <PlusIcon />
                        <span>New Plan</span>
                    </button>
                </div>
            </div>
            {showCreateForm && (
                 <form onSubmit={handleCreate} className="p-4 bg-slate-50 rounded-lg flex gap-4 items-end">
                     <div className="flex-grow">
                        <label htmlFor="new-plan-name" className="block text-sm font-medium text-slate-700 mb-1">New Plan Name</label>
                        <input 
                            id="new-plan-name"
                            type="text"
                            value={newPlanName}
                            onChange={e => setNewPlanName(e.target.value)}
                            placeholder="e.g., Week 1 Dinners"
                            className="w-full p-2 border border-slate-300 rounded-lg"
                            required
                        />
                     </div>
                     <button type="submit" className="bg-slate-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-800 transition-colors h-10">
                        Save
                     </button>
                 </form>
            )}
        </div>
    );
};
