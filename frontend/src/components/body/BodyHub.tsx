
import React, { useState, useEffect, useRef } from 'react';
import { ActivityIcon, FireIcon, PlusIcon, CameraIcon, UserCircleIcon, GlobeAltIcon, TrophyIcon, XIcon, DumbbellIcon, RunningIcon, ClockIcon } from '../icons';
import * as apiService from '../../services/apiService';
import type { HealthStats, UserDashboardPrefs, BodyPhoto } from '../../types';
import { FormAnalysis } from './FormAnalysis';
import { ImageViewModal } from '../ImageViewModal';

interface BodyHubProps {
    healthStats: HealthStats;
    onSyncHealth: (source?: 'apple' | 'fitbit') => void;
    dashboardPrefs: UserDashboardPrefs;
    onUpdatePrefs: (prefs: UserDashboardPrefs) => void;
}

type BodyTab = '3d_scan' | 'images' | 'workout' | 'form_check';
const POSE_TEMPLATES = ['Front', 'Side', 'Back'];

export const BodyHub: React.FC<BodyHubProps> = ({ healthStats }) => {
    const [activeTab, setActiveTab] = useState<BodyTab>('3d_scan');
    
    // Gallery States
    const [photos, setPhotos] = useState<BodyPhoto[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [uploadImage, setUploadImage] = useState<string | null>(null); // For modal preview
    const [uploadCategory, setUploadCategory] = useState('Front'); // Default for pose templates
    const [isUploading, setIsUploading] = useState(false);
    const [viewPhotoId, setViewPhotoId] = useState<number | null>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    // Initial Load
    useEffect(() => {
        loadPhotos();
    }, []);

    const loadPhotos = async () => {
        try {
            const data = await apiService.getBodyPhotos();
            setPhotos(data);
        } catch (e) {
            console.error("Failed to load body photos", e);
        }
    };

    // --- Actions ---

    const handleStartBodyScan = () => {
        const token = localStorage.getItem('embracehealth-api-token');
        const baseUrl = 'https://app.embracehealth.ai/';
        // Use standard redirect for seamless feel between apps
        if (token) {
            window.location.href = `${baseUrl}?token=${encodeURIComponent(token)}`;
        } else {
            window.location.href = baseUrl;
        }
    };

    // Gallery Handlers
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setUploadImage(reader.result as string);
        };
        reader.readAsDataURL(file);
        e.target.value = ''; // Reset input
    };

    const handleConfirmUpload = async () => {
        if (!uploadImage) return;
        setIsUploading(true);
        try {
            await apiService.uploadBodyPhoto(uploadImage, uploadCategory);
            setUploadImage(null);
            setUploadCategory('Front');
            loadPhotos();
        } catch (e) {
            alert("Failed to upload photo.");
        } finally {
            setIsUploading(false);
        }
    };

    // Filter Logic
    const filteredPhotos = selectedCategory === 'All' 
        ? photos.filter(p => p.category !== '3D Scan') 
        : photos.filter(p => p.category === selectedCategory);

    const scansHistory = photos.filter(p => p.category === '3D Scan');

    // --- Renderers ---

    const render3DScan = () => (
        <div className="space-y-8 animate-fade-in">
            {/* Hero CTA */}
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform duration-700 pointer-events-none">
                    <UserCircleIcon className="w-64 h-64" />
                </div>
                <div className="relative z-10 max-w-lg">
                    <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 border border-indigo-500/30">
                        <ActivityIcon className="w-3 h-3" /> EmbraceHealth 3D
                    </div>
                    <h3 className="text-3xl font-black mb-3">Launch 3D Scanner</h3>
                    <p className="text-indigo-100/70 text-lg font-medium leading-relaxed mb-8">
                        Generate a clinical-grade 3D avatar. Track precise muscle gain, body fat percentage, and posture alignment.
                    </p>
                    <button 
                        onClick={handleStartBodyScan}
                        className="bg-emerald-500 hover:bg-emerald-400 text-white font-black py-4 px-8 rounded-2xl shadow-xl transform active:scale-95 transition-all flex items-center gap-3 text-lg"
                    >
                        <span>Capture Scan</span>
                        <PlusIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* History & Future */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                    <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                        <ClockIcon className="w-4 h-4 text-indigo-500" /> Scan History
                    </h3>
                    {scansHistory.length > 0 ? (
                        <div className="space-y-3">
                            {scansHistory.map(scan => (
                                <div key={scan.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-sm font-bold text-slate-700">{new Date(scan.createdAt).toLocaleDateString()}</span>
                                    <button onClick={() => setViewPhotoId(scan.id)} className="text-[10px] font-black uppercase text-indigo-600 bg-white px-3 py-1.5 rounded-lg shadow-sm">View Report</button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-400 text-sm font-medium">No 3D scans recorded yet.</div>
                    )}
                </div>

                <div className="bg-gradient-to-br from-fuchsia-50 to-pink-50 p-6 rounded-[2rem] border border-fuchsia-100 shadow-sm flex flex-col justify-center text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-fuchsia-500"><GlobeAltIcon className="w-24 h-24" /></div>
                    <h3 className="font-black text-fuchsia-900 uppercase tracking-widest text-xs mb-2">Predictive AI</h3>
                    <h2 className="text-2xl font-black text-slate-900 mb-2">Future Me</h2>
                    <p className="text-slate-600 text-sm mb-6">Visualize your physique based on current trajectory.</p>
                    <button className="bg-white text-fuchsia-600 font-bold py-3 px-6 rounded-xl shadow-md text-xs uppercase tracking-widest mx-auto hover:bg-fuchsia-50 transition-colors">
                        Generate Prediction
                    </button>
                </div>
            </div>
        </div>
    );

    const renderImages = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900">Progress Gallery</h3>
                <button 
                    onClick={() => galleryInputRef.current?.click()}
                    className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-black transition-all flex items-center gap-2"
                >
                    <CameraIcon className="w-4 h-4" /> Capture
                </button>
                <input type="file" accept="image/*" capture="environment" ref={galleryInputRef} onChange={handleFileSelect} className="hidden" />
            </div>

            {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                {['All', 'Front', 'Side', 'Back'].map(cat => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border-2 ${
                            selectedCategory === cat 
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700' 
                            : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Grid */}
            {filteredPhotos.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {filteredPhotos.map(photo => (
                        <button 
                            key={photo.id} 
                            onClick={() => setViewPhotoId(photo.id)}
                            className="relative group rounded-2xl overflow-hidden shadow-sm aspect-[3/4] bg-slate-100 flex flex-col items-center justify-center p-4 transition-all hover:scale-[1.02] active:scale-95 border border-slate-200"
                        >
                            <div className="bg-white p-3 rounded-full shadow-sm mb-3">
                                <CameraIcon className="w-6 h-6 text-slate-300" />
                            </div>
                            <span className="font-black text-slate-700 text-sm uppercase">{photo.category}</span>
                            <span className="text-slate-400 text-xs font-bold mt-1">{new Date(photo.createdAt).toLocaleDateString()}</span>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
                    <CameraIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-400 font-bold text-sm">No photos yet. Start tracking!</p>
                </div>
            )}
        </div>
    );

    const renderWorkout = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100 text-center">
                    <TrophyIcon className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <h4 className="font-black text-emerald-800 uppercase text-xs tracking-widest">This Week</h4>
                    <p className="text-3xl font-black text-slate-900 mt-1">4 <span className="text-sm text-slate-400 font-bold">Sessions</span></p>
                </div>
                <div className="bg-orange-50 p-6 rounded-[2rem] border border-orange-100 text-center">
                    <FireIcon className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                    <h4 className="font-black text-orange-800 uppercase text-xs tracking-widest">Intensity</h4>
                    <p className="text-3xl font-black text-slate-900 mt-1">High <span className="text-sm text-slate-400 font-bold">Avg</span></p>
                </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <ActivityIcon className="w-5 h-5 text-indigo-500" /> Actual vs Ideal
                </h3>
                {/* Placeholder Chart */}
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                            <span className="text-slate-500">Volume Load</span>
                            <span className="text-slate-900">85% of Goal</span>
                        </div>
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 w-[85%] rounded-full"></div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                            <span className="text-slate-500">Frequency</span>
                            <span className="text-slate-900">100% of Goal</span>
                        </div>
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 w-full rounded-full"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20">
            {viewPhotoId && <ImageViewModal itemId={viewPhotoId} type="body" onClose={() => setViewPhotoId(null)} />}

            {/* Upload Modal with Pose Templates */}
            {uploadImage && (
                <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden animate-slide-up relative">
                        <div className="relative">
                            <img src={uploadImage} alt="Preview" className="w-full h-80 object-cover" />
                            {/* SVG Overlay Template */}
                            <div className="absolute inset-0 pointer-events-none opacity-30 border-4 border-emerald-500/50">
                                {/* Simple outline simulation based on pose */}
                                {uploadCategory === 'Front' && <div className="w-1/3 h-2/3 border-2 border-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"></div>}
                                {uploadCategory === 'Side' && <div className="w-1/6 h-2/3 border-2 border-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"></div>}
                                <div className="absolute bottom-4 left-0 right-0 text-center text-white font-black uppercase tracking-widest text-xs drop-shadow-md">
                                    Align {uploadCategory} Pose
                                </div>
                            </div>
                            <button onClick={() => setUploadImage(null)} className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full backdrop-blur-md">
                                <XIcon />
                            </button>
                        </div>
                        
                        <div className="p-6">
                            <h3 className="font-black text-slate-900 text-lg mb-4">Confirm Orientation</h3>
                            <div className="flex justify-between mb-6 bg-slate-100 p-1 rounded-xl">
                                {POSE_TEMPLATES.map(pose => (
                                    <button
                                        key={pose}
                                        onClick={() => setUploadCategory(pose)}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${uploadCategory === pose ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}
                                    >
                                        {pose}
                                    </button>
                                ))}
                            </div>
                            <button 
                                onClick={handleConfirmUpload} 
                                disabled={isUploading}
                                className="w-full bg-emerald-500 text-white font-black uppercase tracking-widest py-4 rounded-2xl shadow-lg active:scale-95 disabled:opacity-50"
                            >
                                {isUploading ? 'Uploading...' : 'Save to Gallery'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <header className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Body Hub</h2>
                    <p className="text-slate-500 font-medium">Physical intelligence & recovery metrics.</p>
                </div>
                {/* Tab Navigation */}
                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 w-full md:w-auto overflow-x-auto no-scrollbar">
                    <button onClick={() => setActiveTab('3d_scan')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === '3d_scan' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>3D Scan</button>
                    <button onClick={() => setActiveTab('images')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'images' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Images</button>
                    <button onClick={() => setActiveTab('workout')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'workout' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Log</button>
                    <button onClick={() => setActiveTab('form_check')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'form_check' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Form AI</button>
                </div>
            </header>

            {/* Tab Content */}
            <div className="min-h-[400px]">
                {activeTab === '3d_scan' && render3DScan()}
                {activeTab === 'images' && renderImages()}
                {activeTab === 'workout' && renderWorkout()}
                {activeTab === 'form_check' && (
                    <div className="h-[600px] relative rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-sm">
                        <FormAnalysis onClose={() => setActiveTab('3d_scan')} />
                    </div>
                )}
            </div>

            {/* Bottom Widgets (Always Visible) */}
            {activeTab !== 'form_check' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-8 border-t border-slate-100">
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 text-center">
                        <ActivityIcon className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Steps</p>
                        <p className="font-black text-slate-800">{healthStats.steps.toLocaleString()}</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 text-center">
                        <FireIcon className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Active Cal</p>
                        <p className="font-black text-slate-800">{Math.round(healthStats.activeCalories)}</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 text-center">
                        <DumbbellIcon className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Weight</p>
                        <p className="font-black text-slate-800">{healthStats.weightLbs ? `${healthStats.weightLbs} lbs` : '--'}</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 text-center">
                        <RunningIcon className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Cardio</p>
                        <p className="font-black text-slate-800">{healthStats.vo2Max || '--'}</p>
                    </div>
                </div>
            )}
        </div>
    );
};
