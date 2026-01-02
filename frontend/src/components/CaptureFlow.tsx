
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { XIcon, CameraIcon, BarcodeIcon, ChefHatIcon, UtensilsIcon, UserCircleIcon, MapPinIcon, SearchIcon } from './icons';
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
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mode, setMode] = useState<CaptureMode>(initialMode);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<apiService.MapPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<apiService.MapPlace | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (mode === 'barcode' || mode === 'search') return;
    const startCamera = async () => {
      try {
        const ms = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        setStream(ms);
        if (videoRef.current) videoRef.current.srcObject = ms;
      } catch (err) { console.error(err); }
    };
    startCamera();
    return () => {
        if (stream) stream.getTracks().forEach(t => t.stop());
    };
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
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-20">
        <button onClick={onClose} className="p-2 bg-black/20 backdrop-blur rounded-full"><XIcon /></button>
        <button onClick={onBodyScanClick} className="p-2 bg-black/20 backdrop-blur rounded-full flex items-center gap-2">
            <UserCircleIcon /> <span className="text-xs font-bold uppercase">Body Hub</span>
        </button>
      </div>

      <div className="flex-grow relative bg-slate-900 flex flex-col items-center justify-center">
        {mode === 'barcode' ? (
           <BarcodeScanner onScanSuccess={(code) => onCapture(null, 'barcode', code)} onCancel={() => setMode('meal')} />
        ) : mode === 'search' ? (
            <div className="w-full max-w-md p-8 animate-fade-in">
                <h3 className="text-2xl font-black mb-6 text-center uppercase tracking-tighter">Manual Search</h3>
                <input 
                    type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search meal or ingredient..."
                    className="w-full p-5 bg-white/10 border-2 border-white/20 rounded-[2rem] text-xl font-medium outline-none focus:border-emerald-500 focus:bg-white/20 transition-all"
                    autoFocus
                />
                <button 
                    onClick={() => onCapture(null, 'search', undefined, searchQuery)}
                    disabled={!searchQuery.trim()}
                    className="w-full mt-6 py-5 bg-emerald-500 rounded-[2rem] font-black uppercase tracking-widest shadow-xl active:scale-95 disabled:opacity-30"
                >
                    Analyze Text
                </button>
            </div>
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
            <div className="absolute inset-x-4 bottom-40 z-10">
                <div className="bg-white rounded-3xl p-5 text-slate-800 animate-slide-up shadow-2xl">
                    <h3 className="font-black uppercase tracking-widest text-[10px] text-slate-400 mb-3 flex items-center gap-2">
                        <MapPinIcon className="w-3 h-3" /> {isLocating ? 'Locating...' : 'Verify Location'}
                    </h3>
                    <select 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold mb-2 outline-none focus:ring-2 focus:ring-indigo-500"
                        value={selectedPlace?.uri || ''}
                        onChange={(e) => setSelectedPlace(nearbyPlaces.find(p => p.uri === e.target.value) || null)}
                    >
                        {nearbyPlaces.map((p, i) => <option key={i} value={p.uri}>{p.title}</option>)}
                        {nearbyPlaces.length === 0 && <option>No nearby places found</option>}
                    </select>
                </div>
            </div>
        )}
      </div>

      {!capturedImage && mode !== 'barcode' && mode !== 'search' && (
        <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black to-transparent flex flex-col items-center gap-6">
            <button onClick={takePhoto} className="w-20 h-20 bg-white rounded-full border-4 border-slate-300 active:scale-95 transition" />
            <div className="flex gap-2 overflow-x-auto w-full justify-center no-scrollbar bg-white/10 p-2 rounded-[2rem] backdrop-blur-md">
                {[
                    { id: 'search', label: 'Search', icon: <SearchIcon /> },
                    { id: 'barcode', label: 'Scan', icon: <BarcodeIcon /> },
                    { id: 'meal', label: 'Snap', icon: <CameraIcon /> },
                    { id: 'pantry', label: 'Pantry', icon: <ChefHatIcon /> },
                    { id: 'restaurant', label: 'Dine', icon: <UtensilsIcon /> }
                ].map(m => (
                    <button key={m.id} onClick={() => setMode(m.id as CaptureMode)} className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 rounded-2xl transition-all ${mode === m.id ? 'bg-white text-slate-900 shadow-xl scale-105' : 'text-white/60 hover:text-white'}`}>
                        {m.icon} <span className="text-[8px] uppercase font-black tracking-tighter">{m.label}</span>
                    </button>
                ))}
            </div>
        </div>
      )}

      {(capturedImage || mode === 'barcode' || mode === 'search') && (
          <div className="absolute bottom-0 left-0 right-0 p-6 flex gap-4 bg-black/60 backdrop-blur-md">
              <button onClick={() => { setCapturedImage(null); setMode('meal'); }} className="flex-1 py-5 bg-white/10 rounded-[2rem] font-black uppercase text-xs tracking-widest">Back</button>
              {capturedImage && (
                  <button onClick={() => onCapture(capturedImage, mode)} className="flex-[2] py-5 bg-emerald-500 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl">
                      {mode === 'pantry' ? 'Find Recipes' : mode === 'restaurant' ? 'Reconstruct Meal' : 'Extract Macros'}
                  </button>
              )}
          </div>
      )}
    </div>
  );
};
