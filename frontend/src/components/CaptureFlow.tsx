
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { XIcon, CameraIcon, BarcodeIcon, ChefHatIcon, UtensilsIcon, UserCircleIcon, MapPinIcon, SearchIcon, UploadIcon, PhotoIcon, ActivityIcon } from './icons';
import { BarcodeScanner } from './BarcodeScanner';
import type { MealLogEntry } from '../types';
import * as apiService from '../services/apiService';

interface CaptureFlowProps {
  onClose: () => void;
  onCapture: (image: string | null, mode: 'meal' | 'barcode' | 'pantry' | 'restaurant' | 'search' | 'vitals', barcode?: string, searchQuery?: string) => void;
  onBodyScanClick: () => void;
  initialMode?: 'meal' | 'barcode' | 'pantry' | 'restaurant' | 'search' | 'vitals';
}

type CaptureMode = 'barcode' | 'meal' | 'pantry' | 'restaurant' | 'search' | 'vitals';

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

  const startCamera = async () => {
    try {
      const ms = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(ms);
      if (videoRef.current) videoRef.current.srcObject = ms;
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (mode === 'barcode' || mode === 'search') return;
    startCamera();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, [mode]);

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    const img = canvas.toDataURL('image/jpeg');
    setCapturedImage(img);
  };

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col font-sans text-white">
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-50 bg-gradient-to-b from-black/80 to-transparent">
        <h2 className="font-black text-lg uppercase tracking-tighter text-emerald-400">{mode === 'vitals' ? 'Vision Sync' : 'Kitchen AI'}</h2>
        <button onClick={onClose} className="p-3 bg-white/10 backdrop-blur-xl rounded-2xl"><XIcon /></button>
      </div>

      <div className="flex-grow flex items-center justify-center overflow-hidden bg-slate-900">
        {mode === 'barcode' ? <BarcodeScanner onScanSuccess={c => onCapture(null, 'barcode', c)} onCancel={() => setMode('meal')} /> : (
            capturedImage ? <img src={capturedImage} className="w-full h-full object-contain" alt="Captured" /> : <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
        )}
      </div>

      <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={e => {
          const reader = new FileReader();
          reader.onload = ev => setCapturedImage(ev.target?.result as string);
          if (e.target.files?.[0]) reader.readAsDataURL(e.target.files[0]);
      }} />

      <div className="p-8 bg-black/80 flex flex-col items-center gap-6">
        {!capturedImage ? (
            <div className="flex items-center gap-6">
                <button onClick={() => fileInputRef.current?.click()} className="p-4 bg-white/10 rounded-full"><UploadIcon /></button>
                <button onClick={takePhoto} className="w-20 h-20 bg-white rounded-full flex items-center justify-center"><div className="w-16 h-16 border-4 border-emerald-500 rounded-full"></div></button>
                <div className="w-10"></div>
            </div>
        ) : (
            <button onClick={() => onCapture(capturedImage, mode)} className="w-full py-4 bg-emerald-500 rounded-2xl font-black uppercase tracking-widest">Execute Vision Analysis</button>
        )}
        
        <div className="flex gap-2 overflow-x-auto w-full no-scrollbar pb-2">
            {[
                { id: 'meal', label: 'Macros', icon: <CameraIcon /> },
                { id: 'vitals', label: 'Vitals', icon: <ActivityIcon /> },
                { id: 'pantry', label: 'Pantry', icon: <ChefHatIcon /> },
                { id: 'restaurant', label: 'Chef', icon: <UtensilsIcon /> }
            ].map(m => (
                <button key={m.id} onClick={() => setMode(m.id as any)} className={`flex-1 py-3 px-2 rounded-2xl transition-all ${mode === m.id ? 'bg-emerald-500 text-white' : 'text-white/40'}`}>
                    <div className="scale-75 mb-1 flex justify-center">{m.icon}</div>
                    <p className="text-[8px] font-black uppercase text-center">{m.label}</p>
                </button>
            ))}
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
