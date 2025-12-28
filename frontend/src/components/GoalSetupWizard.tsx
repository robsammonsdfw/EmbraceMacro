import React, { useState } from 'react';
import { XIcon, ActivityIcon, CheckIcon } from './icons';

interface GoalSetupWizardProps {
    onClose: () => void;
    onSave: (calorieGoal: number, proteinGoal: number) => void;
}

export const GoalSetupWizard: React.FC<GoalSetupWizardProps> = ({ onClose, onSave }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        age: 30,
        weightKg: 75,
        heightCm: 175,
        gender: 'male',
        activity: 1.2 // Sedentary
    });

    const calculateTDEE = () => {
        // Mifflin-St Jeor Equation
        const { age, weightKg, heightCm, gender, activity } = formData;
        let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
        bmr = gender === 'male' ? bmr + 5 : bmr - 161;
        const tdee = Math.round(bmr * activity);
        const protein = Math.round(weightKg * 1.8); // High protein recommendation (1.8g/kg)
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

                <div className="p-8">
                    {step === 1 && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-slate-800">Biometric Baseline</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">Age</label>
                                    <input type="number" value={formData.age} onChange={e => setFormData({...formData, age: parseInt(e.target.value)})} className="w-full p-3 bg-slate-50 border rounded-xl" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">Gender</label>
                                    <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl">
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">Weight (kg)</label>
                                    <input type="number" value={formData.weightKg} onChange={e => setFormData({...formData, weightKg: parseInt(e.target.value)})} className="w-full p-3 bg-slate-50 border rounded-xl" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">Height (cm)</label>
                                    <input type="number" value={formData.heightCm} onChange={e => setFormData({...formData, heightCm: parseInt(e.target.value)})} className="w-full p-3 bg-slate-50 border rounded-xl" />
                                </div>
                            </div>
                            <button onClick={() => setStep(2)} className="w-full py-4 bg-slate-900 text-white font-black uppercase rounded-2xl">Next Step</button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-slate-800">Activity Level</h3>
                            <div className="space-y-3">
                                {[
                                    { label: 'Sedentary', val: 1.2, desc: 'Little to no exercise' },
                                    { label: 'Lightly Active', val: 1.375, desc: '1-3 days/week' },
                                    { label: 'Moderately Active', val: 1.55, desc: '3-5 days/week' },
                                    { label: 'Very Active', val: 1.725, desc: '6-7 days/week' }
                                ].map(opt => (
                                    <button 
                                        key={opt.val} 
                                        onClick={() => setFormData({...formData, activity: opt.val})}
                                        className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${formData.activity === opt.val ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 hover:bg-slate-50'}`}
                                    >
                                        <p className="font-black text-slate-900 text-sm">{opt.label}</p>
                                        <p className="text-xs text-slate-500">{opt.desc}</p>
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setStep(1)} className="flex-1 py-4 border-2 rounded-2xl font-black text-slate-400 uppercase">Back</button>
                                <button onClick={() => setStep(3)} className="flex-[2] py-4 bg-slate-900 text-white font-black uppercase rounded-2xl">Analyze</button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-8 py-4">
                            <div className="text-center">
                                <div className="mx-auto w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                                    <ActivityIcon className="w-8 h-8" />
                                </div>
                                <h3 className="text-2xl font-black text-slate-900">Your AI Blueprint</h3>
                                <p className="text-slate-500 text-sm font-medium">Calculated based on your TDEE and Metabolic Profile.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-900 text-white p-6 rounded-[2rem] text-center">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Daily Target</p>
                                    <p className="text-4xl font-black">{calculateTDEE().tdee}</p>
                                    <p className="text-xs font-bold opacity-60">KCAL</p>
                                </div>
                                <div className="bg-indigo-600 text-white p-6 rounded-[2rem] text-center">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-1">Protein Target</p>
                                    <p className="text-4xl font-black">{calculateTDEE().protein}g</p>
                                    <p className="text-xs font-bold opacity-60">MUSCLE FUEL</p>
                                </div>
                            </div>

                            <button onClick={handleSave} className="w-full py-5 bg-emerald-500 text-white font-black uppercase tracking-widest rounded-3xl shadow-xl shadow-emerald-200 flex items-center justify-center gap-3">
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