
import React from 'react';
import { HealthRing } from './HealthRing';
import { UserCircleIcon, FireIcon, ActivityIcon, BeakerIcon } from '../icons';

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
    // Calc percentages
    const calPct = Math.min(100, (calories / calorieGoal) * 100);
    const protPct = Math.min(100, (protein / proteinGoal) * 100);
    const actPct = Math.min(100, activityScore); // Score out of 100

    return (
        <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 relative overflow-hidden flex flex-col items-center justify-center min-h-[400px]">
            {/* Header */}
            <div className="absolute top-4 left-6 z-10">
                <h3 className="text-lg font-bold text-slate-800">My Body Twin</h3>
                <p className="text-xs text-slate-500">Updated today</p>
            </div>
            
            <div className="absolute top-4 right-6 z-10">
                <button 
                    onClick={onScanClick}
                    className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-full hover:bg-slate-700 transition"
                >
                    New Scan
                </button>
            </div>

            {/* Twin Visualization Container */}
            <div className="relative w-full max-w-sm aspect-square flex items-center justify-center mt-6">
                
                {/* Background Glow */}
                <div className="absolute inset-0 bg-gradient-radial from-emerald-50 to-transparent opacity-70 blur-3xl"></div>

                {/* Rings Container */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     {/* Outer Ring: Calories */}
                     <div className="absolute">
                         <HealthRing radius={140} stroke={6} progress={calPct} color="#10b981" />
                     </div>
                     {/* Middle Ring: Protein */}
                     <div className="absolute">
                         <HealthRing radius={120} stroke={6} progress={protPct} color="#6366f1" />
                     </div>
                     {/* Inner Ring: Activity */}
                     <div className="absolute">
                         <HealthRing radius={100} stroke={6} progress={actPct} color="#f59e0b" />
                     </div>
                </div>

                {/* 3D Avatar Placeholder */}
                <div className="relative z-10 w-48 h-64 bg-slate-100 rounded-full flex flex-col items-center justify-center border-4 border-white shadow-xl">
                    <UserCircleIcon />
                    <span className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">3D Model</span>
                </div>
                
                {/* Stats Pills Floating */}
                <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur shadow-sm border border-slate-100 rounded-lg p-2 text-xs">
                    <div className="flex items-center gap-1 text-emerald-600 font-bold"><FireIcon /> {Math.round(calories)} kcal</div>
                </div>
                <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur shadow-sm border border-slate-100 rounded-lg p-2 text-xs">
                    <div className="flex items-center gap-1 text-indigo-600 font-bold"><BeakerIcon /> {Math.round(protein)}g Pro</div>
                </div>

            </div>
        </div>
    );
};
