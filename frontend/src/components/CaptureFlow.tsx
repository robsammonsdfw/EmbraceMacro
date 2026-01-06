
import React, { useState, useRef, useEffect, useCallback } from 'react';
/* Added PhotoIcon to imports */
import { XIcon, CameraIcon, BarcodeIcon, ChefHatIcon, UtensilsIcon, UserCircleIcon, MapPinIcon, SearchIcon, UploadIcon, PhotoIcon } from './icons';
import { BarcodeScanner } from './BarcodeScanner';
import type { MealLogEntry } from '../types';
import * as apiService from '../services/apiService';

interface CaptureFlowProps {
  onClose: () => void;
  onCapture: (image: string | null, mode: 'meal' | 'barcode' | 'pantry' | 'restaurant' | 'search', barcode?: string, searchQuery?: string) => void;
  lastMeal?: MealLogEntry;
  onRepeatMeal: (meal: MealLogEntry) => void;
  onBodyScanClick: () => void;
  initialMode?: 'meal' | 'barcode' | 'pantry' | 'restaurant' | 'search';
}

type CaptureMode = 'barcode' | 'meal' | 'pantry' | 'restaurant' | 'search';

export const CaptureFlow: React.FC<CaptureFlowProps> = ({ 
  onClose, 
  onCapture, 
  onBodyScanClick,
  initialMode = 'meal'
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mode, setMode] = useState<CaptureMode>(initialMode);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<apiService.MapPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<apiService.MapPlace | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [camError, setCamError] = useState<string | null>(null);
  const [isCamLoading, setIsCamLoading] = useState(true);

  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const startCamera = async () => {
    setCamError(null);
    setIsCamLoading(true);
    try {
      const ms = await navigator.mediaDevices.getUserMedia({ 
          video: { 
              facingMode: 'environment',
              width: { ideal: 1920 },
              height: { ideal: 1080 }
          } 
      });
      setStream(ms);
      if (videoRef.current) videoRef.current.srcObject = ms;
    } catch (err) { 
        console.error(err);
        setCamError("Camera access denied or unavailable.");
    } finally {
        setIsCamLoading(false);
    }
  };

  useEffect(() => {
    if (mode === 'barcode' || mode === 'search') {
        stopStream();
        return;
    }
    startCamera();
    return () => stopStream();
  }, [mode]);

  useEffect(() => {
    if (mode === 'restaurant') {
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(async (pos) => {
            try {
                const res = await apiService.searchNearbyRestaurants(pos.coords.latitude, pos.coords.longitude);
                setNearbyPlaces(res.places || []);
                if (res.places?.length > 0) setSelectedPlace(res.places[0]);
            } catch (e) { console.error(e); }
            finally { setIsLocating(false); }
        }, () => setIsLocating(false));
    }
  }, [mode]);

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Resize logic to prevent large payloads (max 1024px)
    const maxDim = 1024;
    let w = video.videoWidth;
    let h = video.videoHeight;
    
    if (w > maxDim || h > maxDim) {
        const ratio = w / h;
        if (w > h) {
            w = maxDim;
            h = maxDim / ratio;
        } else {
            h = maxDim;
            w = maxDim * ratio;
        }
    }

    canvas.width = w;
    canvas.height = h;
    
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, w, h);
      setCapturedImage(canvas.toDataURL('image/jpeg', 0.8));
      stopStream();
    }
  }, [stopStream]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
          const img = new Image();
          img.onload = () => {
              // Resize uploaded image as well
              const canvas = document.createElement('canvas');
              const maxDim = 1024;
              let w = img.width;
              let h = img.height;

              if (w > maxDim || h > maxDim) {
                  const ratio = w / h;
                  if (w > h) { w = maxDim; h = maxDim / ratio; }
                  else { h = maxDim; w = maxDim * ratio; }
              }

              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, w, h);
              
              setCapturedImage(canvas.toDataURL('image/jpeg', 0.8));
              stopStream();
          };
          if (readerEvent.target?.result) {
              img.src = readerEvent.target.result as string;
          }
      };
      reader.readAsDataURL(file);
  };

  const getModeTitle = () => {
      switch(mode) {
          case 'meal': return 'MacrosChef';
          case 'pantry': return 'PantryChef';
          case 'restaurant': return 'MasterChef';
          case 'barcode': return 'Barcode Engine';
          case 'search': return 'Manual Search';
          default: return 'Kitchen AI';
      }
  };

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col font-sans text-white">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-50 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex flex-col">
            <h2 className="font-black text-lg uppercase tracking-tighter text-emerald-400 leading-none">{getModeTitle()}</h2>
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest mt-1">Vision Engine Active</span>
        </div>
        <div className="flex gap-2">
             <button onClick={onBodyScanClick} className="p-3 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center gap-2 border border-white/10 hover:bg-white/20 transition-all">
                <UserCircleIcon className="w-5 h-5" /> <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Body Hub</span>
            </button>
            <button onClick={onClose} className="p-3 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 hover:bg-rose-500 hover:text-white transition-all"><XIcon /></button>
        </div>
      </div>

      <div className="flex-grow relative bg-slate-900 flex flex-col items-center justify-center overflow-hidden">
        {mode === 'barcode' ? (
           <BarcodeScanner onScanSuccess={(code) => onCapture(null, 'barcode', code)} onCancel={() => setMode('meal')} />
        ) : mode === 'search' ? (
            <div className="w-full max-w-md p-8 animate-fade-in">
                <h3 className="text-3xl font-black mb-8 text-center uppercase tracking-tighter">Query Kitchen AI</h3>
                <div className="relative group">
                    <input 
                        type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search meal or ingredient..."
                        className="w-full p-6 bg-white/10 border-2 border-white/20 rounded-[2.5rem] text-xl font-medium outline-none focus:border-emerald-500 focus:bg-white/20 transition-all shadow-2xl"
                        autoFocus
                    />
                    <div className="absolute right-6 top-6 text-emerald-400 group-focus-within:animate-pulse">
                        <SearchIcon className="w-8 h-8" />
                    </div>
                </div>
                <button 
                    onClick={() => onCapture(null, 'search', undefined, searchQuery)}
                    disabled={!searchQuery.trim()}
                    className="w-full mt-8 py-6 bg-emerald-500 rounded-[2.5rem] font-black uppercase tracking-widest shadow-2xl active:scale-95 disabled:opacity-30 transition-all"
                >
                    Run Semantic Analysis
                </button>
            </div>
        ) : (
           <div className="w-full h-full relative">
              {isCamLoading && !capturedImage && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-slate-900">
                      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="font-black text-xs uppercase tracking-widest text-emerald-400">Calibrating Lens...</p>
                  </div>
              )}
              {camError && !capturedImage && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-20 bg-slate-900">
                      <div className="bg-rose-500/20 p-6 rounded-[2.5rem] mb-6 border border-rose-500/30">
                          <PhotoIcon className="w-12 h-12 text-rose-500 mx-auto mb-4" />
                          <p className="font-black text-lg uppercase tracking-tight text-white">{camError}</p>
                          <p className="text-slate-400 text-sm mt-2">Check browser permissions or try uploading a file instead.</p>
                      </div>
                      <button onClick={startCamera} className="bg-white text-slate-900 font-black uppercase text-xs tracking-widest px-8 py-4 rounded-2xl mb-4">Retry Camera</button>
                      <button onClick={() => fileInputRef.current?.click()} className="text-emerald-400 font-bold uppercase text-xs">Choose from Library</button>
                  </div>
              )}
              {!capturedImage ? (
                  <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                  <img src={capturedImage} className="w-full h-full object-contain bg-black" alt="Captured" />
              )}
           </div>
        )}

        {mode === 'restaurant' && !capturedImage && (
            <div className="absolute inset-x-6 bottom-48 z-20">
                <div className="bg-white rounded-[2rem] p-6 text-slate-800 animate-slide-up shadow-2xl border border-slate-100">
                    <h3 className="font-black uppercase tracking-widest text-[10px] text-slate-400 mb-3 flex items-center gap-2">
                        <MapPinIcon className="w-3 h-3 text-emerald-500" /> {isLocating ? 'Scanning Vitals...' : 'Select Menu Source'}
                    </h3>
                    <select 
                        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black uppercase outline-none focus:border-indigo-500 transition-all"
                        value={selectedPlace?.uri || ''}
                        onChange={(e) => setSelectedPlace(nearbyPlaces.find(p => p.uri === e.target.value) || null)}
                    >
                        {nearbyPlaces.map((p, i) => <option key={i} value={p.uri}>{p.title}</option>)}
                        {nearbyPlaces.length === 0 && <option>Current Location</option>}
                    </select>
                </div>
            </div>
        )}
      </div>

      <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />

      {!capturedImage && mode !== 'barcode' && mode !== 'search' && (
        <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black to-transparent flex flex-col items-center gap-8">
            <div className="flex items-center gap-10">
                <button onClick={() => fileInputRef.current?.click()} className="p-4 bg-white/10 rounded-full border border-white/10 text-white/80 hover:text-white transition-all active:scale-90">
                    <UploadIcon />
                </button>
                <button onClick={takePhoto} className="w-24 h-24 bg-white rounded-full border-[6px] border-emerald-500/50 flex items-center justify-center active:scale-95 transition shadow-2xl">
                    <div className="w-16 h-16 bg-white rounded-full border-4 border-slate-100"></div>
                </button>
                <div className="w-14" /> {/* Spacer */}
            </div>
            
            <div className="flex gap-2 overflow-x-auto w-full justify-center no-scrollbar bg-black/40 p-2 rounded-[2.5rem] backdrop-blur-2xl border border-white/10">
                {[
                    { id: 'search', label: 'Search', icon: <SearchIcon /> },
                    { id: 'barcode', label: 'Scan', icon: <BarcodeIcon /> },
                    { id: 'meal', label: 'Macros', icon: <CameraIcon /> },
                    { id: 'pantry', label: 'Pantry', icon: <ChefHatIcon /> },
                    { id: 'restaurant', label: 'Chef', icon: <UtensilsIcon /> }
                ].map(m => (
                    <button key={m.id} onClick={() => setMode(m.id as CaptureMode)} className={`flex-1 py-4 px-2 flex flex-col items-center gap-1.5 rounded-[1.8rem] transition-all duration-300 ${mode === m.id ? 'bg-emerald-500 text-white shadow-lg scale-105' : 'text-white/40 hover:text-white/80'}`}>
                        <div className={`${mode === m.id ? 'scale-110' : 'scale-90'}`}>{m.icon}</div>
                        <span className="text-[9px] uppercase font-black tracking-widest">{m.label}</span>
                    </button>
                ))}
            </div>
        </div>
      )}

      {(capturedImage || mode === 'barcode' || mode === 'search') && (
          <div className="absolute bottom-0 left-0 right-0 p-8 flex gap-4 bg-black/80 backdrop-blur-3xl border-t border-white/10">
              <button onClick={() => { setCapturedImage(null); if(mode !== 'barcode' && mode !== 'search') startCamera(); }} className="flex-1 py-5 bg-white/10 rounded-[2rem] font-black uppercase text-[10px] tracking-[0.2em] border border-white/10">Retake</button>
              {capturedImage && (
                  <button onClick={() => onCapture(capturedImage, mode)} className="flex-[2] py-5 bg-emerald-500 rounded-[2rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-emerald-900/40 active:scale-95 transition-all">
                      {mode === 'pantry' ? 'Run PantryChef' : mode === 'restaurant' ? 'Run MasterChef' : 'Run MacrosChef'}
                  </button>
              )}
          </div>
      )}
    </div>
  );
};
