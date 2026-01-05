
import React from 'react';
import { SidebarNav } from './SidebarNav';
import { MenuIcon, XIcon, ActivityIcon } from '../icons';
import { HealthJourney, ActiveView } from '../../types';

interface AppLayoutProps {
    children: React.ReactNode;
    activeView: ActiveView;
    onNavigate: (view: ActiveView) => void;
    onLogout: () => void;
    rightPanel?: React.ReactNode;
    mobileMenuOpen: boolean;
    setMobileMenuOpen: (open: boolean) => void;
    selectedJourney?: HealthJourney;
    onJourneyChange: (journey: HealthJourney) => void;
    showClientsTab?: boolean;
}

export const JOURNEYS: { id: HealthJourney; label: string }[] = [
    { id: 'weight-loss', label: 'Lose Weight Only' },
    { id: 'muscle-cut', label: 'Gain Muscle & Cut' },
    { id: 'muscle-bulk', label: 'Gain Muscle & Bulk' },
    { id: 'heart-health', label: 'Heart Health' },
    { id: 'blood-pressure', label: 'Lower Blood Pressure' },
    { id: 'general-health', label: 'General Health' },
];

export const AppLayout: React.FC<AppLayoutProps> = ({ 
    children, activeView, onNavigate, onLogout, rightPanel, mobileMenuOpen, setMobileMenuOpen, selectedJourney, onJourneyChange, showClientsTab
}) => {
    const handleMobileNavigate = (view: ActiveView) => {
        onNavigate(view);
        setMobileMenuOpen(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
            {/* Mobile Header */}
            <div className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-30 shadow-sm">
                 <div className="flex items-center">
                    <img src="/logo.png" alt="EH" className="max-w-full h-auto max-h-8 object-contain" />
                 </div>
                <button onClick={() => setMobileMenuOpen(true)} className="p-2 -mr-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"><MenuIcon /></button>
            </div>

            {/* Mobile Sidebar Overlay */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-50 flex md:hidden">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setMobileMenuOpen(false)}></div>
                    <div className="relative bg-white w-72 h-full shadow-2xl flex flex-col animate-slide-in-left">
                         <div className="absolute top-4 right-4 z-10"><button onClick={() => setMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full"><XIcon /></button></div>
                         <SidebarNav activeView={activeView} onNavigate={handleMobileNavigate} onLogout={onLogout} selectedJourney={selectedJourney} onJourneyChange={onJourneyChange} showClientsTab={showClientsTab} />
                    </div>
                </div>
            )}

            {/* Desktop Sidebar */}
            <div className="hidden md:block w-72 flex-shrink-0 h-screen sticky top-0 bg-white z-30 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
                <SidebarNav activeView={activeView} onNavigate={onNavigate} onLogout={onLogout} selectedJourney={selectedJourney} onJourneyChange={onJourneyChange} showClientsTab={showClientsTab} />
            </div>

            {/* Main Content Area */}
            <div className="flex-grow flex flex-col md:flex-row min-w-0">
                <main className="flex-1 overflow-y-auto w-full h-[calc(100vh-64px)] md:h-screen">
                    <div className="hidden md:flex bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-3 items-center justify-between sticky top-0 z-20">
                        <div className="flex items-center gap-2 text-slate-500"><ActivityIcon className="w-4 h-4" /><span className="text-xs font-bold uppercase tracking-widest">Active Journey</span></div>
                        <div className="flex items-center gap-3">
                            <select value={selectedJourney} onChange={(e) => onJourneyChange(e.target.value as HealthJourney)} className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-black text-slate-700 outline-none hover:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all shadow-sm cursor-pointer">
                                {JOURNEYS.map(j => (<option key={j.id} value={j.id}>{j.label}</option>))}
                            </select>
                        </div>
                    </div>
                    <div className="p-4 md:p-8 max-w-6xl mx-auto">{children}</div>
                </main>
                
                {/* Optional Right Panel (Desktop Only) */}
                {rightPanel && (
                    <aside className="hidden xl:block w-80 flex-shrink-0 p-6 border-l border-slate-200 bg-white/50 h-screen sticky top-0 overflow-y-auto">
                        <div className="space-y-6">{rightPanel}</div>
                    </aside>
                )}
            </div>
            
            <style>{`@keyframes slide-in-left { from { transform: translateX(-100%); } to { transform: translateX(0); } } .animate-slide-in-left { animation: slide-in-left 0.3s ease-out forwards; }`}</style>
        </div>
    );
};
