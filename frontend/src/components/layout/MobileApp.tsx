
import React, { useState } from 'react';
import { 
    ActivityIcon, CameraIcon, DumbbellIcon, BrainIcon, 
    UserCircleIcon, XIcon, TrophyIcon, UtensilsIcon, BriefcaseIcon
} from '../icons';
import type { HealthStats, UserDashboardPrefs } from '../../types';

// Import Views
import { FuelSection } from '../sections/FuelSection';
import { BodyHub } from '../body/BodyHub';
import { HealthReportsView } from '../sections/HealthReportsView';
import { ReadinessView } from '../sections/ReadinessView';
import { AssessmentHub } from '../tests/AssessmentHub';
import { CoachingHub } from '../coaching/CoachingHub';
import { JourneyView } from '../sections/JourneyView';
import { RewardsDashboard } from '../RewardsDashboard';
import { PlaceholderPage } from '../PlaceholderPage';
import { FormAnalysis } from '../body/FormAnalysis';
import { PantryChefView } from '../nutrition/PantryChefView';
import { MasterChefView } from '../nutrition/MasterChefView';
import { DeviceSync } from '../account/DeviceSync';
import { WidgetConfig } from '../account/WidgetConfig';
import { PharmacyOrders } from '../account/PharmacyOrders';

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

type StackLevel = 'home' | 'account' | 'physical' | 'nutrition' | 'mental' | 'roles' | 'rewards';

// --- Updated Vitals Strip with Feature Restored ---
const VitalsStrip: React.FC<{ stats: HealthStats; prefs: UserDashboardPrefs; onSyncClick: () => void }> = ({ stats, prefs, onSyncClick }) => {
    
    // Feature Restored: Map available data to widget IDs
    const allWidgets: Record<string, { label: string, value: string | number, unit: string, color: string }> = {
        steps: { label: 'Steps', value: stats.steps.toLocaleString(), unit: '', color: 'text-blue-500' },
        activeCalories: { label: 'Active', value: Math.round(stats.activeCalories), unit: 'kcal', color: 'text-emerald-500' },
        restingCalories: { label: 'Resting', value: Math.round(stats.restingCalories), unit: 'kcal', color: 'text-indigo-500' },
        distanceMiles: { label: 'Dist', value: stats.distanceMiles.toFixed(1), unit: 'mi', color: 'text-amber-500' },
        flightsClimbed: { label: 'Flights', value: stats.flightsClimbed, unit: 'flr', color: 'text-rose-500' },
        heartRate: { label: 'HR', value: stats.heartRate || '--', unit: 'bpm', color: 'text-red-500' },
    };

    // Use prefs to filter, or default to Steps/Active/HR if prefs are empty
    const widgetsToShow = (prefs.selectedWidgets && prefs.selectedWidgets.length > 0)
        ? prefs.selectedWidgets.map(id => ({ id, ...allWidgets[id] })).filter(w => w.label)
        : [
            { id: 'steps', ...allWidgets.steps },
            { id: 'activeCalories', ...allWidgets.activeCalories },
            { id: 'heartRate', ...allWidgets.heartRate }
          ];

    return (
        <div className="flex gap-4 overflow-x-auto no-scrollbar py-4 px-4 bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-30 items-center">
            {widgetsToShow.map(item => (
                <div key={item.id} className="flex flex-col items-center min-w-[70px] flex-shrink-0 animate-fade-in">
                    <span className={`text-xl font-black ${item.color}`}>{item.value}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{item.label}</span>
                </div>
            ))}
            <button 
                onClick={onSyncClick}
                className="flex flex-col items-center min-w-[60px] justify-center text-slate-400 hover:text-emerald-500 transition-colors ml-auto border-l border-slate-100 pl-4"
            >
                <div className="bg-slate-100 p-2 rounded-full mb-1">
                    <ActivityIcon className="w-4 h-4" />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wide">Sync</span>
            </button>
        </div>
    );
};

