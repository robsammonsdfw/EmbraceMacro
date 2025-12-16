
import React from 'react';
import { ThumbsUpIcon, MessageCircleIcon } from '../icons';

const MOCK_FEED = [
    { id: 1, user: 'Sarah M.', avatarBg: 'bg-pink-200', text: 'Sarah has 12,000 steps today!', time: '2h ago' },
    { id: 2, user: 'Mike T.', avatarBg: 'bg-blue-200', text: 'Mike completed a 30min HIIT workout.', time: '4h ago' },
    { id: 3, user: 'Jessica L.', avatarBg: 'bg-emerald-200', text: 'Jessica logged a balanced meal.', time: '5h ago' }
];

export const SocialFeed: React.FC = () => {
    return (
        <div className="w-full">
            <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide px-1">Friends Activity</h3>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {MOCK_FEED.map(item => (
                        <div key={item.id} className="p-4 flex gap-4">
                            <div className={`w-10 h-10 rounded-full flex-shrink-0 ${item.avatarBg}`}></div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <p className="text-sm font-bold text-slate-800">{item.user}</p>
                                    <span className="text-xs text-slate-400">{item.time}</span>
                                </div>
                                <p className="text-sm text-slate-600 mt-0.5">{item.text}</p>
                                
                                <div className="flex gap-4 mt-3">
                                    <button className="flex items-center gap-1 text-slate-400 hover:text-indigo-600 text-xs font-bold transition-colors">
                                        <ThumbsUpIcon /> <span>Like</span>
                                    </button>
                                    <button className="flex items-center gap-1 text-slate-400 hover:text-indigo-600 text-xs font-bold transition-colors">
                                        <MessageCircleIcon /> <span>Comment</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
