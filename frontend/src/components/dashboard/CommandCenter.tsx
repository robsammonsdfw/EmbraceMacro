
import React, { useEffect, useState, useMemo } from 'react';
import { TodayStrip } from './TodayStrip';
import { DigitalTwinPanel } from './DigitalTwinPanel';
import { CameraIcon, BarcodeIcon, ChefHatIcon, UtensilsIcon, TrophyIcon, ChatIcon, ThumbUpIcon, UserGroupIcon } from '../icons';
import type { HealthStats, Friendship } from '../../types';
import * as apiService from '../../services/apiService';

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
    const [friends, setFriends] = useState<Friendship[]>([]);
    const [isLoadingFriends, setIsLoadingFriends] = useState(true);

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
            {/* Rewards Banner */}
            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg flex items-center justify-between">
                <div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Health Wallet Balance</p>
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
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Today's Pulse</h2>
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
                    {/* Social Feed connected to real friend data */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                <UserGroupIcon /> Friend Updates
                            </h3>
                            <span className="text-xs font-bold text-slate-400 uppercase">{friends.length} Active</span>
                        </div>
                        
                        {isLoadingFriends ? (
                            <div className="space-y-4 py-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex items-center space-x-3 animate-pulse">
                                        <div className="w-10 h-10 bg-slate-100 rounded-full"></div>
                                        <div className="flex-1 space-y-2">
                                            <div className="h-3 bg-slate-100 rounded w-3/4"></div>
                                            <div className="h-2 bg-slate-50 rounded w-1/4"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : friends.length > 0 ? (
                            <div className="space-y-1">
                                {activities.slice(0, 5).map(activity => (
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
                            <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <p className="text-sm text-slate-500 mb-3">No friend activity yet.</p>
                                <button className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors">
                                    Invite Friends to Earn Points
                                </button>
                            </div>
                        )}
                        
                        {friends.length > 0 && (
                            <button className="w-full mt-4 py-2 text-center text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest border-t border-slate-100 pt-4">
                                View Full Activity Log
                            </button>
                        )}
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <h3 className="font-bold text-slate-900 mb-4">Quick Log</h3>
                        <div className="grid grid-cols-4 gap-4">
                            <button onClick={onCameraClick} className="flex flex-col items-center gap-2 group">
                                <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:scale-110 transition-transform shadow-sm"><CameraIcon /></div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Meal</span>
                            </button>
                            <button onClick={onBarcodeClick} className="flex flex-col items-center gap-2 group">
                                <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform shadow-sm"><BarcodeIcon /></div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Scan</span>
                            </button>
                            <button onClick={onPantryChefClick} className="flex flex-col items-center gap-2 group">
                                <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl group-hover:scale-110 transition-transform shadow-sm"><ChefHatIcon /></div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Pantry</span>
                            </button>
                            <button onClick={onRestaurantClick} className="flex flex-col items-center gap-2 group">
                                <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-110 transition-transform shadow-sm"><UtensilsIcon /></div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Dine</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Side Column */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between min-h-[300px]">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-slate-900">Body Twin</h3>
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                            </div>
                            <p className="text-xs text-slate-500">Live Health Overlay</p>
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
                            className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors shadow-md"
                        >
                            Open Body Hub
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
