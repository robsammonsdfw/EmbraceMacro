
import React from 'react';
import { FireIcon, ActivityIcon, TrophyIcon, StarIcon } from '../icons';

interface TodayStripProps {
    calories: number;
    calorieGoal: number;
    activityScore: number;
    rewardsBalance: number;
}

const StatCard: React.FC<{
    label: string;
    value: React.ReactNode;
    subValue?: React.ReactNode;
    icon: React.ReactNode;
    colors: string;
}> = ({ label, value, subValue, icon, colors }) => (
    <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3 overflow-hidden transition-all hover:shadow-md">
        <div className={`p-2.5 rounded-xl flex-shrink-0 ${colors}`}>
            {icon}
        </div>
        <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest truncate leading-tight mb-0.5">
                {label}
            </p>
            <div className="flex items-baseline gap-1 truncate">
                <span className="text-lg font-bold text-slate-800 leading-none truncate">
                    {value}
                </span>
                {subValue && (
                    <span className="text-xs text-slate-400 font-medium truncate">
                        {subValue}
                    </span>
                )}
            </div>
        </div>
    </div>
);

export const TodayStrip: React.FC<TodayStripProps> = ({ calories, calorieGoal, activityScore, rewardsBalance }) => {
    return (
        // Grid Logic:
        // Default (Mobile): 2 columns
        // SM (Tablet): 4 columns (Full width)
        // LG (Desktop Split): Back to 2 columns (Half width container)
        // XL (Wide Desktop): Back to 4 columns if space allows, or keep 2 for consistency
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-2 gap-3 mb-6">
            <StatCard 
                label="Calories"
                value={calories}
                subValue={`/ ${calorieGoal}`}
                icon={<FireIcon />}
                colors="bg-emerald-100 text-emerald-600"
            />
            
            <StatCard 
                label="Movement"
                value={activityScore}
                subValue="Score"
                icon={<ActivityIcon />}
                colors="bg-amber-100 text-amber-600"
            />

            <StatCard 
                label="Adherence"
                value="85%"
                subValue="High"
                icon={<StarIcon />}
                colors="bg-indigo-100 text-indigo-600"
            />

            <StatCard 
                label="Rewards"
                value={rewardsBalance.toLocaleString()}
                icon={<TrophyIcon />}
                colors="bg-purple-100 text-purple-600"
            />
        </div>
    );
};
