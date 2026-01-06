
import React, { useState, useEffect, useRef } from 'react';
import { ActivityIcon, FireIcon, HeartIcon, ClockIcon, PlusIcon, CameraIcon, UserCircleIcon, GlobeAltIcon, TrophyIcon, PhotoIcon, XIcon } from '../icons';
import * as apiService from '../../services/apiService';
import type { HealthStats, ReadinessScore, RecoveryData, UserDashboardPrefs, BodyPhoto } from '../../types';
import { FormAnalysis } from './FormAnalysis';

interface BodyHubProps {
    healthStats: HealthStats;
    onSyncHealth: (source?: 'apple' | 'fitbit') => void;
    dashboardPrefs: UserDashboardPrefs;
    onUpdatePrefs: (prefs: UserDashboardPrefs) => void;
}

const BODY_CATEGORIES = ['All', 'General', 'Front', 'Back', 'Side', 'Left Arm', 'Right Arm', 'Left Leg', 'Right Leg'];

export const BodyHub: React.FC<BodyHubProps> = ({ healthStats, onSyncHealth, dashboardPrefs, onUpdatePrefs }) => {
    const [readiness, setReadiness] = useState<ReadinessScore | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [isLogOpen, setIsLogOpen] = useState(false);
    const [isFormCheckOpen, setIsFormCheckOpen] = useState(false);
    const [showWidgetConfig, setShowWidgetConfig] = useState(false);
    
    // Gallery States
    const [photos, setPhotos] = useState<BodyPhoto[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [uploadImage, setUploadImage] = useState<string | null>(null); // For modal preview
    const [uploadCategory, setUploadCategory] = useState('General');
    const [isUploading, setIsUploading] = useState(false);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    const [logForm, setLogForm] = useState<RecoveryData>({
        sleepMinutes: healthStats.sleepMinutes || 420,
        sleepQuality: 80,
        hrv: healthStats.hrv || 50,
        workoutIntensity: 5,
        timestamp: new Date().toISOString()
    });

    const getReadiness = async (data?: RecoveryData) => {
        setIsCalculating(true);
        try {
            const result = await apiService.calculateReadiness(data || logForm);
            setReadiness(result);
        } catch (e) {
            console.error(e);
        } finally {
            setIsCalculating(false);
        }
    };

    const loadPhotos = async () => {
        try {
            const data = await apiService.getBodyPhotos();
            setPhotos(data);
        } catch (e) {
            console.error("Failed to load body photos", e);
        }
    };

    useEffect(() => {
        if (healthStats.hrv) {
            getReadiness();
        }
        loadPhotos();
    }, [healthStats.hrv]);

    const handleLogSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCalculating(true);
        try {
            await apiService.logRecoveryStats(logForm);
            await getReadiness(logForm);
            setIsLogOpen(false);
            alert("Body metrics updated! Readiness score recalculated.");
        } catch (e) {
            alert("Failed to log metrics.");
        } finally {
            setIsCalculating(false);
        }
    };

    const handleToggleWidget = (id: string) => {
        let newList = [...dashboardPrefs.selectedWidgets];
        if (newList.includes(id)) {
            newList = newList.filter(item => item !== id);
        } else if (newList.length < 3) {
            newList.push(id);
        } else {
            alert("You can only select up to 3 widgets for the dashboard.");
            return;
        }
        onUpdatePrefs({ ...dashboardPrefs, selectedWidgets: newList });
    };

    const handleStartBodyScan = () => {
        const token = localStorage.getItem('embracehealth-api-token');
        const url = token 
            ? `https://app.embracehealth.ai?token=${encodeURIComponent(token)}`
            : 'https://app.embracehealth.ai';
        window.open(url, '_blank');
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
            setUploadCategory('General');
            loadPhotos();
        } catch (e) {
            alert("Failed to upload photo.");
        } finally {
            setIsUploading(false);
        }
    };

    const widgetOptions = [
        { id: 'steps', label: 'Steps', value: healthStats.steps.toLocaleString(), icon: <ActivityIcon /> },
        { id: 'activeCalories', label: 'Active Energy', value: `${Math.round(healthStats.activeCalories)} kcal`, icon: <FireIcon /> },
        { id: 'restingCalories', label: 'Resting Energy', value: `${Math.round(healthStats.restingCalories)} kcal`, icon: <TrophyIcon /> },
        { id: 'distanceMiles', label: 'Distance', value: `${healthStats.distanceMiles.toFixed(2)} mi`, icon: <GlobeAltIcon /> },
        { id: 'flightsClimbed', label: 'Flights', value: `${healthStats.flightsClimbed} floors`, icon: <ActivityIcon /> },
        { id: 'heartRate', label: 'Heart Rate', value: `${healthStats.heartRate || '--'} bpm`, icon: <HeartIcon /> }
    ];

    const filteredPhotos = selectedCategory === 'All' 
        ? photos 
        : photos.filter(p => p.category === selectedCategory);

    return (
        <div className="space-y-6 animate-fade-in pb-20 max-w-5xl mx-auto">
            {isFormCheckOpen && <FormAnalysis onClose={() => setIsFormCheckOpen(false)} />}

            {/* Upload Modal */}
            {uploadImage && (
                <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm animate-slide-up shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-black text-slate-800 text-lg">Categorize Photo</h3>
                            <button onClick={() => setUploadImage(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200">
                                <XIcon />
                            </button>
                        </div>
                        <img src={uploadImage} alt="Preview" className="w-full h-64 object-cover rounded-2xl mb-4 border border-slate-200" />
                        
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Select Angle / Type</label>
                        <div className="grid grid-cols-2 gap-2 mb-6">
                            {BODY_CATEGORIES.slice(1).map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setUploadCategory(cat)}
                                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                                        uploadCategory === cat 
                                        ? 'bg-indigo-600 text-white shadow-md' 
                                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    {cat}
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
            )}

            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Body Intelligence</h2>
                    <p className="text-slate-500 font-medium">Predictive recovery & EmbraceHealth 3D biometrics.</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setShowWidgetConfig(!showWidgetConfig)}
                        className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition"
                    >
                        {showWidgetConfig ? 'Done Configuring' : 'Dashboard Widgets'}
                    </button>
                    <button 
                        onClick={() => setIsLogOpen(!isLogOpen)}
                        className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition"
                    >
                        <PlusIcon className="w-4 h-4" /> Log Biometrics
                    </button>
                </div>
            </header>

            {/* Widget Configuration Panel */}
            {showWidgetConfig && (
                <section className="bg-emerald-50 border border-emerald-100 p-6 rounded-3xl animate-fade-in space-y-4">
                    <h3 className="font-black text-emerald-800 uppercase tracking-widest text-sm">Command Center Setup</h3>
                    <p className="text-emerald-700 text-sm">Choose up to 3 stats to display as widgets on your main dashboard.</p>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        {widgetOptions.map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => handleToggleWidget(opt.id)}
                                className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${
                                    dashboardPrefs.selectedWidgets.includes(opt.id)
                                    ? 'bg-emerald-500 text-white border-emerald-600 shadow-md scale-105'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                                }`}
                            >
                                <div className={dashboardPrefs.selectedWidgets.includes(opt.id) ? 'text-white' : 'text-slate-400'}>
                                    {opt.icon}
                                </div>
                                <div className="text-center leading-tight">
                                    <p className="text-[10px] font-bold uppercase tracking-tighter opacity-80">{opt.label}</p>
                                    <p className="font-black text-sm">{opt.value}</p>
                                </div>
                                {dashboardPrefs.selectedWidgets.includes(opt.id) && (
                                    <div className="bg-white text-emerald-600 text-[10px] font-black px-1.5 py-0.5 rounded-full mt-1">
                                        Slot {dashboardPrefs.selectedWidgets.indexOf(opt.id) + 1}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {/* Full Metrics Display */}
            <section className="grid grid-cols-2 md:grid-cols-6 gap-4">
                 {widgetOptions.map(opt => (
                    <div key={opt.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
                        <div className="text-slate-400 mb-2">{opt.icon}</div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{opt.label}</p>
                        <p className="text-xl font-black text-slate-800">{opt.value}</p>
                    </div>
                 ))}
            </section>

            {/* Prism Scanner CTA - Renamed to EmbraceHealth 3D */}
            <section className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform duration-700 pointer-events-none">
                    <UserCircleIcon className="w-64 h-64" />
                </div>
                <div className="relative z-10 max-w-lg">
                    <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 border border-indigo-500/30">
                        <ActivityIcon className="w-3 h-3" /> EmbraceHealth 3D Scanner
                    </div>
                    <h3 className="text-3xl font-black mb-3">Sync Your EmbraceHealth Scan</h3>
                    <p className="text-indigo-100/70 text-lg font-medium leading-relaxed mb-8">
                        The EmbraceHealth scanner creates a clinical 3D avatar of your body, tracking muscle gain, body fat percentage, and posture alignment with medical precision.
                    </p>
                    <button 
                        onClick={handleStartBodyScan}
                        className="bg-emerald-500 hover:bg-emerald-400 text-white font-black py-4 px-8 rounded-2xl shadow-xl transform active:scale-95 transition-all flex items-center gap-3 text-lg"
                    >
                        <span>Perform Body Scan</span>
                        <PlusIcon className="w-5 h-5" />
                    </button>
                </div>
            </section>

            {/* Manual Entry Form */}
            {isLogOpen && (
                <form onSubmit={handleLogSubmit} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl animate-fade-in space-y-6">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">Update Recovery Metrics</h3>
                        <button type="button" onClick={() => setIsLogOpen(false)} className="text-slate-400 hover:text-slate-600"><PlusIcon className="rotate-45 w-6 h-6" /></button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Sleep Duration (Minutes)</label>
                            <input 
                                type="number" 
                                value={logForm.sleepMinutes}
                                onChange={e => setLogForm({...logForm, sleepMinutes: parseInt(e.target.value)})}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Sleep Quality (1-100)</label>
                            <input 
                                type="range" 
                                min="0" max="100"
                                value={logForm.sleepQuality}
                                onChange={e => setLogForm({...logForm, sleepQuality: parseInt(e.target.value)})}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                            <div className="text-right font-black text-indigo-600">{logForm.sleepQuality}%</div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">HRV (Heart Rate Var, ms)</label>
                            <input 
                                type="number" 
                                value={logForm.hrv}
                                onChange={e => setLogForm({...logForm, hrv: parseInt(e.target.value)})}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Last Workout Intensity (1-10)</label>
                            <input 
                                type="range" 
                                min="1" max="10"
                                value={logForm.workoutIntensity}
                                onChange={e => setLogForm({...logForm, workoutIntensity: parseInt(e.target.value)})}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                            />
                            <div className="text-right font-black text-amber-600">{logForm.workoutIntensity}/10</div>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isCalculating}
                        className="w-full py-4 bg-slate-900 text-white font-black uppercase tracking-widest text-sm rounded-2xl hover:bg-black transition-all shadow-lg"
                    >
                        {isCalculating ? 'Processing AI Readiness...' : 'Update & Calculate Readiness'}
                    </button>
                </form>
            )}

            {/* Readiness Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                            <HeartIcon className="w-32 h-32" />
                        </div>
                        
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            <div className="relative flex items-center justify-center w-48 h-48">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="96" cy="96" r="80" stroke="#f1f5f9" strokeWidth="12" fill="none" />
                                    <circle 
                                        cx="96" cy="96" r="80" 
                                        stroke={readiness ? (readiness.score > 70 ? '#10b981' : readiness.score > 40 ? '#f59e0b' : '#ef4444') : '#e2e8f0'} 
                                        strokeWidth="12" fill="none" strokeLinecap="round"
                                        strokeDasharray={2 * Math.PI * 80}
                                        strokeDashoffset={(2 * Math.PI * 80) - ((readiness?.score || 0) / 100) * (2 * Math.PI * 80)}
                                        className="transition-all duration-1000 ease-out"
                                    />
                                </svg>
                                <div className="absolute flex flex-col items-center">
                                    <span className="text-4xl font-black text-slate-900">{isCalculating ? '...' : readiness?.score || '--'}</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Ready Score</span>
                                </div>
                            </div>

                            <div className="flex-1 text-center md:text-left">
                                <h3 className="text-2xl font-black text-slate-900 mb-2">{readiness?.label || 'Calculating Readiness...'}</h3>
                                <p className="text-slate-600 font-medium leading-relaxed">
                                    {isCalculating ? "AI is processing your latest biometrics..." : readiness?.reasoning || "Log your sleep and HRV metrics to receive a predictive readiness score."}
                                </p>
                                
                                <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-4">
                                    <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full">
                                        <ClockIcon className="w-4 h-4 text-slate-400" />
                                        <span className="text-xs font-bold text-slate-600">
                                            {healthStats.sleepMinutes ? `${Math.floor(healthStats.sleepMinutes / 60)}h ${healthStats.sleepMinutes % 60}m Sleep` : '-- Sleep'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full">
                                        <ActivityIcon className="w-4 h-4 text-indigo-500" />
                                        <span className="text-xs font-bold text-slate-600">{healthStats.hrv || '--'}ms HRV</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl hover:shadow-2xl transition-all cursor-pointer group overflow-hidden relative" onClick={() => setIsFormCheckOpen(true)}>
                        <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform"></div>
                        <div className="relative z-10">
                            <div className="bg-white/20 p-3 rounded-2xl w-fit mb-4 group-hover:bg-white/30 transition-colors">
                                <CameraIcon className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-black mb-1">AI Form Check</h3>
                            <p className="text-indigo-100 text-sm font-medium">Real-time feedback on squat depth and posture alignment.</p>
                            <div className="mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-300">
                                <span>Analyze Now</span>
                                <PlusIcon className="w-4 h-4" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <h4 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-4">Integrations</h4>
                        <div className="space-y-4">
                            <button 
                                onClick={() => onSyncHealth('apple')}
                                className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center"><FireIcon className="w-4 h-4" /></div>
                                    <span className="text-sm font-bold text-slate-700">Apple Health</span>
                                </div>
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider">Sync</span>
                            </button>
                            <button 
                                onClick={() => onSyncHealth('fitbit')}
                                className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-[#00B0B9]/10 text-[#00B0B9] rounded-xl flex items-center justify-center"><ActivityIcon className="w-4 h-4" /></div>
                                    <span className="text-sm font-bold text-slate-700">Fitbit App</span>
                                </div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Connect</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- NEW: Body Progress Gallery --- */}
            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl mt-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <PhotoIcon className="w-6 h-6 text-indigo-500" /> Progress Gallery
                        </h3>
                        <p className="text-sm text-slate-500 font-medium mt-1">Visual timeline of your transformation.</p>
                    </div>
                    <button 
                        onClick={() => galleryInputRef.current?.click()}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <PlusIcon className="w-4 h-4" /> Upload Photo
                    </button>
                    <input type="file" accept="image/*" ref={galleryInputRef} onChange={handleFileSelect} className="hidden" />
                </div>

                {/* Filters */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-4">
                    {BODY_CATEGORIES.map(cat => (
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
                            <div key={photo.id} className="relative group rounded-2xl overflow-hidden shadow-sm aspect-[3/4]">
                                <img src={photo.imageUrl} alt={photo.category} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                                    <span className="text-white font-bold text-sm">{photo.category}</span>
                                    <span className="text-white/70 text-xs font-medium">{new Date(photo.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
                        <PhotoIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-400 font-bold text-sm">No photos in this category yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
