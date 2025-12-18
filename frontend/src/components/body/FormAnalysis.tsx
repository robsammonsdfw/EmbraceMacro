
import React, { useRef, useState, useEffect } from 'react';
import { CameraIcon, XIcon, ActivityIcon } from '../icons';
import * as apiService from '../../services/apiService';
import type { FormAnalysisResult } from '../../types';

export const FormAnalysis: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<FormAnalysisResult | null>(null);
    const [selectedExercise, setSelectedExercise] = useState('Squat');

    useEffect(() => {
        const startCamera = async () => {
            try {
                const ms = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                setStream(ms);
                if (videoRef.current) videoRef.current.srcObject = ms;
            } catch (err) {
                console.error("Camera failed", err);
            }
        };
        startCamera();
        return () => stream?.getTracks().forEach(t => t.stop());
    }, []);

    const captureAndAnalyze = async () => {
        if (!videoRef.current || !canvasRef.current) return;
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
            try {
                const analysis = await apiService.analyzeExerciseForm(base64Image, selectedExercise);
                setResult(analysis);
            } catch (e) {
                alert("Analysis failed. Try again.");
            } finally {
                setIsAnalyzing(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col text-white font-sans">
            <div className="p-4 flex justify-between items-center bg-black/40 backdrop-blur-md absolute top-0 w-full z-10">
                <h2 className="font-bold flex items-center gap-2"><ActivityIcon /> AI Form Check</h2>
                <button onClick={onClose} className="p-2 bg-white/10 rounded-full"><XIcon /></button>
            </div>

            <div className="flex-grow relative overflow-hidden flex items-center justify-center">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
                
                {/* Visual Guides */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-96 border-2 border-dashed border-white/30 rounded-full"></div>
                </div>

                {/* Analysis Overlay */}
                {result && (
                    <div className="absolute bottom-32 left-4 right-4 bg-white/90 backdrop-blur-md p-4 rounded-2xl text-slate-900 animate-slide-up">
                        <div className="flex justify-between items-center mb-2">
                            <span className={`text-xs font-black uppercase px-2 py-1 rounded ${result.isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                {result.isCorrect ? 'Perfect Form' : 'Adjust Required'}
                            </span>
                            <span className="text-xl font-black text-indigo-600">{result.score}%</span>
                        </div>
                        <p className="text-sm font-medium">{result.feedback}</p>
                    </div>
                )}
            </div>

            <div className="p-6 bg-slate-900 border-t border-slate-800 flex flex-col gap-4">
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                    {['Squat', 'Pushup', 'Plank', 'Deadlift'].map(ex => (
                        <button 
                            key={ex} 
                            onClick={() => setSelectedExercise(ex)}
                            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${selectedExercise === ex ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                        >
                            {ex}
                        </button>
                    ))}
                </div>
                <button 
                    onClick={captureAndAnalyze}
                    disabled={isAnalyzing}
                    className="w-full bg-emerald-500 py-4 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                    {isAnalyzing ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <><CameraIcon /> Analyze My Form</>
                    )}
                </button>
            </div>

            <style>{`
                @keyframes slide-up {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-up { animation: slide-up 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};
