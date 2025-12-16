
import React from 'react';
import { GiftIcon } from '../icons';

interface RewardsBannerProps {
    points: number;
}

export const RewardsBanner: React.FC<RewardsBannerProps> = ({ points }) => {
    return (
        <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden flex items-center justify-between">
            {/* Background Decor */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/10 to-transparent"></div>

            <div className="relative z-10">
                <h3 className="text-sm font-bold opacity-80 uppercase tracking-wide mb-1">Total Rewards</h3>
                <p className="text-4xl font-extrabold">{points.toLocaleString()} <span className="text-lg font-medium opacity-80">points</span></p>
            </div>

            <div className="relative z-10 bg-white/20 p-4 rounded-full backdrop-blur-sm border border-white/20 shadow-inner">
                <GiftIcon />
            </div>
        </div>
    );
};
