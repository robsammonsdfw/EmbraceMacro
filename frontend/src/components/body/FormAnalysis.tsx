
import React, { useRef, useState, useEffect } from 'react';
import { CameraIcon, XIcon, ActivityIcon, DumbbellIcon, TrophyIcon, RunningIcon, CheckIcon, UploadIcon } from '../icons';
import * as apiService from '../../services/apiService';
import type { FormAnalysisResult } from '../../types';

type ViewMode = 'categories' | 'gallery' | 'camera' | 'analysis';

export const FormAnalysis: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    
    // States
    const [view, setView] = useState<ViewMode>('categories');
    const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
    const [savedChecks, setSavedChecks] = useState<any[]>([]);
    
    // Analysis
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<FormAnalysisResult | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isSaved, setIsSaved] = useState(false);

    // Initial load
    useEffect(() => {
        return () => stopCamera();
    }, []);

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            setStream(null);
        }
    };

    const startCamera = async () => {
        try {
            const ms = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            setStream(ms);
            if (videoRef.current) videoRef.current.srcObject = ms;
        } catch (err) {
            console.error("Camera failed", err);
            alert("Could not access camera.");
        }
    };

    const loadSavedChecks = async (category: string) => {
        try {
            const data = await apiService.getFormChecks(category);
            setSavedChecks(data);
        } catch (e) {
            console.error("Failed to load checks", e);
        }
    };

    const handleCategoryClick = (category: string) => {
        setSelectedExercise(category);
        loadSavedChecks(category);
        setView('gallery');
    };

    const handleNewScan = () => {
        setResult(null);
        setCapturedImage(null);
        setIsSaved(false);
        startCamera();
        setView('camera');
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedExercise) return;

        setIsAnalyzing(true);
        setView('analysis');

        if (file.type.startsWith('video/')) {
            // Process Video: Create URL, load hidden video, seek, capture frame
            const videoUrl = URL.createObjectURL(file);
            const tempVideo = document.createElement('video');
            tempVideo.src = videoUrl;
            tempVideo.muted = true;
            tempVideo.playsInline = true;
            
            tempVideo.onloadeddata = () => {
                tempVideo.currentTime = 1.0; // Seek to 1s
            };

            tempVideo.onseeked = async () => {
                const canvas = document.createElement('canvas');
                canvas.width = tempVideo.videoWidth;
                canvas.height = tempVideo.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
                    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
                    setCapturedImage(base64);
                    try {
                        const analysis = await apiService.analyzeExerciseForm(base64, selectedExercise);
                        setResult(analysis);
                    } catch (err) {
                        alert("Failed to analyze video frame.");
                        setView('gallery');
                    } finally {
                        setIsAnalyzing(false);
                        URL.revokeObjectURL(videoUrl);
                    }
                }
            };
            
            tempVideo.onerror = () => {
                alert("Could not process video file.");
                setIsAnalyzing(false);
                setView('gallery');
            };

        } else {
            // Process Image
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = (reader.result as string).split(',')[1];
                setCapturedImage(base64);
                try {
                    const analysis = await apiService.analyzeExerciseForm(base64, selectedExercise);
                    setResult(analysis);
                } catch (err) {
                    alert("Failed to analyze uploaded file.");
                    setView('gallery');
                } finally {
                    setIsAnalyzing(false);
                }
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    const captureAndAnalyze = async () => {
        if (!videoRef.current || !canvasRef.current || !selectedExercise) return;
        
        setIsAnalyzing(true);
        setResult(null);

        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        
        if (context) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const base64Image = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
            setCapturedImage(base64Image); // Store locally for display
            
            try {
                const analysis = await apiService.analyzeExerciseForm(base64Image, selectedExercise);
                setResult(analysis);
                stopCamera();
                setView('analysis');
            } catch (e) {
                alert("Analysis failed. Try again.");
                setIsAnalyzing(false);
            } finally {
                setIsAnalyzing(false);
            }
        }
    };

    const handleSave = async () => {
        if (!result || !capturedImage || !selectedExercise) return;
        try {
            await apiService.saveFormCheck(selectedExercise, capturedImage, result.score, result.feedback);
            setIsSaved(true);
            alert("Saved to history!");
        } catch (e) {
            alert("Failed to save.");
        }
    };

    const handleViewSaved = async (id: number) => {
        try {
            const check = await apiService.getFormCheckById(id);
            if (check) {
                setResult({
                    isCorrect: check.ai_score > 80,
                    score: check.ai_score,
                    feedback: check.ai_feedback
                });
                setCapturedImage(check.imageUrl.split(',')[1]); // Extract base64
                setIsSaved(true); // Already saved
                setView('analysis');
            }
        } catch (e) {
            alert("Failed to load details.");
        }
    };

    const handleReAnalyze = async () => {
        if (!capturedImage || !selectedExercise) return;
        setIsAnalyzing(true);
        try {
            const analysis = await apiService.analyzeExerciseForm(capturedImage, selectedExercise);
            setResult(analysis);
            // We don't auto-save re-analysis to avoid duplicates, user can save if we implemented update logic, 
            // but for now let's just show the new result.
            alert("Re-analysis complete!");
        } catch (e) {
            alert("Re-analysis failed.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    // --- RENDERERS ---

    const renderCategories = () => (
        <div className="p-6 grid grid-cols-2 gap-4 mt-12">
            {[
                { id: 'Pushup', icon: <DumbbellIcon className="w-8 h-8" />, color: 'bg-indigo-500' },
                { id: 'Squat', icon: <RunningIcon className="w-8 h-8" />, color: 'bg-emerald-500' },
                { id: 'Plank', icon: <ActivityIcon className="w-8 h-8" />, color: 'bg-amber-500' },
                { id: 'Deadlift', icon: <TrophyIcon className="w-8 h-8" />, color: 'bg-rose-500' },
            ].map(cat => (
                <button 
                    key={cat.id}
                    onClick={() => handleCategoryClick(cat.id)}
                    className="flex flex-col items-center justify-center p-6 bg-slate-800 rounded-[2rem] aspect-square shadow-lg active:scale-95 transition-all border border-slate-700"
                >
                    <div className={`p-4 rounded-full ${cat.color} text-white mb-3 shadow-md`}>
                        {cat.icon}
                    </div>
                    <span className="font-black text-white uppercase tracking-widest text-sm">{cat.id}</span>
                </button>
            ))}
        </div>
    );

    const renderGallery = () => (
        <div className="flex flex-col h-full">
            <div className="p-6 pt-20 pb-4">
                <h3 className="text-2xl font-black text-white mb-1">{selectedExercise} History</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Select a video to re-analyze</p>
            </div>
            
            <div className="flex-grow overflow-y-auto px-6 pb-24 space-y-3">
                <div className="flex gap-2 mb-6">
                    <button 
                        onClick={handleNewScan}
                        className="flex-1 py-4 bg-emerald-500 rounded-2xl flex items-center justify-center gap-2 font-black uppercase text-xs tracking-widest text-white shadow-lg"
                    >
                        <CameraIcon className="w-5 h-5" /> New Scan
                    </button>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-4 bg-slate-700 rounded-2xl flex items-center justify-center gap-2 font-black uppercase text-xs tracking-widest text-white shadow-lg"
                    >
                        <UploadIcon className="w-5 h-5" /> Upload Video
                    </button>
                    {/* Updated to accept both image and video */}
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,video/*" className="hidden" />
                </div>

                {savedChecks.map(check => (
                    <button 
                        key={check.id}
                        onClick={() => handleViewSaved(check.id)}
                        className="w-full bg-slate-800 p-4 rounded-2xl border border-slate-700 flex justify-between items-center group active:bg-slate-700 transition-colors"
                    >
                        <div>
                            <p className="text-slate-300 text-xs font-bold uppercase mb-1">{new Date(check.created_at).toLocaleDateString()}</p>
                            <p className="text-white font-medium text-sm truncate max-w-[200px]">{check.ai_feedback}</p>
                        </div>
                        <div className={`px-3 py-1 rounded-lg font-black text-sm ${check.ai_score >= 80 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {check.ai_score}%
                        </div>
                    </button>
                ))}
                
                {savedChecks.length === 0 && (
                    <div className="text-center py-10 text-slate-500 text-sm">No saved videos for this exercise.</div>
                )}
            </div>
        </div>
    );

    const renderAnalysis = () => (
        <div className="flex flex-col h-full bg-slate-900">
            <div className="relative flex-grow flex items-center justify-center p-4">
                {capturedImage && (
                    <img 
                        src={`data:image/jpeg;base64,${capturedImage}`} 
                        className="max-h-full max-w-full rounded-xl border border-slate-700 shadow-2xl" 
                        alt="Form Check" 
                    />
                )}
                {result && (
                    <div className="absolute bottom-8 left-6 right-6 bg-white/95 backdrop-blur-xl p-5 rounded-3xl text-slate-900 shadow-2xl animate-slide-up">
                        <div className="flex justify-between items-center mb-3">
                            <span className={`text-xs font-black uppercase px-2 py-1 rounded-lg ${result.score >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                {result.score >= 80 ? 'Good Form' : 'Correction Needed'}
                            </span>
                            <span className="text-2xl font-black text-indigo-600">{result.score}%</span>
                        </div>
                        <p className="text-sm font-medium leading-relaxed">{result.feedback}</p>
                    </div>
                )}
                {isAnalyzing && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-20">
                        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-emerald-400 font-black uppercase tracking-widest text-xs">AI Analyzing Form...</p>
                    </div>
                )}
            </div>
            
            <div className="p-6 bg-slate-800 border-t border-slate-700 flex gap-3">
                <button 
                    onClick={handleReAnalyze}
                    disabled={isAnalyzing}
                    className="flex-1 py-4 bg-slate-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-600 transition-colors disabled:opacity-50"
                >
                    Run Again
                </button>
                {!isSaved && (
                    <button 
                        onClick={handleSave}
                        className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-500 transition-colors shadow-lg"
                    >
                        Save Video
                    </button>
                )}
                {isSaved && (
                    <div className="flex-1 py-4 bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                        <CheckIcon className="w-4 h-4" /> Saved
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-slate-900 z-50 text-white font-sans animate-fade-in flex flex-col">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-gradient-to-b from-slate-900 to-transparent">
                <div className="flex items-center gap-3">
                    {view !== 'categories' && (
                        <button onClick={() => { 
                            if (view === 'analysis') setView('gallery'); 
                            else if (view === 'camera') { stopCamera(); setView('gallery'); }
                            else setView('categories'); 
                        }} className="p-2 bg-white/10 rounded-full hover:bg-white/20 text-xs font-bold px-4 backdrop-blur-md">
                            ← Back
                        </button>
                    )}
                    <h2 className="font-black text-lg flex items-center gap-2 uppercase tracking-tighter">
                        <ActivityIcon className="text-emerald-400" /> AI Form Coach
                    </h2>
                </div>
                <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 backdrop-blur-md"><XIcon /></button>
            </div>

            {/* View Router */}
            <div className="flex-grow relative overflow-hidden">
                {view === 'categories' && renderCategories()}
                {view === 'gallery' && renderGallery()}
                {view === 'analysis' && renderAnalysis()}
                {view === 'camera' && (
                    <div className="w-full h-full relative flex flex-col items-center justify-center bg-black">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="absolute bottom-10 left-0 right-0 flex justify-center pb-safe">
                            <button 
                                onClick={captureAndAnalyze}
                                disabled={isAnalyzing}
                                className="w-20 h-20 bg-white rounded-full border-4 border-slate-300 shadow-2xl flex items-center justify-center active:scale-95 transition-all"
                            >
                                <div className="w-16 h-16 bg-red-500 rounded-full animate-pulse"></div>
                            </button>
                        </div>
                        <div className="absolute top-20 bg-black/40 px-4 py-2 rounded-full backdrop-blur-md text-xs font-bold uppercase tracking-widest border border-white/10">
                            {selectedExercise} Mode
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
