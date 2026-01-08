
import React, { useState } from 'react';
import { 
    ActivityIcon, CameraIcon, DumbbellIcon, BrainIcon, 
    UserCircleIcon, XIcon, TrophyIcon, UtensilsIcon, BriefcaseIcon,
    MoonIcon, DropIcon, WavesIcon, FireIcon, HomeIcon, BookOpenIcon
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
    fuelProps: any;
    bodyProps: any;
    userRole: 'coach' | 'user';
    onLogout: () => void;
    user?: any;
}

type StackLevel = 'home' | 'account' | 'physical' | 'nutrition' | 'mental' | 'roles' | 'rewards';

const VitalsStrip: React.FC<{ stats: HealthStats; prefs: UserDashboardPrefs; onSyncClick: () => void }> = ({ stats, prefs, onSyncClick }) => {
    
    const allWidgets: Record<string, { label: string, value: string | number, unit: string, color: string }> = {
        steps: { label: 'Steps', value: stats.steps.toLocaleString(), unit: '', color: 'text-blue-500' },
        activeCalories: { label: 'Active', value: Math.round(stats.activeCalories), unit: 'kcal', color: 'text-emerald-500' },
        restingCalories: { label: 'Resting', value: Math.round(stats.restingCalories), unit: 'kcal', color: 'text-indigo-500' },
        distanceMiles: { label: 'Dist', value: stats.distanceMiles.toFixed(1), unit: 'mi', color: 'text-amber-500' },
        flightsClimbed: { label: 'Flights', value: stats.flightsClimbed, unit: 'flr', color: 'text-rose-500' },
        heartRate: { label: 'HR', value: stats.heartRate || '--', unit: 'bpm', color: 'text-red-500' },
        restingHeartRate: { label: 'RHR', value: stats.restingHeartRate || '--', unit: 'bpm', color: 'text-rose-600' },
        sleepScore: { label: 'Sleep', value: stats.sleepScore || '--', unit: 'pts', color: 'text-indigo-600' },
        spo2: { label: 'O2', value: stats.spo2 ? `${stats.spo2}%` : '--', unit: '', color: 'text-cyan-500' },
        activeZoneMinutes: { label: 'Zones', value: stats.activeZoneMinutes || '--', unit: 'min', color: 'text-orange-500' },
        vo2Max: { label: 'Fit', value: stats.vo2Max || '--', unit: 'vo2', color: 'text-teal-500' },
        waterFlOz: { label: 'Water', value: stats.waterFlOz || '--', unit: 'oz', color: 'text-blue-600' },
        mindfulnessMinutes: { label: 'Mind', value: stats.mindfulnessMinutes || '--', unit: 'min', color: 'text-violet-500' },
        // Apple Health iHealth Fields
        bloodPressure: { label: 'BP', value: stats.bloodPressureSystolic && stats.bloodPressureDiastolic ? `${stats.bloodPressureSystolic}/${stats.bloodPressureDiastolic}` : '--', unit: '', color: 'text-rose-600' },
        bodyFat: { label: 'Fat %', value: stats.bodyFatPercentage ? `${stats.bodyFatPercentage}%` : '--', unit: '', color: 'text-indigo-600' },
        bmi: { label: 'BMI', value: stats.bmi ? stats.bmi.toFixed(1) : '--', unit: '', color: 'text-violet-600' },
        weight: { label: 'Lbs', value: stats.weightLbs ? stats.weightLbs.toFixed(1) : '--', unit: '', color: 'text-slate-600' }
    };

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
        <div className={`absolute inset-0 bg-gradient-to-b ${gradientFrom} ${gradientTo}`}></div>
        <div className={`w-16 h-16 rounded-full border-2 ${iconColor} flex items-center justify-center mb-3 relative z-10 shadow-[0_0_15px_rgba(0,0,0,0.5)] bg-white/5 backdrop-blur-sm`}>
            <div className={`absolute inset-0 rounded-full ${glowColor} opacity-20 blur-md`}></div>
            <span className={`${iconColor} drop-shadow-md`}>
                {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-8 h-8" })}
            </span>
        </div>
        <span className={`text-sm font-black tracking-wider uppercase text-white z-10`}>{label}</span>
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"></div>
    </button>
);

export const MobileApp: React.FC<MobileAppProps> = ({ 
    healthStats, dashboardPrefs, onCameraClick, fuelProps, bodyProps, userRole, onLogout, user
}) => {
    const [stack, setStack] = useState<StackLevel>('home');
    const [subView, setSubView] = useState<string | null>(null);

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
             <div className="flex justify-between items-end px-2">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Intelligence</h1>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1.5">Metabolic Control Center</p>
                </div>
                <button onClick={() => navigateTo('rewards')} className="bg-indigo-50 border border-indigo-100 rounded-2xl p-2 px-3 flex flex-col items-center">
                    <span className="text-[8px] font-black uppercase text-indigo-400">Wallet</span>
                    <span className="text-xs font-black text-indigo-700">EH-Pts</span>
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <HubButton label="Fuel" icon={<UtensilsIcon />} onClick={() => navigateTo('nutrition')} gradientFrom="from-emerald-500" gradientTo="to-emerald-700" iconColor="text-white border-white/40" glowColor="bg-emerald-400" />
                <HubButton label="Body" icon={<UserCircleIcon />} onClick={() => navigateTo('physical')} gradientFrom="from-indigo-600" gradientTo="to-indigo-800" iconColor="text-white border-white/40" glowColor="bg-indigo-400" />
                <HubButton label="Brain" icon={<BrainIcon />} onClick={() => navigateTo('mental')} gradientFrom="from-amber-400" gradientTo="to-amber-600" iconColor="text-white border-white/40" glowColor="bg-amber-300" />
                <HubButton label="Social" icon={<BriefcaseIcon />} onClick={() => navigateTo('roles')} gradientFrom="from-rose-500" gradientTo="to-rose-700" iconColor="text-white border-white/40" glowColor="bg-rose-400" />
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center justify-between group active:scale-95 transition-all" onClick={() => navigateTo('account')}>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
                        <ActivityIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="font-black uppercase text-sm text-slate-800">Account Control</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Setup & Device Sync</p>
                    </div>
                </div>
                <div className="text-slate-300">→</div>
            </div>
        </div>
    );

    const renderStack = () => {
        if (stack === 'home') return renderHome();

        return (
            <div className="min-h-screen bg-slate-50 flex flex-col animate-fade-in">
                <div className="bg-white/80 backdrop-blur-md border-b border-slate-100 p-4 sticky top-0 z-50 flex items-center justify-between">
                    <button onClick={goBack} className="text-slate-400 font-black uppercase text-xs tracking-widest flex items-center gap-1 hover:text-slate-900 transition-colors">
                        ← {subView ? stack : 'Dashboard'}
                    </button>
                    <h2 className="font-black uppercase tracking-tighter text-sm">{subView || stack} Hub</h2>
                    <button onClick={() => setStack('home')} className="p-2 bg-slate-100 rounded-full text-slate-500"><XIcon className="w-4 h-4" /></button>
                </div>

                <div className="flex-grow p-4 pb-24">
                    {stack === 'nutrition' && <FuelSection {...fuelProps} />}
                    {stack === 'physical' && <BodyHub {...bodyProps} />}
                    {stack === 'mental' && <AssessmentHub />}
                    {stack === 'roles' && <CoachingHub userRole={userRole} onUpgrade={() => {}} />}
                    {stack === 'rewards' && <RewardsDashboard />}
                    {stack === 'account' && (
                        <div className="space-y-4">
                            <button onClick={() => setSubView('sync')} className="w-full bg-white p-6 rounded-3xl border border-slate-200 text-left font-black uppercase text-sm text-slate-800 flex justify-between shadow-sm">Device Sync <span>→</span></button>
                            <button onClick={() => setSubView('widgets')} className="w-full bg-white p-6 rounded-3xl border border-slate-200 text-left font-black uppercase text-sm text-slate-800 flex justify-between shadow-sm">My Widgets <span>→</span></button>
                            <button onClick={() => setSubView('pharmacy')} className="w-full bg-white p-6 rounded-3xl border border-slate-200 text-left font-black uppercase text-sm text-slate-800 flex justify-between shadow-sm">Pharmacy History <span>→</span></button>
                            <button onClick={onLogout} className="w-full bg-rose-50 p-6 rounded-3xl border border-rose-100 text-left font-black uppercase text-sm text-rose-600 flex justify-between mt-10">Sign Out <span>⏻</span></button>
                        </div>
                    )}

                    {subView === 'sync' && <div className="fixed inset-0 z-[60] bg-slate-50 overflow-y-auto"><div className="p-4 flex items-center justify-between bg-white border-b border-slate-100 sticky top-0"><button onClick={() => setSubView(null)} className="text-xs font-black uppercase">← Back</button><h2 className="font-black uppercase">Sync</h2><div className="w-10"></div></div><DeviceSync onSyncComplete={bodyProps.onSyncHealth} /></div>}
                    {subView === 'widgets' && <div className="fixed inset-0 z-[60] bg-slate-50 overflow-y-auto"><div className="p-4 flex items-center justify-between bg-white border-b border-slate-100 sticky top-0"><button onClick={() => setSubView(null)} className="text-xs font-black uppercase">← Back</button><h2 className="font-black uppercase">Widgets</h2><div className="w-10"></div></div><WidgetConfig currentPrefs={dashboardPrefs} onSave={bodyProps.onUpdatePrefs} /></div>}
                    {subView === 'pharmacy' && <div className="fixed inset-0 z-[60] bg-slate-50 overflow-y-auto"><div className="p-4 flex items-center justify-between bg-white border-b border-slate-100 sticky top-0"><button onClick={() => setSubView(null)} className="text-xs font-black uppercase">← Back</button><h2 className="font-black uppercase">Pharmacy</h2><div className="w-10"></div></div><PharmacyOrders /></div>}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-indigo-100">
            <VitalsStrip stats={healthStats} prefs={dashboardPrefs} onSyncClick={() => navigateTo('account', 'sync')} />
            <main className="flex-grow overflow-y-auto no-scrollbar">
                {renderStack()}
            </main>
            
            <div className="fixed bottom-0 left-0 right-0 h-20 bg-white/90 backdrop-blur-xl border-t border-slate-100 z-40 flex items-center justify-around px-6 pb-safe shadow-[0_-4px_24px_rgba(0,0,0,0.04)]">
                 <button onClick={() => setStack('home')} className={`p-3 rounded-2xl transition-all ${stack === 'home' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-400 hover:bg-slate-50'}`}><HomeIcon /></button>
                 <button onClick={onCameraClick} className="w-16 h-16 bg-emerald-500 text-white rounded-[1.8rem] shadow-xl shadow-emerald-200 flex items-center justify-center transform active:scale-90 transition-all border-4 border-white -mt-10"><CameraIcon className="w-8 h-8" /></button>
                 <button onClick={() => navigateTo('nutrition', 'library')} className={`p-3 rounded-2xl transition-all ${stack === 'nutrition' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-400 hover:bg-slate-50'}`}><BookOpenIcon /></button>
            </div>
        </div>
    );
};
