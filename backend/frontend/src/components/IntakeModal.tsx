
import React, { useState } from 'react';
import { XIcon, ActivityIcon } from './icons';
import { JOURNEYS } from './layout/AppLayout';
import type { HealthJourney } from '../types';

interface IntakeModalProps {
    onClose: () => void;
    onSaveJourney: (journey: HealthJourney) => void;
    onSaveIntake: (data: any) => Promise<void>;
}

export const IntakeModal: React.FC<IntakeModalProps> = ({ onClose, onSaveJourney, onSaveIntake }) => {
    const [step, setStep] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    const totalSteps = 6;

    const [responses, setResponses] = useState({
        journey: '' as HealthJourney,
        activityLevel: '',
        dietary: '',
        stress: 5,
        sleep: 7,
        hydration: ''
    });

    const handleNext = async () => {
        if (step < totalSteps) {
            setStep(step + 1);
        } else {
            // Finish
            setIsSaving(true);
            try {
                // Save Journey Pref
                if (responses.journey) onSaveJourney(responses.journey);
                
                // Save other data
                await onSaveIntake({
                    activityLevel: responses.activityLevel,
                    dietary: responses.dietary,
                    stressLevel: responses.stress,
                    avgSleep: responses.sleep,
                    hydrationGoal: responses.hydration,
                    timestamp: new Date().toISOString()
                });
                onClose();
            } catch (e) {
                alert("Failed to save profile.");
            } finally {
                setIsSaving(false);
            }
        }
    };

    const updateResponse = (key: string, value: any) => {
        setResponses(prev => ({ ...prev, [key]: value }));
    };

    const ProgressBar = () => (
        <div className="w-full bg-slate-100 h-2 rounded-full mb-8 overflow-hidden">
            <div 
                className="h-full bg-indigo-500 transition-all duration-300 ease-out" 
                style={{ width: `${(step / totalSteps) * 100}%` }}
            ></div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                    <XIcon />
                </button>

                <div className="text-center mb-6">
                    <h2 className="text-2xl font-black text-slate-900">Personalize Your Active Journey</h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">Step {step} of {totalSteps}</p>
                </div>

                <ProgressBar />

                <div className="min-h-[300px] flex flex-col justify-center">
                    {step === 1 && (
                        <div className="space-y-3">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">What is your primary focus?</h3>
                            <div className="grid grid-cols-1 gap-2">
                                {JOURNEYS.map(j => (
                                    <button
                                        key={j.id}
                                        onClick={() => updateResponse('journey', j.id)}
                                        className={`p-4 rounded-2xl border-2 text-left font-bold transition-all ${responses.journey === j.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 hover:border-indigo-200'}`}
                                    >
                                        {j.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">How active are you daily?</h3>
                            {['Sedentary (Office Job)', 'Lightly Active (1-3 days/wk)', 'Moderately Active (3-5 days/wk)', 'Very Active (6-7 days/wk)'].map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => updateResponse('activityLevel', opt)}
                                    className={`w-full p-4 rounded-2xl border-2 text-left font-bold transition-all ${responses.activityLevel === opt ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 hover:border-emerald-200'}`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">Any dietary preferences?</h3>
                            {['None', 'Vegetarian', 'Vegan', 'Keto', 'Paleo', 'Gluten-Free'].map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => updateResponse('dietary', opt)}
                                    className={`w-full p-4 rounded-2xl border-2 text-left font-bold transition-all ${responses.dietary === opt ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-100 hover:border-amber-200'}`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-6 text-center">
                            <h3 className="text-lg font-bold text-slate-800">Daily Stress Level (1-10)</h3>
                            <div className="text-4xl font-black text-rose-500">{responses.stress}</div>
                            <input 
                                type="range" min="1" max="10" 
                                value={responses.stress} 
                                onChange={(e) => updateResponse('stress', parseInt(e.target.value))}
                                className="w-full h-3 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-rose-500"
                            />
                            <div className="flex justify-between text-xs font-bold text-slate-400 uppercase">
                                <span>Zen</span>
                                <span>High Stress</span>
                            </div>
                        </div>
                    )}

                    {step === 5 && (
                        <div className="space-y-6 text-center">
                            <h3 className="text-lg font-bold text-slate-800">Average Sleep (Hours)</h3>
                            <div className="text-4xl font-black text-indigo-500">{responses.sleep}h</div>
                            <input 
                                type="range" min="4" max="12" step="0.5"
                                value={responses.sleep} 
                                onChange={(e) => updateResponse('sleep', parseFloat(e.target.value))}
                                className="w-full h-3 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                        </div>
                    )}

                    {step === 6 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">Hydration Goal</h3>
                            {['Low (< 40oz)', 'Standard (64oz)', 'High (> 100oz)'].map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => updateResponse('hydration', opt)}
                                    className={`w-full p-4 rounded-2xl border-2 text-left font-bold transition-all ${responses.hydration === opt ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 hover:border-blue-200'}`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                    <button 
                        onClick={handleNext}
                        disabled={isSaving}
                        className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving ? 'Saving...' : step === totalSteps ? 'Complete Setup' : 'Next Step'}
                        {!isSaving && <ActivityIcon className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
};
