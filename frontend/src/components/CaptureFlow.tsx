
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { XIcon, CameraIcon, BarcodeIcon, ChefHatIcon, UtensilsIcon, UserCircleIcon, MapPinIcon } from './icons';
import { BarcodeScanner } from './BarcodeScanner';
import type { MealLogEntry } from '../types';
import * as apiService from '../services/apiService';

interface CaptureFlowProps {
  onClose: () => void;
  onCapture: (image: string | null, mode: 'meal' | 'barcode' | 'pantry' | 'restaurant', barcode?: string) => void;
  lastMeal?: MealLogEntry;
  onRepeatMeal: (meal: MealLogEntry) => void;
  onBodyScanClick: () => void;
  initialMode?: 'meal' | 'barcode' | 'pantry' | 'restaurant';
}

type CaptureMode = 'barcode' | 'meal' | 'pantry' | 'restaurant';

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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Restaurant Mode State
  const [nearbyPlaces, setNearbyPlaces] = useState<apiService.MapPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<apiService.MapPlace | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (mode === 'barcode') return;
    const startCamera = async () => {
      try {
        const ms = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        setStream(ms);
        if (videoRef.current) videoRef.current.srcObject = ms;
      } catch (err) { console.error(err); }
    };
    startCamera();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, [mode]);

  useEffect(() => {
    if (mode === 'restaurant') {
        findNearbyRestaurants();
    }
  }, [mode]);

  const findNearbyRestaurants = () => {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(async (pos) => {
          try {
              const res = await apiService.searchNearbyRestaurants(pos.coords.latitude, pos.coords.longitude);
              setNearbyPlaces(res.places);
              if (res.places.length > 0) setSelectedPlace(res.places[0]);
          } catch (e) { console.error(e); }
          finally { setIsLocating(false); }
      }, (err) => { 
          console.error(err); 
          setIsLocating(false); 
      });
  };

  const handleCheckIn = async () => {
      if (!selectedPlace) return;
      setIsAnalyzing(true);
      try {
          await apiService.checkInAtLocation(selectedPlace.title);
          alert(`Checked in at ${selectedPlace.title}! Points earned.`);
          onClose();
      } catch (e) { alert("Check-in failed."); }
      finally { setIsAnalyzing(false); }
  };

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      setCapturedImage(canvas.toDataURL('image/jpeg', 0.7));
    }
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col font-sans text-white">
      <input type="file" accept="image/*" ref={fileInputRef} className="hidden" />

      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-20">
        <button onClick={onClose} className="p-2 bg-black/20 backdrop-blur rounded-full"><XIcon /></button>
        <button onClick={onBodyScanClick} className="p-2 bg-black/20 backdrop-blur rounded-full flex items-center gap-2">
            <UserCircleIcon /> <span className="text-xs font-bold uppercase">Body Hub</span>
        </button>
      </div>

      <div className="flex-grow relative bg-slate-900">
        {mode === 'barcode' ? (
           <BarcodeScanner onScanSuccess={(code) => onCapture(null, 'barcode', code)} onCancel={() => setMode('meal')} />
        ) : (
           <>
              {!capturedImage ? (
                  <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                  <img src={capturedImage} className="w-full h-full object-contain" alt="Captured" />
              )}
           </>
        )}

        {mode === 'restaurant' && !capturedImage && (
            <div className="absolute inset-0 bg-black/40 z-10 flex flex-col justify-end px-6 pb-40">
                <div className="bg-white rounded-2xl p-4 text-slate-800 animate-fade-in shadow-2xl">
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                        <MapPinIcon /> {isLocating ? 'Locating...' : 'Select Restaurant'}
                    </h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {nearbyPlaces.map((p, i) => (
                            <button 
                                key={i} onClick={() => setSelectedPlace(p)}
                                className={`w-full text-left p-3 rounded-xl border transition-all ${selectedPlace?.uri === p.uri ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : 'border-slate-100 hover:bg-slate-50'}`}
                            >
                                <p className="font-bold text-sm">{p.title}</p>
                            </button>
                        ))}
                    </div>
                    <button 
                        onClick={handleCheckIn}
                        disabled={!selectedPlace || isAnalyzing}
                        className="w-full mt-4 bg-emerald-500 text-white font-bold py-3 rounded-xl hover:bg-emerald-600 disabled:opacity-50"
                    >
                        {isAnalyzing ? 'Processing...' : `Check-in at ${selectedPlace?.title || '...'}`}
                    </button>
                </div>
            </div>
        )}
      </div>

      {!capturedImage && mode !== 'barcode' && (
        <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black to-transparent flex flex-col items-center gap-6">
            <button onClick={takePhoto} className="w-20 h-20 bg-white rounded-full border-4 border-slate-300 active:scale-95 transition" />
            <div className="flex gap-4 overflow-x-auto w-full justify-center no-scrollbar">
                {[
                    { id: 'barcode', label: 'Scan', icon: <BarcodeIcon /> },
                    { id: 'meal', label: 'Meal', icon: <CameraIcon /> },
                    { id: 'pantry', label: 'Pantry', icon: <ChefHatIcon /> },
                    { id: 'restaurant', label: 'Dine', icon: <UtensilsIcon /> }
                ].map(m => (
                    <button key={m.id} onClick={() => setMode(m.id as CaptureMode)} className={`flex flex-col items-center gap-1 ${mode === m.id ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {m.icon} <span className="text-[10px] uppercase font-bold">{m.label}</span>
                    </button>
                ))}
            </div>
        </div>
      )}

      {capturedImage && (
          <div className="absolute bottom-0 left-0 right-0 p-6 flex gap-4 bg-black/60">
              <button onClick={() => setCapturedImage(null)} className="flex-1 py-4 bg-slate-800 rounded-xl font-bold">Retake</button>
              <button onClick={() => onCapture(capturedImage, mode)} className="flex-1 py-4 bg-emerald-500 rounded-xl font-bold">Analyze</button>
          </div>
      )}
    </div>
  );
};
