
import React, { useState, useEffect } from 'react';
import { XIcon, CheckIcon, RefreshIcon } from './icons';
import { MEDICAL_INTAKE_QUESTIONS, IntakeQuestion } from '../data/medicalQuestions';
import * as apiService from '../services/apiService';

interface MedicalIntakeWizardProps {
    onClose: () => void;
}

export const MedicalIntakeWizard: React.FC<MedicalIntakeWizardProps> = ({ onClose }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    
    // Load initial state
    useEffect(() => {
        const loadState = async () => {
            try {
                const { step, data } = await apiService.getMedicalIntake();
                // Ensure step is within bounds
                const safeStep = Math.min(Math.max(0, step), MEDICAL_INTAKE_QUESTIONS.length);
                setCurrentStep(safeStep);
                setAnswers(data);
            } catch (e) {
                console.error("Failed to load intake state", e);
            } finally {
                setIsLoading(false);
            }
        };
        loadState();
    }, []);

    const handleAnswer = async (value: any) => {
        const question = MEDICAL_INTAKE_QUESTIONS[currentStep];
        const nextStep = currentStep + 1;
        
        setIsSaving(true);
        
        // Update local state immediately for UI responsiveness
        setAnswers(prev => ({ ...prev, [question.id]: value }));

        try {
            await apiService.updateMedicalIntake(nextStep, question.id, value);
            
            // Move to next step if not finished
            if (nextStep < MEDICAL_INTAKE_QUESTIONS.length) {
                setCurrentStep(nextStep);
            } else {
                // Completed
                onClose();
                alert("Medical Intake Completed!");
            }
        } catch (e) {
            alert("Failed to save answer. Please check your connection.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = async () => {
        if (!window.confirm("Are you sure? This will clear your previous answers.")) return;
        setIsLoading(true);
        try {
            await apiService.updateMedicalIntake(0, '', '', true);
            setCurrentStep(0);
            setAnswers({});
        } catch (e) {
            alert("Failed to reset.");
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center">
                <div className="bg-white p-8 rounded-2xl shadow-xl flex flex-col items-center">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="font-bold text-slate-700">Loading your file...</p>
                </div>
            </div>
        );
    }

    // Explicitly using IntakeQuestion type
    const question: IntakeQuestion = MEDICAL_INTAKE_QUESTIONS[currentStep];
    const isComplete = currentStep >= MEDICAL_INTAKE_QUESTIONS.length;

    // Render Completion Screen
    if (isComplete) {
        return (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 text-center shadow-2xl relative">
                    <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full"><XIcon /></button>
                    <div className="mx-auto w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                        <CheckIcon className="w-12 h-12" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 mb-2">All Set!</h2>
                    <p className="text-slate-500 font-medium mb-8">Your medical intake form is complete and securely stored.</p>
                    <button onClick={onClose} className="bg-emerald-500 text-white font-black uppercase tracking-widest py-4 px-8 rounded-2xl hover:bg-emerald-600 transition-all shadow-lg">
                        Return to Dashboard
                    </button>
                    <button onClick={handleReset} className="block w-full mt-4 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600">
                        Start Over
                    </button>
                </div>
            </div>
        );
    }

    // Render Question
    return (
        <div className="fixed inset-0 bg-slate-50 z-[100] flex flex-col animate-fade-in">
            {/* Header */}
            <div className="px-6 py-4 bg-white border-b border-slate-100 flex justify-between items-center shadow-sm">
                <div>
                    <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Medical Intake</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{question.section}</p>
                </div>
                <div className="flex gap-2">
                    {currentStep > 0 && (
                        <button onClick={handleReset} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full" title="Start Over">
                            <RefreshIcon />
                        </button>
                    )}
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
                        <XIcon />
                    </button>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="h-1.5 w-full bg-slate-100">
                <div 
                    className="h-full bg-indigo-600 transition-all duration-500 ease-out" 
                    style={{ width: `${((currentStep) / MEDICAL_INTAKE_QUESTIONS.length) * 100}%` }}
                ></div>
            </div>

            {/* Main Content */}
            <div className="flex-grow flex items-center justify-center p-6 overflow-y-auto">
                <div className="w-full max-w-xl">
                    <h3 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8 leading-tight">{question.text}</h3>

                    <div className="space-y-4">
                        {question.type === 'text' && (
                            <form onSubmit={(e) => { e.preventDefault(); const val = (e.currentTarget.elements[0] as HTMLInputElement).value; if(val) handleAnswer(val); }}>
                                {/* Using answers state to pre-fill if navigating back */}
                                <input 
                                    key={question.id} 
                                    type="text" 
                                    autoFocus 
                                    defaultValue={answers[question.id] || ''}
                                    className="w-full p-5 text-lg border-2 border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-medium text-slate-800 placeholder-slate-300" 
                                    placeholder="Type your answer..." 
                                />
                                <button type="submit" disabled={isSaving} className="mt-4 w-full bg-slate-900 text-white font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-black transition-all">Next</button>
                            </form>
                        )}

                        {question.type === 'number' && (
                            <form onSubmit={(e) => { e.preventDefault(); const val = (e.currentTarget.elements[0] as HTMLInputElement).value; if(val) handleAnswer(parseInt(val)); }}>
                                <input 
                                    key={question.id}
                                    type="number" 
                                    autoFocus 
                                    defaultValue={answers[question.id] || ''}
                                    className="w-full p-5 text-lg border-2 border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-medium text-slate-800" 
                                    placeholder="0" 
                                />
                                <button type="submit" disabled={isSaving} className="mt-4 w-full bg-slate-900 text-white font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-black transition-all">Next</button>
                            </form>
                        )}

                        {question.type === 'date' && (
                            <form onSubmit={(e) => { e.preventDefault(); const val = (e.currentTarget.elements[0] as HTMLInputElement).value; if(val) handleAnswer(val); }}>
                                <input 
                                    key={question.id}
                                    type="date" 
                                    defaultValue={answers[question.id] || ''}
                                    className="w-full p-5 text-lg border-2 border-slate-200 rounded-2xl focus:border-indigo-500 outline-none font-medium text-slate-800" 
                                />
                                <button type="submit" disabled={isSaving} className="mt-4 w-full bg-slate-900 text-white font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-black transition-all">Next</button>
                            </form>
                        )}

                        {question.type === 'choice' && question.options?.map(opt => (
                            <button 
                                key={opt} 
                                onClick={() => handleAnswer(opt)}
                                disabled={isSaving}
                                className={`w-full p-5 text-left text-lg font-bold rounded-2xl border-2 transition-all shadow-sm active:scale-[0.98] ${
                                    answers[question.id] === opt 
                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                                    : 'bg-white border-slate-100 text-slate-700 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-700'
                                }`}
                            >
                                {opt}
                            </button>
                        ))}

                        {question.type === 'multiselect' && (
                            <MultiSelect 
                                key={question.id}
                                options={question.options || []} 
                                initialSelected={answers[question.id] || []}
                                onSubmit={handleAnswer} 
                                isSaving={isSaving} 
                            />
                        )}
                    </div>
                </div>
            </div>
            
            {/* Footer Status */}
            <div className="p-4 text-center text-xs font-bold text-slate-300 uppercase tracking-widest">
                Question {currentStep + 1} of {MEDICAL_INTAKE_QUESTIONS.length}
            </div>
        </div>
    );
};

// Sub-component for MultiSelect to manage internal state before submitting
const MultiSelect: React.FC<{ 
    options: string[]; 
    initialSelected: string[];
    onSubmit: (val: string[]) => void; 
    isSaving: boolean 
}> = ({ options, initialSelected, onSubmit, isSaving }) => {
    const [selected, setSelected] = useState<string[]>(initialSelected);

    const toggle = (opt: string) => {
        setSelected(prev => prev.includes(opt) ? prev.filter(p => p !== opt) : [...prev, opt]);
    };

    return (
        <>
            <div className="grid grid-cols-1 gap-3">
                {options.map(opt => (
                    <button 
                        key={opt}
                        onClick={() => toggle(opt)}
                        className={`w-full p-4 text-left text-base font-bold rounded-2xl border-2 transition-all ${
                            selected.includes(opt) 
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md' 
                            : 'border-slate-100 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <div className="flex justify-between items-center">
                            <span>{opt}</span>
                            {selected.includes(opt) && <CheckIcon className="w-5 h-5" />}
                        </div>
                    </button>
                ))}
            </div>
            <button 
                onClick={() => onSubmit(selected)}
                disabled={isSaving}
                className="mt-6 w-full bg-slate-900 text-white font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-black transition-all disabled:opacity-50"
            >
                Confirm Selection ({selected.length})
            </button>
        </>
    );
};
