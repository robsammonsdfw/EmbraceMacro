
import React, { useState, useRef } from 'react';
import { CameraIcon, XIcon, TrophyIcon, FireIcon } from './icons';
import * as apiService from '../services/apiService';

interface CookOffModalProps {
    recipeContext: string; // The text description of the recipe
    recipeId: number; // ID for backend linking
    onClose: () => void;
}

export const CookOffModal: React.FC<CookOffModalProps> = ({ recipeContext, recipeId, onClose }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [image, setImage] = useState<string | null>(null);
    const [isJudging, setIsJudging] = useState(false);
    const [result, setResult] = useState<apiService.JudgeResult | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (ev.target?.result) setImage(ev.target.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleJudge = async () => {
        if (!image) return;
        setIsJudging(true);
        try {
            const base64 = image.split(',')[1];
            const data = await apiService.judgeRecipeAttempt(base64, recipeContext, recipeId);
            setResult(data);
        } catch (e) {
            alert("Judging failed. The AI might be busy.");
        } finally {
            setIsJudging(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-[120] flex items-center justify-center p-4 animate-fade-in backdrop-blur-md">
            <div className="bg-slate-900 w-full max-w-lg rounded-[2.5rem] border border-slate-700 shadow-2xl overflow-hidden relative">
                
                <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 text-white z-20">
                    <XIcon />
                </button>

                {/* Content */}
                <div className="p-8 text-center">
                    {!result ? (
                        <>
                            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl flex items-center justify-center shadow-lg shadow-orange-900/50 mb-6 rotate-3">
                                <FireIcon className="w-10 h-10 text-white" />
                            </div>
                            <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-2">MasterChef Challenge</h2>
                            <p className="text-slate-400 font-medium mb-8">Prove your culinary skills. Snap a photo of your dish for AI judging.</p>

                            {!image ? (
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-4 border-dashed border-slate-700 bg-slate-800/50 rounded-[2rem] p-10 cursor-pointer hover:border-emerald-500 hover:bg-slate-800 transition-all group"
                                >
                                    <CameraIcon className="w-12 h-12 text-slate-500 group-hover:text-emerald-400 mx-auto mb-3" />
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Tap to Upload Evidence</p>
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                                </div>
                            ) : (
                                <div className="relative rounded-[2rem] overflow-hidden border-4 border-slate-700 shadow-xl mb-8">
                                    <img src={image} alt="Attempt" className="w-full h-64 object-cover" />
                                    {isJudging && (
                                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                                            <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                            <p className="text-emerald-400 font-black uppercase tracking-widest text-xs animate-pulse">Analyzing Plating...</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {image && !isJudging && (
                                <button 
                                    onClick={handleJudge}
                                    className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg active:scale-95 transition-all text-lg"
                                >
                                    Get Judge's Score
                                </button>
                            )}
                        </>
                    ) : (
                        <div className="animate-slide-up">
                            <div className="mx-auto w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl shadow-white/10 mb-6">
                                <TrophyIcon className="w-12 h-12 text-yellow-500" />
                            </div>
                            <h2 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-2">
                                {result.score}
                            </h2>
                            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-8">Culinary Score</p>
                            
                            <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 text-left mb-8">
                                <p className="text-slate-300 font-medium italic leading-relaxed">"{result.feedback}"</p>
                                <p className="text-right text-xs font-bold text-slate-500 mt-4 uppercase tracking-widest">- AI Judge</p>
                            </div>

                            <button 
                                onClick={onClose}
                                className="w-full py-4 bg-white text-slate-900 font-black uppercase tracking-widest rounded-2xl hover:bg-slate-200 transition-all"
                            >
                                Claim Points
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
