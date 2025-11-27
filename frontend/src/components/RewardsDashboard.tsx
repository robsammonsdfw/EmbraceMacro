import React, { useEffect, useState } from 'react';
import type { RewardsSummary } from '../types';
import * as apiService from '../services/apiService';
import { StarIcon, TrophyIcon } from './icons';

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

    const tierColor = {
        'Bronze': 'text-amber-700 bg-amber-100 border-amber-300',
        'Silver': 'text-slate-500 bg-slate-100 border-slate-300',
        'Gold': 'text-yellow-600 bg-yellow-100 border-yellow-300',
        'Platinum': 'text-cyan-600 bg-cyan-100 border-cyan-300'
    }[tier] || 'text-slate-700 bg-slate-100 border-slate-300';

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header Card */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <TrophyIcon />
                </div>
                
                <div className="flex flex-col md:flex-row justify-between items-center z-10 relative">
                    <div className="text-center md:text-left mb-4 md:mb-0">
                        <h2 className="text-xl font-medium opacity-90">Total Rewards Balance</h2>
                        <p className="text-5xl font-extrabold mt-2 tracking-tight">{points_total.toLocaleString()}</p>
                        <p className="text-sm opacity-80 mt-1">Points Available</p>
                    </div>
                    
                    <div className={`px-6 py-3 rounded-full border-2 font-bold text-lg flex items-center space-x-2 ${tierColor.split(' ')[0]} bg-white shadow-md`}>
                        <TrophyIcon />
                        <span>{tier} Member</span>
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
                                    +{entry.points_delta}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};