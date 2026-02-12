
import React, { useState, useEffect } from 'react';
import { HeartIcon, ActivityIcon, PlusIcon } from '../icons';
import * as apiService from '../../services/apiService';
import type { ReadinessScore, RecoveryData } from '../../types';

export const ReadinessView: React.FC = () => {
    const [readiness, setReadiness] = useState<ReadinessScore | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [logForm, setLogForm] = useState<RecoveryData>({
        sleepMinutes: 480,
        sleepQuality: 80,
        hrv: 50,
        workoutIntensity: 5,
        timestamp: new Date().toISOString()
    });

    const getReadiness = async (data?: RecoveryData) => {
        setIsCalculating(true);
        try {
            const result = await apiService.calculateReadiness(data || logForm);
            setReadiness(result);
        } catch (e) {
            console.error(e);
        } finally {
            setIsCalculating(false);
        }
    };

    useEffect(() => { getReadiness(); }, []);

    const handleLogSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCalculating(true);
        try {
            await apiService.logRecoveryStats(logForm);
            await getReadiness(logForm);
            alert("Mental & Physical Readiness Updated.");
        } catch (e) {
            alert("Failed to log metrics.");
        } finally {
            setIsCalculating(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-fade-in">
            <header className="flex items-center gap-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full">
                    <ActivityIcon className="w-8 h-8" />
                </div>
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Daily Readiness</h2>
                    <p className="text-slate-500 font-medium">Cognitive and physical recovery status.</p>
                </div>
            </header>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                    <HeartIcon className="w-64 h-64" />
                </div>

                <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
                    {/* Ring Chart */}
                    <div className="relative flex items-center justify-center w-56 h-56 flex-shrink-0">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="112" cy="112" r="90" stroke="#f1f5f9" strokeWidth="16" fill="none" />
                            <circle 
                                cx="112" cy="112" r="90" 
                                stroke={readiness ? (readiness.score > 70 ? '#10b981' : readiness.score > 40 ? '#f59e0b' : '#ef4444') : '#e2e8f0'} 
                                strokeWidth="16" fill="none" strokeLinecap="round"
                                strokeDasharray={2 * Math.PI * 90}
                                strokeDashoffset={(2 * Math.PI * 90) - ((readiness?.score || 0) / 100) * (2 * Math.PI * 90)}
                                className="transition-all duration-1000 ease-out"
                            />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                            <span className="text-5xl font-black text-slate-900">{isCalculating ? '...' : readiness?.score || '--'}</span>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Score</span>
                        </div>
                    </div>

                    <div className="flex-grow text-center md:text-left">
                        <div className="inline-block bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 border border-indigo-100">
                            AI Analysis
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 mb-3">{readiness?.label || 'Calculating...'}</h3>
                        <p className="text-lg text-slate-600 font-medium leading-relaxed max-w-lg">
                            {readiness?.reasoning || "Analyzing your sleep quality and heart rate variability to determine your optimal load for today."}
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleLogSubmit} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs mb-6 flex items-center gap-2">
                    <PlusIcon className="w-4 h-4" /> Input Vitals
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div>
                        <label className="flex justify-between text-xs font-bold text-slate-500 uppercase mb-2">
                            <span>Sleep Duration</span>
                            <span className="text-indigo-600">{Math.floor(logForm.sleepMinutes / 60)}h {logForm.sleepMinutes % 60}m</span>
                        </label>
                        <input 
                            type="range" min="0" max="720" step="15"
                            value={logForm.sleepMinutes}
                            onChange={e => setLogForm({...logForm, sleepMinutes: parseInt(e.target.value)})}
                            className="w-full h-3 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                    </div>
                    <div>
                        <label className="flex justify-between text-xs font-bold text-slate-500 uppercase mb-2">
                            <span>HRV (Stress)</span>
                            <span className="text-emerald-600">{logForm.hrv} ms</span>
                        </label>
                        <input 
                            type="range" min="10" max="150"
                            value={logForm.hrv}
                            onChange={e => setLogForm({...logForm, hrv: parseInt(e.target.value)})}
                            className="w-full h-3 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                    </div>
                </div>

                <button 
                    type="submit" 
                    disabled={isCalculating}
                    className="w-full py-4 bg-slate-900 text-white font-black uppercase tracking-widest text-sm rounded-2xl hover:bg-black transition-all shadow-lg active:scale-95"
                >
                    Recalculate Score
                </button>
            </form>
        </div>
    );
};
