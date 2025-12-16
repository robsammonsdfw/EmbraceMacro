
import React, { useState, useEffect } from 'react';
import { XIcon, UploadIcon } from './icons'; // Reusing UploadIcon as Share Icon approximation

export const InstallPrompt: React.FC = () => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        // Simple logic: Show after 3 seconds if not dismissed previously
        const isDismissed = localStorage.getItem('install-prompt-dismissed');
        if (!isDismissed) {
            const timer = setTimeout(() => setShow(true), 3000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleDismiss = () => {
        setShow(false);
        localStorage.setItem('install-prompt-dismissed', 'true');
    };

    if (!show) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:bottom-8 md:w-96 bg-slate-900 text-white p-4 rounded-xl shadow-2xl z-50 animate-bounce-short border border-slate-700">
            <div className="flex justify-between items-start">
                <div className="flex gap-3">
                    <div className="bg-emerald-500 p-2 rounded-lg h-10 w-10 flex items-center justify-center font-bold text-xl">E</div>
                    <div>
                        <h4 className="font-bold text-emerald-400">Install App</h4>
                        <p className="text-sm text-slate-300 leading-tight mt-1">
                            Save your Digital Twin to your home screen for instant access.
                        </p>
                    </div>
                </div>
                <button onClick={handleDismiss} className="text-slate-400 hover:text-white"><XIcon /></button>
            </div>
            
            {/* iOS Instructions Approximation */}
            <div className="mt-4 pt-3 border-t border-slate-700 flex items-center gap-2 text-xs text-slate-400">
                <span>Tap</span>
                <span className="bg-slate-700 p-1 rounded"><UploadIcon /></span>
                <span>then "Add to Home Screen"</span>
            </div>
            
            {/* Triangular pointer for bottom bar (mobile) */}
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-slate-900 rotate-45 border-b border-r border-slate-700 md:hidden"></div>
        </div>
    );
};
