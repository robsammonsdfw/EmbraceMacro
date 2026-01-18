
import React, { useState, useEffect } from 'react';
import { CHRONIC_DISEASES, DiseaseTemplate } from '../data/chronicDiseases';
import { XIcon, BeakerIcon, TrophyIcon, StarIcon } from './icons';

interface MedicalPlannerModalProps {
    onClose: () => void;
    onGenerate: (diseases: DiseaseTemplate[], cuisine: string, duration: 'day' | 'week') => void;
    isLoading: boolean;
    progress?: number;
    status?: string;
    recommendations?: any[];
    initialDiseases?: string[]; // Array of disease IDs
}

const CUISINES = ['American', 'Italian', 'Mexican', 'Asian', 'Mediterranean', 'Indian', 'French'];

export const MedicalPlannerModal: React.FC<MedicalPlannerModalProps> = ({ 
    onClose, onGenerate, isLoading, progress = 0, status = '', recommendations = [], initialDiseases = []
}) => {
    const [selectedDiseases, setSelectedDiseases] = useState<string[]>(initialDiseases);
    const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null); // For recommended flow
    const [cuisine, setCuisine] = useState<string>('American');
    const [duration, setDuration] = useState<'day' | 'week'>('day');

    // If recommendations exist, default view is "Recommended" mode. 
    // If initialDiseases exist (from Article), force "manual" mode.
    const hasRecommendations = recommendations.length > 0;
    const [viewMode, setViewMode] = useState<'recommended' | 'manual'>(
        hasRecommendations && initialDiseases.length === 0 ? 'recommended' : 'manual'
    );

    useEffect(() => {
        if (initialDiseases.length > 0) {
            setSelectedDiseases(initialDiseases);
            setViewMode('manual');
        }
    }, [initialDiseases]);

    const handleToggleDisease = (id: string) => {
        setSelectedDiseases(prev => 
            prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
        );
    };

    const handleConfirm = () => {
        let diseasesToUse: DiseaseTemplate[] = [];

        if (viewMode === 'recommended' && selectedOptionId) {
            // Find the selected option in the recommendations structure
            let foundOption: any = null;
            recommendations.forEach(rec => {
                const opt = rec.options.find((o: any) => o.profileId === selectedOptionId);
                if (opt) foundOption = opt;
            });

            if (foundOption) {
                // Convert to DiseaseTemplate format for the generator
                diseasesToUse = [{
                    id: foundOption.profileId,
                    name: foundOption.profileName,
                    macros: foundOption.macros,
                    description: foundOption.description || 'Prescribed Plan',
                    focus: foundOption.focus || 'Balanced'
                }];
            }
        } else {
            // Manual selection
            // Map selected IDs to full DiseaseTemplate objects based on CHRONIC_DISEASES data
            // Also supports custom IDs passed via initialDiseases that might map to existing templates
            diseasesToUse = CHRONIC_DISEASES.filter(d => 
                selectedDiseases.some(sel => sel.toLowerCase() === d.id.toLowerCase() || sel.toLowerCase() === d.name.toLowerCase())
            );
        }

        onGenerate(diseasesToUse, cuisine, duration);
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
                    {!isLoading && (
                        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition">
                            <XIcon />
                        </button>
                    )}
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-12 space-y-6">
                        <div className="relative w-24 h-24">
                            <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                            <div 
                                className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"
                            ></div>
                            <div className="absolute inset-0 flex items-center justify-center font-bold text-indigo-600 text-lg">
                                {progress}%
                            </div>
                        </div>
                        <div className="text-center max-w-xs">
                            <h3 className="font-bold text-slate-800 text-lg mb-1">Generating Plan</h3>
                            <p className="text-slate-500 text-sm animate-pulse">{status || 'Orchestrating meal logic...'}</p>
                        </div>
                        <div className="w-full max-w-sm bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div 
                                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-500 ease-out" 
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col md:flex-row flex-grow overflow-hidden">
                        {/* Left: Selection Area */}
                        <div className="w-full md:w-1/2 p-4 border-r border-slate-200 overflow-y-auto bg-slate-50">
                            {hasRecommendations && (
                                <div className="flex mb-4 bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                                    <button 
                                        onClick={() => setViewMode('recommended')}
                                        className={`flex-1 py-1 text-xs font-bold rounded ${viewMode === 'recommended' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
                                    >
                                        My Prescriptions
                                    </button>
                                    <button 
                                        onClick={() => setViewMode('manual')}
                                        className={`flex-1 py-1 text-xs font-bold rounded ${viewMode === 'manual' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
                                    >
                                        Manual Select
                                    </button>
                                </div>
                            )}

                            {viewMode === 'recommended' ? (
                                <div className="space-y-4">
                                    {recommendations.map((rec, idx) => (
                                        <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                            <div className="bg-emerald-50 p-3 border-b border-emerald-100 flex items-center gap-2">
                                                <TrophyIcon />
                                                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Based on purchase: {rec.kitName}</span>
                                            </div>
                                            <div className="p-2 space-y-2">
                                                {rec.options.map((opt: any) => (
                                                    <div 
                                                        key={opt.profileId}
                                                        onClick={() => setSelectedOptionId(opt.profileId)}
                                                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                                            selectedOptionId === opt.profileId
                                                            ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500 shadow-sm'
                                                            : 'bg-white border-slate-100 hover:border-slate-300'
                                                        }`}
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-bold text-slate-800 text-sm">{opt.profileName}</span>
                                                                    {opt.optionIndex === 1 && <StarIcon />}
                                                                </div>
                                                                <p className="text-xs text-slate-500 mt-1">{opt.description}</p>
                                                                {opt.label && <span className="inline-block mt-1 bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded border border-slate-200">{opt.label}</span>}
                                                            </div>
                                                            {selectedOptionId === opt.profileId && <div className="w-4 h-4 bg-indigo-500 rounded-full border-2 border-white shrink-0"></div>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <>
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
                                </>
                            )}
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

                                <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                                    <h4 className="text-amber-800 font-bold text-xs uppercase mb-2">Consolidation Logic</h4>
                                    <p className="text-amber-700 text-xs">
                                        {viewMode === 'recommended' 
                                            ? "AI will generate a plan specifically tailored to the nutritional biomarkers associated with your purchased kit."
                                            : `AI will calculate the nutritional intersection of the selected ${selectedDiseases.length} condition${selectedDiseases.length > 1 ? 's' : ''}, prioritizing the most restrictive safety constraints (e.g. low sodium, allergens) while balancing macronutrients.`
                                        }
                                    </p>
                                </div>
                            </div>

                            <button 
                                onClick={handleConfirm}
                                disabled={(viewMode === 'manual' && selectedDiseases.length === 0) || (viewMode === 'recommended' && !selectedOptionId) || isLoading}
                                className="w-full mt-8 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <BeakerIcon />
                                <span>Generate Plan</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
