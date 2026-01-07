
import React, { useState } from 'react';
import { ActivityIcon, FireIcon, CheckIcon } from '../icons';
import * as apiService from '../../services/apiService';
import { connectHealthProvider, syncHealthData } from '../../services/healthService';

interface DeviceSyncProps {
    onSyncComplete: () => void;
}

export const DeviceSync: React.FC<DeviceSyncProps> = ({ onSyncComplete }) => {
    const [appleStatus, setAppleStatus] = useState<'idle' | 'syncing' | 'connected'>('idle');
    const [fitbitStatus, setFitbitStatus] = useState<'idle' | 'syncing' | 'connected'>('idle');

    const handleAppleSync = async () => {
        setAppleStatus('syncing');
        try {
            await connectHealthProvider('ios');
            const data = await syncHealthData('apple');
            await apiService.syncHealthStatsToDB(data);
            setAppleStatus('connected');
            onSyncComplete();
        } catch (e) {
            alert("Apple Health sync failed.");
            setAppleStatus('idle');
        }
    };

    const handleFitbitSync = async () => {
        setFitbitStatus('syncing');
        try {
            await connectHealthProvider('fitbit');
            const data = await syncHealthData('fitbit');
            await apiService.syncHealthStatsToDB(data);
            setFitbitStatus('connected');
            onSyncComplete();
        } catch (e) {
            alert("Fitbit sync failed.");
            setFitbitStatus('idle');
        }
    };

    return (
        <div className="max-w-md mx-auto p-6 space-y-8 animate-fade-in pb-20">
            <header className="text-center">
                <div className="mx-auto bg-slate-100 p-4 rounded-full w-20 h-20 flex items-center justify-center mb-4 text-slate-400">
                    <ActivityIcon className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-black text-slate-900">Device Sync</h2>
                <p className="text-slate-500 font-medium mt-1">Connect your wearables to feed the Digital Twin.</p>
            </header>

            <div className="space-y-4">
                {/* Apple Health Button */}
                <button
                    onClick={handleAppleSync}
                    disabled={appleStatus === 'syncing' || appleStatus === 'connected'}
                    className={`w-full p-5 rounded-3xl border-2 transition-all flex items-center justify-between group ${
                        appleStatus === 'connected' 
                        ? 'bg-emerald-50 border-emerald-200' 
                        : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'
                    }`}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center text-white">
                            <FireIcon className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <h3 className="font-bold text-slate-900">Apple Health</h3>
                            <p className="text-xs text-slate-500 font-medium">Steps, Sleep, HRV</p>
                        </div>
                    </div>
                    <div className="pr-2">
                        {appleStatus === 'idle' && <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide group-hover:bg-slate-200">Connect</span>}
                        {appleStatus === 'syncing' && <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin"></div>}
                        {appleStatus === 'connected' && <div className="bg-emerald-500 text-white p-1 rounded-full"><CheckIcon className="w-4 h-4" /></div>}
                    </div>
                </button>

                {/* Fitbit Button */}
                <button
                    onClick={handleFitbitSync}
                    disabled={fitbitStatus === 'syncing' || fitbitStatus === 'connected'}
                    className={`w-full p-5 rounded-3xl border-2 transition-all flex items-center justify-between group ${
                        fitbitStatus === 'connected' 
                        ? 'bg-emerald-50 border-emerald-200' 
                        : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'
                    }`}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#00B0B9] rounded-2xl flex items-center justify-center text-white">
                            <ActivityIcon className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <h3 className="font-bold text-slate-900">Fitbit</h3>
                            <p className="text-xs text-slate-500 font-medium">Activity, Heart Rate</p>
                        </div>
                    </div>
                    <div className="pr-2">
                        {fitbitStatus === 'idle' && <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide group-hover:bg-slate-200">Connect</span>}
                        {fitbitStatus === 'syncing' && <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin"></div>}
                        {fitbitStatus === 'connected' && <div className="bg-emerald-500 text-white p-1 rounded-full"><CheckIcon className="w-4 h-4" /></div>}
                    </div>
                </button>
            </div>

            <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 text-center">
                <p className="text-indigo-800 text-xs font-bold uppercase tracking-widest mb-2">Sync Status</p>
                <p className="text-indigo-600 text-sm font-medium">Last updated: Just now</p>
            </div>
        </div>
    );
};
