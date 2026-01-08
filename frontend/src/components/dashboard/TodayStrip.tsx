
import React from 'react';
import { FireIcon, ActivityIcon, ClockIcon, GlobeAltIcon, TrophyIcon, HeartIcon, MoonIcon, DropIcon, WavesIcon, BrainIcon, UserCircleIcon } from '../icons';
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
        { id: 'steps', label: 'Steps', value: stats.steps.toLocaleString(), subValue: 'Daily Count', icon: <ActivityIcon />, colors: 'bg-blue-50 text-blue-600' },
        { id: 'activeCalories', label: 'Active Burn', value: Math.round(stats.activeCalories), subValue: 'kcal', icon: <FireIcon />, colors: 'bg-emerald-50 text-emerald-600' },
        { id: 'restingCalories', label: 'Resting Burn', value: Math.round(stats.restingCalories), subValue: 'kcal', icon: <TrophyIcon />, colors: 'bg-indigo-50 text-indigo-600' },
        { id: 'distanceMiles', label: 'Distance', value: stats.distanceMiles.toFixed(2), subValue: 'miles', icon: <GlobeAltIcon />, colors: 'bg-amber-50 text-amber-600' },
        { id: 'flightsClimbed', label: 'Floors', value: stats.flightsClimbed, subValue: 'flights', icon: <ActivityIcon />, colors: 'bg-rose-50 text-rose-600' },
        { id: 'heartRate', label: 'Current HR', value: stats.heartRate || '--', subValue: 'bpm', icon: <HeartIcon />, colors: 'bg-red-50 text-red-600' },
        { id: 'restingHeartRate', label: 'Resting HR', value: stats.restingHeartRate || '--', subValue: 'bpm', icon: <HeartIcon />, colors: 'bg-rose-50 text-rose-500' },
        { id: 'sleepScore', label: 'Sleep Quality', value: stats.sleepScore || '--', subValue: '/ 100', icon: <MoonIcon />, colors: 'bg-indigo-50 text-indigo-500' },
        { id: 'spo2', label: 'Blood Oxygen', value: stats.spo2 ? `${stats.spo2}%` : '--', subValue: 'SpO2', icon: <WavesIcon />, colors: 'bg-cyan-50 text-cyan-500' },
        { id: 'activeZoneMinutes', label: 'Zone Mins', value: stats.activeZoneMinutes || '--', subValue: 'AZM', icon: <FireIcon />, colors: 'bg-orange-50 text-orange-500' },
        { id: 'vo2Max', label: 'Cardio Fitness', value: stats.vo2Max || '--', subValue: 'VO2 Max', icon: <TrophyIcon />, colors: 'bg-teal-50 text-teal-500' },
        { id: 'waterFlOz', label: 'Hydration', value: stats.waterFlOz || '--', subValue: 'fl oz', icon: <DropIcon />, colors: 'bg-blue-50 text-blue-500' },
        { id: 'mindfulnessMinutes', label: 'Mindfulness', value: stats.mindfulnessMinutes || '--', subValue: 'minutes', icon: <BrainIcon />, colors: 'bg-violet-50 text-violet-500' },
        
        // NEW Apple Health / iHealth Clinical Widgets (Directly from user screenshots)
        { 
            id: 'bloodPressure', 
            label: 'Blood Pressure', 
            value: stats.bloodPressureSystolic && stats.bloodPressureDiastolic ? `${stats.bloodPressureSystolic}/${stats.bloodPressureDiastolic}` : '--', 
            subValue: 'mmHg', 
            icon: <HeartIcon />, 
            colors: 'bg-rose-100 text-rose-600 border-rose-200' 
        },
        { 
            id: 'bodyFat', 
            label: 'Body Fat', 
            value: stats.bodyFatPercentage ? `${stats.bodyFatPercentage}%` : '--', 
            subValue: 'Clinical %', 
            icon: <UserCircleIcon />, 
            colors: 'bg-indigo-100 text-indigo-600 border-indigo-200' 
        },
        { 
            id: 'bmi', 
            label: 'Body Mass Index', 
            value: stats.bmi ? stats.bmi.toFixed(1) : '--', 
            subValue: 'BMI', 
            icon: <ActivityIcon />, 
            colors: 'bg-violet-100 text-violet-600 border-violet-200' 
        },
        { 
            id: 'weight', 
            label: 'Body Weight', 
            value: stats.weightLbs ? stats.weightLbs.toFixed(1) : '--', 
            subValue: 'lbs', 
            icon: <ActivityIcon />, 
            colors: 'bg-slate-100 text-slate-700' 
        }
    ];

    const selectedWidgets = availableWidgets.filter(w => dashboardPrefs.selectedWidgets.includes(w.id)).slice(0, 3);

    return (
        <div className="space-y-4 mb-6">
            <div className="flex justify-between items-center px-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Wearable Sync Data</p>
                {stats.lastSynced && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <ClockIcon />
                        <span>Updated {new Date(stats.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
                    className="flex-1 py-3 bg-[#ff2d55] text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:brightness-110 flex items-center justify-center gap-2 shadow-sm active:scale-95"
                >
                    {isSyncing ? 'Syncing...' : 'Sync Apple Health'}
                </button>
                <button 
                    onClick={() => onConnect('fitbit')}
                    disabled={isSyncing}
                    className="flex-1 py-3 bg-[#00B0B9] text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:brightness-110 flex items-center justify-center gap-2 shadow-sm active:scale-95"
                >
                    {isSyncing ? 'Syncing...' : 'Sync Fitbit'}
                </button>
            </div>
        </div>
    );
};
