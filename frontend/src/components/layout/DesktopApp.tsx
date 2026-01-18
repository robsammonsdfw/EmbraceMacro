
import React, { useState, useEffect, useMemo } from 'react';
import { AppLayout } from './AppLayout';
import { ActiveView, HealthStats, UserDashboardPrefs, HealthJourney } from '../../types';
import * as apiService from '../../services/apiService';

// Import Views
import { CommandCenter } from '../dashboard/CommandCenter';
import { FuelSection } from '../sections/FuelSection';
import { BodyHub } from '../body/BodyHub';
import { HealthReportsView } from '../sections/HealthReportsView';
import { ReadinessView } from '../sections/ReadinessView';
import { AssessmentHub } from '../tests/AssessmentHub';
import { CoachingHub } from '../coaching/CoachingHub';
import { JourneyView } from '../sections/JourneyView';
import { RewardsDashboard } from '../RewardsDashboard';
import { SocialManager } from '../social/SocialManager';
import { Hub } from '../Hub';
import { PlaceholderPage } from '../PlaceholderPage';
import { FormAnalysis } from '../body/FormAnalysis';
import { PantryChefView } from '../nutrition/PantryChefView';
import { MasterChefView } from '../nutrition/MasterChefView';
import { MealPrepVideos } from '../nutrition/MealPrepVideos';
import { DeviceSync } from '../account/DeviceSync';
import { WidgetConfig } from '../account/WidgetConfig';
import { PharmacyOrders } from '../account/PharmacyOrders';
import { TeleMedicineHub } from '../telemed/TeleMedicineHub'; 
import { PulseFeed } from '../content/PulseFeed';
import { ActivityIcon, CameraIcon } from '../icons';

interface DesktopAppProps {
    healthStats: HealthStats;
    dashboardPrefs: UserDashboardPrefs;
    fuelProps: any;
    bodyProps: any;
    userRole: 'coach' | 'user';
    onLogout: () => void;
    user?: any;
    onCameraClick?: (mode: 'meal' | 'barcode' | 'pantry' | 'restaurant' | 'search') => void;
    onProxySelect?: (client: { id: string; name: string }) => void;
}

