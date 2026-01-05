
import React, { useState } from 'react';
import { 
    ActivityIcon, CameraIcon, DumbbellIcon, BrainIcon, SparklesIcon, 
    UserCircleIcon, HomeIcon, MenuIcon, XIcon, PlusIcon 
} from '../icons';
import type { HealthStats, UserDashboardPrefs, ActiveView } from '../../types';

// Import Views
import { FuelSection } from '../sections/FuelSection';
import { BodyHub } from '../body/BodyHub';
import { HealthReportsView } from '../sections/HealthReportsView';
import { ReadinessView } from '../sections/ReadinessView';
import { AssessmentHub } from '../tests/AssessmentHub';
import { CoachingHub } from '../coaching/CoachingHub';
import { SocialManager } from '../social/SocialManager';
import { JourneyView } from '../sections/JourneyView';
import { RewardsDashboard } from '../RewardsDashboard';

interface MobileAppProps {
    healthStats: HealthStats;
    dashboardPrefs: UserDashboardPrefs;
    onCameraClick: () => void;
    // Pass-through props for views
    fuelProps: any;
    bodyProps: any;
    userRole: 'coach' | 'user';
    onLogout: () => void;
    user?: any;
}

type StackLevel = 'home' | 'physical' | 'mental' | 'spiritual' | 'config';

const VitalsStrip: React.FC<{ stats: HealthStats; prefs: UserDashboardPrefs }> = ({ stats, prefs }) => {
    // Helper to render enabled stats
    const items = [
        { id: 'steps', label: 'Steps', value: stats.steps.toLocaleString(), unit: '', color: 'text-blue-500' },
        { id: 'activeCalories', label: 'Active', value: Math.round(stats.activeCalories), unit: 'kcal', color: 'text-emerald-500' },
        { id: 'heartRate', label: 'HR', value: stats.heartRate || '--', unit: 'bpm', color: 'text-rose-500' },
        { id: 'sleepMinutes', label: 'Sleep', value: stats.sleepMinutes ? Math.round(stats.sleepMinutes/60) : '--', unit: 'hrs', color: 'text-indigo-500' },
    ];

    const displayItems = items.filter(i => prefs.selectedWidgets.includes(i.id) || i.id === 'steps' || i.id === 'heartRate');

    return (
        <div className="flex gap-4 overflow-x-auto no-scrollbar py-4 px-4 bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-30">
            {displayItems.map(item => (
                <div key={item.id} className="flex flex-col items-center min-w-[70px] flex-shrink-0">
                    <span className={`text-xl font-black ${item.color}`}>{item.value}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{item.label}</span>
                </div>
            ))}
            <button className="flex flex-col items-center min-w-[50px] justify-center text-slate-300">
                <ActivityIcon className="w-5 h-5" />
            </button>
        </div>
    );
};

