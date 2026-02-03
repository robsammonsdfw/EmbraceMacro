
import React, { useState } from 'react';
import type { PassivePrompt } from '../../types';
import { LightBulbIcon, StarIcon } from '../icons';

interface PassivePulseProps {
    prompt: PassivePrompt;
    onResponse: (value: any) => void;
}

export const PassivePulse: React.FC<PassivePulseProps> = ({ prompt, onResponse }) => {
    const [value, setValue] = useState<any>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = () => {
        if (value !== null) {
            setIsSubmitted(true);
            setTimeout(() => onResponse(value), 800);
        }
    };

    return (
        <div className={`bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white shadow-xl animate-fade-in relative overflow-hidden transition-all duration-500 ${isSubmitted ? 'opacity-0 scale-95 translate-y-4' : 'opacity-100'}`}>
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <LightBulbIcon className="w-24 h-24" />
            </div>
            
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                    <span className="bg-emerald-500 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">AI Quick Pulse</span>
                    <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">{prompt.category}</span>
                </div>

                <h3 className="text-xl font-bold mb-6 leading-tight">{prompt.question}</h3>

                <div className="space-y-6">
                    {prompt.type === 'scale' && (
                        <div>
                             <div className="flex justify-between text-[10px] font-black uppercase text-indigo-200 mb-2">
                                <span>Low</span>
                                <span className="text-white text-base">{value || '-'}</span>
                                <span>High</span>
                             </div>
                             <input 
                                type="range" 
                                min="1" max="10" step="1"
                                value={value || 5}
                                onChange={e => setValue(parseInt(e.target.value))}
                                className="w-full h-2 bg-indigo-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                             />
                        </div>
                    )}

                    <div className="flex justify-between items-center">
                         <div className="flex items-center gap-1.5 text-emerald-400">
                            <StarIcon className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">+15 Health Pts</span>
                         </div>
                         <button 
                            onClick={handleSubmit}
                            disabled={value === null && prompt.type === 'scale'}
                            className="bg-white text-indigo-700 font-black uppercase tracking-widest text-xs px-6 py-3 rounded-xl shadow-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
                         >
                            Submit
                         </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
