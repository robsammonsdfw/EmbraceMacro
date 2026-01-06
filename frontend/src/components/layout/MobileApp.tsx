
import React, { useState } from 'react';
import { 
    ActivityIcon, CameraIcon, DumbbellIcon, BrainIcon, UserGroupIcon, 
    UserCircleIcon, XIcon, TrophyIcon
} from '../icons';
import type { HealthStats, UserDashboardPrefs } from '../../types';

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

type StackLevel = 'home' | 'physical' | 'mental' | 'social' | 'config';

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

// New Hub Button Component matching the requested design
const HubButton: React.FC<{
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    // Styling props to match the image provided
    gradientFrom: string;
    gradientTo: string;
    iconColor: string;
    glowColor: string;
    image?: string; // Optional image prop if user uploads assets
}> = ({ label, icon, onClick, gradientFrom, gradientTo, iconColor, glowColor, image }) => (
    <button 
        onClick={onClick}
        className="relative flex flex-col items-center justify-center h-48 w-full rounded-[2rem] overflow-hidden shadow-xl transition-transform active:scale-95 group border border-white/5"
    >
        {/* Dynamic Background */}
        <div className={`absolute inset-0 bg-gradient-to-b ${gradientFrom} ${gradientTo}`}></div>
        
        {/* Optional Image Overlay (if assets exist) */}
        {image && <div className="absolute inset-0 bg-cover bg-center opacity-50 mix-blend-overlay" style={{backgroundImage: `url(${image})`}}></div>}

        {/* Neon Glow Circle */}
        <div className={`w-20 h-20 rounded-full border-2 ${iconColor} flex items-center justify-center mb-4 relative z-10 shadow-[0_0_15px_rgba(0,0,0,0.5)] bg-white/5 backdrop-blur-sm`}>
            <div className={`absolute inset-0 rounded-full ${glowColor} opacity-20 blur-md`}></div>
            <span className={`${iconColor} drop-shadow-md`}>
                {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-8 h-8" })}
            </span>
        </div>

        {/* Label */}
        <span className={`text-base font-black tracking-wider uppercase text-white z-10`}>{label}</span>
        
        {/* Subtle Bottom Fade */}
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>
    </button>
);

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
        <div className="p-4 space-y-6 pb-24 animate-fade-in">
            <header className="flex justify-between items-center px-2">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Hello, {user?.firstName || 'Hero'}</h1>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Your Utility Hub</p>
                </div>
                <button onClick={onLogout} className="bg-slate-100 p-2 rounded-full">
                    <UserCircleIcon className="w-6 h-6 text-slate-400" />
                </button>
            </header>

            {/* Hubs Grid - Matching the requested design */}
            <div className="grid grid-cols-3 gap-3">
                <HubButton 
                    label="Physical"
                    icon={<DumbbellIcon />}
                    gradientFrom="from-[#0f172a]" // Dark Navy
                    gradientTo="to-[#064e3b]"     // Dark Emerald
                    iconColor="text-emerald-400"
                    glowColor="bg-emerald-400"
                    onClick={() => navigateTo('physical')}
                    // image="/assets/physical-hub.png" // User can place image here
                />
                <HubButton 
                    label="Mental"
                    icon={<BrainIcon />}
                    gradientFrom="from-[#1e1b4b]" // Dark Indigo
                    gradientTo="to-[#4c1d95]"     // Dark Violet
                    iconColor="text-purple-400"
                    glowColor="bg-purple-400"
                    onClick={() => navigateTo('mental')}
                    // image="/assets/mental-hub.png" // User can place image here
                />
                <HubButton 
                    label="Social"
                    icon={<UserGroupIcon />}
                    gradientFrom="from-[#2e1065]" // Dark Purple
                    gradientTo="to-[#9a3412]"     // Dark Orange
                    iconColor="text-orange-400"
                    glowColor="bg-orange-400"
                    onClick={() => navigateTo('social')}
                    // image="/assets/social-hub.png" // User can place image here
                />
            </div>

            {/* Secondary Actions */}
            <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={onCameraClick}
                    className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-slate-100 flex items-center gap-3 active:scale-95 transition-transform"
                >
                    <div className="bg-slate-100 p-3 rounded-full text-slate-600">
                        <CameraIcon className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                        <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Quick</span>
                        <span className="block text-sm font-black text-slate-800">Scan Meal</span>
                    </div>
                </button>
                <button 
                    onClick={() => navigateTo('social', 'rewards')}
                    className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-slate-100 flex items-center gap-3 active:scale-95 transition-transform"
                >
                    <div className="bg-amber-100 p-3 rounded-full text-amber-600">
                        <TrophyIcon className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                        <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Wallet</span>
                        <span className="block text-sm font-black text-slate-800">Redeem</span>
                    </div>
                </button>
            </div>
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
        if (stack === 'social') {
            return renderSubLevelMenu('Social', [
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
