
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
    initialTab?: '3d_scan' | 'images' | 'workout' | 'form_check';
}

type BodyTab = '3d_scan' | 'images' | 'workout' | 'form_check';

// Define the 10 specific poses for the 2x5 grid
const BODY_POSE_GRID = [
    { id: 'Front Double Bicep', label: 'Front Double Bicep', row: 1 },
    { id: 'Front Lat Spread', label: 'Front Lat Spread', row: 1 },
    { id: 'Side Chest Left', label: 'Side Chest Left', row: 1 },
    { id: 'Side Chest Right', label: 'Side Chest Right', row: 1 },
    { id: 'Abs & Thighs', label: 'Abs & Thighs', row: 1 },
    { id: 'Back Double Bicep', label: 'Back Double Bicep', row: 2 },
    { id: 'Back Lat Spread', label: 'Back Lat Spread', row: 2 },
    { id: 'Side Tricep Left', label: 'Side Tricep Left', row: 2 },
    { id: 'Side Tricep Right', label: 'Side Tricep Right', row: 2 },
    { id: 'Most Muscular', label: 'Most Muscular', row: 2 },
];

const BodybuilderOutline: React.FC<{ pose: string; className?: string }> = ({ pose, className }) => {
    // Simplified SVG paths representing abstract muscle outlines
    let path = "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"; // Default User

    if (pose.includes('Double Bicep')) {
        path = "M12 2a3 3 0 100 6 3 3 0 000-6zm-5 7l-2 2-2-1 1-3 3 2zm10 0l2 2 2-1-1-3-3 2zM6 11v6l2 4h8l2-4v-6H6z"; 
    } else if (pose.includes('Lat Spread')) {
        path = "M12 2a3 3 0 100 6 3 3 0 000-6zM4 9l2 3 2-1-1-2-3 0zm16 0l-2 3-2-1 1-2 3 0zM7 11v8l5 3 5-3v-8H7z";
    } else if (pose.includes('Side Chest')) {
        path = "M12 2a3 3 0 100 6 3 3 0 000-6zM9 9l-1 4 2 6 2-6-1-4H9zm6 0l1 4-2 6-2-6 1-4h2z";
    } else if (pose.includes('Tricep')) {
        path = "M12 2a3 3 0 100 6 3 3 0 000-6zM10 9v10l2 3 2-3V9h-4z";
    } else if (pose.includes('Abs')) {
        path = "M12 2a3 3 0 100 6 3 3 0 000-6zM7 9h10v6l-5 5-5-5V9zm3 2h4v2h-4v-2z";
    }

    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d={path} opacity="0.2" />
        </svg>
    );
};

