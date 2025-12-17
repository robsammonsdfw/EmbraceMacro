
import React from 'react';
import { TodayStrip } from './TodayStrip';
import { DigitalTwinPanel } from './DigitalTwinPanel';
import { CameraIcon, BarcodeIcon, ChefHatIcon, UtensilsIcon, TrophyIcon, ChatIcon, ThumbUpIcon } from '../icons';
import type { HealthStats } from '../../types';

interface CommandCenterProps {
    dailyCalories: number;
    dailyProtein: number;
    rewardsBalance: number;
    userName: string;
    healthStats: HealthStats;
    isHealthConnected: boolean;
    isHealthSyncing: boolean;
    onConnectHealth: () => void;
    onScanClick: () => void;
    onCameraClick: () => void;
    onBarcodeClick: () => void;
    onPantryChefClick: () => void;
    onRestaurantClick: () => void;
    onUploadClick: () => void;
}

const SocialFeedItem: React.FC<{ name: string; action: string; time: string; color: string }> = ({ name, action, time, color }) => (
    <div className="flex items-start space-x-3 p-3 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer">
        <div className={`w-10 h-10 rounded-full flex-shrink-0 ${color}`}></div>
        <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-800">
                <span className="font-bold">{name}</span> {action}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{time}</p>
        </div>
        <div className="flex space-x-2 text-slate-300">
            <button className="hover:text-emerald-500 transition-colors"><ThumbUpIcon /></button>
            <button className="hover:text-blue-500 transition-colors"><ChatIcon /></button>
        </div>
    </div>
);

export const CommandCenter: React.FC<CommandCenterProps> = ({ 
    dailyCalories, dailyProtein, rewardsBalance, onScanClick,
    onCameraClick, onBarcodeClick, onPantryChefClick, onRestaurantClick,
    healthStats, isHealthConnected, isHealthSyncing, onConnectHealth
}) => {
    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Phase 2: Rewards Banner */}
            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg flex items-center justify-between">
                <div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Health Wallet</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-extrabold text-white">{rewardsBalance.toLocaleString()}</span>
                        <span className="text-emerald-400 font-bold">points</span>
                    </div>
                </div>
                <div className="bg-white/10 p-3 rounded-full">
                    <TrophyIcon />
                </div>
            </div>

            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Today's Activity</h2>
            </div>

            {/* Dynamic Activity Row */}
            <TodayStrip 
                stats={healthStats}
                isConnected={isHealthConnected}
                onConnect={onConnectHealth}
                isSyncing={isHealthSyncing}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Feed Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Phase 2: Social Feed */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <h3 className="font-bold text-slate-900 mb-4">Friends Updated</h3>
                        <div className="space-y-2">
                            <SocialFeedItem name="Sarah M." action="has 12,000 steps today!" time="2h ago" color="bg-rose-200" />
                            <SocialFeedItem name="Mike T." action="completed a 30min HIIT workout." time="4h ago" color="bg-blue-200" />
                            <SocialFeedItem name="Jessica L." action="logged a balanced lunch." time="5h ago" color="bg-emerald-200" />
                        </div>
                        <button className="w-full mt-4 text-center text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">
                            View All Activity
                        </button>
                    </div>

                    {/* Quick Actions (Preserved Functionality) */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <h3 className="font-bold text-slate-900 mb-4">Quick Actions</h3>
                        <div className="grid grid-cols-4 gap-4">
                            <button onClick={onCameraClick} className="flex flex-col items-center gap-2 group">
                                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform"><CameraIcon /></div>
                                <span className="text-xs font-bold text-slate-600">Meal</span>
                            </button>
                            <button onClick={onBarcodeClick} className="flex flex-col items-center gap-2 group">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform"><BarcodeIcon /></div>
                                <span className="text-xs font-bold text-slate-600">Scan</span>
                            </button>
                            <button onClick={onPantryChefClick} className="flex flex-col items-center gap-2 group">
                                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform"><ChefHatIcon /></div>
                                <span className="text-xs font-bold text-slate-600">Pantry</span>
                            </button>
                            <button onClick={onRestaurantClick} className="flex flex-col items-center gap-2 group">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform"><UtensilsIcon /></div>
                                <span className="text-xs font-bold text-slate-600">Dine</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Side Column / Bottom Mobile */}
                <div className="space-y-6">
                    {/* Phase 2: Mini-Progress Bar (Body Twin) */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between min-h-[300px]">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-slate-900">Body Twin</h3>
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                            </div>
                            <p className="text-xs text-slate-500">Updates pending</p>
                        </div>
                        
                        {/* Mini Visual */}
                        <div className="flex-grow flex items-center justify-center my-4">
                             <DigitalTwinPanel 
                                calories={dailyCalories}
                                calorieGoal={2000}
                                protein={dailyProtein}
                                proteinGoal={150}
                                activityScore={healthStats.cardioScore || 0}
                                onScanClick={onScanClick}
                                miniMode={true}
                            />
                        </div>

                        <button 
                            onClick={onScanClick}
                            className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors"
                        >
                            View Body
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
