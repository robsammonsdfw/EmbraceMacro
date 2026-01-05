
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
import { SocialManager } from '../social/SocialManager';
import { JourneyView } from '../sections/JourneyView';
import { RewardsDashboard } from '../RewardsDashboard';
import { Hub } from '../Hub';

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
    }, [activeView]); // Refresh when view changes (e.g. after logging something)

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
            
            // Physical Hub
            case 'physical.fuel': return <FuelSection {...fuelProps} />;
            case 'physical.body': return <BodyHub {...bodyProps} />;
            case 'physical.reports': return <HealthReportsView />;

            // Mental Hub
            case 'mental.readiness': return <ReadinessView />;
            case 'mental.assessments': return <AssessmentHub />;
            case 'mental.care': return <CoachingHub userRole={userRole} onUpgrade={() => {}} />;

            // Social Hub
            case 'social.community': return <SocialManager />;
            case 'social.journey': return <JourneyView dashboardPrefs={dashboardPrefs} onOpenWizard={() => {}} />;
            case 'social.rewards': return <RewardsDashboard />;

            // Misc
            case 'hub': return <Hub onEnterMeals={() => setActiveView('physical.fuel')} onLogout={onLogout} />;
            case 'clients': return <CoachingHub userRole={userRole} onUpgrade={() => {}} />;

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
