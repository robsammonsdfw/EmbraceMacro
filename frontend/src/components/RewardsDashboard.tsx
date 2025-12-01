import React, { useEffect, useState } from 'react';
import type { RewardsSummary } from '../types';
import * as apiService from '../services/apiService';
import { StarIcon, TrophyIcon, UserCircleIcon } from './icons';

export const RewardsDashboard: React.FC = () => {
    const [rewardsData, setRewardsData] = useState<RewardsSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchRewards = async () => {
            try {
                const data = await apiService.getRewardsSummary();
                setRewardsData(data);
            } catch (err) {
                setError("Could not load rewards data.");
            } finally {
                setLoading(false);
            }
        };
        fetchRewards();
    }, []);

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading rewards...</div>;
    }

    if (error || !rewardsData) {
        return (
            <div className="bg-red-50 p-6 rounded-xl border border-red-200 text-center text-red-600">
                <p>{error || "No data available."}</p>
            </div>
        );
    }

    const { points_total, tier, history } = rewardsData;
    const cashValue = (points_total * 0.009).toFixed(2);

    const tierColor = {
        'Bronze': 'text-amber-700 bg-amber-100 border-amber-300',
        'Silver': 'text-slate-500 bg-slate-100 border-slate-300',
        'Gold': 'text-yellow-600 bg-yellow-100 border-yellow-300',
        'Platinum': 'text-cyan-600 bg-cyan-100 border-cyan-300'
    }[tier] || 'text-slate-700 bg-slate-100 border-slate-300';

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Health Wallet Header */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <TrophyIcon />
                </div>
                
                <div className="flex flex-col md:flex-row justify-between items-center z-10 relative">
                    <div className="text-center md:text-left mb-6 md:mb-0">
                        <div className="flex items-center justify-center md:justify-start space-x-2 mb-2">
                             <h2 className="text-lg font-medium opacity-90 uppercase tracking-wide">Health Wallet Balance</h2>
                             <span className="bg-white/20 px-2 py-0.5 rounded text-xs">Redeemable</span>
                        </div>
                        <div className="flex items-baseline justify-center md:justify-start space-x-3">
                            <p className="text-5xl font-extrabold tracking-tight">{points_total.toLocaleString()}<span className="text-2xl font-medium ml-1">pts</span></p>
                            <span className="text-3xl opacity-60">·</span>
                            <p className="text-4xl font-bold text-emerald-300">${cashValue}</p>
                        </div>
                    </div>
                    
                    <div className={`px-6 py-3 rounded-full border-2 font-bold text-lg flex items-center space-x-2 ${tierColor.split(' ')[0]} bg-white shadow-md`}>
                        <TrophyIcon />
                        <span>{tier} Member</span>
                    </div>
                </div>
            </div>

            {/* Invite & Earn Card */}
            <div className="bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl shadow-md p-1 relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all">
                <div className="bg-white rounded-lg p-6 h-full relative z-10">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center space-x-4">
                            <div className="bg-rose-100 p-4 rounded-full text-rose-500">
                                <UserCircleIcon />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Invite & Earn</h3>
                                <p className="text-slate-600">
                                    Get <span className="font-bold text-emerald-600">500 pts ($4.50)</span> for every friend who joins and logs their first meal.
                                </p>
                            </div>
                        </div>
                        <button className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-md flex items-center space-x-2 whitespace-nowrap">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                            <span>Invite Friends</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* History List */}
            <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
                <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
                    <StarIcon />
                    <span className="ml-2">Recent Activity</span>
                </h3>
                
                {history.length === 0 ? (
                    <p className="text-slate-500 text-center py-4">No recent activity. Start logging meals to earn points!</p>
                ) : (
                    <ul className="space-y-0">
                        {history.map((entry) => (
                            <li key={entry.entry_id} className="flex justify-between items-center py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 px-2 rounded transition-colors">
                                <div>
                                    <p className="font-semibold text-slate-800 capitalize">
                                        {entry.event_type.replace(/_/g, ' ').replace('.', ' ')}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {new Date(entry.created_at).toLocaleDateString()} • {new Date(entry.created_at).toLocaleTimeString()}
                                    </p>
                                </div>
                                <div className="font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                                    +{entry.points_delta} pts
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};