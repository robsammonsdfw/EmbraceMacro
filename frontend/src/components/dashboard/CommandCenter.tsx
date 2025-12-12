
import React from 'react';
import { TodayStrip } from './TodayStrip';
import { DigitalTwinPanel } from './DigitalTwinPanel';
import { OrdersCard } from './OrdersCard';
import { LabsCard } from './LabsCard';

interface CommandCenterProps {
    dailyCalories: number;
    dailyProtein: number;
    rewardsBalance: number;
    userName: string;
    onScanClick: () => void;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({ 
    dailyCalories, dailyProtein, rewardsBalance, userName, onScanClick 
}) => {
    return (
        <div className="space-y-6 animate-fade-in">
            <header className="mb-8">
                <h2 className="text-2xl font-extrabold text-slate-800">Command Center</h2>
                <p className="text-slate-500">Welcome back, {userName}.</p>
            </header>

            <TodayStrip 
                calories={Math.round(dailyCalories)}
                calorieGoal={2000}
                activityScore={75} // Placeholder
                rewardsBalance={rewardsBalance}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <DigitalTwinPanel 
                        calories={dailyCalories}
                        calorieGoal={2000}
                        protein={dailyProtein}
                        proteinGoal={150}
                        activityScore={75}
                        onScanClick={onScanClick}
                    />
                </div>
                
                {/* On larger screens, this content is duplicated in RightRail via AppLayout. 
                    On smaller screens (lg but not xl), we show it here. 
                    The AppLayout handles XL screens specifically. */}
                <div className="space-y-6 xl:hidden">
                    <OrdersCard />
                    <LabsCard />
                </div>
            </div>
        </div>
    );
};
