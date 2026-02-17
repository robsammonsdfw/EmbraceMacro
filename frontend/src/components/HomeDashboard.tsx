
import React, { useMemo, useEffect, useState } from 'react';
import { CameraIcon, UploadIcon, BarcodeIcon, ChefHatIcon, UtensilsIcon, FireIcon, UserGroupIcon, BeakerIcon, UserCircleIcon, TrophyIcon, ClockIcon } from './icons';
import type { MealLogEntry, RewardsSummary } from '../types';
import * as apiService from '../services/apiService';

interface HomeDashboardProps {
    onCameraClick: () => void;
    onUploadClick: () => void;
    onBarcodeClick: () => void;
    onPantryChefClick: () => void;
    onGetRecipeClick: () => void;
    mealLog: MealLogEntry[];
    userName?: string;
}

const DigitalTwin: React.FC<{ 
    calories: number; 
    protein: number; 
    calorieGoal: number; 
    proteinGoal: number;
    activityScore: number; 
    onBodyClick: () => void;
}> = ({ calories, protein, calorieGoal, proteinGoal, activityScore, onBodyClick }) => {
    
    // Calculate progress (capped at 100%)
    const calPct = Math.min(100, ((calories ?? 0) / calorieGoal) * 100);
    const protPct = Math.min(100, ((protein ?? 0) / proteinGoal) * 100);
    const actPct = Math.min(100, activityScore);

    // SVG parameters
    const radius = 90;
    const circumference = 2 * Math.PI * radius;
    const offset = (pct: number) => circumference - (pct / 100) * circumference;

    const ringBase = "transform -rotate-90 origin-center transition-all duration-1000 ease-out";

    return (
        <div className="relative w-64 h-64 mx-auto flex items-center justify-center mb-6">
            {/* Halo Effect Background */}
            <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-2xl animate-pulse"></div>
            
            <svg className="w-full h-full relative z-10" viewBox="0 0 200 200">
                {/* Track Rings */}
                <circle cx="100" cy="100" r="90" stroke="#e2e8f0" strokeWidth="6" fill="none" className="opacity-30" />
                <circle cx="100" cy="100" r="78" stroke="#e2e8f0" strokeWidth="6" fill="none" className="opacity-30" />
                <circle cx="100" cy="100" r="66" stroke="#e2e8f0" strokeWidth="6" fill="none" className="opacity-30" />

                {/* Progress Rings */}
                {/* Outer: Calories (Emerald) */}
                <circle 
                    cx="100" cy="100" r="90" 
                    stroke="#10b981" strokeWidth="6" fill="none" strokeLinecap="round"
                    strokeDasharray={circumference} 
                    strokeDashoffset={offset(calPct)} 
                    className={ringBase}
                />
                
                {/* Middle: Protein (Indigo) */}
                <circle 
                    cx="100" cy="100" r="78" 
                    stroke="#6366f1" strokeWidth="6" fill="none" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 78} 
                    strokeDashoffset={(2 * Math.PI * 78) - (protPct / 100) * (2 * Math.PI * 78)} 
                    className={ringBase}
                />

                {/* Inner: Activity (Amber) */}
                <circle 
                    cx="100" cy="100" r="66" 
                    stroke="#f59e0b" strokeWidth="6" fill="none" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 66} 
                    strokeDashoffset={(2 * Math.PI * 66) - (actPct / 100) * (2 * Math.PI * 66)} 
                    className={ringBase}
                />
            </svg>

            {/* Central Avatar / Twin */}
            <div 
                className="absolute inset-0 m-auto w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center cursor-pointer hover:scale-105 transition-transform shadow-inner border-2 border-white"
                onClick={onBodyClick}
            >
                <UserCircleIcon /> 
                {/* In a real app, this would be the 3D Avatar/Silhouette */}
            </div>

            {/* Labels floating around or overlaid? Let's use a legend below instead for cleanliness */}
        </div>
    );
};

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ 
    onCameraClick, onUploadClick, onBarcodeClick, onPantryChefClick, onGetRecipeClick, mealLog, userName
}) => {
    const [rewards, setRewards] = useState<RewardsSummary | null>(null);
    const [socialOpen, setSocialOpen] = useState(false);
    const [greeting, setGreeting] = useState('');

    useEffect(() => {
        apiService.getRewardsSummary().then(setRewards).catch(console.error);
    }, []);

    useEffect(() => {
        const updateGreeting = () => {
            const hour = new Date().getHours();
            if (hour < 5) setGreeting('Good Night');
            else if (hour < 12) setGreeting('Good Morning');
            else if (hour < 17) setGreeting('Good Afternoon');
            else setGreeting('Good Evening');
        };
        updateGreeting();
        // Update greeting every minute to keep it accurate if page stays open
        const interval = setInterval(updateGreeting, 60000);
        return () => clearInterval(interval);
    }, []);

    // Calculate daily totals
    const today = new Date().toDateString();
    const dailyStats = useMemo(() => {
        return mealLog
            .filter(entry => new Date(entry.createdAt).toDateString() === today)
            .reduce((acc, curr) => ({
                calories: acc.calories + curr.totalCalories,
                protein: acc.protein + curr.totalProtein
            }), { calories: 0, protein: 0 });
    }, [mealLog, today]);

    // Determine Next Action based on time
    const nextAction = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 11) return { text: "Breakfast approaching. Log your morning meal.", btn: "Log Breakfast", action: onCameraClick };
        if (hour < 14) return { text: "It's lunchtime. Snap a photo of your meal.", btn: "Log Lunch", action: onCameraClick };
        if (hour < 19) return { text: "Dinner time. Record your nutrition.", btn: "Log Dinner", action: onCameraClick };
        return { text: "Plan tomorrow's nutrition to stay ahead.", btn: "View Plan", action: () => {} }; // Placeholder action
    }, [onCameraClick]);

    // Placeholder activity score (would come from device integration)
    const activityScore = 65; 

    // Helper to get wallet string
    const walletBalance = rewards ? `${(rewards.points_total ?? 0).toLocaleString()} pts` : 'Loading...';
    const cashValue = rewards ? `$${((rewards.points_total ?? 0) * 0.009).toFixed(2)}` : '...';

    const handleBodyScanClick = () => {
        // Redirect to body scan page logic or modal
        const token = localStorage.getItem('embracehealth-api-token');
        const scannerUrl = 'https://scan.embracehealth.ai';
        if (token) {
            window.location.href = `${scannerUrl}?token=${encodeURIComponent(token)}`;
        } else {
            window.location.href = scannerUrl;
        }
    };

    return (
        <div className="pb-20 animate-fade-in">
            {/* Header */}
            <header className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">{greeting}, {userName || 'User'}</h1>
                    <p className="text-slate-500 font-medium">Let's hit your goals today.</p>
                </div>
                {/* Health Wallet Pill - Extra Prominent */}
                <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-2 px-3 flex items-center space-x-3">
                    <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg">
                        <TrophyIcon />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Health Wallet</p>
                        <div className="flex items-baseline space-x-1">
                            <span className="font-bold text-slate-800">{walletBalance}</span>
                            <span className="text-xs text-emerald-500 font-semibold bg-emerald-50 px-1 rounded">{cashValue}</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Digital Twin Hero */}
            <section className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 mb-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-indigo-500 to-amber-400"></div>
                
                <DigitalTwin 
                    calories={dailyStats.calories} 
                    protein={dailyStats.protein} 
                    calorieGoal={2000} 
                    proteinGoal={150} 
                    activityScore={activityScore}
                    onBodyClick={handleBodyScanClick}
                />

                {/* Body Status Chip */}
                <div className="text-center -mt-2 mb-6">
                     <button 
                        onClick={handleBodyScanClick}
                        className="inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-full px-4 py-1.5 transition-colors"
                     >
                        <span className="text-sm font-bold text-slate-700">Body Score: <span className="text-emerald-600">B+</span></span>
                        <span className="text-xs text-emerald-600 font-medium">↓ 0.5" Waist</span>
                    </button>
                </div>

                {/* Legend */}
                <div className="flex justify-center gap-6 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Cal: {Math.round(dailyStats.calories ?? 0)}</div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> Pro: {Math.round(dailyStats.protein ?? 0)}g</div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Activity</div>
                </div>
            </section>

            {/* Next Action Card */}
            <section className="mb-8">
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl shadow-lg p-5 flex flex-col sm:flex-row items-center justify-between text-white relative overflow-hidden">
                    <div className="relative z-10 mb-4 sm:mb-0 text-center sm:text-left">
                        <h3 className="font-bold text-lg mb-1 flex items-center justify-center sm:justify-start gap-2">
                            <ClockIcon /> 
                            <span>Up Next</span>
                        </h3>
                        <p className="text-slate-300 text-sm max-w-xs">{nextAction.text}</p>
                    </div>
                    <button 
                        onClick={nextAction.action}
                        className="relative z-10 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-2 px-6 rounded-lg transition-all shadow-md transform hover:-translate-y-0.5 whitespace-nowrap"
                    >
                        {nextAction.btn}
                    </button>
                    {/* Decorative bg element */}
                    <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 skew-x-12 transform origin-bottom-right"></div>
                </div>
            </section>

            {/* Quick Actions Grid (Condensed) */}
            <section className="grid grid-cols-5 gap-2 mb-8">
                {[
                    { icon: <CameraIcon />, label: "Photo", onClick: onCameraClick, color: "bg-emerald-100 text-emerald-600" },
                    { icon: <BarcodeIcon />, label: "Scan", onClick: onBarcodeClick, color: "bg-blue-100 text-blue-600" },
                    { icon: <ChefHatIcon />, label: "Pantry", onClick: onPantryChefClick, color: "bg-amber-100 text-amber-600" },
                    { icon: <UtensilsIcon />, label: "Recipe", onClick: onGetRecipeClick, color: "bg-indigo-100 text-indigo-600" },
                    { icon: <UploadIcon />, label: "Upload", onClick: onUploadClick, color: "bg-slate-100 text-slate-600" },
                ].map((action, i) => (
                    <button key={i} onClick={action.onClick} className="flex flex-col items-center gap-2 group">
                        <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center ${action.color} shadow-sm group-hover:scale-105 transition-transform`}>
                            {action.icon}
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{action.label}</span>
                    </button>
                ))}
            </section>

            {/* Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Streaks Module */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                    <div className="p-3 bg-orange-100 text-orange-500 rounded-full">
                        <FireIcon />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800">7 Day Streak</h4>
                        <p className="text-xs text-slate-500">You're on fire! Keep logging.</p>
                    </div>
                </div>

                {/* Telemed Module (Conditional/Placeholder) */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer">
                    <div className="p-3 bg-cyan-100 text-cyan-500 rounded-full">
                        <BeakerIcon />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800">Labs & Vitals</h4>
                        <p className="text-xs text-slate-500">Connect provider to view.</p>
                    </div>
                </div>
            </div>

            {/* Community Section (Collapsible) */}
            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button 
                    onClick={() => setSocialOpen(!socialOpen)}
                    className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                    <div className="flex items-center gap-2 font-bold text-slate-700">
                        <UserGroupIcon />
                        <span>Community & Friends</span>
                    </div>
                    <span className="text-slate-400 text-sm">{socialOpen ? 'Hide' : 'Show Updates'}</span>
                </button>
                
                {socialOpen && (
                    <div className="p-4 border-t border-slate-200 space-y-4 animate-fade-in">
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-pink-200 flex-shrink-0"></div>
                            <div>
                                <p className="text-sm text-slate-800"><span className="font-bold">Sarah</span> hit her protein goal 5 days in a row!</p>
                                <p className="text-xs text-slate-400 mt-1">2 hours ago</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-200 flex-shrink-0"></div>
                            <div>
                                <p className="text-sm text-slate-800"><span className="font-bold">Mike</span> logged a new 10k run.</p>
                                <p className="text-xs text-slate-400 mt-1">5 hours ago</p>
                            </div>
                        </div>
                         <button className="w-full py-2 text-sm text-emerald-600 font-bold hover:bg-emerald-50 rounded-lg">
                            View All Activity
                        </button>
                    </div>
                )}
            </section>
        </div>
    );
};
