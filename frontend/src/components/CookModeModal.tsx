
import React, { useState } from 'react';
import { XIcon } from './icons';
import type { Recipe } from '../types';

interface CookModeModalProps {
    recipe: Recipe;
    onClose: () => void;
}

export const CookModeModal: React.FC<CookModeModalProps> = ({ recipe, onClose }) => {
    const [activeStep, setActiveStep] = useState(0);
    const [fontSize, setFontSize] = useState(1); // Scale factor

    const nextStep = () => {
        if (activeStep < recipe.instructions.length - 1) setActiveStep(prev => prev + 1);
    };

    const prevStep = () => {
        if (activeStep > 0) setActiveStep(prev => prev - 1);
    };

    return (
        <div className="fixed inset-0 bg-slate-900 z-[80] flex flex-col animate-fade-in text-white">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-slate-800">
                <h2 className="text-2xl font-bold truncate pr-4">{recipe.recipeName}</h2>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-700 rounded-lg p-1">
                        <button onClick={() => setFontSize(Math.max(0.8, fontSize - 0.2))} className="px-3 py-1 text-sm font-bold">A-</button>
                        <button onClick={() => setFontSize(Math.min(2.0, fontSize + 0.2))} className="px-3 py-1 text-lg font-bold">A+</button>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full">
                        <XIcon />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
                {/* Ingredients Sidebar (Desktop) / Drawer (Mobile) */}
                <div className="w-full md:w-1/4 bg-slate-800 p-6 overflow-y-auto border-r border-slate-700 hidden md:block">
                    <h3 className="text-emerald-400 font-bold uppercase tracking-wider mb-4">Ingredients</h3>
                    <ul className="space-y-3">
                        {recipe.ingredients.map((ing, i) => (
                            <li key={i} className="flex justify-between text-slate-300 text-lg">
                                <span>{ing.name}</span>
                                <span className="font-bold text-white">{ing.quantity}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Active Step Display */}
                <div className="flex-grow flex flex-col items-center justify-center p-8 md:p-16 text-center relative">
                    <div className="max-w-4xl">
                        <span className="text-emerald-500 font-bold uppercase tracking-widest text-sm md:text-base mb-4 block">
                            Step {activeStep + 1} of {recipe.instructions.length}
                        </span>
                        <p 
                            className="font-serif font-medium leading-relaxed transition-all duration-300"
                            style={{ fontSize: `${2.5 * fontSize}rem` }}
                        >
                            {recipe.instructions[activeStep]}
                        </p>
                    </div>
                </div>
            </div>

            {/* Footer Navigation */}
            <div className="p-6 bg-slate-800 border-t border-slate-700 flex justify-between items-center">
                <button 
                    onClick={prevStep}
                    disabled={activeStep === 0}
                    className="px-8 py-4 rounded-xl font-bold text-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                    Previous
                </button>

                <div className="flex gap-2">
                    {recipe.instructions.map((_, i) => (
                        <div 
                            key={i} 
                            className={`w-3 h-3 rounded-full transition-all ${i === activeStep ? 'bg-emerald-500 scale-125' : 'bg-slate-600'}`}
                        />
                    ))}
                </div>

                <button 
                    onClick={nextStep}
                    disabled={activeStep === recipe.instructions.length - 1}
                    className="px-8 py-4 rounded-xl font-bold text-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-900/20"
                >
                    {activeStep === recipe.instructions.length - 1 ? 'Finish' : 'Next Step'}
                </button>
            </div>
        </div>
    );
};