const HubButton: React.FC<{
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    gradientFrom: string;
    gradientTo: string;
    iconColor: string;
    glowColor: string;
}> = ({ label, icon, onClick, gradientFrom, gradientTo, iconColor, glowColor }) => (
    <button 
        onClick={onClick}
        className="relative flex flex-col items-center justify-center h-40 w-full rounded-[2rem] overflow-hidden shadow-xl transition-transform active:scale-95 group border border-white/5"
    >
        {/* Dynamic Background */}
        <div className={`absolute inset-0 bg-gradient-to-b ${gradientFrom} ${gradientTo}`}></div>
        
        {/* Neon Glow Circle */}
        <div className={`w-16 h-16 rounded-full border-2 ${iconColor} flex items-center justify-center mb-3 relative z-10 shadow-[0_0_15px_rgba(0,0,0,0.5)] bg-white/5 backdrop-blur-sm`}>
            <div className={`absolute inset-0 rounded-full ${glowColor} opacity-20 blur-md`}></div>
            <span className={`${iconColor} drop-shadow-md`}>
                {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-8 h-8" })}
            </span>
        </div>

        {/* Label */}
        <span className={`text-sm font-black tracking-wider uppercase text-white z-10`}>{label}</span>
        
        {/* Subtle Bottom Fade */}
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"></div>
    </button>
);

export const MobileApp: React.FC<MobileAppProps> = ({ 
    healthStats, dashboardPrefs, onCameraClick, fuelProps, bodyProps, userRole, onLogout, user
}) => {
    const [stack, setStack] = useState<StackLevel>('home');
    const [subView, setSubView] = useState<string | null>(null);
    const [showFormAnalysis, setShowFormAnalysis] = useState(false);

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

            {/* Quick Sync Button for Visibility */}
            <button 
                onClick={() => navigateTo('account', 'account.sync')}
                className="w-full bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between shadow-lg"
            >
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-500 p-2 rounded-lg">
                        <ActivityIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-sm">Sync Wearables</p>
                        <p className="text-xs text-slate-400">Connect Apple Health & Fitbit</p>
                    </div>
                </div>
                <div className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-black uppercase">Connect</div>
            </button>

            {/* 6 Hubs Grid */}
            <div className="grid grid-cols-2 gap-3">
                {/* 1. MY ACCOUNT */}
                <HubButton 
                    label="Account"
                    icon={<UserCircleIcon />}
                    gradientFrom="from-slate-700" 
                    gradientTo="to-slate-900"
                    iconColor="text-slate-200"
                    glowColor="bg-slate-400"
                    onClick={() => navigateTo('account')}
                />
                
                {/* 2. PHYSICAL */}
                <HubButton 
                    label="Physical"
                    icon={<DumbbellIcon />}
                    gradientFrom="from-emerald-700" 
                    gradientTo="to-teal-900"
                    iconColor="text-emerald-200"
                    glowColor="bg-emerald-400"
                    onClick={() => navigateTo('physical')}
                />

                {/* 3. NUTRITION */}
                <HubButton 
                    label="Nutrition"
                    icon={<UtensilsIcon />}
                    gradientFrom="from-orange-600" 
                    gradientTo="to-amber-800"
                    iconColor="text-orange-200"
                    glowColor="bg-orange-400"
                    onClick={() => navigateTo('nutrition')}
                />

                {/* 4. MENTAL & LABS */}
                <HubButton 
                    label="Mental"
                    icon={<BrainIcon />}
                    gradientFrom="from-indigo-700" 
                    gradientTo="to-violet-900"
                    iconColor="text-indigo-200"
                    glowColor="bg-indigo-400"
                    onClick={() => navigateTo('mental')}
                />

                {/* 5. ROLES */}
                <HubButton 
                    label="Portals"
                    icon={<BriefcaseIcon />}
                    gradientFrom="from-blue-600" 
                    gradientTo="to-cyan-800"
                    iconColor="text-cyan-200"
                    glowColor="bg-cyan-400"
                    onClick={() => navigateTo('roles')}
                />

                {/* 6. REWARDS */}
                <HubButton 
                    label="Rewards"
                    icon={<TrophyIcon />}
                    gradientFrom="from-yellow-600" 
                    gradientTo="to-amber-800"
                    iconColor="text-yellow-200"
                    glowColor="bg-yellow-400"
                    onClick={() => navigateTo('rewards')}
                />
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

        // Drilled-Down Views (subView)
        if (subView) {
            switch(subView) {
                // --- Account ---
                case 'account.setup': return <div className="pt-16 px-2"><JourneyView dashboardPrefs={dashboardPrefs} onOpenWizard={() => {}} /></div>;
                case 'account.widgets': return <div className="pt-16 px-2"><WidgetConfig currentPrefs={dashboardPrefs} onSave={bodyProps.onUpdatePrefs} /></div>;
                case 'account.sync': return <div className="pt-16 px-2"><DeviceSync onSyncComplete={bodyProps.onSyncHealth} lastSynced={healthStats.lastSynced} /></div>;
                case 'account.pharmacy': return <div className="pt-16 px-2"><PharmacyOrders /></div>;

                // --- Physical ---
                case 'physical.scan': return <div className="pt-16 px-2"><BodyHub {...bodyProps} /></div>;
                case 'physical.workout_log': return <div className="pt-16 px-2"><PlaceholderPage title="Workout Log" description="Track sets and reps." /></div>;
                case 'physical.plans': return <div className="pt-16 px-2"><PlaceholderPage title="Exercise Plans" description="AI generated workouts." /></div>;
                case 'physical.form_check': 
                    return (
                        <div className="pt-16 px-4 h-[80vh] flex flex-col items-center justify-center text-center">
                            <h2 className="text-2xl font-black mb-4">AI Form Coach</h2>
                            <button onClick={() => setShowFormAnalysis(true)} className="bg-emerald-500 text-white px-8 py-4 rounded-2xl font-bold shadow-lg">Open Camera</button>
                            {showFormAnalysis && <FormAnalysis onClose={() => setShowFormAnalysis(false)} />}
                        </div>
                    );
                case 'physical.run': return <div className="pt-16 px-2"><PlaceholderPage title="Running App" description="GPS tracking." /></div>;

                // --- Nutrition ---
                case 'nutrition.planner': return <div className="pt-16 px-2"><FuelSection {...fuelProps} defaultTab="plan" /></div>;
                case 'nutrition.pantry': return <div className="pt-16 px-2"><FuelSection {...fuelProps} defaultTab="grocery" /></div>;
                case 'nutrition.pantry_chef': return <div className="pt-16 px-2"><PantryChefView savedMeals={fuelProps.savedMeals} onSaveMeal={fuelProps.onAddMealToLibrary} /></div>;
                case 'nutrition.dining': return <div className="pt-16 px-2"><MasterChefView savedMeals={fuelProps.savedMeals} onSaveMeal={fuelProps.onAddMealToLibrary} /></div>;
                case 'nutrition.library': return <div className="pt-16 px-2"><FuelSection {...fuelProps} defaultTab="library" /></div>;
                case 'nutrition.videos': return <div className="pt-16 px-2"><PlaceholderPage title="Meal Prep Videos" /></div>;

                // --- Mental ---
                case 'mental.sleep': return <div className="pt-16 px-2"><ReadinessView /></div>;
                case 'mental.readiness': return <div className="pt-16 px-2"><ReadinessView /></div>;
                case 'mental.assessments': return <div className="pt-16 px-2"><AssessmentHub /></div>;
                case 'mental.labs': return <div className="pt-16 px-2"><HealthReportsView /></div>;
                case 'mental.store': return <div className="pt-16 px-2"><PlaceholderPage title="Lab Store" /></div>;

                // --- Roles ---
                case 'roles.coach': return <div className="pt-16 px-2"><CoachingHub userRole={userRole} onUpgrade={fuelProps.onGenerateMedical} /></div>;
                case 'roles.influencer': return <div className="pt-16 px-2"><PlaceholderPage title="Influencer Portal" /></div>;
                case 'roles.employer': return <div className="pt-16 px-2"><PlaceholderPage title="Employer Portal" /></div>;
                case 'roles.union': return <div className="pt-16 px-2"><PlaceholderPage title="Union Portal" /></div>;
                case 'roles.payor': return <div className="pt-16 px-2"><PlaceholderPage title="Payor Portal" /></div>;
                case 'roles.government': return <div className="pt-16 px-2"><PlaceholderPage title="Government Portal" /></div>;
                case 'roles.health_systems': return <div className="pt-16 px-2"><PlaceholderPage title="Health Systems" /></div>;

                // --- Rewards ---
                case 'rewards': return <div className="pt-16 px-2"><RewardsDashboard /></div>;
                case 'history': return <div className="pt-16 px-2"><FuelSection {...fuelProps} defaultTab="history" /></div>;

                default: return <div className="pt-20 text-center">View Not Found</div>;
            }
        }

        // Stack Menus (The "Drill Down" Lists)
        switch(stack) {
            case 'account': return renderSubLevelMenu('My Account', [
                { id: 'account.setup', label: 'Personalize', desc: 'Goals & settings' },
                { id: 'account.widgets', label: 'My Widgets', desc: 'Dashboard config' },
                { id: 'account.sync', label: 'Device Sync', desc: 'Apple Health & Fitbit' },
                { id: 'account.pharmacy', label: 'Order Meds', desc: 'Pharmacy store' }
            ]);
            case 'physical': return renderSubLevelMenu('Physical', [
                { id: 'physical.scan', label: '3D Body Scan', desc: 'Biometric avatar' },
                { id: 'physical.workout_log', label: 'Workout Log', desc: 'Track training' },
                { id: 'physical.plans', label: 'Exercise Plans', desc: 'AI routines' },
                { id: 'physical.form_check', label: 'Form Checker', desc: 'Real-time correction' },
                { id: 'physical.run', label: 'Running App', desc: 'GPS tracker' }
            ]);
            case 'nutrition': return renderSubLevelMenu('Nutrition', [
                { id: 'nutrition.planner', label: 'Meal Plans', desc: 'Weekly schedule' },
                { id: 'nutrition.pantry', label: 'Grocery List', desc: 'Shopping management' },
                { id: 'nutrition.pantry_chef', label: 'Pantry Chef', desc: 'Fridge photo to recipe' },
                { id: 'nutrition.dining', label: 'Dining Out', desc: 'MasterChef Replicator' },
                { id: 'nutrition.library', label: 'Saved Recipes', desc: 'Cookbook' },
                { id: 'nutrition.videos', label: 'Meal Prep Vids', desc: 'Community guides' }
            ]);
            case 'mental': return renderSubLevelMenu('Mental & Labs', [
                { id: 'mental.sleep', label: 'Sleep Log', desc: 'Rest tracking' },
                { id: 'mental.readiness', label: 'Readiness Score', desc: 'Daily capacity' },
                { id: 'mental.assessments', label: 'Psych Quizzes', desc: 'Cognitive check-ins' },
                { id: 'mental.labs', label: 'Labs', desc: 'Bloodwork results' },
                { id: 'mental.store', label: 'Buy Test Kits', desc: 'Home biomarkers' }
            ]);
            case 'roles': return renderSubLevelMenu('Roles & Portals', [
                { id: 'roles.coach', label: 'For Coaches', desc: 'Professional suite' },
                { id: 'roles.influencer', label: 'For Influencers', desc: 'Brand tools' },
                { id: 'roles.employer', label: 'For Employers', desc: 'Corporate wellness' },
                { id: 'roles.union', label: 'For Unions', desc: 'Member benefits' },
                { id: 'roles.government', label: 'For Government', desc: 'Public health initiatives' },
                { id: 'roles.payor', label: 'Payers / Insurers', desc: 'Insurance claims' },
                { id: 'roles.health_systems', label: 'For Health Systems', desc: 'Clinical integration' }
            ]);
            case 'rewards': return renderSubLevelMenu('Rewards', [
                { id: 'rewards', label: 'My Rewards', desc: 'Health wallet' },
                { id: 'history', label: 'History', desc: 'Timeline log' }
            ]);
            default: return null;
        }
    };

    return (
        <div className="bg-slate-50 min-h-screen font-sans">
            <VitalsStrip 
                stats={healthStats} 
                prefs={dashboardPrefs} 
                onSyncClick={() => navigateTo('account', 'account.sync')} 
            />
            
            {/* Main Content Render */}
            <main>
                {renderContent()}
            </main>

            {/* Back Button Overlay (if not home) */}
            {stack !== 'home' && (
                <button 
                    onClick={goBack}
                    className="fixed bottom-6 left-6 w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center text-slate-800 border border-slate-100 z-50 active:scale-90 transition-transform"
                >
                    <XIcon className="w-6 h-6" />
                </button>
            )}

            {/* Persistent Camera FAB */}
            <button 
                onClick={onCameraClick}
                className="fixed bottom-6 right-6 w-16 h-16 bg-emerald-500 rounded-full shadow-2xl shadow-emerald-500/40 flex items-center justify-center text-white z-50 active:scale-90 transition-transform border-4 border-white"
            >
                <CameraIcon className="w-8 h-8" />
            </button>
        </div>
    );
};
