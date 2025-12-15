
import React, { useState } from 'react';
import { CHRONIC_DISEASES, DiseaseTemplate } from '../data/chronicDiseases';
import { XIcon, BeakerIcon } from './icons';

interface MedicalPlannerModalProps {
    onClose: () => void;
    onGenerate: (diseases: DiseaseTemplate[], cuisine: string, duration: 'day' | 'week') => void;
    isLoading: boolean;
}

const CUISINES = ['American', 'Italian', 'Mexican', 'Asian', 'Mediterranean', 'Indian', 'French'];

export const MedicalPlannerModal: React.FC<MedicalPlannerModalProps> = ({ onClose, onGenerate, isLoading }) => {
    const [selectedDiseases, setSelectedDiseases] = useState<string[]>([]);
    const [cuisine, setCuisine] = useState<string>('American');
    const [duration, setDuration] = useState<'day' | 'week'>('day');

    const handleToggleDisease = (id: string) => {
        setSelectedDiseases(prev => 
            prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
        );
    };

    const handleConfirm = () => {
        const templates = CHRONIC_DISEASES.filter(d => selectedDiseases.includes(d.id));
        onGenerate(templates, cuisine, duration);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <BeakerIcon />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Medical AI Planner</h2>
                            <p className="text-blue-100 text-xs">Clinical-grade nutrition consolidation</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition">
                        <XIcon />
                    </button>
                </div>

                <div className="flex flex-col md:flex-row flex-grow overflow-hidden">
                    {/* Left: Disease List */}
                    <div className="w-full md:w-1/2 p-4 border-r border-slate-200 overflow-y-auto bg-slate-50">
                        <h3 className="font-bold text-slate-700 mb-3 sticky top-0 bg-slate-50 py-1 z-10">Select Conditions</h3>
                        <div className="space-y-2">
                            {CHRONIC_DISEASES.map(disease => (
                                <div 
                                    key={disease.id}
                                    onClick={() => handleToggleDisease(disease.id)}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                        selectedDiseases.includes(disease.id)
                                        ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 shadow-sm'
                                        : 'bg-white border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-slate-800 text-sm">{disease.name}</span>
                                        {selectedDiseases.includes(disease.id) && <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white"></div>}
                                    </div>
                                    <p className="text-xs text-slate-500 line-clamp-2">{disease.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Settings */}
                    <div className="w-full md:w-1/2 p-6 flex flex-col justify-between overflow-y-auto">
                        <div className="space-y-6">
                            <div>
                                <h3 className="font-bold text-slate-700 mb-2">Cuisine Preference</h3>
                                <select 
                                    value={cuisine}
                                    onChange={e => setCuisine(e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    {CUISINES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div>
                                <h3 className="font-bold text-slate-700 mb-2">Plan Duration</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setDuration('day')}
                                        className={`p-3 rounded-lg border text-center text-sm font-bold transition-all ${
                                            duration === 'day' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'
                                        }`}
                                    >
                                        Today (1 Day)
                                    </button>
                                    <button
                                        onClick={() => setDuration('week')}
                                        className={`p-3 rounded-lg border text-center text-sm font-bold transition-all ${
                                            duration === 'week' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'
                                        }`}
                                    >
                                        Whole Week
                                    </button>
                                </div>
                            </div>

                            {selectedDiseases.length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                                    <h4 className="text-amber-800 font-bold text-xs uppercase mb-2">Consolidation Logic</h4>
                                    <p className="text-amber-700 text-xs">
                                        AI will calculate the nutritional intersection of the selected {selectedDiseases.length} condition{selectedDiseases.length > 1 ? 's' : ''}, prioritizing the most restrictive safety constraints (e.g. low sodium, allergens) while balancing macronutrients.
                                    </p>
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={handleConfirm}
                            disabled={selectedDiseases.length === 0 || isLoading}
                            className="w-full mt-8 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Consolidating Logic...</span>
                                </>
                            ) : (
                                <>
                                    <BeakerIcon />
                                    <span>Generate Plan</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
