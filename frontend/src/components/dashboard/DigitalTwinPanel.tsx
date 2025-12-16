
import React, { useState } from 'react';
import { HealthRing } from './HealthRing';
import { UserCircleIcon, FireIcon, BeakerIcon, ClockIcon } from '../icons';

interface DigitalTwinPanelProps {
    calories: number;
    calorieGoal: number;
    protein: number;
    proteinGoal: number;
    activityScore: number;
    onScanClick: () => void;
}

export const DigitalTwinPanel: React.FC<DigitalTwinPanelProps> = ({ 
    calories, calorieGoal, protein, proteinGoal, activityScore, onScanClick 
}) => {
    const [isComparisonMode, setIsComparisonMode] = useState(false);
    const [historyDate, setHistoryDate] = useState(30); // Days ago

    // Calc current percentages
    const calPct = Math.min(100, (calories / calorieGoal) * 100);
    const protPct = Math.min(100, (protein / proteinGoal) * 100);
    const actPct = Math.min(100, activityScore); 

    // Simulated "Before" data based on slider
    const beforeCalPct = Math.max(20, calPct - (historyDate * 0.5));
    const beforeProtPct = Math.max(10, protPct - (historyDate * 0.2));
    const beforeActPct = Math.max(10, actPct - (historyDate * 0.8));

    const renderTwin = (c: number, p: number, a: number, label?: string) => (
        <div className="relative w-full max-w-[200px] aspect-square flex items-center justify-center">
            {label && (
                <div className="absolute -top-8 left-0 right-0 text-center">
                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{label}</span>
                </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none transform scale-75 md:scale-100">
                 <div className="absolute"><HealthRing radius={100} stroke={5} progress={c} color="#10b981" /></div>
                 <div className="absolute"><HealthRing radius={85} stroke={5} progress={p} color="#6366f1" /></div>
                 <div className="absolute"><HealthRing radius={70} stroke={5} progress={a} color="#f59e0b" /></div>
            </div>
            <div className="relative z-10 w-24 h-32 bg-slate-100 rounded-full flex flex-col items-center justify-center border-4 border-white shadow-lg transform scale-75 md:scale-100">
                <UserCircleIcon />
            </div>
        </div>
    );

    return (
        <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 relative overflow-hidden flex flex-col min-h-[500px]">
            {/* Header */}
            <div className="flex justify-between items-start mb-4 z-10 relative">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">My Body Twin</h3>
                    <p className="text-xs text-slate-500">{isComparisonMode ? 'Progress Analysis' : 'Live Status'}</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsComparisonMode(!isComparisonMode)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full transition border ${isComparisonMode ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                    >
                        {isComparisonMode ? 'Exit Comparison' : 'Compare'}
                    </button>
                    <button 
                        onClick={onScanClick}
                        className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-full hover:bg-slate-700 transition"
                    >
                        New Scan
                    </button>
                </div>
            </div>

            {/* Main Visual Area */}
            <div className="flex-grow flex flex-col items-center justify-center relative">
                <div className="absolute inset-0 bg-gradient-radial from-emerald-50 to-transparent opacity-50 blur-3xl pointer-events-none"></div>

                {/* 5.1 Comparison View Refactor */}
                {isComparisonMode ? (
                    <div className="flex justify-around items-center w-full animate-fade-in gap-4">
                        {renderTwin(beforeCalPct, beforeProtPct, beforeActPct, "Before")}
                        
                        <div className="hidden md:flex flex-col items-center justify-center text-slate-300">
                            <span className="text-2xl font-bold">→</span>
                        </div>

                        {renderTwin(calPct, protPct, actPct, "After")}
                    </div>
                ) : (
                    <div className="relative w-full flex items-center justify-center mt-4">
                        {/* Standard Single View */}
                        <div className="relative w-full max-w-sm aspect-square flex items-center justify-center">
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="absolute"><HealthRing radius={140} stroke={6} progress={calPct} color="#10b981" /></div>
                                <div className="absolute"><HealthRing radius={120} stroke={6} progress={protPct} color="#6366f1" /></div>
                                <div className="absolute"><HealthRing radius={100} stroke={6} progress={actPct} color="#f59e0b" /></div>
                            </div>
                            <div className="relative z-10 w-48 h-64 bg-slate-100 rounded-full flex flex-col items-center justify-center border-4 border-white shadow-xl">
                                <UserCircleIcon />
                                <span className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">3D Model</span>
                            </div>
                            {/* Floating Stats */}
                            <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur shadow-sm border border-slate-100 rounded-lg p-2 text-xs">
                                <div className="flex items-center gap-1 text-emerald-600 font-bold"><FireIcon /> {Math.round(calories)} kcal</div>
                            </div>
                            <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur shadow-sm border border-slate-100 rounded-lg p-2 text-xs">
                                <div className="flex items-center gap-1 text-indigo-600 font-bold"><BeakerIcon /> {Math.round(protein)}g Pro</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Controls */}
            <div className="mt-6 z-10 relative">
                {isComparisonMode ? (
                    <div className="animate-fade-in space-y-4">
                        {/* 5.2 Date Slider */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                                <span>Adjust to Date</span>
                                <span className="text-indigo-600 flex items-center gap-1"><ClockIcon /> {historyDate} Days Ago</span>
                            </div>
                            <input 
                                type="range" 
                                min="7" 
                                max="90" 
                                value={historyDate}
                                onChange={(e) => setHistoryDate(parseInt(e.target.value))}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                                <span>1 Week</span>
                                <span>3 Months</span>
                            </div>
                        </div>

                        {/* 5.3 Share Progress Button */}
                        <button className="w-full bg-emerald-500 text-white font-bold text-lg py-4 rounded-xl shadow-lg hover:bg-emerald-600 transition-transform active:scale-95 flex items-center justify-center gap-2">
                            <FireIcon /> Share Progress
                        </button>
                    </div>
                ) : (
                    // Default State Footer (if needed, currently mostly empty or standard stats)
                    <div className="text-center">
                        <p className="text-xs text-slate-400">Scan regularly to track your digital twin's evolution.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
