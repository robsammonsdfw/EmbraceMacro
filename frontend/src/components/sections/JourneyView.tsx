
import React, { useState } from 'react';
import { HeartIcon, ActivityIcon, CheckIcon } from '../icons';
import type { UserDashboardPrefs } from '../../types';
import { IntakeModal } from '../IntakeModal';
import * as apiService from '../../services/apiService';

interface JourneyViewProps {
    dashboardPrefs: UserDashboardPrefs;
    onOpenWizard: () => void; // Legacy wizard (can keep or remove, keeping for backwards compat if needed elsewhere)
}

export const JourneyView: React.FC<JourneyViewProps> = ({ dashboardPrefs, onOpenWizard }) => {
    const [showIntake, setShowIntake] = useState(false);

    const handleSaveIntake = async (data: any) => {
        await apiService.saveIntakeData(data);
    };

    const handleUpdateJourney = async (journey: any) => {
        const newPrefs = { ...dashboardPrefs, selectedJourney: journey };
        await apiService.saveDashboardPrefs(newPrefs);
        // Force refresh of parent state would be ideal here, but for now we rely on the next load
        window.location.reload(); 
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8 pb-20 animate-fade-in">
            {showIntake && (
                <IntakeModal 
                    onClose={() => setShowIntake(false)}
                    onSaveJourney={handleUpdateJourney}
                    onSaveIntake={handleSaveIntake}
                />
            )}

            <header className="text-center">
                <div className="mx-auto w-20 h-20 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <HeartIcon className="w-10 h-10" />
                </div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-2">My Journey</h2>
                <p className="text-slate-500 font-medium">Your metabolic master plan and goal settings.</p>
            </header>

            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div className="space-y-6">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Current Focus</p>
                            <h3 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">
                                {dashboardPrefs.selectedJourney?.replace('-', ' ') || 'General Health'}
                            </h3>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                                <span className="font-bold text-slate-600 text-sm">Daily Calories</span>
                                <span className="font-black text-emerald-600 text-xl">{dashboardPrefs.calorieGoal || 2000}</span>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                                <span className="font-bold text-slate-600 text-sm">Daily Protein</span>
                                <span className="font-black text-indigo-600 text-xl">{dashboardPrefs.proteinGoal || 150}g</span>
                            </div>
                        </div>
                    </div>

                    <div 
                        className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-[2rem] p-8 text-white text-center relative overflow-hidden group cursor-pointer" 
                        onClick={() => setShowIntake(true)}
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                            <ActivityIcon className="w-32 h-32" />
                        </div>
                        <div className="relative z-10">
                            <h4 className="font-black text-lg mb-2">Config Active Journey</h4>
                            <p className="text-indigo-200 text-sm mb-6">Launch the personalization wizard to set your health focus and baselines.</p>
                            <button className="bg-white text-indigo-900 font-black uppercase tracking-widest text-[10px] py-3 px-6 rounded-xl transition-all shadow-lg active:scale-95">
                                Personalize My Journey
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center opacity-60">
                    <CheckIcon className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <h4 className="font-bold text-slate-700">Week 1</h4>
                    <p className="text-xs text-slate-400">Foundation</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border-2 border-indigo-500 shadow-md text-center transform scale-105">
                    <CheckIcon className="w-8 h-8 mx-auto text-indigo-500 mb-2" />
                    <h4 className="font-bold text-slate-900">Week 2</h4>
                    <p className="text-xs text-indigo-500 font-bold uppercase">Current Phase</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center opacity-60">
                    <div className="w-8 h-8 mx-auto border-2 border-dashed border-slate-300 rounded-full mb-2"></div>
                    <h4 className="font-bold text-slate-700">Week 3</h4>
                    <p className="text-xs text-slate-400">Optimization</p>
                </div>
            </div>
        </div>
    );
};
