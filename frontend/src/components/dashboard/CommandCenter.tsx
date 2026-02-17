
import React, { useEffect, useState, useMemo } from 'react';
import { TodayStrip } from './TodayStrip';
import { DigitalTwinPanel } from './DigitalTwinPanel';
import { CameraIcon, BarcodeIcon, ChefHatIcon, UtensilsIcon, UserGroupIcon, ActivityIcon } from '../icons';
import type { HealthStats, Friendship, UserDashboardPrefs } from '../../types';
import * as apiService from '../../services/apiService';

interface CommandCenterProps {
    dailyCalories: number;
    dailyProtein: number;
    rewardsBalance: number;
    userName: string;
    healthStats: HealthStats;
    isHealthConnected: boolean;
    isHealthSyncing: boolean;
    onConnectHealth: (source?: 'apple' | 'fitbit') => void;
    onScanClick: () => void;
    onCameraClick: (mode: 'meal' | 'barcode' | 'pantry' | 'restaurant' | 'search') => void;
    dashboardPrefs: UserDashboardPrefs;
}

const SocialFeedItem: React.FC<{ name: string; action: string; time: string; color: string }> = ({ name, action, time, color }) => (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100/50">
        <div className={`w-10 h-10 rounded-xl ${color} flex-shrink-0 flex items-center justify-center font-black text-white text-xs`}>
            {name[0].toUpperCase()}
        </div>
        <div>
            <p className="text-xs text-slate-700 font-medium">
                <span className="font-black text-slate-900">{name}</span> {action}
            </p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{time}</p>
        </div>
    </div>
);

const ChefGPTCard: React.FC<{ 
    title: string; 
    subtitle: string; 
    icon: React.ReactNode; 
    color: string; 
    onClick: () => void; 
}> = ({ title, subtitle, icon, color, onClick }) => (
    <button 
        onClick={onClick}
        className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 flex items-center gap-4 text-left group active:scale-95"
    >
        <div className={`p-4 rounded-2xl ${color} transition-transform group-hover:scale-110 shadow-sm`}>
            {icon}
        </div>
        <div>
            <h4 className="font-black text-slate-800 uppercase tracking-tight text-sm">{title}</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight mt-0.5">{subtitle}</p>
        </div>
    </button>
);

