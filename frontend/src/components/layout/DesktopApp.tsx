
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
import { Hub } from '../Hub';
import { PlaceholderPage } from '../PlaceholderPage';
import { FormAnalysis } from '../body/FormAnalysis';
import { PantryChefView } from '../nutrition/PantryChefView';
import { DeviceSync } from '../account/DeviceSync';

interface DesktopAppProps {
    healthStats: HealthStats;
    dashboardPrefs: UserDashboardPrefs;
    fuelProps: any;
    bodyProps: any;
    userRole: 'coach' | 'user';
    onLogout: () => void;
    user?: any;
    onCameraClick?: (mode: 'meal' | 'barcode' | 'pantry' | 'restaurant' | 'search') => void;
}

export const DesktopApp: React.FC<DesktopAppProps> = ({ 
    healthStats, dashboardPrefs, fuelProps, bodyProps, userRole, onLogout, user, onCameraClick
}) => {
    const [activeView, setActiveView] = useState<ActiveView>('home');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [rewardsBalance, setRewardsBalance] = useState(0);
    const [showFormAnalysis, setShowFormAnalysis] = useState(false);

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

    const handleUpdateJourney = (j: HealthJourney) => {
        if (bodyProps.onUpdatePrefs) {
            bodyProps.onUpdatePrefs({ ...dashboardPrefs, selectedJourney: j });
        }
    };

    const renderContent = () => {
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
                        onConnectHealth={() => {}}
                        onScanClick={() => {}}
                        onCameraClick={onCameraClick || (() => {})}
                        dashboardPrefs={dashboardPrefs}
                    />
                );
            
            // --- 1. MY ACCOUNT ---
            case 'account.setup': 
                return <JourneyView dashboardPrefs={dashboardPrefs} onOpenWizard={() => {}} />;
            case 'account.widgets': 
                return <PlaceholderPage title="My Widgets" description="Customize your Command Center dashboard." />;
            case 'account.sync': 
                return <DeviceSync onSyncComplete={bodyProps.onSyncHealth} />; // Dedicated Sync View
            case 'account.pharmacy': 
                return <PlaceholderPage title="Pharmacy Store" description="Order prescriptions and view history." />;

            // --- 2. PHYSICAL ---
            case 'physical.scan': 
                return <BodyHub {...bodyProps} />;
            case 'physical.workout_log': 
                return <PlaceholderPage title="Workout Log" description="Track your sets, reps, and PRs." />;
            case 'physical.plans': 
                return <PlaceholderPage title="Exercise Plans" description="AI-generated workout routines." />;
            case 'physical.form_check':
                // Special handling to open the overlay directly
                return (
                    <div className="flex flex-col items-center justify-center h-full">
                        <button onClick={() => setShowFormAnalysis(true)} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold">
                            Launch AI Form Analysis
                        </button>
                        {showFormAnalysis && <FormAnalysis onClose={() => setShowFormAnalysis(false)} />}
                    </div>
                );
            case 'physical.run': 
                return <PlaceholderPage title="Running App" description="GPS tracking and pace coaching." />;

            // --- 3. NUTRITION ---
            case 'nutrition.planner': 
                return <FuelSection {...fuelProps} defaultTab="plan" />;
            case 'nutrition.pantry': 
                return <FuelSection {...fuelProps} defaultTab="grocery" />; 
            case 'nutrition.pantry_chef':
                return <PantryChefView savedMeals={fuelProps.savedMeals} onSaveMeal={fuelProps.onAddMealToLibrary} />;
            case 'nutrition.dining': 
                return (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                        <h2 className="text-3xl font-black mb-4">MasterChef Replicator</h2>
                        <p className="mb-8 text-slate-500">Snap a photo of your restaurant meal to reverse-engineer the recipe.</p>
                        <button 
                            onClick={() => onCameraClick && onCameraClick('restaurant')} 
                            className="bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-emerald-600 transition-all"
                        >
                            Open Camera
                        </button>
                    </div>
                );
            case 'nutrition.library': 
                return <FuelSection {...fuelProps} defaultTab="library" />;
            case 'nutrition.videos': 
                return <PlaceholderPage title="Meal Prep Videos" description="Community generated cooking guides." />;

            // --- 4. MENTAL & LABS ---
            case 'mental.sleep': 
                return <ReadinessView />; // Contains sleep logging
            case 'mental.readiness': 
                return <ReadinessView />;
            case 'mental.assessments': 
                return <AssessmentHub />;
            case 'mental.labs': 
                return <HealthReportsView />;
            case 'mental.store': 
                return <PlaceholderPage title="Lab Store" description="Order biomarker test kits." />;

            // --- 5. ROLES & PORTALS ---
            case 'roles.coach': 
                return <CoachingHub userRole={userRole} onUpgrade={() => {}} />;
            case 'roles.influencer': 
                return <PlaceholderPage title="Influencer Portal" description="Manage campaigns and followers." />;
            case 'roles.employer': 
                return <PlaceholderPage title="Employer Portal" description="Corporate wellness dashboard." />;
            case 'roles.union': 
                return <PlaceholderPage title="Union Portal" description="Member benefits management." />;
            case 'roles.payor': 
                return <PlaceholderPage title="Payor Portal" description="Insurance integration." />;
            case 'roles.government':
                return <PlaceholderPage title="Government Portal" description="Public sector health management." />;
            case 'roles.health_systems':
                return <PlaceholderPage title="Health Systems" description="Hospital and clinic integration." />;

            // --- 6. REWARDS & HISTORY ---
            case 'rewards': 
                return <RewardsDashboard />;
            case 'history': 
                return <FuelSection {...fuelProps} defaultTab="history" />;

            // --- MISC ---
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
