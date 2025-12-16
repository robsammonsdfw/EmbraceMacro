import React, { useState, useRef, useEffect, useCallback } from 'react';
import { XIcon, CameraIcon, BarcodeIcon, ChefHatIcon, UtensilsIcon, UserCircleIcon, PlusIcon, SearchIcon, TagIcon, PhotoIcon, UserGroupIcon } from './icons';
import { BarcodeScanner } from './BarcodeScanner';
import type { MealLogEntry } from '../types';

interface CaptureFlowProps {
  onClose: () => void;
  onCapture: (image: string | null, mode: 'meal' | 'barcode' | 'pantry' | 'restaurant', barcode?: string) => void;
  lastMeal?: MealLogEntry;
  onRepeatMeal: (meal: MealLogEntry) => void;
  onBodyScanClick: () => void;
  initialMode?: 'meal' | 'barcode' | 'pantry' | 'restaurant';
}

type CaptureMode = 'barcode' | 'meal' | 'pantry' | 'restaurant';

const RECENT_FRIEND_MEALS = [
  { id: 1, user: 'Sarah', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=150&h=150&fit=crop' },
  { id: 2, user: 'Mike', image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=150&h=150&fit=crop' },
  { id: 3, user: 'Jess', image: 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=150&h=150&fit=crop' },
  { id: 4, user: 'Tom', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=150&h=150&fit=crop' },
];

const FRIENDS_HERE = [
    { id: 1, name: 'Alex', bg: 'bg-blue-500' },
    { id: 2, name: 'Sam', bg: 'bg-purple-500' },
    { id: 3, name: 'Jordan', bg: 'bg-yellow-500' }
];

export const CaptureFlow: React.FC<CaptureFlowProps> = ({ 
  onClose, 
  onCapture, 
  lastMeal, 
  onRepeatMeal,
  onBodyScanClick,
  initialMode = 'meal'
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mode, setMode] = useState<CaptureMode>(initialMode);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedLabel, setDetectedLabel] = useState<string | null>(null);
  const [showSelfLabelInput, setShowSelfLabelInput] = useState(false);
  const [selfLabel, setSelfLabel] = useState('');
  
  // Phase 4 State
  const [addToStory, setAddToStory] = useState(false);

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
    
    // Scale Down Logic: Limit max dimension to 1024px to reduce base64 size for Lambda
    const MAX_DIMENSION = 1024;
    let width = video.videoWidth;
    let height = video.videoHeight;

    if (width > height) {
        if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width;
            width = MAX_DIMENSION;
        }
    } else {
        if (height > MAX_DIMENSION) {
            width *= MAX_DIMENSION / height;
            height = MAX_DIMENSION;
        }
    }
    
    canvas.width = width;
    canvas.height = height;
    
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, width, height);
      // Reduce quality slightly to 0.7 to ensure small payload size
      const imageData = canvas.toDataURL('image/jpeg', 0.7);
      setCapturedImage(imageData);
      
      // Simulate AI Detection sequence
      setIsAnalyzing(true);
      setTimeout(() => {
        setDetectedLabel("Identifying...");
        setTimeout(() => {
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

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (mode === 'barcode') setMode('meal');

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
             // Resize uploaded image as well
             const canvas = document.createElement('canvas');
             const MAX_DIMENSION = 1024;
             let width = img.width;
             let height = img.height;

             if (width > height) {
                 if (width > MAX_DIMENSION) {
                     height *= MAX_DIMENSION / width;
                     width = MAX_DIMENSION;
                 }
             } else {
                 if (height > MAX_DIMENSION) {
                     width *= MAX_DIMENSION / height;
                     height = MAX_DIMENSION;
                 }
             }
             canvas.width = width;
             canvas.height = height;
             const ctx = canvas.getContext('2d');
             ctx?.drawImage(img, 0, 0, width, height);
             const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
             
             setCapturedImage(dataUrl);
             setIsAnalyzing(true);
             setDetectedLabel("Analyzing...");
             setTimeout(() => {
                  setDetectedLabel("Image Selected");
                  setIsAnalyzing(false);
             }, 800);
        };
        if(e.target?.result) {
            img.src = e.target.result as string;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirm = () => {
    onCapture(capturedImage, mode);
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setDetectedLabel(null);
    setIsAnalyzing(false);
    setShowSelfLabelInput(false);
    setSelfLabel('');
    if (fileInputRef.current) fileInputRef.current.value = '';
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
      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />

      {/* Top Header */}
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

      {/* Main Viewport */}
      <div className="flex-grow relative bg-gray-900 overflow-hidden">
        {mode === 'barcode' && !capturedImage ? (
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
                      <img src={capturedImage} alt="Captured" className="w-full h-full object-contain bg-black" />
                      
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 pointer-events-none">
                          {!showSelfLabelInput && (
                             <div className={`absolute inset-0 border-2 border-emerald-400 rounded-lg transition-all duration-500 ${isAnalyzing ? 'scale-110 opacity-50 animate-pulse' : 'scale-100 opacity-100'}`}>
                                 <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-emerald-500"></div>
                                 <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-emerald-500"></div>
                                 <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-emerald-500"></div>
                                 <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-emerald-500"></div>
                             </div>
                          )}
                          
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

                      {showSelfLabelInput && (
                          <div className="absolute top-1/3 left-8 right-8 bg-white p-4 rounded-xl shadow-2xl animate-fade-in text-slate-800 z-50">
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

        {/* Phase 6: Restaurant Mode Overlay */}
        {mode === 'restaurant' && !capturedImage && (
            <div className="absolute inset-0 bg-black/40 z-10 flex flex-col justify-center px-6 pb-32">
                
                {/* 6.1 Check-in Card */}
                <div className="bg-white rounded-2xl p-4 shadow-2xl mb-4 animate-fade-in text-slate-800">
                    <div className="h-32 bg-slate-100 rounded-xl mb-4 flex items-center justify-center border border-slate-200">
                        {/* Placeholder for Map */}
                        <div className="text-slate-400 flex flex-col items-center">
                            <UtensilsIcon />
                            <span className="text-xs font-bold mt-1">Sweetgreen, Downtown</span>
                        </div>
                    </div>
                    <h3 className="font-bold text-lg">You're at Sweetgreen</h3>
                    <p className="text-slate-500 text-sm">Healthy Salads • $$</p>
                </div>

                {/* 6.2 Action Button */}
                <button 
                    onClick={() => onCapture(null, 'restaurant')}
                    className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-indigo-700 transition mb-6 flex items-center justify-center gap-2"
                >
                    <TagIcon /> 
                    <span>Check-in & Share</span>
                </button>

                {/* 6.4 Group Order */}
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 mb-6 flex items-center justify-between cursor-pointer hover:bg-white/20 transition">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-500 p-2 rounded-full text-white">
                            <UserGroupIcon />
                        </div>
                        <div>
                            <p className="font-bold text-sm">Start Group Order</p>
                            <p className="text-xs text-white/70">Sync carts with friends</p>
                        </div>
                    </div>
                    <PlusIcon />
                </div>

                {/* 6.3 Social Proof */}
                <div className="bg-black/40 backdrop-blur-sm rounded-xl p-3">
                    <p className="text-xs text-white/70 mb-2 uppercase font-bold tracking-wider">Friends who ate here</p>
                    <div className="flex -space-x-2">
                        {FRIENDS_HERE.map(f => (
                            <div key={f.id} className={`w-8 h-8 rounded-full border-2 border-black flex items-center justify-center text-[10px] font-bold ${f.bg}`}>
                                {f.name[0]}
                            </div>
                        ))}
                        <div className="w-8 h-8 rounded-full border-2 border-black bg-slate-700 flex items-center justify-center text-[10px] text-white">
                            +12
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* Controls Area */}
      {!capturedImage && mode !== 'barcode' && (
        <div className="absolute bottom-0 left-0 right-0 pb-8 pt-12 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col items-center z-30 space-y-4">
            
            {/* Phase 4.4: Friend's Recent Meals Strip */}
            {mode === 'meal' && (
                <div className="w-full overflow-x-auto no-scrollbar px-4 mb-2">
                    <div className="flex gap-3">
                        {RECENT_FRIEND_MEALS.map(friend => (
                            <div key={friend.id} className="flex-shrink-0 flex flex-col items-center gap-1 group cursor-pointer">
                                <div className="w-14 h-14 rounded-full border-2 border-white/30 p-0.5 group-hover:border-emerald-500 transition-colors">
                                    <img src={friend.image} alt={friend.user} className="w-full h-full rounded-full object-cover" />
                                </div>
                                <span className="text-[10px] font-medium shadow-black drop-shadow-md">{friend.user}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Repeat Meal Chip */}
            {lastMeal && mode !== 'restaurant' && (
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

            <div className="flex items-center justify-center w-full relative px-8">
                {mode !== 'restaurant' && (
                    <button 
                        onClick={triggerUpload}
                        className="absolute left-8 md:left-24 w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl border border-white/20 flex items-center justify-center text-white hover:bg-white/30 transition shadow-lg"
                        title="Upload from Photos"
                    >
                        <PhotoIcon />
                    </button>
                )}

                {/* Shutter Button Logic */}
                {mode === 'restaurant' ? (
                    <div className="h-20"></div> // Spacer since restaurant mode uses overlay buttons
                ) : (
                    <div className="flex flex-col items-center gap-3">
                        {/* 4.3 Add to Story Toggle */}
                        {mode === 'meal' && (
                            <div className="flex items-center gap-2 bg-black/40 backdrop-blur rounded-full px-3 py-1">
                                <span className="text-xs font-bold text-white/90">Add to Story</span>
                                <div 
                                    onClick={() => setAddToStory(!addToStory)}
                                    className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${addToStory ? 'bg-emerald-500' : 'bg-slate-500'}`}
                                >
                                    <div className={`w-2 h-2 bg-white rounded-full absolute top-1 transition-all ${addToStory ? 'left-5' : 'left-1'}`}></div>
                                </div>
                            </div>
                        )}

                        {/* 4.2 Snap & Share Button (Pill for Meal mode, Round for others) */}
                        {mode === 'meal' ? (
                            <button 
                                onClick={takePhoto}
                                className="w-64 h-16 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:bg-emerald-400 hover:scale-105 transition-all active:scale-95"
                            >
                                <span className="font-bold text-lg tracking-wide flex items-center gap-2">
                                    <CameraIcon /> Snap & Share
                                </span>
                            </button>
                        ) : (
                            <button 
                                onClick={takePhoto}
                                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center relative group"
                            >
                                <div className="w-16 h-16 bg-white rounded-full group-active:scale-90 transition-transform duration-150"></div>
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="flex space-x-6 overflow-x-auto w-full justify-center px-4 no-scrollbar pb-2 pt-2">
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
                      {isAnalyzing ? 'Scanning...' : (mode === 'meal' ? (addToStory ? 'Share to Story' : 'Save Meal') : 'Analyze')}
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};