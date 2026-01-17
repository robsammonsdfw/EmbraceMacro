
import React, { useState, useEffect, useMemo } from 'react';
import { XIcon, CheckIcon, RefreshIcon, ClipboardListIcon } from './icons';
import { MEDICAL_INTAKE_QUESTIONS, IntakeQuestion, SECTIONS } from '../data/medicalQuestions';
import * as apiService from '../services/apiService';

interface MedicalIntakeWizardProps {
    onClose: () => void;
}

export const MedicalIntakeWizard: React.FC<MedicalIntakeWizardProps> = ({ onClose }) => {
    const [view, setView] = useState<'HUB' | 'WIZARD'>('HUB');
    const [selectedSection, setSelectedSection] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    
    // Load initial state
    useEffect(() => {
        const loadState = async () => {
            try {
                const { data } = await apiService.getMedicalIntake();
                setAnswers(data);
            } catch (e) {
                console.error("Failed to load intake state", e);
            } finally {
                setIsLoading(false);
            }
        };
        loadState();
    }, []);

    // Calculate progress per section
    const progressData = useMemo(() => {
        const sections = Object.values(SECTIONS);
        return sections.map(section => {
            const questions = MEDICAL_INTAKE_QUESTIONS.filter(q => q.section === section);
            const answeredCount = questions.filter(q => answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== '').length;
            const total = questions.length;
            const percent = total === 0 ? 0 : Math.round((answeredCount / total) * 100);
            return { section, percent, total, answeredCount };
        });
    }, [answers]);

    const handleSectionClick = (section: string) => {
        setSelectedSection(section);
        setView('WIZARD');
    };

    const handleSaveAnswer = async (questionId: string, value: any) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
        // We save step as 0 because in Hub mode, step doesn't matter as much as the data
        await apiService.updateMedicalIntake(0, questionId, value);
    };

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center">
                <div className="bg-white p-8 rounded-2xl shadow-xl flex flex-col items-center">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="font-bold text-slate-700">Loading profile...</p>
                </div>
            </div>
        );
    }

    // --- VIEW: SECTION HUB ---
    if (view === 'HUB') {
        const totalProgress = Math.round(progressData.reduce((acc, curr) => acc + curr.percent, 0) / progressData.length);

        return (
            <div className="fixed inset-0 bg-slate-50 z-[100] flex flex-col animate-fade-in">
                <div className="px-6 py-4 bg-white border-b border-slate-100 flex justify-between items-center shadow-sm sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Medical Intake Hub</h2>
                        <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${totalProgress}%` }}></div>
                            </div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{totalProgress}% Complete</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
                        <XIcon />
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto p-6">
                    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {progressData.map((item) => (
                            <button 
                                key={item.section}
                                onClick={() => handleSectionClick(item.section)}
                                className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all text-left group relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                                    <ClipboardListIcon className="w-24 h-24" />
                                </div>
                                <div className="relative z-10">
                                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide mb-2 min-h-[40px] flex items-center">
                                        {item.section}
                                    </h3>
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-xs text-slate-500 font-medium">{item.answeredCount} / {item.total} Questions</p>
                                        </div>
                                        <div className={`text-xl font-black ${item.percent === 100 ? 'text-emerald-500' : 'text-indigo-600'}`}>
                                            {item.percent}%
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                                        <div className={`h-full transition-all duration-500 ${item.percent === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${item.percent}%` }}></div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // --- VIEW: WIZARD FOR SECTION ---
    return (
        <SectionWizard 
            section={selectedSection!} 
            onBack={() => setView('HUB')}
            answers={answers}
            onAnswer={handleSaveAnswer}
        />
    );
};

// Sub-component for answering questions linearly within a section
const SectionWizard: React.FC<{ 
    section: string; 
    onBack: () => void; 
    answers: Record<string, any>;
    onAnswer: (id: string, val: any) => Promise<void>;
}> = ({ section, onBack, answers, onAnswer }) => {
    
    // Filter questions for this section
    const questions = useMemo(() => MEDICAL_INTAKE_QUESTIONS.filter(q => q.section === section), [section]);
    
    // Find first unanswered question index, default to 0
    const firstUnanswered = questions.findIndex(q => !answers[q.id]);
    const [currentIndex, setCurrentIndex] = useState(firstUnanswered === -1 ? 0 : firstUnanswered);
    const [isSaving, setIsSaving] = useState(false);

    const question = questions[currentIndex];
    const isLast = currentIndex === questions.length - 1;

    const handleNext = async (val: any) => {
        setIsSaving(true);
        await onAnswer(question.id, val);
        setIsSaving(false);
        
        if (isLast) {
            onBack();
        } else {
            setCurrentIndex(prev => prev + 1);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-50 z-[110] flex flex-col animate-fade-in">
            <div className="px-6 py-4 bg-white border-b border-slate-100 flex justify-between items-center shadow-sm">
                <div>
                    <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">{section}</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Question {currentIndex + 1} of {questions.length}</p>
                </div>
                <button onClick={onBack} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-slate-200">
                    Back to Hub
                </button>
            </div>

            <div className="h-1 w-full bg-slate-100">
                <div 
                    className="h-full bg-indigo-600 transition-all duration-300 ease-out" 
                    style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                ></div>
            </div>

            <div className="flex-grow flex items-center justify-center p-6 overflow-y-auto">
                <div className="w-full max-w-xl">
                    <h3 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2 leading-tight">{question.text}</h3>
                    {question.subtext && <p className="text-slate-500 mb-6 font-medium">{question.subtext}</p>}

                    <div className="space-y-4 mt-6">
                        {question.type === 'text' && (
                            <form onSubmit={(e) => { e.preventDefault(); const val = (e.currentTarget.elements[0] as HTMLInputElement).value; if(val) handleNext(val); }}>
                                <input 
                                    defaultValue={answers[question.id] || ''}
                                    type="text" autoFocus className="w-full p-5 text-lg border-2 border-slate-200 rounded-2xl focus:border-indigo-500 outline-none transition-all font-medium text-slate-800" placeholder="Type your answer..." 
                                />
                                <NextButton isSaving={isSaving} />
                            </form>
                        )}

                        {question.type === 'number' && (
                            <form onSubmit={(e) => { e.preventDefault(); const val = (e.currentTarget.elements[0] as HTMLInputElement).value; if(val) handleNext(parseInt(val)); }}>
                                <input 
                                    defaultValue={answers[question.id] || ''}
                                    type="number" autoFocus className="w-full p-5 text-lg border-2 border-slate-200 rounded-2xl focus:border-indigo-500 outline-none transition-all font-medium text-slate-800" placeholder="0" 
                                />
                                <NextButton isSaving={isSaving} />
                            </form>
                        )}

                        {question.type === 'date' && (
                            <form onSubmit={(e) => { e.preventDefault(); const val = (e.currentTarget.elements[0] as HTMLInputElement).value; if(val) handleNext(val); }}>
                                <input 
                                    defaultValue={answers[question.id] || ''}
                                    type="date" className="w-full p-5 text-lg border-2 border-slate-200 rounded-2xl focus:border-indigo-500 outline-none font-medium text-slate-800" 
                                />
                                <NextButton isSaving={isSaving} />
                            </form>
                        )}

                        {question.type === 'choice' && question.options?.map(opt => (
                            <button 
                                key={opt} 
                                onClick={() => handleNext(opt)}
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

                        {question.type === 'scale' && (
                            <div className="space-y-6">
                                <div className="flex justify-between font-bold text-xs uppercase text-slate-400">
                                    <span>0 (Never/None)</span>
                                    <span>4 (Severe/Frequent)</span>
                                </div>
                                <div className="flex justify-between gap-2">
                                    {[0, 1, 2, 3, 4].map(val => (
                                        <button
                                            key={val}
                                            onClick={() => handleNext(val)}
                                            className={`flex-1 py-6 rounded-2xl font-black text-xl border-2 transition-all ${
                                                answers[question.id] === val 
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' 
                                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-400'
                                            }`}
                                        >
                                            {val}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {question.type === 'multiselect' && (
                            <MultiSelect 
                                options={question.options || []} 
                                initialSelected={answers[question.id] || []}
                                onSubmit={handleNext} 
                                isSaving={isSaving} 
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const NextButton: React.FC<{ isSaving: boolean }> = ({ isSaving }) => (
    <button type="submit" disabled={isSaving} className="mt-6 w-full bg-slate-900 text-white font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-black transition-all shadow-lg active:scale-95 disabled:opacity-50">
        {isSaving ? 'Saving...' : 'Next'}
    </button>
);

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
            <div className="grid grid-cols-1 gap-3 max-h-[50vh] overflow-y-auto pr-2">
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
                className="mt-6 w-full bg-slate-900 text-white font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-black transition-all disabled:opacity-50 shadow-lg"
            >
                Confirm Selection ({selected.length})
            </button>
        </>
    );
};
