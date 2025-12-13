
import React, { useState } from 'react';
import type { Assessment } from '../../types';
import { XIcon } from '../icons';

interface TestRunnerProps {
    assessment: Assessment;
    onComplete: (responses: Record<string, any>) => void;
    onClose: () => void;
}

export const TestRunner: React.FC<TestRunnerProps> = ({ assessment, onComplete, onClose }) => {
    const [responses, setResponses] = useState<Record<string, any>>({});
    const [currentStep, setCurrentStep] = useState(0);

    const questions = assessment.questions;
    const currentQuestion = questions[currentStep];

    const handleNext = () => {
        if (currentStep < questions.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onComplete(responses);
        }
    };

    const handleAnswer = (value: any) => {
        setResponses(prev => ({ ...prev, [currentQuestion.id]: value }));
    };

    const isCurrentAnswered = responses[currentQuestion.id] !== undefined;

    return (
        <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col items-center justify-center animate-fade-in p-4">
            <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white rounded-full shadow hover:bg-slate-100">
                <XIcon />
            </button>

            <div className="max-w-xl w-full">
                {/* Progress */}
                <div className="mb-8">
                    <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-emerald-500 transition-all duration-300"
                            style={{ width: `${((currentStep + 1) / questions.length) * 100}%` }}
                        ></div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 text-right">Question {currentStep + 1} of {questions.length}</p>
                </div>

                {/* Question */}
                <h2 className="text-2xl font-bold text-slate-800 mb-6">{currentQuestion.text}</h2>

                <div className="space-y-4">
                    {currentQuestion.type === 'choice' && currentQuestion.options?.map((opt, i) => (
                        <button
                            key={i}
                            onClick={() => handleAnswer(opt.value)}
                            className={`w-full p-4 rounded-xl border text-left transition-all ${
                                responses[currentQuestion.id] === opt.value
                                ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                                : 'border-slate-200 hover:border-slate-300 hover:bg-white'
                            }`}
                        >
                            <span className="font-semibold text-slate-700">{opt.label}</span>
                        </button>
                    ))}

                    {currentQuestion.type === 'boolean' && (
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => handleAnswer(true)} className={`p-6 rounded-xl border font-bold ${responses[currentQuestion.id] === true ? 'bg-emerald-50 border-emerald-500' : 'bg-white'}`}>Yes</button>
                            <button onClick={() => handleAnswer(false)} className={`p-6 rounded-xl border font-bold ${responses[currentQuestion.id] === false ? 'bg-emerald-50 border-emerald-500' : 'bg-white'}`}>No</button>
                        </div>
                    )}

                    {currentQuestion.type === 'scale' && (
                        <div>
                             <input 
                                type="range" 
                                min={currentQuestion.min} 
                                max={currentQuestion.max} 
                                value={responses[currentQuestion.id] || (currentQuestion.max! / 2)}
                                onChange={(e) => handleAnswer(parseFloat(e.target.value))}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                             />
                             <div className="flex justify-between text-sm text-slate-500 mt-2">
                                <span>Low ({currentQuestion.min})</span>
                                <span className="font-bold text-emerald-600 text-lg">{responses[currentQuestion.id] || '-'}</span>
                                <span>High ({currentQuestion.max})</span>
                             </div>
                        </div>
                    )}
                </div>

                <div className="mt-10 flex justify-end">
                    <button
                        onClick={handleNext}
                        disabled={!isCurrentAnswered}
                        className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {currentStep === questions.length - 1 ? 'Finish' : 'Next'}
                    </button>
                </div>
            </div>
        </div>
    );
};
