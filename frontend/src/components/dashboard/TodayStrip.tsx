
import React from 'react';
import { FireIcon, ActivityIcon, HeartIcon, ClockIcon } from '../icons';
import type { HealthStats } from '../../types';
import { getPlatform } from '../../services/healthService';

interface TodayStripProps {
    stats: HealthStats;
    isConnected: boolean;
    onConnect: () => void;
    isSyncing?: boolean;
}

const StatCard: React.FC<{
    label: string;
    value: React.ReactNode;
    subValue?: React.ReactNode;
    icon: React.ReactNode;
    colors: string;
}> = ({ label, value, subValue, icon, colors }) => (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-2 transition-all hover:shadow-md h-32 relative overflow-hidden group">
        <div className={`p-3 rounded-full ${colors} transition-transform group-hover:scale-110`}>
            {icon}
        </div>
        <div className="text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight mb-1">
                {label}
            </p>
            <div className="flex flex-col items-center leading-tight">
                <span className="text-xl font-extrabold text-slate-800">
                    {value}
                </span>
                {subValue && (
                    <span className="text-xs text-slate-400 font-medium">
                        {subValue}
                    </span>
                )}
            </div>
        </div>
    </div>
);

export const TodayStrip: React.FC<TodayStripProps> = ({ stats, isConnected, onConnect, isSyncing }) => {
    const platform = getPlatform();

    if (!isConnected) {
        const platformName = platform === 'ios' ? 'Apple Health' : platform === 'android' ? 'Health Connect' : 'Google Fit';
        const brandColor = platform === 'ios' ? 'bg-[#ff2d55]' : 'bg-blue-600';

        return (
            <div className="mb-6">
                <button 
                    onClick={onConnect}
                    disabled={isSyncing}
                    className={`w-full ${brandColor} text-white p-6 rounded-2xl shadow-lg flex flex-col items-center justify-center gap-2 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 group`}
                >
                    {isSyncing ? (
                        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <div className="bg-white/20 p-3 rounded-full mb-1">
                            <ActivityIcon />
                        </div>
                    )}
                    <div className="text-center">
                        <h3 className="text-lg font-bold">Connect {platformName}</h3>
                        <p className="text-sm opacity-90">Sync steps, calories, and cardio markers automatically.</p>
                    </div>
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4 mb-6">
            <div className="flex justify-between items-center px-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Wearable Data</p>
                {stats.lastSynced && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <ClockIcon />
                        <span>Synced {new Date(stats.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                )}
            </div>
            <div className="grid grid-cols-3 gap-4">
                <StatCard 
                    label="Steps"
                    value={stats.steps.toLocaleString()}
                    subValue="Goal: 10k"
                    icon={<ActivityIcon />}
                    colors="bg-blue-50 text-blue-600"
                />
                
                <StatCard 
                    label="Calories"
                    value={Math.round(stats.activeCalories)}
                    subValue="Active"
                    icon={<FireIcon />}
                    colors="bg-emerald-50 text-emerald-600"
                />

                <StatCard 
                    label="Cardio"
                    value={stats.cardioScore}
                    subValue="Heart Pts"
                    icon={<HeartIcon />}
                    colors="bg-rose-50 text-rose-600"
                />
            </div>
            <button 
                onClick={onConnect} // Re-using connect as sync for this component logic
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl text-xs font-bold transition-colors"
            >
                {isSyncing ? 'Syncing...' : 'Force Sync Now'}
            </button>
        </div>
    );
};
