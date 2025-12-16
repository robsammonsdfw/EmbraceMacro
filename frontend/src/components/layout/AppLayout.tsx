
import React, { useState } from 'react';
import { SidebarNav } from './SidebarNav';
import { MenuIcon, XIcon } from '../icons';

interface AppLayoutProps {
    children: React.ReactNode;
    activeView: string;
    onNavigate: (view: string) => void;
    onLogout: () => void;
    rightPanel?: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, activeView, onNavigate, onLogout, rightPanel }) => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleMobileNavigate = (view: string) => {
        onNavigate(view);
        setMobileMenuOpen(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
            {/* Mobile Header with Hamburger */}
            <div className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-30 shadow-sm">
                 <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500">
                    Embrace
                </h1>
                <button 
                    onClick={() => setMobileMenuOpen(true)}
                    className="p-2 -mr-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <MenuIcon />
                </button>
            </div>

            {/* Mobile Menu Overlay (Drawer) */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-50 flex md:hidden">
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-black/50 transition-opacity" 
                        onClick={() => setMobileMenuOpen(false)}
                    ></div>
                    
                    {/* Drawer */}
                    <div className="relative bg-white w-72 h-full shadow-2xl flex flex-col animate-slide-in-left">
                         <div className="absolute top-4 right-4 z-10">
                             <button 
                                onClick={() => setMobileMenuOpen(false)} 
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full"
                             >
                                <XIcon />
                             </button>
                         </div>
                         <SidebarNav activeView={activeView} onNavigate={handleMobileNavigate} onLogout={onLogout} />
                    </div>
                </div>
            )}

            {/* Desktop Sidebar (Persistent) */}
            <div className="hidden md:block w-64 flex-shrink-0 h-screen sticky top-0 border-r border-slate-200 bg-white z-30">
                <SidebarNav activeView={activeView} onNavigate={onNavigate} onLogout={onLogout} />
            </div>

            {/* Main Content Area */}
            <div className="flex-grow flex flex-col md:flex-row min-w-0">
                <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-5xl mx-auto w-full">
                    {children}
                </main>

                {/* Right Rail - Desktop Only */}
                {rightPanel && (
                    <aside className="hidden xl:block w-80 flex-shrink-0 p-6 border-l border-slate-200 bg-white/50 h-screen sticky top-0 overflow-y-auto">
                        <div className="space-y-6">
                            {rightPanel}
                        </div>
                    </aside>
                )}
            </div>
            
            <style>{`
                @keyframes slide-in-left {
                    from { transform: translateX(-100%); }
                    to { transform: translateX(0); }
                }
                .animate-slide-in-left {
                    animation: slide-in-left 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};
