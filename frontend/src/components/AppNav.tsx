import React from 'react';
import { PlusIcon, BookOpenIcon, ClockIcon } from './icons';

type ActiveView = 'plan' | 'meals' | 'history';

interface AppNavProps {
    activeView: ActiveView;
    onViewChange: (view: ActiveView) => void;
}

const NavButton: React.FC<{
    isActive: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}> = ({ isActive, onClick, icon, label }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center justify-center space-x-2 font-bold py-3 px-4 rounded-lg transition-all text-sm md:text-base ${
            isActive
                ? 'bg-emerald-500 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100'
        }`}
    >
        {icon}
        <span>{label}</span>
    </button>
);

export const AppNav: React.FC<AppNavProps> = ({ activeView, onViewChange }) => {
    return (
        <div className="grid grid-cols-3 gap-3 p-2 bg-slate-100 rounded-xl border border-slate-200">
            <NavButton
                isActive={activeView === 'plan'}
                onClick={() => onViewChange('plan')}
                icon={<PlusIcon />}
                label="Today's Plan"
            />
            <NavButton
                isActive={activeView === 'meals'}
                onClick={() => onViewChange('meals')}
                icon={<BookOpenIcon />}
                label="My Meals"
            />
            <NavButton
                isActive={activeView === 'history'}
                onClick={() => onViewChange('history')}
                icon={<ClockIcon />}
                label="History"
            />
        </div>
    );
};