import React, { useEffect, useState, useMemo } from 'react';
import { TodayStrip } from './TodayStrip';
import { DigitalTwinPanel } from './DigitalTwinPanel';
import { CameraIcon, BarcodeIcon, ChefHatIcon, UtensilsIcon, ChatIcon, ThumbUpIcon, UserGroupIcon, UserCircleIcon, PlusIcon, ActivityIcon, FireIcon } from '../icons';
import type { HealthStats, Friendship, UserDashboardPrefs } from '../../types';
import * as apiService from '../../services/apiService';

interface CommandCenterProps {
    dailyCalories: number;
    dailyProtein: number;
    rewardsBalance: number;
    userName: string;
    healthStats: HealthStats;
    isHealthConnected: boolean;
    isHealthSyncing: boolean;
    onConnectHealth: (source?: 'apple' | 'fitbit') => void;
    onScanClick: () => void;
    onCameraClick: () => void;
    onBarcodeClick: () => void;
    onPantryChefClick: () => void;
    onRestaurantClick: () => void;
    onUploadClick: () => void;
    dashboardPrefs: UserDashboardPrefs;
}

interface FriendActivity {
    id: string;
    name: string;
    action: string;
    time: string;
    color: string;
}

const SocialFeedItem: React.FC<{ name: string; action: string; time: string; color: string }> = ({ name, action, time, color }) => (
    <div className="flex items-start space-x-3 p-3 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer group">
        <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white shadow-sm ${color}`}>
            {name[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-800 leading-tight">
                <span className="font-bold">{name}</span> {action}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">{time}</p>
        </div>
        <div className="flex space-x-2 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="hover:text-emerald-500 transition-colors"><ThumbUpIcon className="w-4 h-4" /></button>
            <button className="hover:text-blue-500 transition-colors"><ChatIcon className="w-4 h-4" /></button>
        </div>
    </div>
);

export const CommandCenter: React.FC<CommandCenterProps> = ({ 
    dailyCalories, dailyProtein, rewardsBalance, onScanClick,
    onCameraClick, onBarcodeClick, onPantryChefClick, onRestaurantClick,
    healthStats, isHealthSyncing, isHealthConnected, onConnectHealth,
    dashboardPrefs
}) => {
    const [friends, setFriends] = useState<Friendship[]>([]);
    const [isLoadingFriends, setIsLoadingFriends] = useState(true);

    const journeyLabel = useMemo(() => {
        const labels: Record<string, string> = {
            'weight-loss': 'Weight Loss Only',
            'muscle-cut': 'Muscle Gain & Cut',
            'muscle-bulk': 'Muscle Gain & Bulk',
            'heart-health': 'Improve Heart Health',
            'blood-pressure': 'Lower Blood Pressure',
            'general-health': 'General Health'
        };
        return labels[dashboardPrefs.selectedJourney || ''] || 'My Health';
    }, [dashboardPrefs.selectedJourney]);

    useEffect(() => {
        const fetchFriends = async () => {
            try {
                const data = await apiService.getFriends();
                setFriends(data);
            } catch (e) {
                console.error("Failed to load friends for feed", e);
            } finally {
                setIsLoadingFriends(false);
            }
        };
        fetchFriends();
    }, []);

    const activities = useMemo((): FriendActivity[] => {
        const actionPool = [
            "has reached their daily step goal! 🏃‍♂️",
            "just logged a high-protein dinner. 💪",
            "completed a 20-minute meditation. 🧘",
            "earned 50 health points for a body scan. 🏆",
            "is on a 5-day meal logging streak! 🔥",
            "shared a new recipe in their library. 📖",
            "synced their Apple Health data. ⌚",
            "joined the 10k steps challenge. 🏁",
            "logged a new personal best for protein intake. 🍗",
            "reviewed a local healthy restaurant. 🥗"
        ];
        
        const colors = [
            "bg-rose-400", "bg-blue-400", "bg-emerald-400", "bg-amber-400", 
            "bg-indigo-400", "bg-cyan-400", "bg-violet-400", "bg-orange-400"
        ];
        const times = ["2h ago", "4h ago", "5h ago", "12h ago", "Yesterday", "2 days ago", "3 days ago"];

        return friends.map((friend, idx) => ({
            id: friend.friendId,
            name: friend.firstName || friend.email.split('@')[0],
            action: actionPool[idx % actionPool.length],
            time: times[idx % times.length],
            color: colors[idx % colors.length]
        }));
    }, [friends]);

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex-1 text-center md:text-left">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Health Wallet Balance</p>
                    <div className="flex items-baseline justify-center md:justify-start gap-2">
                        <span className="text-4xl font-extrabold text-white">{rewardsBalance.toLocaleString()}</span>
                        <span className="text-emerald-400 font-bold">points</span>
                    </div>
                </div>
                
                <div className="h-px w-full md:h-12 md:w-px bg-slate-700 hidden md:block"></div>

                <div className="flex-1 text-center md:text-right">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Active Journey</p>
                    <div className="flex items-center justify-center md:justify-end gap-2 text-emerald-400 font-black">
                        <ActivityIcon className="w-4 h-4" />
                        <span className="text-lg uppercase tracking-tight">{journeyLabel}</span>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Status Update</h2>
                <button 
                    onClick={onScanClick}
                    className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold border border-emerald-100 hover:bg-emerald-100 transition-colors"
                >
                    <UserCircleIcon className="w-4 h-4" />
                    <span>Body Hub</span>
                </button>
            </div>

            <TodayStrip 
                stats={healthStats}
                isConnected={isHealthConnected}
                onConnect={onConnectHealth}
                isSyncing={isHealthSyncing}
                dashboardPrefs={dashboardPrefs}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Goal-specific insight module */}
                    <div className="bg-gradient-to-br from-emerald-500 to-cyan-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-20">
                            <FireIcon className="w-24 h-24" />
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-lg font-black uppercase tracking-widest mb-2">Journey Insight</h3>
                            {dashboardPrefs.selectedJourney === 'weight-loss' && (
                                <p className="text-white/90 font-medium">Your step count is currently <span className="font-black">15% higher</span> than yesterday. Maintaining this calorie deficit is critical for consistent fat loss.</p>
                            )}
                            {dashboardPrefs.selectedJourney === 'muscle-cut' && (
                                <p className="text-white/90 font-medium">Prioritize your <span className="font-black">{dailyProtein}g protein intake</span> today. High protein during a cut ensures muscle preservation while fat stores are utilized.</p>
                            )}
                            {dashboardPrefs.selectedJourney === 'muscle-bulk' && (
                                <p className="text-white/90 font-medium">You are currently in a <span className="font-black">surplus phase</span>. Ensure you're hitting your compound lifting sessions to maximize lean mass accrual.</p>
                            )}
                            {dashboardPrefs.selectedJourney === 'heart-health' && (
                                <p className="text-white/90 font-medium">Resting heart rate is <span className="font-black">trending lower</span> this week. Keep up the Zone 2 cardio work to strengthen your cardiovascular baseline.</p>
                            )}
                             {(!dashboardPrefs.selectedJourney || dashboardPrefs.selectedJourney === 'general-health') && (
                                <p className="text-white/90 font-medium">Consistency is key. Every logged meal helps our medical AI calibrate your digital twin for more accurate predictive modeling.</p>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                <UserGroupIcon className="w-5 h-5 text-indigo-500" /> Community
                            </h3>
                        </div>
                        
                        {isLoadingFriends ? (
                            <div className="space-y-4 py-4">
                                {[1, 2].map(i => (
                                    <div key={i} className="flex items-center space-x-3 animate-pulse">
                                        <div className="w-10 h-10 bg-slate-100 rounded-full"></div>
                                        <div className="flex-1 space-y-2">
                                            <div className="h-3 bg-slate-100 rounded w-3/4"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : friends.length > 0 ? (
                            <div className="space-y-1">
                                {activities.slice(0, 3).map(activity => (
                                    <SocialFeedItem 
                                        key={activity.id} 
                                        name={activity.name} 
                                        action={activity.action} 
                                        time={activity.time} 
                                        color={activity.color} 
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <p className="text-sm text-slate-500">No community updates yet.</p>
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <h3 className="font-bold text-slate-900 mb-4 uppercase tracking-widest text-xs">Quick Log</h3>
                        <div className="grid grid-cols-4 gap-4">
                            <button onClick={onCameraClick} className="flex flex-col items-center gap-2 group">
                                <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:scale-110 transition-transform shadow-sm"><CameraIcon className="w-6 h-6" /></div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight text-center">Meal</span>
                            </button>
                            <button onClick={onBarcodeClick} className="flex flex-col items-center gap-2 group">
                                <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform shadow-sm"><BarcodeIcon className="w-6 h-6" /></div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight text-center">Scan</span>
                            </button>
                            <button onClick={onPantryChefClick} className="flex flex-col items-center gap-2 group">
                                <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl group-hover:scale-110 transition-transform shadow-sm"><ChefHatIcon className="w-6 h-6" /></div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight text-center">Pantry</span>
                            </button>
                            <button onClick={onRestaurantClick} className="flex flex-col items-center gap-2 group">
                                <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-110 transition-transform shadow-sm"><UtensilsIcon className="w-6 h-6" /></div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight text-center">Dine</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div 
                        onClick={() => {
                            const token = localStorage.getItem('embracehealth-api-token');
                            window.open(token ? `https://app.embracehealth.ai?token=${encodeURIComponent(token)}` : 'https://app.embracehealth.ai', '_blank');
                        }}
                        className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white shadow-lg cursor-pointer hover:shadow-xl transition-all group overflow-hidden relative"
                    >
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform"></div>
                        <div className="relative z-10">
                            <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                                <ActivityIcon className="w-4 h-4" /> 3D Body Scan
                            </h3>
                            <p className="text-indigo-100 text-xs mb-6">Open Prism Scanner to track muscle and body composition.</p>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-1 rounded">Launch App</span>
                                <PlusIcon className="w-4 h-4" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between min-h-[250px]">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-slate-900 uppercase tracking-widest text-xs">Body Twin</h3>
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Real-time Biometric Overlay</p>
                        </div>
                        
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
                            className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors shadow-md text-sm"
                        >
                            Open Body Hub
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};