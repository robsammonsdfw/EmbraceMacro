
import React, { useState, useEffect } from 'react';
import * as apiService from '../../services/apiService';
import { HeartIcon } from '../icons';

export const PartnerBlueprint: React.FC = () => {
    const [preferences, setPreferences] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);

    // Hardcoded trait definitions for UI (in real app, fetch from backend)
    const traits = [
        { key: 'sleep_quality', label: 'Sleep Quality', minLabel: 'Restless', maxLabel: 'Deep Sleeper' },
        { key: 'intensity_preference', label: 'Workout Intensity', minLabel: 'Casual', maxLabel: 'Hardcore' }
    ];

    useEffect(() => {
        apiService.getPartnerBlueprint().then(data => {
            setPreferences(data.preferences || {});
            setLoading(false);
        });
    }, []);

    const handleChange = (key: string, field: string, value: any) => {
        setPreferences(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: value
            }
        }));
    };

    const handleSave = async () => {
        await apiService.savePartnerBlueprint(preferences);
        alert("Blueprint Saved!");
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 max-w-2xl mx-auto">
            <div className="text-center mb-8">
                <div className="inline-block p-3 bg-rose-100 text-rose-500 rounded-full mb-3">
                    <HeartIcon />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Partner Blueprint</h2>
                <p className="text-slate-500">Define what matters most to you in a partner.</p>
            </div>

            <div className="space-y-8">
                {traits.map(trait => {
                    const pref = preferences[trait.key] || { target: 0.5, importance: 0.5, isDealbreaker: false };
                    
                    return (
                        <div key={trait.key} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-slate-700">{trait.label}</h3>
                                <label className="flex items-center space-x-2 text-sm">
                                    <input 
                                        type="checkbox" 
                                        checked={pref.isDealbreaker}
                                        onChange={(e) => handleChange(trait.key, 'isDealbreaker', e.target.checked)}
                                        className="rounded text-rose-500 focus:ring-rose-500"
                                    />
                                    <span className={pref.isDealbreaker ? "text-rose-600 font-bold" : "text-slate-500"}>Dealbreaker?</span>
                                </label>
                            </div>

                            <div className="mb-4">
                                <div className="flex justify-between text-xs text-slate-400 mb-1">
                                    <span>Target: {trait.minLabel}</span>
                                    <span>{trait.maxLabel}</span>
                                </div>
                                <input 
                                    type="range" min="0" max="1" step="0.1"
                                    value={pref.target}
                                    onChange={(e) => handleChange(trait.key, 'target', parseFloat(e.target.value))}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                            </div>

                            <div>
                                <p className="text-xs font-semibold text-slate-500 mb-2">Importance</p>
                                <div className="flex gap-2">
                                    {[0.2, 0.5, 0.8, 1.0].map(val => (
                                        <button 
                                            key={val}
                                            onClick={() => handleChange(trait.key, 'importance', val)}
                                            className={`flex-1 py-1 text-xs rounded border ${
                                                pref.importance === val 
                                                ? 'bg-slate-700 text-white border-slate-700' 
                                                : 'bg-white text-slate-500 border-slate-200'
                                            }`}
                                        >
                                            {val === 1.0 ? 'Critical' : val === 0.2 ? 'Low' : val === 0.5 ? 'Medium' : 'High'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100">
                <button 
                    onClick={handleSave}
                    className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-xl transition-colors shadow-md"
                >
                    Save Blueprint
                </button>
            </div>
        </div>
    );
};
