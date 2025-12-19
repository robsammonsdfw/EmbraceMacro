
import React from 'react';
import { FireIcon, ActivityIcon, ClockIcon, GlobeAltIcon, TrophyIcon, HeartIcon } from '../icons';
import type { HealthStats, UserDashboardPrefs } from '../../types';

interface TodayStripProps {
    stats: HealthStats;
    isConnected: boolean;
    onConnect: (source?: 'apple' | 'fitbit') => void;
    isSyncing?: boolean;
    dashboardPrefs: UserDashboardPrefs;
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

export const TodayStrip: React.FC<TodayStripProps> = ({ stats, onConnect, isSyncing, dashboardPrefs }) => {
    
    const availableWidgets = [
        { id: 'steps', label: 'Steps', value: stats.steps.toLocaleString(), subValue: 'Highest Logged', icon: <ActivityIcon />, colors: 'bg-blue-50 text-blue-600' },
        { id: 'activeCalories', label: 'Active Energy', value: Math.round(stats.activeCalories), subValue: 'kcal', icon: <FireIcon />, colors: 'bg-emerald-50 text-emerald-600' },
        { id: 'restingCalories', label: 'Resting Energy', value: Math.round(stats.restingCalories), subValue: 'kcal', icon: <TrophyIcon />, colors: 'bg-indigo-50 text-indigo-600' },
        { id: 'distanceMiles', label: 'Distance', value: stats.distanceMiles.toFixed(2), subValue: 'miles', icon: <GlobeAltIcon />, colors: 'bg-amber-50 text-amber-600' },
        { id: 'flightsClimbed', label: 'Flights', value: stats.flightsClimbed, subValue: 'floors', icon: <ActivityIcon />, colors: 'bg-rose-50 text-rose-600' },
        { id: 'heartRate', label: 'Avg Heart Rate', value: stats.heartRate || '--', subValue: 'bpm', icon: <HeartIcon />, colors: 'bg-red-50 text-red-600' }
    ];

    const selectedWidgets = availableWidgets.filter(w => dashboardPrefs.selectedWidgets.includes(w.id)).slice(0, 3);

    return (
        <div className="space-y-4 mb-6">
            <div className="flex justify-between items-center px-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aggregate Health Data</p>
                {stats.lastSynced && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <ClockIcon />
                        <span>Last Synced {new Date(stats.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                )}
            </div>
            
            <div className="grid grid-cols-3 gap-4">
                {selectedWidgets.map(widget => (
                    <StatCard 
                        key={widget.id}
                        label={widget.label}
                        value={widget.value}
                        subValue={widget.subValue}
                        icon={widget.icon}
                        colors={widget.colors}
                    />
                ))}
            </div>

            <div className="flex gap-2">
                <button 
                    onClick={() => onConnect('apple')}
                    disabled={isSyncing}
                    className="flex-1 py-3 bg-[#ff2d55] text-white rounded-xl text-xs font-bold transition-all hover:brightness-110 flex items-center justify-center gap-2 shadow-sm"
                >
                    {isSyncing ? 'Syncing...' : 'Sync Apple Health'}
                </button>
                <button 
                    onClick={() => onConnect('fitbit')}
                    disabled={isSyncing}
                    className="flex-1 py-3 bg-[#00B0B9] text-white rounded-xl text-xs font-bold transition-all hover:brightness-110 flex items-center justify-center gap-2 shadow-sm"
                >
                    {isSyncing ? 'Syncing...' : 'Sync Fitbit App'}
                </button>
            </div>
        </div>
    );
};