export const CommandCenter: React.FC<CommandCenterProps> = ({ 
    dailyCalories, dailyProtein, rewardsBalance, onScanClick,
    onCameraClick, healthStats, isHealthSyncing, isHealthConnected, 
    onConnectHealth, dashboardPrefs
}) => {
    const [friends, setFriends] = useState<Friendship[]>([]);

    const journeyLabel = useMemo(() => {
        const labels: Record<string, string> = {
            'weight-loss': 'Weight Loss Only',
            'muscle-cut': 'Muscle Gain & Cut',
            'muscle-bulk': 'Muscle Gain & Bulk',
            'heart-health': 'Improve Heart Health',
            'blood-pressure': 'Lower Blood Pressure',
            'general-health': 'General Health'
        };
        return labels[dashboardPrefs.selectedJourney || ''] || 'My Health';
    }, [dashboardPrefs.selectedJourney]);

    useEffect(() => {
        apiService.getFriends().then(setFriends).catch(() => {});
    }, []);

    const calorieGoal = dashboardPrefs.calorieGoal || 2000;
    const proteinGoal = dashboardPrefs.proteinGoal || 150;

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header / Wallet */}
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex-1 text-center md:text-left">
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Health Wallet</p>
                    <div className="flex items-baseline justify-center md:justify-start gap-2">
                        <span className="text-5xl font-black text-white">{(rewardsBalance ?? 0).toLocaleString()}</span>
                        <span className="text-emerald-400 font-black uppercase text-xs tracking-widest">Points</span>
                    </div>
                </div>
                <div className="h-px w-full md:h-12 md:w-px bg-slate-800"></div>
                <div className="flex-1 text-center md:text-right">
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Metabolic Goal</p>
                    <div className="flex items-center justify-center md:justify-end gap-2 text-emerald-400 font-black">
                        <ActivityIcon className="w-5 h-5" />
                        <span className="text-xl uppercase tracking-tight">{journeyLabel}</span>
                    </div>
                </div>
            </div>

            {/* Kitchen Intelligence Feature Matrix */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Kitchen Intelligence</h2>
                    <div className="h-px flex-grow bg-slate-100"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ChefGPTCard 
                        title="MacrosChef" 
                        subtitle="Scan Meal for Macros & Cals" 
                        icon={<CameraIcon className="w-6 h-6" />} 
                        color="bg-emerald-50 text-emerald-600"
                        onClick={() => onCameraClick('meal')}
                    />
                    <ChefGPTCard 
                        title="PantryChef" 
                        subtitle="Ingredients to 3 Recipes" 
                        icon={<ChefHatIcon className="w-6 h-6" />} 
                        color="bg-amber-50 text-amber-600"
                        onClick={() => onCameraClick('pantry')}
                    />
                    <ChefGPTCard 
                        title="MasterChef" 
                        subtitle="Cooked Dish to Recipe" 
                        icon={<UtensilsIcon className="w-6 h-6" />} 
                        color="bg-indigo-50 text-indigo-600"
                        onClick={() => onCameraClick('restaurant')}
                    />
                    <ChefGPTCard 
                        title="Barcode Engine" 
                        subtitle="Scan Store Packaging" 
                        icon={<BarcodeIcon className="w-6 h-6" />} 
                        color="bg-blue-50 text-blue-600"
                        onClick={() => onCameraClick('barcode')}
                    />
                </div>
            </section>

            {/* Vitals Strip */}
            <div className="pt-4">
                <TodayStrip 
                    stats={healthStats} isHealthConnected={isHealthConnected} onConnect={onConnectHealth} 
                    isSyncing={isHealthSyncing} dashboardPrefs={dashboardPrefs} 
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                             Metabolic Compliance
                        </h3>
                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between mb-2">
                                    <span className="font-black uppercase text-[10px] tracking-widest text-slate-600">Energy (Kcal)</span>
                                    <span className="font-black text-slate-900">{Math.round(dailyCalories ?? 0)} / {calorieGoal}</span>
                                </div>
                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 shadow-lg" style={{ width: `${Math.min(100, ((dailyCalories ?? 0) / calorieGoal) * 100)}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between mb-2">
                                    <span className="font-black uppercase text-[10px] tracking-widest text-slate-600">Protein (Grams)</span>
                                    <span className="font-black text-slate-900">{Math.round(dailyProtein ?? 0)} / {proteinGoal}g</span>
                                </div>
                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000 shadow-lg" style={{ width: `${Math.min(100, ((dailyProtein ?? 0) / proteinGoal) * 100)}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8">
                        <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs flex items-center gap-2 mb-6">
                            <UserGroupIcon className="w-5 h-5 text-indigo-500" /> Community Updates
                        </h3>
                        {friends.length > 0 ? (
                            <div className="space-y-2">
                                {friends.slice(0, 3).map(f => (
                                    <SocialFeedItem key={f.friendId} name={f.firstName || 'User'} action="is crushing their cardio goal" time="2h ago" color="bg-indigo-400" />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 text-slate-400">
                                <p className="text-sm font-medium">No community activity yet.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8 flex flex-col justify-between min-h-[300px]">
                        <div>
                            <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-6">EmbraceHealth 3D Body</h3>
                            <div className="flex justify-center mb-8">
                                <DigitalTwinPanel calories={dailyCalories} calorieGoal={calorieGoal} protein={dailyProtein} proteinGoal={proteinGoal} activityScore={0} onScanClick={onScanClick} miniMode={true} />
                            </div>
                        </div>
                        <button onClick={onScanClick} className="w-full bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] py-5 rounded-2xl hover:bg-black transition-all shadow-xl active:scale-95">
                            Launch Body Hub
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
