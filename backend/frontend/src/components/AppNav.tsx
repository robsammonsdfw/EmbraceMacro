
import React from 'react';
import { PlusIcon, BookOpenIcon, ClockIcon, LightBulbIcon, ClipboardListIcon, StarIcon } from './icons';

type ActiveView = 'plan' | 'meals' | 'history' | 'suggestions' | 'grocery' | 'rewards';

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
        className={`w-full flex flex-col items-center justify-center py-3 px-2 rounded-lg transition-all text-xs font-bold ${
            isActive
                ? 'bg-emerald-500 text-white shadow-md'
                : 'bg-white text-slate-500 hover:bg-slate-100 hover:text-emerald-600'
        }`}
    >
        <span className="mb-1">{icon}</span>
        <span>{label}</span>
    </button>
);

export const AppNav: React.FC<AppNavProps> = ({ activeView, onViewChange }) => {
    return (
        <div className="grid grid-cols-4 md:grid-cols-6 gap-2 p-2 bg-slate-100 rounded-xl border border-slate-200">
            <NavButton
                isActive={activeView === 'plan'}
                onClick={() => onViewChange('plan')}
                icon={<PlusIcon />}
                label="Plan"
            />
            <NavButton
                isActive={activeView === 'meals'}
                onClick={() => onViewChange('meals')}
                icon={<BookOpenIcon />}
                label="Meals"
            />
            <NavButton
                isActive={activeView === 'history'}
                onClick={() => onViewChange('history')}
                icon={<ClockIcon />}
                label="History"
            />
            <NavButton
                isActive={activeView === 'suggestions'}
                onClick={() => onViewChange('suggestions')}
                icon={<LightBulbIcon />}
                label="Ideas"
            />
            <NavButton
                isActive={activeView === 'grocery'}
                onClick={() => onViewChange('grocery')}
                icon={<ClipboardListIcon />}
                label="List"
            />
             <NavButton
                isActive={activeView === 'rewards'}
                onClick={() => onViewChange('rewards')}
                icon={<StarIcon />}
                label="Rewards"
            />
        </div>
    );
};
