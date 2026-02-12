import React, { useState, useEffect } from 'react';
import { ActivityIcon, CheckIcon, HeartIcon, RefreshIcon } from '../icons';
import * as apiService from '../../services/apiService';
import type { HealthStats } from '../../types';

// --- PKCE Helpers ---
function generateRandomString(length: number) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const values = new Uint8Array(length);
    crypto.getRandomValues(values);
    for (let i = 0; i < length; i++) {
        result += charset[values[i] % charset.length];
    }
    return result;
}

async function sha256(plain: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(a: ArrayBuffer) {
    let str = "";
    const bytes = new Uint8Array(a);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        str += String.fromCharCode(bytes[i]);
    }
    return btoa(str)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

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
            const verifier = localStorage.getItem('fitbit_code_verifier');
            if (!verifier) {
                console.warn("No verifier found in local storage. Auth session may have expired.");
                return;
            }

            setIsProcessingCode(true);
            setFitbitStatus('syncing');
            apiService.linkFitbitAccount(code, verifier).then(() => {
                setFitbitStatus('connected');
                localStorage.removeItem('fitbit_code_verifier');
                // Clean URL to prevent re-processing on refresh
                window.history.replaceState({}, document.title, window.location.pathname);
                alert("Fitbit account linked successfully!");
            }).catch(e => {
                console.error("Link failed", e);
                setFitbitStatus('idle');
                alert("Fitbit link failed. Check your backend environment variables (ID/SECRET/REDIRECT).");
            }).finally(() => setIsProcessingCode(false));
        }
    }, [isProcessingCode]);

    const handleAppleSync = async () => {
        setAppleStatus('syncing');
        setLastUpdatedFields([]);
        try {
            // Direct sync pending native platform bridge
            alert("Native Apple Health sync is coming soon! For now, use the 'Vision Sync' feature to import screenshots from your Health app.");
            setAppleStatus('idle');
        } catch (e) {
            console.error(e);
            setAppleStatus('idle');
        }
    };

    const handleFitbitConnect = async () => {
        setFitbitStatus('syncing');
        try {
            // 1. Generate Verifier and Challenge for PKCE
            const verifier = generateRandomString(128);
            const hashed = await sha256(verifier);
            const challenge = base64urlencode(hashed);
            
            // 2. Save verifier locally for the return trip
            localStorage.setItem('fitbit_code_verifier', verifier);

            // 3. Get Auth URL from backend (includes challenge)
            const { url } = await apiService.getFitbitAuthUrl(challenge);
            
            // 4. Redirect the user to Fitbit
            window.location.href = url;
        } catch (e) {
            console.error("Failed to initiate Fitbit connect", e);
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
                        {appleStatus === 'syncing' ? <div className="w-5 h-5 border-2 border-slate-300 border-t-rose-500 rounded-full animate-spin"></div> : <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase group-hover:bg-slate-200">Sync</span>}
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
                            {(fitbitStatus as string) === 'connected' ? 'Connected' : 'Link Account'}
                        </button>
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