
import React from 'react';
import { FireIcon, FootprintsIcon, HeartIcon } from '../icons';

interface ActivityRowProps {
    steps: number;
    calories: number;
    heartPoints: number;
}

const ActivityWidget: React.FC<{ 
    label: string; 
    value: string; 
    icon: React.ReactNode; 
    iconBg: string;
    iconColor: string; 
}> = ({ label, value, icon, iconBg, iconColor }) => (
    <div className="flex flex-col items-center justify-center bg-white rounded-xl py-4 shadow-sm border border-slate-100 flex-1">
        <div className={`mb-2 p-2 rounded-full ${iconBg} ${iconColor}`}>
            {icon}
        </div>
        <span className="text-xl font-extrabold text-slate-800 leading-none mb-1">{value}</span>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
    </div>
);

export const ActivityRow: React.FC<ActivityRowProps> = ({ steps, calories, heartPoints }) => {
    return (
        <div className="flex gap-4 w-full">
            <ActivityWidget 
                label="Steps" 
                value={steps.toLocaleString()} 
                icon={<FootprintsIcon />} 
                iconBg="bg-blue-50"
                iconColor="text-blue-500"
            />
            <ActivityWidget 
                label="Calories" 
                value={Math.round(calories).toLocaleString()} 
                icon={<FireIcon />} 
                iconBg="bg-orange-50"
                iconColor="text-orange-500"
            />
            <ActivityWidget 
                label="Heart Pts" 
                value={heartPoints.toString()} 
                icon={<HeartIcon />} 
                iconBg="bg-rose-50"
                iconColor="text-rose-500"
            />
        </div>
    );
};