export const MobileApp: React.FC<MobileAppProps> = ({ 
    healthStats, dashboardPrefs, onCameraClick, fuelProps, bodyProps, userRole, onLogout, user
}) => {
    const [stack, setStack] = useState<StackLevel>('home');
    const [subView, setSubView] = useState<string | null>(null);

    // Navigation Helper
    const navigateTo = (level: StackLevel, view?: string) => {
        setStack(level);
        if (view) setSubView(view);
        else setSubView(null);
    };

    const goBack = () => {
        if (subView) {
            setSubView(null);
        } else {
            setStack('home');
        }
    };

    const renderHome = () => (
        <div className="p-4 space-y-4 pb-24 animate-fade-in">
            <header className="flex justify-between items-center mb-2 px-2">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Hello, {user?.firstName || 'Hero'}</h1>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Your Utility Hub</p>
                </div>
                <button onClick={onLogout} className="bg-slate-100 p-2 rounded-full">
                    <UserCircleIcon className="w-6 h-6 text-slate-400" />
                </button>
            </header>

            {/* Giant Action Grid */}
            <div 
                className="mobile-hero-card relative overflow-hidden group"
                style={{backgroundImage: 'url(https://images.unsplash.com/photo-1540420772988-4c38dbdd8018?auto=format&fit=crop&q=80&w=800)'}}
                onClick={() => navigateTo('physical')}
            >
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                <div className="relative z-10 flex items-center gap-3">
                    <DumbbellIcon className="w-8 h-8 text-emerald-400" />
                    <span>Physical</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div 
                    className="mobile-hero-card h-[160px] text-xl relative overflow-hidden"
                    style={{backgroundImage: 'url(https://images.unsplash.com/photo-1544367563-12123d8965cd?auto=format&fit=crop&q=80&w=600)'}}
                    onClick={() => navigateTo('mental')}
                >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                    <div className="relative z-10 flex items-center gap-2">
                        <BrainIcon className="w-6 h-6 text-indigo-400" />
                        <span>Mental</span>
                    </div>
                </div>
                <div 
                    className="mobile-hero-card h-[160px] text-xl relative overflow-hidden"
                    style={{backgroundImage: 'url(https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&q=80&w=600)'}}
                    onClick={() => navigateTo('spiritual')}
                >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                    <div className="relative z-10 flex items-center gap-2">
                        <SparklesIcon className="w-6 h-6 text-amber-400" />
                        <span>Spiritual</span>
                    </div>
                </div>
            </div>

            {/* Quick Camera Action */}
            <button 
                onClick={onCameraClick}
                className="w-full bg-slate-900 rounded-[2rem] p-6 flex items-center justify-between text-white shadow-xl active:scale-95 transition-transform"
            >
                <div className="flex items-center gap-4">
                    <div className="bg-emerald-500 p-3 rounded-full text-white">
                        <CameraIcon className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                        <h3 className="font-black text-lg uppercase tracking-tight">Quick Scan</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Log Meal or Body</p>
                    </div>
                </div>
                <PlusIcon className="w-6 h-6" />
            </button>
        </div>
    );

    const renderSubLevelMenu = (title: string, items: { id: string, label: string, desc: string }[]) => (
        <div className="p-6 pt-20 animate-slide-in-left min-h-screen bg-slate-50">
            <h2 className="text-4xl font-black text-slate-900 mb-8">{title}</h2>
            <div className="space-y-4">
                {items.map(item => (
                    <button 
                        key={item.id}
                        onClick={() => setSubView(item.id)}
                        className="w-full bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 text-left active:scale-95 transition-transform"
                    >
                        <h3 className="text-xl font-bold text-slate-800">{item.label}</h3>
                        <p className="text-slate-500 text-sm mt-1">{item.desc}</p>
                    </button>
                ))}
            </div>
        </div>
    );

    const renderContent = () => {
        if (stack === 'home') return renderHome();

        // Sub Views
        if (subView) {
            switch(subView) {
                case 'nutrition': return <div className="pt-16 px-2"><FuelSection {...fuelProps} /></div>;
                case 'body': return <div className="pt-16 px-2"><BodyHub {...bodyProps} /></div>;
                case 'reports': return <div className="pt-16 px-2"><HealthReportsView /></div>;
                
                case 'readiness': return <div className="pt-16 px-2"><ReadinessView /></div>;
                case 'assessments': return <div className="pt-16 px-2"><AssessmentHub /></div>;
                case 'care': return <div className="pt-16 px-2"><CoachingHub userRole={userRole} onUpgrade={fuelProps.onGenerateMedical} /></div>; // Hacky prop pass for upgrade placeholder

                case 'community': return <div className="pt-16 px-2"><SocialManager /></div>;
                case 'journey': return <div className="pt-16 px-2"><JourneyView dashboardPrefs={dashboardPrefs} onOpenWizard={() => {}} /></div>;
                case 'rewards': return <div className="pt-16 px-2"><RewardsDashboard /></div>;
                default: return <div>Not Found</div>;
            }
        }

        // Stack Menus
        if (stack === 'physical') {
            return renderSubLevelMenu('Physical', [
                { id: 'nutrition', label: 'Nutrition & Fuel', desc: 'Meal plans, library, grocery' },
                { id: 'body', label: 'Body & Movement', desc: '3D scan, form check, recovery' },
                { id: 'reports', label: 'Health Reports', desc: 'Labs, vitals, analysis' }
            ]);
        }
        if (stack === 'mental') {
            return renderSubLevelMenu('Mental', [
                { id: 'readiness', label: 'Daily Readiness', desc: 'HRV & Sleep score' },
                { id: 'assessments', label: 'Assessments', desc: 'Cognitive & mood checks' },
                { id: 'care', label: 'Care Team', desc: 'Coaches & Doctors' }
            ]);
        }
        if (stack === 'spiritual') {
            return renderSubLevelMenu('Spiritual', [
                { id: 'community', label: 'Community', desc: 'Friends & Groups' },
                { id: 'journey', label: 'My Journey', desc: 'Goals & Milestones' },
                { id: 'rewards', label: 'Rewards', desc: 'Health Wallet' }
            ]);
        }
    };

    return (
        <div className="bg-slate-50 min-h-screen font-sans">
            <VitalsStrip stats={healthStats} prefs={dashboardPrefs} />
            
            {/* Main Content Render */}
            <main>
                {renderContent()}
            </main>

            {/* Back Button Overlay (if deep) */}
            {stack !== 'home' && (
                <button 
                    onClick={goBack}
                    className="fixed bottom-6 left-6 w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center text-slate-800 border border-slate-100 z-50 active:scale-90 transition-transform"
                >
                    <XIcon className="w-6 h-6" />
                </button>
            )}

            {/* Persistent Camera FAB (only on home or subviews) */}
            {(stack === 'home' || subView) && (
                <button 
                    onClick={onCameraClick}
                    className="fixed bottom-6 right-6 w-16 h-16 bg-emerald-500 rounded-full shadow-2xl shadow-emerald-500/40 flex items-center justify-center text-white z-50 active:scale-90 transition-transform border-4 border-white"
                >
                    <CameraIcon className="w-8 h-8" />
                </button>
            )}
        </div>
    );
};
