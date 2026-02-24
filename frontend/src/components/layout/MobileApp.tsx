
import React, { useState } from 'react';
import { 
    ActivityIcon, CameraIcon, BrainIcon, 
    UserCircleIcon, XIcon, UtensilsIcon, BriefcaseIcon,
    HomeIcon, BookOpenIcon, PillIcon, UploadIcon, HeartIcon,
    GlobeAltIcon, BeakerIcon, ClockIcon, MoonIcon, ShoppingCartIcon,
    ClipboardCheckIcon, UsersIcon, TrophyIcon, BadgeCheckIcon,
    DumbbellIcon, UserGroupIcon, NewspaperIcon
} from '../icons';
import type { HealthStats, UserDashboardPrefs, Article } from '../../types';

// Import Views
import { FuelSection } from '../sections/FuelSection';
import { BodyHub } from '../body/BodyHub';
import { AssessmentHub } from '../tests/AssessmentHub';
import { CoachingHub } from '../coaching/CoachingHub';
import { CreatorDashboard } from '../creator/CreatorDashboard';
import { RewardsDashboard } from '../RewardsDashboard';
import { SocialManager } from '../social/SocialManager';
import { DeviceSync } from '../account/DeviceSync';
import { WidgetConfig } from '../account/WidgetConfig';
import { PharmacyOrders } from '../account/PharmacyOrders';
import { TeleMedicineHub } from '../telemed/TeleMedicineHub';
import { ReadinessView } from '../sections/ReadinessView';
import { HealthReportsView } from '../sections/HealthReportsView';
import { PlaceholderPage } from '../PlaceholderPage';
import { MealPrepVideos } from '../nutrition/MealPrepVideos';
import { PulseFeed } from '../content/PulseFeed';
import { ArticleViewer } from '../content/ArticleViewer';

// Feature Flag: Set to false to show "For Her" category
const HIDE_FOR_HER = true;

interface MobileAppProps {
    healthStats: HealthStats;
    dashboardPrefs: UserDashboardPrefs;
    onCameraClick: () => void;
    fuelProps: any;
    bodyProps: any;
    userRole: 'coach' | 'user';
    onLogout: () => void;
    user?: any;
    onProxySelect?: (client: { id: string; name: string }) => void;
    onVisionSync?: () => void;
}

type StackLevel = 'home' | 'account' | 'physical' | 'nutrition' | 'mental' | 'sleep' | 'labs' | 'roles' | 'rewards' | 'telemed' | 'social' | 'pulse';

