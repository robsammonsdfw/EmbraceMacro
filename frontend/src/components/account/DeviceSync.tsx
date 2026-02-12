import React, { useState, useEffect } from 'react';
import { ActivityIcon, CheckIcon, RefreshIcon, CameraIcon, TrashIcon } from '../icons';
import * as apiService from '../../services/apiService';
import type { HealthStats } from '../../types';

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
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

interface DeviceSyncProps {
    onSyncComplete: (data?: HealthStats) => void;
    lastSynced?: string;
    onVisionSyncTrigger?: () => void;
}

export const DeviceSync: React.FC<DeviceSyncProps> = ({ onSyncComplete, lastSynced, onVisionSyncTrigger }) => {
    const [fitbitStatus, setFitbitStatus] = useState<'idle' | 'syncing' | 'connected'>('idle');
    const [isProcessingCode, setIsProcessingCode] = useState(false);
    const [isSyncingData, setIsSyncingData] = useState(false);

    useEffect(() => {
        const verifyStatus = async () => {
            try {
                const { connected } = await apiService.checkFitbitStatus();
                if (connected) setFitbitStatus('connected');
            } catch (e) { console.warn("Status check failed"); }
        };
        verifyStatus();
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code && !isProcessingCode) {
            const verifier = localStorage.getItem('fitbit_code_verifier');
            if (!verifier) return;

            setIsProcessingCode(true);
            setFitbitStatus('syncing');
            apiService.linkFitbitAccount(code, verifier).then(() => {
                setFitbitStatus('connected');
                localStorage.removeItem('fitbit_code_verifier');
                window.history.replaceState({}, document.title, window.location.pathname);
                alert("Fitbit linked successfully!");
            }).catch(e => {
                console.error("Link failed", e);
                setFitbitStatus('idle');
            }).finally(() => setIsProcessingCode(false));
        }
    }, [isProcessingCode]);

    const handleAppleSync = () => {
        if (onVisionSyncTrigger) onVisionSyncTrigger();
    };

    const handleFitbitConnect = async () => {
        setFitbitStatus('syncing');
        try {
            const verifier = generateRandomString(128);
            const hashed = await sha256(verifier);
            const challenge = base64urlencode(hashed);
            localStorage.setItem('fitbit_code_verifier', verifier);
            const { url } = await apiService.getFitbitAuthUrl(challenge);
            window.location.href = url;
        } catch (e) {
            alert("Fitbit connection failed.");
            setFitbitStatus('idle');
        }
    };

    const handleFitbitSync = async () => {
        setIsSyncingData(true);
        try {
            const result = await apiService.syncWithFitbit();
            onSyncComplete(result);
            alert("Fitbit sync complete! Steps and Calories updated.");
        } catch (e) {
            alert("Fitbit sync failed. Reconnect might be required.");
        } finally {
            setIsSyncingData(false);
        }
    };

    const handleFitbitDisconnect = async () => {
        if (!window.confirm("Unlink Fitbit? Current session data will stay, but no new updates will fetch.")) return;
        try {
            await apiService.disconnectFitbit();
            setFitbitStatus('idle');
            alert("Fitbit unlinked.");
        } catch (e) {
            alert("Failed to unlink.");
        }
    };

    return (
        <div className="max-w-md mx-auto p-6 space-y-8 animate-fade-in pb-20">
            <header className="text-center">
                <div className="mx-auto bg-slate-100 p-4 rounded-full w-20 h-20 flex items-center justify-center mb-4 text-slate-400">
                    <ActivityIcon className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 uppercase">Device Cloud</h2>
                <p className="text-slate-500 font-medium">Real-time wearable data persistence.</p>
            </header>

            <div className="space-y-4">
                <button
                    onClick={handleAppleSync}
                    className="w-full p-5 rounded-3xl border-2 bg-white border-slate-100 hover:border-indigo-400 transition-all flex items-center justify-between group shadow-sm"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md">
                            <CameraIcon className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <h3 className="font-bold text-slate-900">Vision Sync</h3>
                            <p className="text-xs text-slate-500 font-medium">Import Apple Health via Screenshot</p>
                        </div>
                    </div>
                    <span className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase">Launch</span>
                </button>

                <div className="bg-white rounded-3xl border-2 border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#00B0B9] rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md">
                                <ActivityIcon className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-slate-900">Fitbit Cloud</h3>
                                <p className="text-xs text-slate-500 font-medium">Direct API Wearable Link</p>
                            </div>
                        </div>
                        {fitbitStatus === 'connected' && (
                            <button onClick={handleFitbitDisconnect} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    
                    <div className="bg-slate-50 p-4 flex gap-2">
                        {fitbitStatus !== 'connected' ? (
                            <button 
                                onClick={handleFitbitConnect}
                                disabled={fitbitStatus === 'syncing'}
                                className="w-full bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest"
                            >
                                {fitbitStatus === 'syncing' ? 'Redirecting...' : 'Link Fitbit Account'}
                            </button>
                        ) : (
                            <button 
                                onClick={handleFitbitSync}
                                disabled={isSyncingData}
                                className="w-full bg-indigo-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                            >
                                {isSyncingData ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <RefreshIcon className="w-4 h-4" />}
                                Fetch Real-time Activity
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 text-center">
                <p className="text-emerald-800 text-[10px] font-black uppercase tracking-widest mb-1">Ecosystem Status</p>
                <p className="text-emerald-600 text-xs font-bold">Last cloud refresh: {lastSynced ? new Date(lastSynced).toLocaleString() : 'Pending connection'}</p>
            </div>
        </div>
    );
};
