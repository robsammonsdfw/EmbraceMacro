
import React from 'react';
import { RewardsBanner } from './RewardsBanner';
import { ActivityRow } from './ActivityRow';
import { SocialFeed } from './SocialFeed';
import { MiniBodyCard } from './MiniBodyCard';
import { CameraIcon, BarcodeIcon, ChefHatIcon, UtensilsIcon, UploadIcon } from '../icons';

// Note: DigitalTwinPanel and TodayStrip imports removed/unused in this specific refactor
// import { TodayStrip } from './TodayStrip'; 
// import { DigitalTwinPanel } from './DigitalTwinPanel';

interface CommandCenterProps {
    dailyCalories: number;
    dailyProtein: number;
    rewardsBalance: number;
    userName: string;
    onScanClick: () => void;
    onCameraClick: () => void;
    onBarcodeClick: () => void;
    onPantryChefClick: () => void;
    onRestaurantClick: () => void;
    onUploadClick: () => void;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({ 
    dailyCalories, dailyProtein, rewardsBalance, userName, onScanClick,
    onCameraClick, onBarcodeClick, onPantryChefClick, onRestaurantClick, onUploadClick
}) => {
    
    // Mocking Activity Score / Peloities based on available data or defaults
    const activityScore = 75; 
    // Mocking Steps based on cal burn ratio approximation for display (since not passed in props)
    const dailySteps = Math.floor(dailyCalories * 2.5) || 1200; 

    return (
        <div className="space-y-6 animate-fade-in pb-24">
            <header className="mb-2">
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Hi, {userName}</h2>
                <p className="text-slate-500 text-sm font-medium">Your daily health snapshot.</p>
            </header>

            {/* 2.1 Rewards Banner */}
            <RewardsBanner points={rewardsBalance} />

            {/* 2.2 Activity Row */}
            <ActivityRow 
                steps={dailySteps} 
                calories={dailyCalories} 
                peloities={activityScore} 
            />

            {/* 2.3 Social Feed */}
            <SocialFeed />

            {/* Bottom Grid: 2.4 Mini Body Card (Left) & Quick Actions (Right) */}
            <div className="grid grid-cols-2 gap-4">
                
                {/* Bottom Left: Body Twin */}
                <MiniBodyCard 
                    onClick={onScanClick} 
                    progress={activityScore} 
                />

                {/* Bottom Right: Condensed Quick Actions Grid to fit 2.4 constraint */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 grid grid-cols-2 gap-2">
                    <button onClick={onCameraClick} className="flex flex-col items-center justify-center bg-emerald-50 hover:bg-emerald-100 rounded-xl p-2 transition-colors">
                        <div className="text-emerald-600 scale-75"><CameraIcon /></div>
                        <span className="text-[10px] font-bold text-emerald-700">Meal</span>
                    </button>
                    <button onClick={onBarcodeClick} className="flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-100 rounded-xl p-2 transition-colors">
                        <div className="text-blue-600 scale-75"><BarcodeIcon /></div>
                        <span className="text-[10px] font-bold text-blue-700">Scan</span>
                    </button>
                    <button onClick={onPantryChefClick} className="flex flex-col items-center justify-center bg-amber-50 hover:bg-amber-100 rounded-xl p-2 transition-colors">
                        <div className="text-amber-600 scale-75"><ChefHatIcon /></div>
                        <span className="text-[10px] font-bold text-amber-700">Pantry</span>
                    </button>
                    <button onClick={onRestaurantClick} className="flex flex-col items-center justify-center bg-indigo-50 hover:bg-indigo-100 rounded-xl p-2 transition-colors">
                        <div className="text-indigo-600 scale-75"><UtensilsIcon /></div>
                        <span className="text-[10px] font-bold text-indigo-700">Dine</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
