
import React, { useState } from 'react';
import { XIcon, ActivityIcon, BeakerIcon, UtensilsIcon, CheckIcon } from '../icons';
import { Article } from '../../types';

interface ArticleEditorModalProps {
    onClose: () => void;
    onPublish: (article: Partial<Article>) => void;
}

export const ArticleEditorModal: React.FC<ArticleEditorModalProps> = ({ onClose, onPublish }) => {
    const [step, setStep] = useState(1);
    const [title, setTitle] = useState('');
    const [summary, setSummary] = useState('');
    const [content, setContent] = useState('');
    const [image, setImage] = useState('');
    const [isSquadExclusive, setIsSquadExclusive] = useState(false);
    
    // Action Config
    const [actionType, setActionType] = useState<string>('');
    const [actionConfig, setActionConfig] = useState<any>({});

    const handleActionSelect = (type: string) => {
        setActionType(type);
        // Reset config based on type
        if (type === 'OPEN_FORM_CHECK') setActionConfig({ exercise: 'Squat', label: 'Check Form' });
        if (type === 'GENERATE_MEDICAL_PLAN') setActionConfig({ conditions: ['Diabetes'], label: 'Get Plan' });
        if (type === 'OPEN_COOK_MODE') setActionConfig({ label: 'Start Cooking', recipe: { recipeName: 'Sample Recipe', ingredients: [], instructions: [], nutrition: { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 } } });
    };

    const handlePublish = () => {
        const payload: Partial<Article> = {
            title,
            summary,
            content,
            image_url: image,
            is_squad_exclusive: isSquadExclusive,
            embedded_actions: actionType ? { type: actionType, ...actionConfig } : undefined
        };
        onPublish(payload);
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Compose Pulse</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><XIcon /></button>
                </div>

                <div className="flex-grow overflow-y-auto p-8 space-y-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <input 
                            type="text" 
                            placeholder="Article Headline" 
                            className="w-full text-2xl font-black text-slate-900 placeholder-slate-300 outline-none border-b-2 border-transparent focus:border-indigo-500 transition-all pb-2"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                        />
                        <textarea 
                            placeholder="Executive Summary (Appears in feed)" 
                            className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-600 h-24 resize-none"
                            value={summary}
                            onChange={e => setSummary(e.target.value)}
                        />
                        <textarea 
                            placeholder="Full Content..." 
                            className="w-full p-4 bg-white rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800 h-64 resize-y"
                            value={content}
                            onChange={e => setContent(e.target.value)}
                        />
                        <input 
                            type="text" 
                            placeholder="Cover Image URL" 
                            className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm font-bold text-slate-600"
                            value={image}
                            onChange={e => setImage(e.target.value)}
                        />
                    </div>

                    {/* Configuration */}
                    <div className="pt-6 border-t border-slate-100 space-y-6">
                        <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-100 cursor-pointer" onClick={() => setIsSquadExclusive(!isSquadExclusive)}>
                            <div>
                                <h4 className="font-black text-amber-800 uppercase tracking-widest text-xs">Squad Exclusive</h4>
                                <p className="text-xs text-amber-600 font-medium">Only allow friends/followers to read full content.</p>
                            </div>
                            <div className={`w-12 h-6 rounded-full p-1 transition-colors ${isSquadExclusive ? 'bg-amber-500' : 'bg-amber-200'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${isSquadExclusive ? 'translate-x-6' : 'translate-x-0'}`}></div>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-3">Smart Action Embed</h4>
                            <div className="grid grid-cols-3 gap-3">
                                <button 
                                    onClick={() => handleActionSelect('OPEN_FORM_CHECK')}
                                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${actionType === 'OPEN_FORM_CHECK' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 hover:bg-slate-50 text-slate-500'}`}
                                >
                                    <ActivityIcon />
                                    <span className="text-[10px] font-black uppercase">Form Check</span>
                                </button>
                                <button 
                                    onClick={() => handleActionSelect('GENERATE_MEDICAL_PLAN')}
                                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${actionType === 'GENERATE_MEDICAL_PLAN' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 hover:bg-slate-50 text-slate-500'}`}
                                >
                                    <BeakerIcon />
                                    <span className="text-[10px] font-black uppercase">Meal Plan</span>
                                </button>
                                <button 
                                    onClick={() => handleActionSelect('OPEN_COOK_MODE')}
                                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${actionType === 'OPEN_COOK_MODE' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-100 hover:bg-slate-50 text-slate-500'}`}
                                >
                                    <UtensilsIcon />
                                    <span className="text-[10px] font-black uppercase">Cook Mode</span>
                                </button>
                            </div>
                            
                            {/* Simple Config Inputs based on selection */}
                            {actionType === 'OPEN_FORM_CHECK' && (
                                <div className="mt-4 animate-fade-in">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Target Exercise</label>
                                    <select 
                                        className="w-full mt-1 p-2 border rounded-lg text-sm bg-white"
                                        value={actionConfig.exercise}
                                        onChange={e => setActionConfig({...actionConfig, exercise: e.target.value})}
                                    >
                                        <option value="Squat">Squat</option>
                                        <option value="Pushup">Pushup</option>
                                        <option value="Plank">Plank</option>
                                        <option value="Deadlift">Deadlift</option>
                                    </select>
                                </div>
                            )}
                            
                            {actionType === 'GENERATE_MEDICAL_PLAN' && (
                                <div className="mt-4 animate-fade-in">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Medical Condition Preset</label>
                                    <select 
                                        className="w-full mt-1 p-2 border rounded-lg text-sm bg-white"
                                        onChange={e => setActionConfig({...actionConfig, conditions: [e.target.value]})}
                                    >
                                        <option value="Diabetes">Diabetes</option>
                                        <option value="Hypertension">Hypertension</option>
                                        <option value="Celiac">Celiac Disease</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition-colors">Cancel</button>
                    <button 
                        onClick={handlePublish}
                        disabled={!title || !content}
                        className="bg-indigo-600 text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                    >
                        Publish Live
                    </button>
                </div>
            </div>
        </div>
    );
};
