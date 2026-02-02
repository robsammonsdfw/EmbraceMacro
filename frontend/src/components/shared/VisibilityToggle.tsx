
import React from 'react';
import { VisibilityMode } from '../../types';
import { UserCircleIcon, UserGroupIcon, GlobeAltIcon } from '../icons';

interface VisibilityToggleProps {
    value: VisibilityMode;
    onChange: (mode: VisibilityMode) => void;
    label?: string;
}

export const VisibilityToggle: React.FC<VisibilityToggleProps> = ({ value, onChange, label }) => {
    const options: { id: VisibilityMode; icon: React.ReactNode; label: string }[] = [
        { id: 'private', icon: <UserCircleIcon />, label: 'Private' },
        { id: 'friends', icon: <UserGroupIcon />, label: 'Friends' },
        { id: 'public', icon: <GlobeAltIcon />, label: 'Everyone' }
    ];

    return (
        <div className="space-y-2">
            {label && <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                {options.map(opt => (
                    <button
                        key={opt.id}
                        onClick={() => onChange(opt.id)}
                        className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all ${
                            value === opt.id 
                            ? 'bg-white text-emerald-600 shadow-sm font-bold' 
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <span className="scale-75">{opt.icon}</span>
                        <span className="text-[10px] mt-0.5">{opt.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};
