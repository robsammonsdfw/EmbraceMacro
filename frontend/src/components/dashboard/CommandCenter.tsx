
import React, { useEffect, useState, useMemo } from 'react';
import { TodayStrip } from './TodayStrip';
import { DigitalTwinPanel } from './DigitalTwinPanel';
import { CameraIcon, BarcodeIcon, ChefHatIcon, UtensilsIcon, UserGroupIcon, UserCircleIcon, ActivityIcon } from '../icons';
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
    onCameraClick: () => void;
    onBarcodeClick: () => void;
    onPantryChefClick: () => void;
    onRestaurantClick: () => void;
    onUploadClick: () => void;
    dashboardPrefs: UserDashboardPrefs;
    isProxy?: boolean;
}

const SocialFeedItem: React.FC<{ name: string; action: string; time: string; color: string }> = ({ name, action, time, color }) => (
    <div className="flex items-start space-x-3 p-3 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer group">
        <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white shadow-sm ${color}`}>
            {name[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-800 leading-tight">
                <span className="font-bold">{name}</span> {action}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">{time}</p>
        </div>
    </div>
);

export const CommandCenter: React.FC<CommandCenterProps> = ({ 
    dailyCalories, dailyProtein, rewardsBalance, onScanClick,
    onCameraClick, onBarcodeClick, onPantryChefClick, onRestaurantClick,
    healthStats, isHealthSyncing, isHealthConnected, onConnectHealth,
    dashboardPrefs, isProxy
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

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex-1 text-center md:text-left">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Health Wallet Balance</p>
                    <div className="flex items-baseline justify-center md:justify-start gap-2">
                        <span className="text-4xl font-extrabold text-white">{rewardsBalance.toLocaleString()}</span>
                        <span className="text-emerald-400 font-bold">points</span>
                    </div>
                </div>
                <div className="flex-1 text-center md:text-right">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Active Journey</p>
                    <div className="flex items-center justify-center md:justify-end gap-2 text-emerald-400 font-black">
                        <ActivityIcon className="w-4 h-4" />
                        <span className="text-lg uppercase tracking-tight">{journeyLabel}</span>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Status Update</h2>
                <button onClick={onScanClick} className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold border border-emerald-100 transition-colors">
                    <UserCircleIcon className="w-4 h-4" />
                    <span>Body Hub</span>
                </button>
            </div>

            <TodayStrip 
                stats={healthStats} isConnected={isHealthConnected} onConnect={onConnectHealth} 
                isSyncing={isHealthSyncing} dashboardPrefs={dashboardPrefs} 
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-gradient-to-br from-emerald-500 to-cyan-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-lg font-black uppercase tracking-widest mb-2">Journey Insight</h3>
                            <p className="text-white/90 font-medium">Calibrated medical insights for your {journeyLabel} path.</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4"><UserGroupIcon className="w-5 h-5 text-indigo-500" /> Community</h3>
                        {friends.length > 0 ? (
                            <div className="space-y-1">
                                {friends.slice(0, 2).map(f => (
                                    <SocialFeedItem key={f.friendId} name={f.firstName || 'User'} action="is tracking goals" time="2h ago" color="bg-indigo-400" />
                                ))}
                            </div>
                        ) : <p className="text-sm text-slate-400">No updates.</p>}
                    </div>

                    {!isProxy && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                            <h3 className="font-bold text-slate-900 mb-4 uppercase tracking-widest text-xs">Quick Log</h3>
                            <div className="grid grid-cols-4 gap-4">
                                <button onClick={onCameraClick} className="flex flex-col items-center gap-2 group"><div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:scale-110 transition-transform"><CameraIcon /></div><span className="text-[10px] font-bold text-slate-500 uppercase">Meal</span></button>
                                <button onClick={onBarcodeClick} className="flex flex-col items-center gap-2 group"><div className="p-4 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform"><BarcodeIcon /></div><span className="text-[10px] font-bold text-slate-500 uppercase">Scan</span></button>
                                <button onClick={onPantryChefClick} className="flex flex-col items-center gap-2 group"><div className="p-4 bg-amber-50 text-amber-600 rounded-2xl group-hover:scale-110 transition-transform"><ChefHatIcon /></div><span className="text-[10px] font-bold text-slate-500 uppercase">Pantry</span></button>
                                <button onClick={onRestaurantClick} className="flex flex-col items-center gap-2 group"><div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-110 transition-transform"><UtensilsIcon /></div><span className="text-[10px] font-bold text-slate-500 uppercase">Dine</span></button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between min-h-[250px]">
                        <h3 className="font-bold text-slate-900 uppercase tracking-widest text-xs mb-2">Body Twin</h3>
                        <div className="flex-grow flex items-center justify-center my-4">
                             <DigitalTwinPanel calories={dailyCalories} calorieGoal={2000} protein={dailyProtein} proteinGoal={150} activityScore={0} onScanClick={onScanClick} miniMode={true} />
                        </div>
                        <button onClick={onScanClick} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors shadow-md text-sm">Open Body Hub</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