export const DesktopApp: React.FC<DesktopAppProps> = ({ 
    healthStats, dashboardPrefs, fuelProps, bodyProps, userRole, onLogout, user, onCameraClick, onProxySelect
}) => {
    const [activeView, setActiveView] = useState<ActiveView>('home');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [rewardsBalance, setRewardsBalance] = useState(0);
    const [showFormAnalysis, setShowFormAnalysis] = useState(false);
    const [recentFormChecks, setRecentFormChecks] = useState<any[]>([]);

    // Calculate Daily Macros
    const today = new Date().toDateString();
    const dailyStats = useMemo(() => {
        return fuelProps.mealLog
            .filter((entry: any) => new Date(entry.createdAt).toDateString() === today)
            .reduce((acc: any, curr: any) => ({
                calories: acc.calories + curr.totalCalories,
                protein: acc.protein + curr.totalProtein
            }), { calories: 0, protein: 0 });
    }, [fuelProps.mealLog, today]);

    // Fetch rewards for dashboard
    useEffect(() => {
        const loadRewards = async () => {
            try {
                const data = await apiService.getRewardsSummary();
                setRewardsBalance(data.points_total);
            } catch (e) { console.error(e); }
        };
        loadRewards();
    }, [activeView]);

    // Fetch form checks when entering view
    useEffect(() => {
        if (activeView === 'physical.form_check') {
            const fetchChecks = async () => {
                try {
                    // Fetch generic exercises to show history
                    const squats = await apiService.getFormChecks('Squat');
                    const pushups = await apiService.getFormChecks('Pushup');
                    setRecentFormChecks([...squats, ...pushups].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6));
                } catch(e) { console.warn(e); }
            };
            fetchChecks();
        }
    }, [activeView, showFormAnalysis]); // Reload when modal closes

    const handleUpdateJourney = (j: HealthJourney) => {
        if (bodyProps.onUpdatePrefs) {
            bodyProps.onUpdatePrefs({ ...dashboardPrefs, selectedJourney: j });
        }
    };

    const renderContent = () => {
        // Handle Telemedicine Views via the Hub
        if (activeView.startsWith('telemed.')) {
            return <TeleMedicineHub view={activeView} />;
        }

        // Handle Role Views Dynamically
        if (activeView.startsWith('roles.')) {
            // Map individual practitioner roles to the Coaching Hub
            if (['roles.coach', 'roles.trainer', 'roles.nutrition', 'roles.sports', 'roles.wellness'].includes(activeView)) {
                return <CoachingHub userRole={userRole} onUpgrade={() => {}} onProxySelect={onProxySelect} />;
            }
            // Map business/institutional roles to placeholders for now
            const roleLabels: Record<string, string> = {
                'roles.influencer': 'Influencer/Creator Portal',
                'roles.studio': 'Studio Management',
                'roles.gym': 'Gym Management',
                'roles.clinic': 'Health Center Portal',
                'roles.club': 'Fitness Club Portal',
                'roles.rec': 'Recreation Center Portal',
                'roles.employer': 'Corporate Wellness',
                'roles.health_systems': 'Health Systems Integration',
                'roles.payor': 'Payor & Insurance Portal',
                'roles.government': 'Government Health Portal',
                'roles.union': 'Union Benefits Portal',
                'roles.logistics': 'Logistics & Trucking Health'
            };
            return <PlaceholderPage title={roleLabels[activeView] || 'Business Portal'} description="Enterprise dashboard for managing member health at scale." />;
        }

        switch(activeView) {
            case 'home':
                return (
                    <CommandCenter 
                        dailyCalories={dailyStats.calories}
                        dailyProtein={dailyStats.protein}
                        rewardsBalance={rewardsBalance}
                        userName={user?.firstName || 'User'}
                        healthStats={healthStats}
                        isHealthConnected={false}
                        isHealthSyncing={false}
                        onConnectHealth={() => setActiveView('account.sync')}
                        onScanClick={() => {}}
                        onCameraClick={onCameraClick || (() => {})}
                        dashboardPrefs={dashboardPrefs}
                    />
                );
            
            // Knowledge Hub
            case 'pulse':
                return <PulseFeed />;

            // Account Views
            case 'account.setup': 
                return <JourneyView dashboardPrefs={dashboardPrefs} onOpenWizard={() => {}} />;
            case 'account.widgets': 
                return <WidgetConfig currentPrefs={dashboardPrefs} onSave={bodyProps.onUpdatePrefs} />;
            case 'account.sync': 
                return <DeviceSync onSyncComplete={bodyProps.onSyncHealth} lastSynced={healthStats.lastSynced} />;
            case 'account.pharmacy': 
                return <PharmacyOrders />;

            // Body + Fitness Views
            case 'physical.scan': 
                return <BodyHub {...bodyProps} initialTab="3d_scan" />;
            case 'physical.pics': 
                return <BodyHub {...bodyProps} initialTab="images" />;
            case 'physical.workout_log': 
                return <PlaceholderPage title="Workout Log" description="Track sets and reps." />;
            case 'physical.plans': 
                return <PlaceholderPage title="Exercise Plans" description="AI-generated workout routines." />;
            case 'physical.form_check':
                return (
                    <div className="flex flex-col h-full animate-fade-in pb-20">
                        <div className="bg-slate-900 rounded-[2.5rem] p-10 text-center text-white shadow-2xl relative overflow-hidden shrink-0">
                            <div className="absolute top-0 right-0 p-12 opacity-10"><ActivityIcon className="w-32 h-32" /></div>
                            <div className="relative z-10">
                                <h2 className="text-3xl font-black mb-4">AI Form Coach</h2>
                                <p className="text-slate-400 mb-8 max-w-md mx-auto">Get real-time feedback on your squats, pushups, and deadlifts using computer vision.</p>
                                <button 
                                    onClick={() => setShowFormAnalysis(true)} 
                                    className="bg-emerald-500 hover:bg-emerald-400 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg transition-all active:scale-95"
                                >
                                    Launch Analysis
                                </button>
                            </div>
                        </div>

                        {showFormAnalysis && <FormAnalysis onClose={() => setShowFormAnalysis(false)} />}

                        <div className="mt-8 flex-grow">
                            <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                                <ActivityIcon className="w-4 h-4 text-indigo-500" /> Recent Sessions
                            </h3>
                            {recentFormChecks.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {recentFormChecks.map(check => (
                                        <div key={check.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                                            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-300">
                                                <CameraIcon />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm">{check.exercise}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-bold ${check.ai_score >= 80 ? 'text-emerald-500' : 'text-amber-500'}`}>{check.ai_score}% Score</span>
                                                    <span className="text-[10px] text-slate-400">{new Date(check.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-slate-400 text-sm">No recent form checks recorded.</div>
                            )}
                        </div>
                    </div>
                );
            case 'physical.run': 
                return <PlaceholderPage title="Running App" description="GPS tracking and pace coaching." />;

            // Nutrition + Meals Views
            case 'nutrition.planner': 
                return <FuelSection {...fuelProps} defaultTab="plan" />;
            case 'nutrition.pantry': 
                return <FuelSection {...fuelProps} defaultTab="grocery" />; 
            case 'nutrition.pantry_chef':
                return <PantryChefView savedMeals={fuelProps.savedMeals} onSaveMeal={fuelProps.onAddMealToLibrary} />;
            case 'nutrition.dining': 
                return <MasterChefView savedMeals={fuelProps.savedMeals} onSaveMeal={fuelProps.onAddMealToLibrary} />;
            case 'nutrition.library': 
                return <FuelSection {...fuelProps} defaultTab="library" />;
            case 'nutrition.videos': 
                return <MealPrepVideos />;

            // Mental + Motivation Views
            case 'mental.assessments': 
                return <AssessmentHub />;
            case 'mental.readiness': 
                return <ReadinessView />;

            // Sleep Views
            case 'sleep.log':
                return <ReadinessView />; // Reuse Readiness view for sleep logging for now
            case 'sleep.order_test':
                return (
                    <PlaceholderPage 
                        title="Home Sleep Test" 
                        description="Order a clinical-grade sleep test delivered to your door." 
                        icon={<ActivityIcon className="w-12 h-12" />} 
                    />
                );
            case 'sleep.appliances':
                return <PlaceholderPage title="Oral Appliances" description="Custom-fitted solutions for sleep apnea and snoring." />;
            case 'sleep.results':
                return <HealthReportsView />; // Reuse health reports for results

            // Labs Views
            case 'labs.results': 
                return <HealthReportsView />;
            case 'labs.store': 
                // Updated: Use live store instead of placeholder
                return <TeleMedicineHub view="labs.store" />;

            // Social
            case 'social':
                return <SocialManager />;

            // Rewards & History
            case 'rewards': 
                return <RewardsDashboard onNavigate={setActiveView} />;
            case 'history': 
                return <FuelSection {...fuelProps} defaultTab="history" />;

            // Hub
            case 'hub': 
                return <Hub onEnterMeals={() => setActiveView('nutrition.planner')} onLogout={onLogout} />;

            default: return <div className="p-10 text-center text-slate-400">View not found</div>;
        }
    };

    return (
        <AppLayout
            activeView={activeView}
            onNavigate={setActiveView}
            onLogout={onLogout}
            mobileMenuOpen={mobileMenuOpen}
            setMobileMenuOpen={setMobileMenuOpen}
            selectedJourney={dashboardPrefs.selectedJourney}
            onJourneyChange={handleUpdateJourney}
            showClientsTab={userRole === 'coach'}
        >
            {renderContent()}
        </AppLayout>
    );
};
