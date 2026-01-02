import React, { useState, useEffect } from 'react';
import { XIcon, UploadIcon } from './icons';

export const InstallPrompt: React.FC = () => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        const isDismissed = localStorage.getItem('install-prompt-dismissed');
        if (!isDismissed) {
            const timer = setTimeout(() => setShow(true), 5000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleDismiss = () => {
        setShow(false);
        localStorage.setItem('install-prompt-dismissed', 'true');
    };

    if (!show) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:bottom-8 md:w-96 bg-slate-900 text-white p-5 rounded-3xl shadow-2xl z-[100] animate-slide-up border border-slate-700">
            <div className="flex justify-between items-start">
                <div className="flex gap-4">
                    <div className="bg-white p-2 rounded-2xl h-12 w-12 flex items-center justify-center shadow-lg">
                        <img src="/icon.png" alt="EmbraceHealth" className="w-8 h-8" />
                    </div>
                    <div>
                        <h4 className="font-black uppercase tracking-tight text-emerald-400">Install Digital Twin</h4>
                        <p className="text-xs text-slate-300 font-medium leading-relaxed mt-1">
                            Save EmbraceHealth to your home screen for clinical-grade tracking and 3D biometrics.
                        </p>
                    </div>
                </div>
                <button onClick={handleDismiss} className="text-slate-500 hover:text-white p-1 transition-colors"><XIcon className="w-5 h-5" /></button>
            </div>
            
            <div className="mt-5 pt-4 border-t border-slate-800 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <span>Tap</span>
                <span className="bg-slate-800 p-1.5 rounded-lg text-white"><UploadIcon className="w-3.5 h-3.5" /></span>
                <span>then "Add to Home Screen"</span>
            </div>
            
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-slate-900 rotate-45 border-b border-r border-slate-700 md:hidden"></div>
            <style>{`
                @keyframes slide-up {
                    from { transform: translateY(100px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-up { animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            `}</style>
        </div>
    );
};