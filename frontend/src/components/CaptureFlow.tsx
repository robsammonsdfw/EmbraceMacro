
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { XIcon, CameraIcon, BarcodeIcon, ChefHatIcon, UtensilsIcon, UserCircleIcon, PlusIcon, SearchIcon, TagIcon } from './icons';
import { BarcodeScanner } from './BarcodeScanner';
import type { MealLogEntry } from '../types';

interface CaptureFlowProps {
  onClose: () => void;
  onCapture: (image: string | null, mode: 'meal' | 'barcode' | 'pantry' | 'restaurant', barcode?: string) => void;
  lastMeal?: MealLogEntry;
  onRepeatMeal: (meal: MealLogEntry) => void;
  onBodyScanClick: () => void;
}

type CaptureMode = 'barcode' | 'meal' | 'pantry' | 'restaurant';

export const CaptureFlow: React.FC<CaptureFlowProps> = ({ 
  onClose, 
  onCapture, 
  lastMeal, 
  onRepeatMeal,
  onBodyScanClick
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mode, setMode] = useState<CaptureMode>('meal');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedLabel, setDetectedLabel] = useState<string | null>(null);
  const [showSelfLabelInput, setShowSelfLabelInput] = useState(false);
  const [selfLabel, setSelfLabel] = useState('');

  // Initialize Camera
  useEffect(() => {
    if (mode === 'barcode') return; // Barcode component handles its own camera

    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [mode]);

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(imageData);
      
      // Simulate AI Detection sequence
      setIsAnalyzing(true);
      setTimeout(() => {
        setDetectedLabel("Identifying...");
        setTimeout(() => {
            // In a real app, this would come from a lightweight local model or the initial API handshake
            const mockLabels: Record<string, string> = {
                'meal': 'Dish Detected',
                'pantry': 'Ingredients',
                'restaurant': 'Menu / Plating'
            };
            setDetectedLabel(mockLabels[mode] || 'Food Detected');
            setIsAnalyzing(false);
        }, 1200);
      }, 500);
    }
  }, [mode]);

  const handleConfirm = () => {
    onCapture(capturedImage, mode);
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setDetectedLabel(null);
    setIsAnalyzing(false);
    setShowSelfLabelInput(false);
  };

  const handleBarcodeSuccess = (code: string) => {
    onCapture(null, 'barcode', code);
  };

  const modes: { id: CaptureMode; label: string; icon: React.ReactNode }[] = [
    { id: 'barcode', label: 'Scan', icon: <BarcodeIcon /> },
    { id: 'meal', label: 'Snap Meal', icon: <CameraIcon /> },
    { id: 'pantry', label: 'Pantry', icon: <ChefHatIcon /> },
    { id: 'restaurant', label: 'Restaurant', icon: <UtensilsIcon /> },
  ];

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col font-sans animate-fade-in text-white">
      {/* --- Top Controls --- */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-20 bg-gradient-to-b from-black/60 to-transparent h-24">
        <button onClick={onClose} className="p-2 bg-black/20 backdrop-blur-md rounded-full hover:bg-white/20 transition">
          <XIcon />
        </button>
        
        <button 
          onClick={onBodyScanClick}
          className="flex flex-col items-center gap-1 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-lg hover:bg-white/20 transition"
        >
          <UserCircleIcon />
          <span className="text-[10px] font-bold uppercase tracking-wider">Body Scan</span>
        </button>
      </div>

      {/* --- Main Viewport --- */}
      <div className="flex-grow relative bg-gray-900 overflow-hidden">
        {mode === 'barcode' ? (
           <BarcodeScanner onScanSuccess={handleBarcodeSuccess} onCancel={() => setMode('meal')} />
        ) : (
           <>
              {!capturedImage ? (
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="absolute inset-0 w-full h-full object-cover"
                  />
              ) : (
                  <div className="absolute inset-0 w-full h-full bg-black relative">
                      <img src={capturedImage} alt="Captured" className="w-full h-full object-cover opacity-80" />
                      
                      {/* Detection Overlay */}
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64">
                          {!showSelfLabelInput && (
                             <div className={`absolute inset-0 border-2 border-emerald-400 rounded-lg transition-all duration-500 ${isAnalyzing ? 'scale-110 opacity-50 animate-pulse' : 'scale-100 opacity-100'}`}>
                                 {/* Corners */}
                                 <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-emerald-500"></div>
                                 <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-emerald-500"></div>
                                 <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-emerald-500"></div>
                                 <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-emerald-500"></div>
                             </div>
                          )}
                          
                          {/* Label Chip */}
                          {(detectedLabel || isAnalyzing) && (
                              <div className="absolute -top-12 left-0 right-0 flex justify-center">
                                  <div className="bg-emerald-500 text-white px-4 py-1.5 rounded-full font-bold shadow-lg flex items-center gap-2 animate-bounce-short">
                                      {isAnalyzing ? (
                                        <>
                                          <SearchIcon /> <span>Analyzing...</span>
                                        </>
                                      ) : (
                                        <>
                                          <TagIcon /> <span>{detectedLabel}</span>
                                        </>
                                      )}
                                  </div>
                              </div>
                          )}
                      </div>

                      {/* Fallback Input */}
                      {showSelfLabelInput && (
                          <div className="absolute top-1/3 left-8 right-8 bg-white p-4 rounded-xl shadow-2xl animate-fade-in text-slate-800">
                              <h3 className="font-bold text-lg mb-2">What is this?</h3>
                              <input 
                                type="text" 
                                autoFocus
                                value={selfLabel}
                                onChange={(e) => setSelfLabel(e.target.value)}
                                placeholder="e.g. Chicken Caesar Salad"
                                className="w-full p-3 border border-slate-300 rounded-lg mb-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                              />
                              <button 
                                onClick={handleConfirm}
                                className="w-full bg-emerald-500 text-white font-bold py-3 rounded-lg"
                              >
                                Use Label
                              </button>
                          </div>
                      )}
                  </div>
              )}
           </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* --- Bottom Controls (UI Layer) --- */}
      {!capturedImage && mode !== 'barcode' && (
        <div className="absolute bottom-0 left-0 right-0 pb-8 pt-12 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col items-center z-30 space-y-6">
            
            {/* Repeat Meal Chip */}
            {lastMeal && (
                <button 
                    onClick={() => onRepeatMeal(lastMeal)}
                    className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-full flex items-center space-x-2 hover:bg-white/20 transition transform hover:-translate-y-1"
                >
                    <span className="text-emerald-400"><PlusIcon /></span>
                    <span className="text-sm font-semibold truncate max-w-[200px]">
                        Repeat: {lastMeal.mealName}
                    </span>
                </button>
            )}

            {/* Shutter */}
            <div className="flex items-center justify-center w-full relative">
                <button 
                    onClick={takePhoto}
                    className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center relative group"
                >
                    <div className="w-16 h-16 bg-white rounded-full group-active:scale-90 transition-transform duration-150"></div>
                </button>
            </div>

            {/* Mode Selector */}
            <div className="flex space-x-6 overflow-x-auto w-full justify-center px-4 no-scrollbar pb-2">
                {modes.map((m) => (
                    <button
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        className={`flex flex-col items-center space-y-1 transition-all duration-300 ${
                            mode === m.id ? 'text-emerald-400 scale-110 font-bold' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <div className="p-2">{m.icon}</div>
                        <span className="text-[10px] uppercase tracking-wider whitespace-nowrap">{m.label}</span>
                    </button>
                ))}
            </div>
        </div>
      )}

      {/* --- Post-Capture Controls --- */}
      {capturedImage && (
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent z-40 flex flex-col gap-4">
              {!isAnalyzing && !showSelfLabelInput && (
                  <button 
                    onClick={() => setShowSelfLabelInput(true)}
                    className="mx-auto text-sm text-slate-300 hover:text-white underline decoration-dashed"
                  >
                      Not sure? Tap to self-label
                  </button>
              )}
              
              <div className="flex gap-4">
                  <button 
                    onClick={handleRetake}
                    className="flex-1 py-3 bg-slate-700/80 backdrop-blur rounded-xl font-bold hover:bg-slate-600 transition"
                  >
                      Retake
                  </button>
                  <button 
                    onClick={handleConfirm}
                    disabled={isAnalyzing}
                    className="flex-1 py-3 bg-emerald-500 rounded-xl font-bold hover:bg-emerald-400 transition flex justify-center items-center gap-2 disabled:opacity-50"
                  >
                      {isAnalyzing ? 'Scanning...' : 'Analyze Meal'}
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};