export const BodyHub: React.FC<BodyHubProps> = ({ healthStats, initialTab = '3d_scan' }) => {
    const [activeTab, setActiveTab] = useState<BodyTab>(initialTab);
    
    // Gallery States
    const [photos, setPhotos] = useState<BodyPhoto[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null); // Track which grid slot is clicked
    const [uploadImage, setUploadImage] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [viewPhotoId, setViewPhotoId] = useState<number | null>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    // Sync prop to state if it changes
    useEffect(() => {
        if (initialTab) setActiveTab(initialTab);
    }, [initialTab]);

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

    const handleStartBodyScan = () => {
        const token = localStorage.getItem('embracehealth-api-token');
        const baseUrl = 'https://app.embracehealth.ai/';
        if (token) {
            window.location.href = `${baseUrl}?token=${encodeURIComponent(token)}`;
        } else {
            window.location.href = baseUrl;
        }
    };

    const handleSlotClick = (poseId: string, existingPhotoId?: number) => {
        if (existingPhotoId) {
            setViewPhotoId(existingPhotoId);
        } else {
            setSelectedCategory(poseId);
            galleryInputRef.current?.click();
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setUploadImage(reader.result as string);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleConfirmUpload = async () => {
        if (!uploadImage || !selectedCategory) return;
        setIsUploading(true);
        try {
            await apiService.uploadBodyPhoto(uploadImage, selectedCategory);
            setUploadImage(null);
            setSelectedCategory(null);
            loadPhotos();
        } catch (e) {
            alert("Failed to upload photo.");
        } finally {
            setIsUploading(false);
        }
    };

    const scansHistory = photos.filter(p => p.category === '3D Scan');

    const render3DScan = () => (
        <div className="space-y-8 animate-fade-in">
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

    const renderImages = () => {
        // Find latest photo for each pose
        const latestPhotos: Record<string, BodyPhoto> = {};
        photos.forEach(p => {
            if (BODY_POSE_GRID.some(pose => pose.id === p.category)) {
                // If newer or first found
                if (!latestPhotos[p.category] || new Date(p.createdAt) > new Date(latestPhotos[p.category].createdAt)) {
                    latestPhotos[p.category] = p;
                }
            }
        });

        return (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center px-2">
                    <div>
                        <h3 className="text-xl font-black text-slate-900">Physique Check-In</h3>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Update your visual progress log</p>
                    </div>
                    {/* Hidden input for slot clicks */}
                    <input type="file" accept="image/*" capture="environment" ref={galleryInputRef} onChange={handleFileSelect} className="hidden" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {BODY_POSE_GRID.map((pose) => {
                        const existing = latestPhotos[pose.id];
                        return (
                            <button 
                                key={pose.id}
                                onClick={() => handleSlotClick(pose.id, existing?.id)}
                                className="relative aspect-[3/4] rounded-2xl bg-slate-100 overflow-hidden border-2 border-slate-200 hover:border-indigo-400 hover:shadow-lg transition-all group flex flex-col items-center justify-end p-2"
                            >
                                {/* Background Outline or Image */}
                                {existing && existing.hasImage ? (
                                    <div className="absolute inset-0 bg-slate-200">
                                        <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold bg-white">
                                            <CameraIcon className="w-8 h-8 opacity-50" />
                                        </div>
                                        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                                    </div>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center p-4">
                                        <BodybuilderOutline pose={pose.label} className="w-full h-full text-slate-300" />
                                    </div>
                                )}

                                {/* Overlay Label */}
                                <div className="relative z-10 w-full text-center">
                                    {existing ? (
                                        <span className="bg-emerald-500 text-white text-[9px] font-black uppercase px-2 py-1 rounded-full shadow-sm">
                                            {new Date(existing.createdAt).toLocaleDateString()}
                                        </span>
                                    ) : (
                                        <div className="bg-white/80 backdrop-blur-sm px-2 py-1 rounded-lg">
                                            <PlusIcon className="w-4 h-4 mx-auto text-indigo-500 mb-0.5" />
                                            <span className="text-[8px] font-black uppercase text-slate-600 block leading-tight">{pose.label}</span>
                                        </div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

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

            {/* Upload Modal with Visual Template */}
            {uploadImage && selectedCategory && (
                <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden animate-slide-up relative">
                        <div className="relative">
                            <img src={uploadImage} alt="Preview" className="w-full h-96 object-cover" />
                            {/* Overlay Template for Alignment */}
                            <div className="absolute inset-0 pointer-events-none opacity-40 border-4 border-emerald-500/50 flex items-center justify-center p-8">
                                <BodybuilderOutline pose={selectedCategory} className="w-full h-full text-white drop-shadow-lg" />
                            </div>
                            <div className="absolute bottom-4 left-0 right-0 text-center text-white font-black uppercase tracking-widest text-xs drop-shadow-md bg-black/30 py-2">
                                Align: {selectedCategory}
                            </div>
                            <button onClick={() => setUploadImage(null)} className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full backdrop-blur-md">
                                <XIcon />
                            </button>
                        </div>
                        
                        <div className="p-6">
                            <h3 className="font-black text-slate-900 text-lg mb-2">Confirm Upload</h3>
                            <p className="text-sm text-slate-500 mb-6">Does this photo match the <strong>{selectedCategory}</strong> pose?</p>
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
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Body + Fitness</h2>
                    <p className="text-slate-500 font-medium">Physical intelligence & recovery metrics.</p>
                </div>
                {/* Tab Navigation */}
                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 w-full md:w-auto overflow-x-auto no-scrollbar">
                    <button onClick={() => setActiveTab('3d_scan')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === '3d_scan' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>3D Scan</button>
                    <button onClick={() => setActiveTab('images')} className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'images' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Body Pics</button>
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
