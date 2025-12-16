
import React from 'react';
import { UserCircleIcon } from '../icons';

interface MiniBodyCardProps {
    onClick: () => void;
    progress: number; // 0-100
}

export const MiniBodyCard: React.FC<MiniBodyCardProps> = ({ onClick, progress }) => {
    return (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col justify-between h-full relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10 text-indigo-600">
                <UserCircleIcon />
            </div>
            
            <div>
                <h4 className="font-bold text-slate-800 text-sm">Body Twin</h4>
                <p className="text-xs text-slate-500">Updates pending</p>
            </div>

            <div className="mt-4">
                <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                    <span>Score</span>
                    <span>{progress}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div 
                        className="bg-indigo-600 h-full rounded-full" 
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            </div>

            <button 
                onClick={onClick}
                className="mt-4 w-full bg-slate-900 text-white text-xs font-bold py-2 rounded-lg hover:bg-slate-700 transition-colors"
            >
                View Body
            </button>
        </div>
    );
};
