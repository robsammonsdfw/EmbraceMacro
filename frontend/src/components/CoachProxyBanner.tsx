
import React from 'react';
import { XIcon, UserCircleIcon } from './icons';

interface CoachProxyBannerProps {
    clientName: string;
    onExit: () => void;
}

export const CoachProxyBanner: React.FC<CoachProxyBannerProps> = ({ clientName, onExit }) => {
    return (
        <div className="bg-yellow-400 text-slate-900 px-4 py-2 flex items-center justify-between shadow-md sticky top-0 z-[60]">
            <div className="flex items-center gap-2">
                <span className="animate-pulse">⚠️</span>
                <span className="font-black uppercase tracking-tighter text-sm">Proxy Mode Active</span>
                <span className="mx-2 text-slate-600">|</span>
                <div className="flex items-center gap-1.5">
                    <UserCircleIcon className="w-4 h-4" />
                    <span className="font-bold">Client: {clientName}</span>
                </div>
            </div>
            <button 
                onClick={onExit}
                className="bg-slate-900 text-white px-3 py-1 rounded-lg text-xs font-black uppercase hover:bg-black transition-colors flex items-center gap-1"
            >
                <XIcon className="w-3 h-3" /> Exit Proxy
            </button>
        </div>
    );
};
