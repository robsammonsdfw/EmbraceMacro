
import React, { useState, useEffect, useRef } from 'react';
import { ActivityIcon, CheckIcon, HeartIcon, RefreshIcon } from '../icons';
import * as apiService from '../../services/apiService';
import { connectHealthProvider, syncHealthData } from '../../services/healthService';
import type { HealthStats } from '../../types';

interface DeviceSyncProps {
    onSyncComplete: (data?: HealthStats) => void;
    lastSynced?: string;
}

export const DeviceSync: React.FC<DeviceSyncProps> = ({ onSyncComplete, lastSynced }) => {
    const [appleStatus, setAppleStatus] = useState<'idle' | 'syncing' | 'connected'>('idle');
    const [fitbitStatus, setFitbitStatus] = useState<'idle' | 'syncing' | 'connected'>('idle');
    const [lastUpdatedFields, setLastUpdatedFields] = useState<string[]>([]);
    const [isProcessingCode, setIsProcessingCode] = useState(false);

    // Handle Fitbit Redirect Callback Handshake
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code && !isProcessingCode) {
            setIsProcessingCode(true);
            setFitbitStatus('syncing');
            apiService.linkFitbitAccount(code).then(() => {
                setFitbitStatus('connected');
                // Clean URL to prevent re-linking on refresh
                window.history.replaceState({}, document.title, window.location.pathname);
                alert("Fitbit account linked successfully!");
            }).catch(e => {
                console.error("Link failed", e);
                setFitbitStatus('idle');
                alert("Fitbit link failed. Check your server environment variables.");
            }).finally(() => setIsProcessingCode(false));
        }
    }, []);

    const handleAppleSync = async () => {
        setAppleStatus('syncing');
        setLastUpdatedFields([]);
        try {
            await connectHealthProvider('ios');
            const data = await syncHealthData('apple');
            const result = await apiService.syncHealthStatsToDB(data);
            setAppleStatus('connected');
            setLastUpdatedFields(['Blood Pressure', 'Weight', 'Body Fat', 'Mindfulness']);
            onSyncComplete(result);
        } catch (e) {
            console.error(e);
            alert("Apple Health sync failed.");
            setAppleStatus('idle');
        }
    };

    const handleFitbitConnect = async () => {
        setFitbitStatus('syncing');
        try {
            // This will trigger the redirect to Fitbit's site
            await connectHealthProvider('fitbit');
        } catch (e) {
            console.error(e);
            alert("Fitbit connection failed. Ensure FITBIT_CLIENT_ID is set in backend.");
            setFitbitStatus('idle');
        }
    };

    const handleFitbitSync = async () => {
        setFitbitStatus('syncing');
        try {
            const result = await apiService.syncWithFitbit();
            setFitbitStatus('connected');
            setLastUpdatedFields(['Steps', 'Active Calories']);
            onSyncComplete(result);
        } catch (e) {
            console.error(e);
            alert("Fitbit sync failed. You might need to reconnect.");
            setFitbitStatus('idle');
        }
    };

    const formatLastSynced = (dateString?: string) => {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleString();
    };

    return (
        <div className="max-w-md mx-auto p-6 space-y-8 animate-fade-in pb-20">
            <header className="text-center">
                <div className="mx-auto bg-slate-100 p-4 rounded-full w-20 h-20 flex items-center justify-center mb-4 text-slate-400">
                    <ActivityIcon className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-black text-slate-900">Device Sync</h2>
                <p className="text-slate-500 font-medium mt-1">Aggregated health data from your connected ecosystem.</p>
            </header>

            {lastUpdatedFields.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 animate-fade-in">
                    <p className="text-emerald-800 text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                        <CheckIcon className="w-4 h-4" /> Wearable Sync Complete
                    </p>
                    <p className="text-emerald-700 text-sm">Updated: {lastUpdatedFields.join(', ')}</p>
                </div>
            )}

            <div className="space-y-4">
                {/* Apple Health Button */}
                <button
                    onClick={handleAppleSync}
                    disabled={appleStatus === 'syncing'}
                    className={`w-full p-5 rounded-3xl border-2 transition-all flex items-center justify-between group ${
                        appleStatus === 'connected' ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'
                    }`}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center text-white shrink-0">
                            <HeartIcon className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <h3 className="font-bold text-slate-900">Apple Health</h3>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">Vitals & Body Composition</p>
                        </div>
                    </div>
                    <div className="pr-2">
                        {appleStatus === 'syncing' ? <div className="w-5 h-5 border-2 border-slate-300 border-t-rose-500 rounded-full animate-spin"></div> : <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase group-hover:bg-slate-200">Connect</span>}
                    </div>
                </button>

                {/* Fitbit Wearable Section */}
                <div className="bg-white rounded-3xl border-2 border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#00B0B9] rounded-2xl flex items-center justify-center text-white shrink-0">
                                <ActivityIcon className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-slate-900">Fitbit Wearable</h3>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">Real-time Activity & Sleep API</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-slate-50 p-4 flex gap-2">
                        <button 
                            onClick={handleFitbitConnect}
                            disabled={fitbitStatus === 'syncing'}
                            className="flex-1 bg-white border border-slate-200 py-3 rounded-xl text-[10px] font-black uppercase text-slate-700 hover:bg-slate-100 transition shadow-sm"
                        >
                            {/* FIX: Cast fitbitStatus to string to bypass unintended overlap warning */}
                            {(fitbitStatus as string) === 'connected' ? 'Connected' : 'Link Account'}
                        </button>
                        {/* FIX: Cast fitbitStatus to string to bypass unintended overlap warning */}
                        {(fitbitStatus as string) === 'connected' && (
                            <button 
                                onClick={handleFitbitSync}
                                disabled={fitbitStatus === 'syncing'}
                                className="flex-1 bg-slate-900 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-50"
                            >
                                {fitbitStatus === 'syncing' ? <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <RefreshIcon className="w-3 h-3" />}
                                Sync Data
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 text-center">
                <p className="text-indigo-800 text-xs font-bold uppercase tracking-widest mb-2">Aggregate Status</p>
                <p className="text-indigo-600 text-sm font-medium">Last wearable update: {formatLastSynced(lastSynced)}</p>
            </div>
        </div>
    );
};
