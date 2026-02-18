
import React, { useState, useRef, useCallback } from 'react';
// Changed import from ./components/Icons to ./components/icons to fix casing mismatch
import { CameraIcon, PhotoIcon, XMarkIcon, SparklesIcon, ChartBarIcon } from './components/icons';
import { NutritionDisplay } from './components/NutritionDisplay';
import { Loader } from './components/Loader';
import type { NutritionInfo } from './types';

const App: React.FC = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [nutritionData, setNutritionData] = useState<NutritionInfo | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local Preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreviewImage(ev.target?.result as string);
    reader.readAsDataURL(file);

    setIsAnalyzing(true);
    setError(null);
    setNutritionData(null);

    const base64Reader = new FileReader();
    base64Reader.onload = async () => {
      try {
        const base64Data = (base64Reader.result as string).split(',')[1];
        const response = await fetch('/api/analyze-meal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Data, mimeType: file.type }),
        });

        if (!response.ok) throw new Error('Analysis failed');
        
        const data = await response.json();
        setNutritionData(data);
      } catch (err) {
        setError('Could not identify food. Please try a clearer photo.');
      } finally {
        setIsAnalyzing(false);
      }
    };
    base64Reader.readAsDataURL(file);
  }, []);

  const reset = () => {
    setPreviewImage(null);
    setNutritionData(null);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col text-slate-100 font-sans">
      {/* Header */}
      <header className="pt-safe px-6 py-4 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-black tracking-tighter uppercase text-emerald-400">MacrosChef AI</h1>
          <button onClick={reset} className="p-2 text-slate-400 hover:text-white transition-colors">
            <RefreshIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow relative overflow-y-auto px-6 py-8 pb-32">
        {!previewImage && !isAnalyzing && (
          <div className="flex flex-col items-center justify-center h-[60vh] space-y-6 animate-fade-in">
            <div className="w-32 h-32 bg-slate-800/50 rounded-full flex items-center justify-center border-2 border-dashed border-slate-700">
              <SparklesIcon className="w-12 h-12 text-emerald-500 opacity-50" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Metabolic Vision</h2>
              <p className="text-slate-400 max-w-[240px] mx-auto text-sm leading-relaxed">
                Snap a photo of your meal to calculate calorie load and macronutrient density.
              </p>
            </div>
          </div>
        )}

        {previewImage && (
          <div className="space-y-6 animate-slide-up">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-800 aspect-square md:aspect-video">
              <img src={previewImage} alt="Meal preview" className="w-full h-full object-cover" />
              {isAnalyzing && (
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center">
                  <Loader />
                  <p className="mt-4 text-emerald-400 font-black uppercase text-[10px] tracking-[0.2em] animate-pulse">Analyzing Metabolism...</p>
                </div>
              )}
            </div>

            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-sm font-bold flex items-center gap-3">
                <XMarkIcon className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            {nutritionData && <NutritionDisplay data={nutritionData} />}
          </div>
        )}
      </main>

      {/* Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-6 pb-safe bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent">
        <div className="max-w-md mx-auto">
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleCapture}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black uppercase tracking-widest py-5 rounded-[2rem] shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-4 transition-all active:scale-95 disabled:opacity-50"
          >
            <CameraIcon className="w-6 h-6" />
            <span>Capture Meal</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const RefreshIcon = ({ className }: { className: string }) => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

export default App;
