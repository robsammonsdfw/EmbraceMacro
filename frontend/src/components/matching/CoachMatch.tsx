
import React, { useEffect, useState } from 'react';
import * as apiService from '../../services/apiService';
import { UserCircleIcon, TrophyIcon } from '../icons';

export const CoachMatch: React.FC = () => {
    const [matches, setMatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Reuse matching engine
        // FIX: Removed 'coach' argument to match the getMatches signature in apiService.ts which expects 0 arguments.
        apiService.getMatches().then(data => {
            setMatches(data);
            setLoading(false);
        });
    }, []);

    return (
        <div className="space-y-6">
            <header className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-800">Coach Matching</h2>
                <p className="text-slate-500">Based on your Training Style & Sleep Habits</p>
            </header>

            {loading ? (
                <div className="text-center p-8 text-slate-400">Finding matches...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {matches.map(match => (
                        <div key={match.userId} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                                <UserCircleIcon />
                            </div>
                            <div className="flex-grow">
                                <h3 className="font-bold text-slate-800">Coach {match.email.split('@')[0]}</h3>
                                <div className="flex items-center space-x-2 mt-1">
                                    <div className="h-2 flex-grow bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500" style={{ width: `${match.compatibilityScore}%` }}></div>
                                    </div>
                                    <span className="text-sm font-bold text-emerald-600">{match.compatibilityScore}%</span>
                                </div>
                                <p className="text-xs text-slate-400 mt-1">Match Score</p>
                            </div>
                            <button className="bg-emerald-50 text-emerald-600 p-2 rounded-full hover:bg-emerald-100">
                                <TrophyIcon />
                            </button>
                        </div>
                    ))}
                    {matches.length === 0 && (
                        <p className="text-center text-slate-500 col-span-2">No matches found yet. Try taking more assessments!</p>
                    )}
                </div>
            )}
        </div>
    );
};