const VitalsStrip: React.FC<{ stats: HealthStats; prefs: UserDashboardPrefs; onVisionSync?: () => void }> = ({ stats, prefs, onVisionSync }) => {
    
    const allWidgets: Record<string, { label: string, value: string | number, unit: string, color: string }> = {
        steps: { label: 'Steps', value: (stats.steps ?? 0).toLocaleString(), unit: '', color: 'text-blue-500' },
        activeCalories: { label: 'Active', value: Math.round(stats.activeCalories ?? 0), unit: 'kcal', color: 'text-emerald-500' },
        restingCalories: { label: 'Resting', value: Math.round(stats.restingCalories ?? 0), unit: 'kcal', color: 'text-indigo-500' },
        distanceMiles: { label: 'Dist', value: (stats.distanceMiles ?? 0).toFixed(1), unit: 'mi', color: 'text-amber-500' },
        flightsClimbed: { label: 'Flights', value: stats.flightsClimbed ?? 0, unit: 'flr', color: 'text-rose-500' },
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
            {/* Branding Logo */}
            <div className="flex-shrink-0 pr-4 border-r border-slate-100 mr-1">
                <img src="/logo.png" alt="EmbraceHealth" className="h-8 w-auto object-contain" />
            </div>

            {widgetsToShow.map(item => (
                <div key={item.id} className="flex flex-col items-center min-w-[70px] flex-shrink-0 animate-fade-in">
                    <span className={`text-xl font-black ${item.color}`}>{item.value}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{item.label}</span>
                </div>
            ))}
            <button 
                onClick={onVisionSync}
                className="flex flex-col items-center min-w-[80px] justify-center text-slate-500 hover:text-emerald-500 transition-colors ml-auto border-l border-slate-100 pl-4 flex-shrink-0"
            >
                <div className="bg-slate-900 text-white p-2 rounded-xl mb-1 shadow-md">
                    <UploadIcon className="w-4 h-4" />
                </div>
                <span className="text-[8px] font-black uppercase tracking-wide text-center leading-tight">Vision Sync<br/>Screenshot</span>
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
        <span className={`text-sm font-black tracking-wider uppercase text-white z-10 text-center px-1 leading-tight`}>{label}</span>
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"></div>
    </button>
);

const CategoryItem: React.FC<{ label: string; onClick: () => void; icon: React.ReactNode }> = ({ label, onClick, icon }) => (
    <button onClick={onClick} className="w-full bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-3 active:scale-95 transition-transform shadow-sm">
        <div className="p-2 bg-slate-100 text-slate-500 rounded-lg">{icon}</div>
        <span className="font-bold text-slate-700 text-xs uppercase tracking-wide">{label}</span>
    </button>
);

const CollapsibleSection: React.FC<{
    title: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}> = ({ title, isOpen, onToggle, children }) => (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
        <button 
            onClick={onToggle}
            className="w-full flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors"
        >
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">{title}</h3>
            <span className={`text-slate-400 transition-transform duration-200 text-xs ${isOpen ? 'rotate-180' : ''}`}>▼</span>
        </button>
        {isOpen && (
            <div className="p-2 space-y-2 border-t border-slate-100 bg-white animate-fade-in">
                {children}
            </div>
        )}
    </div>
);

export const MobileApp: React.FC<MobileAppProps> = ({ 
    healthStats, dashboardPrefs, onCameraClick, fuelProps, bodyProps, userRole, onLogout, onProxySelect, onVisionSync
}) => {
    const [stack, setStack] = useState<StackLevel>('home');
    const [subView, setSubView] = useState<string | null>(null);
    
    // Feature States
    const [medicalActionParams, setMedicalActionParams] = useState<{ conditions: string[], cuisine: string, duration: string } | undefined>(undefined);
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
    const [formAnalysisExercise, setFormAnalysisExercise] = useState<string | undefined>(undefined);

    // Telemed Category State
    const [telemedCategories, setTelemedCategories] = useState({
        him: false,
        her: false
    });

    // Roles Category State
    const [rolesCategories, setRolesCategories] = useState({
        independent: true,
        smb: false,
        enterprise: false,
        institutional: false
    });

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

    const toggleTelemedCategory = (cat: keyof typeof telemedCategories) => {
        setTelemedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
    };

    const toggleRolesCategory = (cat: keyof typeof rolesCategories) => {
        setRolesCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
    };

    const handleArticleAction = (type: string, payload: any) => {
        setSelectedArticle(null); // Close viewer
        
        switch (type) {
            case 'OPEN_FORM_CHECK':
                setFormAnalysisExercise(payload.exercise);
                setStack('physical');
                setSubView('form_check'); 
                break;
            case 'GENERATE_MEDICAL_PLAN':
                setMedicalActionParams({
                    conditions: payload.conditions || [],
                    cuisine: payload.cuisine || 'Mediterranean',
                    duration: payload.duration || 'day'
                });
                setStack('nutrition');
                setSubView('plan');
                break;
            default:
                console.warn("Unknown action type on mobile:", type);
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
                {/* 1. Prescriptions (Money Maker) */}
                <HubButton label="Prescriptions" icon={<PillIcon />} onClick={() => navigateTo('telemed')} gradientFrom="from-blue-600" gradientTo="to-blue-800" iconColor="text-white border-white/40" glowColor="bg-blue-400" />
                
                {/* 2. Body (Money Maker) */}
                <HubButton label="Body + Fitness" icon={<UserCircleIcon />} onClick={() => navigateTo('physical')} gradientFrom="from-indigo-600" gradientTo="to-indigo-800" iconColor="text-white border-white/40" glowColor="bg-indigo-400" />
                
                {/* 3. Nutrition */}
                <HubButton label="Nutrition + Meals" icon={<UtensilsIcon />} onClick={() => navigateTo('nutrition')} gradientFrom="from-emerald-500" gradientTo="to-emerald-700" iconColor="text-white border-white/40" glowColor="bg-emerald-400" />
                
                {/* 4. Pulse */}
                <HubButton label="Pulse" icon={<NewspaperIcon />} onClick={() => navigateTo('pulse')} gradientFrom="from-amber-500" gradientTo="to-orange-600" iconColor="text-white border-white/40" glowColor="bg-amber-400" />
                
                {/* 5. Sleep */}
                <HubButton label="Sleep" icon={<MoonIcon />} onClick={() => navigateTo('sleep')} gradientFrom="from-indigo-400" gradientTo="to-indigo-600" iconColor="text-white border-white/40" glowColor="bg-indigo-300" />
                
                {/* 6. Labs */}
                <HubButton label="Labs" icon={<BeakerIcon />} onClick={() => navigateTo('labs')} gradientFrom="from-cyan-500" gradientTo="to-cyan-700" iconColor="text-white border-white/40" glowColor="bg-cyan-400" />
                
                {/* 7. Mental */}
                <HubButton label="Mental + Motivation" icon={<BrainIcon />} onClick={() => navigateTo('mental')} gradientFrom="from-violet-500" gradientTo="to-violet-700" iconColor="text-white border-white/40" glowColor="bg-violet-400" />
                
                {/* 8. Social (Added) */}
                <HubButton label="Social & Friends" icon={<UserGroupIcon />} onClick={() => navigateTo('social')} gradientFrom="from-pink-500" gradientTo="to-rose-600" iconColor="text-white border-white/40" glowColor="bg-pink-400" />
                
                {/* 9. Rewards (Added) */}
                <HubButton label="Rewards" icon={<TrophyIcon />} onClick={() => navigateTo('rewards')} gradientFrom="from-yellow-500" gradientTo="to-amber-600" iconColor="text-white border-white/40" glowColor="bg-yellow-400" />

                {/* 10. Roles */}
                <HubButton label="Roles & Business" icon={<BriefcaseIcon />} onClick={() => navigateTo('roles')} gradientFrom="from-rose-500" gradientTo="to-rose-700" iconColor="text-white border-white/40" glowColor="bg-rose-400" />
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
                    <h2 className="font-black uppercase tracking-tighter text-sm">{subView ? subView.replace('telemed.', '').replace('.', ' ') : (stack === 'physical' ? 'Body + Fitness' : stack)}</h2>
                    <button onClick={() => setStack('home')} className="p-2 bg-slate-100 rounded-full text-slate-500"><XIcon className="w-4 h-4" /></button>
                </div>

                <div className="flex-grow p-4 pb-24">
                    {stack === 'pulse' && (
                        <>
                            {selectedArticle && (
                                <ArticleViewer 
                                    article={selectedArticle} 
                                    onClose={() => setSelectedArticle(null)}
                                    onAction={handleArticleAction}
                                />
                            )}
                            <PulseFeed onArticleSelect={setSelectedArticle} />
                        </>
                    )}
                    {stack === 'nutrition' && (
                        subView ? (
                            subView === 'videos' ? <MealPrepVideos /> : <FuelSection {...fuelProps} defaultTab={subView === 'plan' ? 'plan' : undefined} initialMedicalParams={medicalActionParams} />
                        ) : (
                            <FuelSection {...fuelProps} />
                        )
                    )}
                    {stack === 'physical' && (
                        <BodyHub 
                            {...bodyProps} 
                            initialTab={subView === 'pics' ? 'images' : subView === 'form_check' ? 'form_check' : '3d_scan'}
                            initialExercise={formAnalysisExercise}
                        />
                    )}
                    {stack === 'mental' && <AssessmentHub />}
                    {stack === 'rewards' && <RewardsDashboard onNavigate={navigateTo as any} />}
                    {stack === 'social' && <SocialManager />}
                    
                    {stack === 'roles' && (
                        subView ? (
                            subView === 'influencer' ? <CreatorDashboard /> : <CoachingHub userRole={userRole} onUpgrade={() => {}} onProxySelect={onProxySelect} />
                        ) : (
                            <div className="space-y-4">
                                {/* Independent Coach */}
                                <CollapsibleSection title="Independent Coach" isOpen={rolesCategories.independent} onToggle={() => toggleRolesCategory('independent')}>
                                    <CategoryItem label="Personal Trainer" icon={<UsersIcon className="w-5 h-5 text-indigo-500" />} onClick={() => setSubView('trainer')} />
                                    <CategoryItem label="Nutrition Coach" icon={<UtensilsIcon className="w-5 h-5 text-emerald-500" />} onClick={() => setSubView('nutrition')} />
                                    <CategoryItem label="Sports Coach" icon={<TrophyIcon className="w-5 h-5 text-amber-500" />} onClick={() => setSubView('sports')} />
                                    <CategoryItem label="Health & Wellness" icon={<HeartIcon className="w-5 h-5 text-rose-500" />} onClick={() => setSubView('wellness')} />
                                    <CategoryItem label="Influencer/Creator" icon={<BadgeCheckIcon className="w-5 h-5 text-blue-500" />} onClick={() => setSubView('influencer')} />
                                </CollapsibleSection>

                                {/* Small to Medium Business */}
                                <CollapsibleSection title="Small to Medium Business" isOpen={rolesCategories.smb} onToggle={() => toggleRolesCategory('smb')}>
                                    <CategoryItem label="Training Studios" icon={<DumbbellIcon className="w-5 h-5 text-purple-500" />} onClick={() => setSubView('studio')} />
                                    <CategoryItem label="Gym" icon={<ActivityIcon className="w-5 h-5 text-orange-500" />} onClick={() => setSubView('gym')} />
                                    <CategoryItem label="Health Center" icon={<BeakerIcon className="w-5 h-5 text-cyan-500" />} onClick={() => setSubView('clinic')} />
                                </CollapsibleSection>

                                {/* Large Business */}
                                <CollapsibleSection title="Large Business" isOpen={rolesCategories.enterprise} onToggle={() => toggleRolesCategory('enterprise')}>
                                    <CategoryItem label="Fitness Club" icon={<UserGroupIcon className="w-5 h-5 text-indigo-600" />} onClick={() => setSubView('club')} />
                                    <CategoryItem label="Recreation Center" icon={<ActivityIcon className="w-5 h-5 text-teal-600" />} onClick={() => setSubView('rec')} />
                                    <CategoryItem label="Corporate Wellness" icon={<BriefcaseIcon className="w-5 h-5 text-slate-600" />} onClick={() => setSubView('employer')} />
                                </CollapsibleSection>

                                {/* Institutional & Other */}
                                <CollapsibleSection title="Institutional & Other" isOpen={rolesCategories.institutional} onToggle={() => toggleRolesCategory('institutional')}>
                                    <CategoryItem label="Health Systems" icon={<HeartIcon className="w-5 h-5 text-red-600" />} onClick={() => setSubView('health_systems')} />
                                    <CategoryItem label="Payors & Insurers" icon={<ClipboardCheckIcon className="w-5 h-5 text-blue-600" />} onClick={() => setSubView('payor')} />
                                    <CategoryItem label="Government" icon={<GlobeAltIcon className="w-5 h-5 text-slate-500" />} onClick={() => setSubView('government')} />
                                    <CategoryItem label="Unions" icon={<UserGroupIcon className="w-5 h-5 text-amber-600" />} onClick={() => setSubView('union')} />
                                    <CategoryItem label="Logistics & Trucking" icon={<BriefcaseIcon className="w-5 h-5 text-stone-600" />} onClick={() => setSubView('logistics')} />
                                </CollapsibleSection>
                            </div>
                        )
                    )}
                    
                    {stack === 'sleep' && (
                        <div className="space-y-4">
                            {!subView && (
                                <>
                                    <CategoryItem label="Sleep Log" icon={<MoonIcon className="w-5 h-5 text-indigo-500" />} onClick={() => setSubView('log')} />
                                    <CategoryItem label="Order Home Test" icon={<ClipboardCheckIcon className="w-5 h-5 text-indigo-500" />} onClick={() => setSubView('order_test')} />
                                    <CategoryItem label="Oral Appliances" icon={<UserCircleIcon className="w-5 h-5 text-indigo-500" />} onClick={() => setSubView('appliances')} />
                                    <CategoryItem label="Test Results" icon={<ActivityIcon className="w-5 h-5 text-indigo-500" />} onClick={() => setSubView('results')} />
                                </>
                            )}
                            
                            {subView === 'log' && <ReadinessView />}
                            {subView === 'order_test' && <PlaceholderPage title="Home Sleep Test" description="Order a clinical-grade sleep test delivered to your door." icon={<ActivityIcon className="w-12 h-12" />} />}
                            {subView === 'appliances' && <PlaceholderPage title="Oral Appliances" description="Custom-fitted sleep apnea solutions." />}
                            {subView === 'results' && <HealthReportsView />}
                        </div>
                    )}

                    {stack === 'labs' && (
                        <div className="space-y-4">
                            {!subView && (
                                <>
                                    <CategoryItem label="View Lab Results" icon={<BeakerIcon className="w-5 h-5 text-cyan-500" />} onClick={() => setSubView('results')} />
                                    <CategoryItem label="Lab Test Kits" icon={<ShoppingCartIcon className="w-5 h-5 text-indigo-500" />} onClick={() => setSubView('lab_kits')} />
                                    <CategoryItem label="DNA Test Kits" icon={<GlobeAltIcon className="w-5 h-5 text-blue-500" />} onClick={() => setSubView('dna_kits')} />
                                </>
                            )}
                            
                            {subView === 'results' && <HealthReportsView />}
                            {subView === 'lab_kits' && <TeleMedicineHub view="labs.store" />}
                            {subView === 'dna_kits' && <TeleMedicineHub view="labs.store" />}
                        </div>
                    )}
                    
                    {stack === 'telemed' && (
                        subView && (subView.startsWith('everyone') || subView.startsWith('him') || subView.startsWith('her')) ? (
                            // Render specific category view
                            <TeleMedicineHub view={`telemed.${subView}` as any} />
                        ) : (
                            // Render Telemed Menu with Collapsible Sections
                            <div className="space-y-4">
                                <CategoryItem label="Weight Loss" icon={<ActivityIcon className="w-5 h-5 text-emerald-500" />} onClick={() => setSubView('everyone.weight_loss')} />

                                <CollapsibleSection 
                                    title="For Him" 
                                    isOpen={telemedCategories.him} 
                                    onToggle={() => toggleTelemedCategory('him')}
                                >
                                    <CategoryItem label="Hair Loss" icon={<UserCircleIcon className="w-5 h-5 text-amber-500" />} onClick={() => setSubView('him.hair_loss')} />
                                    <CategoryItem label="Erectile Dysfunction" icon={<ActivityIcon className="w-5 h-5 text-blue-500" />} onClick={() => setSubView('him.ed')} />
                                    <CategoryItem label="Low Testosterone" icon={<HeartIcon className="w-5 h-5 text-rose-500" />} onClick={() => setSubView('him.low_t')} />
                                    <CategoryItem label="Premature Ejaculation" icon={<ClockIcon className="w-5 h-5 text-indigo-500" />} onClick={() => setSubView('him.pe')} />
                                </CollapsibleSection>

                                {!HIDE_FOR_HER && (
                                    <CollapsibleSection 
                                        title="For Her" 
                                        isOpen={telemedCategories.her} 
                                        onToggle={() => toggleTelemedCategory('her')}
                                    >
                                        <CategoryItem label="Menopause Support" icon={<HeartIcon className="w-5 h-5 text-pink-500" />} onClick={() => setSubView('her.menopause')} />
                                        <CategoryItem label="Estrogen Therapy" icon={<PillIcon className="w-5 h-5 text-purple-500" />} onClick={() => setSubView('her.estrogen')} />
                                    </CollapsibleSection>
                                )}
                            </div>
                        )
                    )}

                    {stack === 'account' && (
                        <div className="space-y-4">
                            <button onClick={() => setSubView('sync')} className="w-full bg-white p-6 rounded-3xl border border-slate-200 text-left font-black uppercase text-sm text-slate-800 flex justify-between shadow-sm">Device Sync <span>→</span></button>
                            <button onClick={() => setSubView('widgets')} className="w-full bg-white p-6 rounded-3xl border border-slate-200 text-left font-black uppercase text-sm text-slate-800 flex justify-between shadow-sm">My Widgets <span>→</span></button>
                            <button onClick={() => setSubView('pharmacy')} className="w-full bg-white p-6 rounded-3xl border border-slate-200 text-left font-black uppercase text-sm text-slate-800 flex justify-between shadow-sm">Pharmacy History <span>→</span></button>
                            <button onClick={onLogout} className="w-full bg-rose-50 p-6 rounded-3xl border border-rose-100 text-left font-black uppercase text-sm text-rose-600 flex justify-between mt-10">Sign Out <span>⏻</span></button>
                        </div>
                    )}
{subView === 'sync' && stack === 'account' && (
                        <div className="fixed inset-0 z-[60] bg-slate-50 flex flex-col">
                            <div className="p-4 flex items-center justify-between bg-white border-b border-slate-100 sticky top-0 shrink-0">
                                <button onClick={() => setSubView(null)} className="text-xs font-black uppercase">← Back</button>
                                <h2 className="font-black uppercase">Sync</h2><div className="w-10"></div>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {/* FIX: Added lastSynced and mapped the correct sync trigger from bodyProps */}
                                <DeviceSync 
                                    onSyncComplete={(stats) => { bodyProps.onHealthStatsUpdate(stats); setSubView(null); }} 
                                    onVisionSyncTrigger={bodyProps.onSyncHealth || onVisionSync} 
                                    lastSynced={healthStats.lastSynced} 
                                />
                            </div>
                        </div>
                    )}
                    {subView === 'widgets' && stack === 'account' && (
                        <div className="fixed inset-0 z-[60] bg-slate-50 flex flex-col">
                            <div className="p-4 flex items-center justify-between bg-white border-b border-slate-100 sticky top-0 shrink-0">
                                <button onClick={() => setSubView(null)} className="text-xs font-black uppercase">← Back</button>
                                <h2 className="font-black uppercase">Widgets</h2><div className="w-10"></div>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {/* FIX: Added modal close on save so the UI updates immediately */}
                                <WidgetConfig 
                                    currentPrefs={dashboardPrefs} 
                                    onSave={(prefs) => { bodyProps.onUpdatePrefs(prefs); setSubView(null); }} 
                                />
                            </div>
                        </div>
                    )}
{subView === 'pharmacy' && stack === 'account' && (
                        <div className="fixed inset-0 z-[60] bg-slate-50 flex flex-col">
                            <div className="p-4 flex items-center justify-between bg-white border-b border-slate-100 sticky top-0 shrink-0">
                                <button onClick={() => setSubView(null)} className="text-xs font-black uppercase">← Back</button>
                                <h2 className="font-black uppercase">Pharmacy</h2><div className="w-10"></div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2">
                                {/* FIX: Isolated the component in a scrolling flex-container to prevent rendering cutoffs */}
                                <PharmacyOrders />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-indigo-100">
            <VitalsStrip stats={healthStats} prefs={dashboardPrefs} onVisionSync={onVisionSync} />
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
