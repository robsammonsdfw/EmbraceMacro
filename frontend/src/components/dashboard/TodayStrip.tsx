
import React from 'react';
import { FireIcon, ActivityIcon, HeartIcon, MoonIcon, DropIcon } from '../icons';
import type { HealthStats, UserDashboardPrefs } from '../../types';

interface TodayStripProps {
    stats: HealthStats;
    isConnected: boolean;
    onConnect: (source?: 'apple' | 'fitbit') => void;
    dashboardPrefs: UserDashboardPrefs;
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

export const TodayStrip: React.FC<TodayStripProps> = ({ stats, onConnect, dashboardPrefs, isSyncing }) => {
    
    const availableWidgets = [
        { id: 'steps', label: 'Steps', value: stats.steps.toLocaleString(), subValue: 'Daily Count', icon: <ActivityIcon />, colors: 'bg-blue-50 text-blue-600' },
        { id: 'activeCalories', label: 'Active Burn', value: Math.round(stats.activeCalories), subValue: 'kcal', icon: <FireIcon />, colors: 'bg-emerald-50 text-emerald-600' },
        { id: 'heartRate', label: 'Current HR', value: stats.heartRate || '--', subValue: 'bpm', icon: <HeartIcon />, colors: 'bg-red-50 text-red-600' },
        { id: 'bloodPressure', label: 'Blood Pressure', value: stats.bloodPressureSystolic && stats.bloodPressureDiastolic ? `${stats.bloodPressureSystolic}/${stats.bloodPressureDiastolic}` : '--', subValue: 'mmHg', icon: <HeartIcon />, colors: 'bg-rose-100 text-rose-600 border-rose-200' },
        { id: 'weight', label: 'Body Weight', value: stats.weightLbs ? stats.weightLbs.toFixed(1) : '--', subValue: 'lbs', icon: <ActivityIcon />, colors: 'bg-slate-100 text-slate-700' },
        { id: 'glucose', label: 'Blood Glucose', value: stats.glucoseMgDl || '--', subValue: 'mg/dL', icon: <DropIcon />, colors: 'bg-indigo-50 text-indigo-600' },
        { id: 'sleepScore', label: 'Sleep Quality', value: stats.sleepScore || '--', subValue: '/ 100', icon: <MoonIcon />, colors: 'bg-indigo-50 text-indigo-500' },
    ];

    const selectedWidgets = availableWidgets.filter(w => (dashboardPrefs.selectedWidgets || []).includes(w.id)).slice(0, 3);
    if (selectedWidgets.length === 0) selectedWidgets.push(availableWidgets[0], availableWidgets[3], availableWidgets[4]);

    return (
        <div className="space-y-4 mb-6">
            <div className="flex justify-between items-center px-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Vision Sync Active Data</p>
                {stats.lastSynced && <span className="text-[10px] text-slate-400">Updated {new Date(stats.lastSynced).toLocaleTimeString()}</span>}
            </div>
            <div className="grid grid-cols-3 gap-4">
                {selectedWidgets.map(widget => (
                    <StatCard key={widget.id} label={widget.label} value={widget.value} subValue={widget.subValue} icon={widget.icon} colors={widget.colors} />
                ))}
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={() => onConnect('apple')} 
                    disabled={isSyncing}
                    className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isSyncing ? 'Processing Vision...' : 'Vision Sync Screenshot'}
                </button>
            </div>
        </div>
    );
};
