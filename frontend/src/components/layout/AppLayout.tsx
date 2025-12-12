
import React from 'react';
import { SidebarNav } from './SidebarNav';

interface AppLayoutProps {
    children: React.ReactNode;
    activeView: string;
    onNavigate: (view: string) => void;
    onLogout: () => void;
    rightPanel?: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, activeView, onNavigate, onLogout, rightPanel }) => {
    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar - Hidden on mobile by default in this implementation, assume mobile uses bottom nav from App.tsx */}
            <div className="hidden md:block w-64 flex-shrink-0">
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
        </div>
    );
};
