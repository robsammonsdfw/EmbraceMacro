
import React, { useEffect, useState } from 'react';
import type { Assessment, AssessmentState } from '../../types';
import * as apiService from '../../services/apiService';
import { TestRunner } from './TestRunner';
import { PassivePulse } from './PassivePulse';
import { ClipboardCheckIcon, ActivityIcon } from '../icons';

export const AssessmentHub: React.FC = () => {
    const [assessments, setAssessments] = useState<Assessment[]>([]);
    const [gameState, setGameState] = useState<AssessmentState | null>(null);
    const [activeTest, setActiveTest] = useState<Assessment | null>(null);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        try {
            setLoading(true);
            const [testData, stateData] = await Promise.all([
                apiService.getAssessments(),
                apiService.getAssessmentState()
            ]);
            setAssessments(testData);
            setGameState(stateData);
        } catch (err) {
            console.error("Failed to load assessments:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleComplete = async (responses: any) => {
        if (!activeTest) return;
        try {
            await apiService.submitAssessment(activeTest.id, responses);
            setActiveTest(null);
            alert("Assessment Complete! Points awarded.");
            loadData(); // Refresh state
        } catch (err) {
            alert("Failed to save results.");
        }
    };

    const handlePassivePulse = async (value: any) => {
        if (!gameState?.passivePrompt) return;
        try {
            await apiService.submitPassivePulseResponse(gameState.passivePrompt.id, value);
            // Remove prompt from view
            setGameState({ ...gameState, passivePrompt: undefined });
        } catch (err) {
            console.error("Passive pulse failed", err);
        }
    };

    if (loading && assessments.length === 0) return <div className="p-8 text-center text-slate-500">Loading assessments...</div>;

    if (activeTest) {
        return <TestRunner assessment={activeTest} onComplete={handleComplete} onClose={() => setActiveTest(null)} />;
    }

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center space-x-3">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full">
                        <ClipboardCheckIcon />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Assessments</h2>
                        <p className="text-slate-500 font-medium">Deep dives & predictive micro-checks.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {/* Visual indicators for stale data - Added safety check for lastUpdated */}
                    {gameState?.lastUpdated && Object.entries(gameState.lastUpdated).map(([cat, date]) => {
                        const isStale = (Date.now() - new Date(date).getTime()) > 86400000;
                        return (
                            <div key={cat} title={`${cat}: ${isStale ? 'Stale' : 'Fresh'}`} className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${isStale ? 'bg-rose-400' : 'bg-emerald-400'}`}></div>
                        );
                    })}
                </div>
            </header>

            {/* Hybrid Data Layer: Passive Prompt */}
            {gameState?.passivePrompt && (
                <div className="max-w-2xl mx-auto w-full">
                    <PassivePulse prompt={gameState.passivePrompt} onResponse={handlePassivePulse} />
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Fixed "Daily Check" active entry */}
                <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col justify-between h-full group hover:scale-[1.02] transition-all">
                    <div>
                        <div className="bg-emerald-50 w-fit p-2 rounded-xl mb-4 group-hover:rotate-12 transition-transform">
                            <ActivityIcon className="w-5 h-5" />
                        </div>
                        <h3 className="text-xl font-black mb-2">Daily Pulse</h3>
                        <p className="text-slate-400 text-sm font-medium mb-8">The standard clinical baseline for your digital twin. Takes 2 minutes.</p>
                    </div>
                    <button 
                        onClick={() => assessments.length > 0 && setActiveTest(assessments[0])}
                        className="w-full bg-white text-slate-900 font-black uppercase tracking-widest text-xs py-4 rounded-2xl hover:bg-emerald-50 transition-colors"
                    >
                        Log Active Baseline
                    </button>
                </div>

                {/* Other Assessments */}
                {assessments.slice(1).map(test => (
                    <div key={test.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow flex flex-col justify-between h-full">
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-bold text-slate-800 leading-tight">{test.title}</h3>
                                <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase px-2 py-1 rounded-lg border border-emerald-100">+50 pts</span>
                            </div>
                            <p className="text-slate-500 text-sm font-medium mb-6">{test.description}</p>
                        </div>
                        <button 
                            onClick={() => setActiveTest(test)}
                            className="w-full bg-slate-50 text-slate-700 font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl border border-slate-200 hover:bg-white hover:border-indigo-300 transition-all"
                        >
                            Start Module
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
