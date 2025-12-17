
import React from 'react';
import { FireIcon, ActivityIcon, HeartIcon } from '../icons';

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
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-2 transition-all hover:shadow-md h-32">
        <div className={`p-3 rounded-full ${colors}`}>
            {icon}
        </div>
        <div className="text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight mb-1">
                {label}
            </p>
            <div className="flex flex-col items-center leading-tight">
                <span className="text-xl font-extrabold text-slate-800">
                    {value}
                </span>
                {subValue && (
                    <span className="text-xs text-slate-400 font-medium">
                        {subValue}
                    </span>
                )}
            </div>
        </div>
    </div>
);

export const TodayStrip: React.FC<TodayStripProps> = ({ calories, calorieGoal, activityScore }) => {
    return (
        <div className="grid grid-cols-3 gap-4 mb-6">
            <StatCard 
                label="Steps"
                value="8,432"
                subValue="Goal: 10k"
                icon={<ActivityIcon />}
                colors="bg-blue-50 text-blue-600"
            />
            
            <StatCard 
                label="Calories"
                value={Math.round(calories)}
                subValue={`/ ${calorieGoal}`}
                icon={<FireIcon />}
                colors="bg-emerald-50 text-emerald-600"
            />

            <StatCard 
                label="Cardio Score"
                value={activityScore}
                subValue="Heart Pts"
                icon={<HeartIcon />}
                colors="bg-rose-50 text-rose-600"
            />
        </div>
    );
};
