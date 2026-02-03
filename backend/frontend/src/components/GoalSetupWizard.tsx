
import React, { useState, useEffect } from 'react';
import { XIcon, ActivityIcon, CheckIcon, GlobeAltIcon } from './icons';

interface GoalSetupWizardProps {
    onClose: () => void;
    onSave: (calorieGoal: number, proteinGoal: number) => void;
}

type UnitSystem = 'metric' | 'imperial';

export const GoalSetupWizard: React.FC<GoalSetupWizardProps> = ({ onClose, onSave }) => {
    const [step, setStep] = useState(1);
    const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
    
    const [formData, setFormData] = useState({
        age: 30,
        gender: 'male',
        activity: 1.2,
        // Metric defaults
        weightKg: 75,
        heightCm: 175,
        // Imperial defaults (mirrored)
        weightLbs: 165,
        heightFt: 5,
        heightIn: 9
    });

    // Auto-detect units based on location/locale
    useEffect(() => {
        try {
            const locale = Intl.DateTimeFormat().resolvedOptions().locale;
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            
            // Heuristic for Imperial usage (USA, Liberia, Myanmar)
            if (locale.includes('US') || timeZone.includes('America/New_York') || timeZone.includes('America/Chicago') || timeZone.includes('America/Los_Angeles')) {
                setUnitSystem('imperial');
            }
        } catch (e) {
            console.warn("Unit detection failed, defaulting to Metric.");
        }
    }, []);

    const calculateTDEE = () => {
        let weight = formData.weightKg;
        let height = formData.heightCm;

        if (unitSystem === 'imperial') {
            // Convert to Metric for MSJ Equation
            weight = formData.weightLbs / 2.20462;
            height = (formData.heightFt * 30.48) + (formData.heightIn * 2.54);
        }

        // Mifflin-St Jeor Equation
        let bmr = (10 * weight) + (6.25 * height) - (5 * formData.age);
        bmr = formData.gender === 'male' ? bmr + 5 : bmr - 161;
        const tdee = Math.round(bmr * formData.activity);
        const protein = Math.round(weight * 1.8); // 1.8g per kg of bodyweight
        return { tdee, protein };
    };

    const handleSave = () => {
        const { tdee, protein } = calculateTDEE();
        onSave(tdee, protein);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-end md:items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-xl font-black text-slate-900">Goal Architect</h2>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Macro-Setup Wizard</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><XIcon /></button>
                </div>

                {/* Unit Switcher */}
                <div className="bg-slate-100 p-1 flex m-4 rounded-xl border border-slate-200">
                    <button 
                        onClick={() => setUnitSystem('metric')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${unitSystem === 'metric' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Metric (kg/cm)
                    </button>
                    <button 
                        onClick={() => setUnitSystem('imperial')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${unitSystem === 'imperial' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Imperial (lb/ft)
                    </button>
                </div>

                <div className="p-8 pt-2">
                    {step === 1 && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <GlobeAltIcon className="w-5 h-5 text-indigo-500" />
                                Biometric Baseline
                            </h3>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Age</label>
                                    <input type="number" value={formData.age} onChange={e => setFormData({...formData, age: parseInt(e.target.value)})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Gender</label>
                                    <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold">
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                    </select>
                                </div>
                            </div>

                            {unitSystem === 'metric' ? (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Weight (kg)</label>
                                        <input type="number" value={formData.weightKg} onChange={e => setFormData({...formData, weightKg: parseInt(e.target.value)})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Height (cm)</label>
                                        <input type="number" value={formData.heightCm} onChange={e => setFormData({...formData, heightCm: parseInt(e.target.value)})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold" />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Weight (lbs)</label>
                                        <input type="number" value={formData.weightLbs} onChange={e => setFormData({...formData, weightLbs: parseInt(e.target.value)})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Height (ft)</label>
                                            <input type="number" value={formData.heightFt} onChange={e => setFormData({...formData, heightFt: parseInt(e.target.value)})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Inches</label>
                                            <input type="number" value={formData.heightIn} onChange={e => setFormData({...formData, heightIn: parseInt(e.target.value)})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <button onClick={() => setStep(2)} className="w-full py-4 bg-slate-900 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg active:scale-95 transition-all">Next Step</button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-slate-800">Activity Level</h3>
                            <div className="space-y-3">
                                {[
                                    { label: 'Sedentary', val: 1.2, desc: 'Office job, little to no exercise' },
                                    { label: 'Lightly Active', val: 1.375, desc: '1-3 days of exercise/week' },
                                    { label: 'Moderately Active', val: 1.55, desc: '3-5 days of exercise/week' },
                                    { label: 'Very Active', val: 1.725, desc: '6-7 days of intense sport/week' }
                                ].map(opt => (
                                    <button 
                                        key={opt.val} 
                                        onClick={() => setFormData({...formData, activity: opt.val})}
                                        className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${formData.activity === opt.val ? 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-50' : 'border-slate-100 hover:bg-slate-50'}`}
                                    >
                                        <p className="font-black text-slate-900 text-sm">{opt.label}</p>
                                        <p className="text-xs text-slate-500">{opt.desc}</p>
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setStep(1)} className="flex-1 py-4 border-2 rounded-2xl font-black text-slate-400 uppercase tracking-widest text-xs">Back</button>
                                <button onClick={() => setStep(3)} className="flex-[2] py-4 bg-slate-900 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-lg active:scale-95 transition-all">Analyze Profile</button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-8 py-4">
                            <div className="text-center">
                                <div className="mx-auto w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                                    <ActivityIcon className="w-8 h-8" />
                                </div>
                                <h3 className="text-2xl font-black text-slate-900">Metabolic Logic</h3>
                                <p className="text-slate-500 text-sm font-medium">Calculation complete. Your customized blueprint is ready.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] text-center border border-slate-700 shadow-xl">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-1">Energy Target</p>
                                    <p className="text-4xl font-black">{calculateTDEE().tdee}</p>
                                    <p className="text-xs font-bold opacity-60">KCAL / DAY</p>
                                </div>
                                <div className="bg-indigo-600 text-white p-6 rounded-[2.5rem] text-center border border-indigo-500 shadow-xl">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200 mb-1">Anabolic Cap</p>
                                    <p className="text-4xl font-black">{calculateTDEE().protein}g</p>
                                    <p className="text-xs font-bold opacity-60">PRO / DAY</p>
                                </div>
                            </div>

                            <button onClick={handleSave} className="w-full py-5 bg-emerald-500 text-white font-black uppercase tracking-[0.2em] rounded-[2rem] shadow-xl shadow-emerald-200 flex items-center justify-center gap-3 active:scale-95 transition-all">
                                <CheckIcon /> Commit to Goals
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <style>{`
                @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
                .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            `}</style>
        </div>
    );
};
