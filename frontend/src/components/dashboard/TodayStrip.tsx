
import React from 'react';
import { FireIcon, ActivityIcon, TrophyIcon, StarIcon } from '../icons';

interface TodayStripProps {
    calories: number;
    calorieGoal: number;
    activityScore: number;
    rewardsBalance: number;
}

export const TodayStrip: React.FC<TodayStripProps> = ({ calories, calorieGoal, activityScore, rewardsBalance }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                    <FireIcon />
                </div>
                <div>
                    <p className="text-xs text-slate-500 font-bold uppercase">Calories</p>
                    <p className="font-bold text-slate-800">{calories} <span className="text-slate-400 text-xs">/ {calorieGoal}</span></p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                    <ActivityIcon />
                </div>
                <div>
                    <p className="text-xs text-slate-500 font-bold uppercase">Movement</p>
                    <p className="font-bold text-slate-800">{activityScore} <span className="text-slate-400 text-xs">Score</span></p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                    <StarIcon />
                </div>
                <div>
                    <p className="text-xs text-slate-500 font-bold uppercase">Adherence</p>
                    <p className="font-bold text-slate-800">85% <span className="text-slate-400 text-xs">High</span></p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                    <TrophyIcon />
                </div>
                <div>
                    <p className="text-xs text-slate-500 font-bold uppercase">Rewards</p>
                    <p className="font-bold text-slate-800">{rewardsBalance.toLocaleString()}</p>
                </div>
            </div>
        </div>
    );
};
