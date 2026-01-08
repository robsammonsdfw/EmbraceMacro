
import React, { useState, useCallback, useEffect } from 'react';
import * as apiService from './services/apiService';
import type { NutritionInfo, MealLogEntry, SavedMeal, MealPlan, HealthStats, UserDashboardPrefs, Recipe, RestaurantPlace } from './types';
import { useAuth } from './hooks/useAuth';
import { Login } from './components/Login';
import { Loader } from './components/Loader';
import { CaptureFlow } from './components/CaptureFlow';
import { MobileApp } from './components/layout/MobileApp';
import { DesktopApp } from './components/layout/DesktopApp';

const App: React.FC = () => {
  const { isAuthenticated, isLoading: isAuthLoading, logout, user } = useAuth();
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [captureMode, setCaptureMode] = useState<'meal' | 'barcode' | 'pantry' | 'restaurant' | 'vitals'>('meal');
  const [isProcessing, setIsProcessing] = useState(false);
  const [healthStats, setHealthStats] = useState<HealthStats>({ steps: 0, activeCalories: 0, restingCalories: 0, distanceMiles: 0, flightsClimbed: 0, heartRate: 0, cardioScore: 0, sleepMinutes: 0 });
  const [mealLog, setMealLog] = useState<MealLogEntry[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [dashboardPrefs, setDashboardPrefs] = useState<UserDashboardPrefs>({ selectedWidgets: ['steps', 'activeCalories', 'bloodPressure'] });

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadAllData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
        const [log, saved, plans, prefs, health] = await Promise.all([
            apiService.getMealLog().catch(() => []),
            apiService.getSavedMeals().catch(() => []),
            apiService.getMealPlans().catch(() => []),
            apiService.getDashboardPrefs().catch(() => ({ selectedWidgets: ['steps', 'activeCalories', 'bloodPressure'] })),
            apiService.getHealthStatsFromDB().catch(() => null)
        ]);
        setMealLog(log); setSavedMeals(saved); setMealPlans(plans); setDashboardPrefs(prefs);
        if (health) setHealthStats(health);
    } catch (e) { console.error("Load failed", e); }
  }, [isAuthenticated]);

  useEffect(() => { loadAllData(); }, [loadAllData]);

  const handleCaptureResult = useCallback(async (img: string | null, mode: any) => {
    if (!img) return;
    setIsProcessing(true);
    setIsCaptureOpen(false); 
    try {
        const base64 = img.split(',')[1];
        if (mode === 'vitals') {
            const updated = await apiService.analyzeVitalsImage(base64, 'image/jpeg');
            setHealthStats(updated);
            alert("Vision Sync Complete: Clinical vitals extracted from screenshot.");
        } else if (mode === 'meal') {
            const data = await apiService.analyzeImageWithGemini(base64, 'image/jpeg');
            // Show result modal logic... (omitted for brevity in this delta)
        }
    } catch (err) {
        alert("Vision analysis failed.");
    } finally {
        setIsProcessing(false);
    }
  }, []);

  if (isAuthLoading) return <div className="min-h-screen flex items-center justify-center"><Loader message="Authenticating..." /></div>;
  if (!isAuthenticated) return <Login />;

  return (
    <>
        {isProcessing && <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center"><Loader message="Vision Sync in Progress..." /></div>}
        {isCaptureOpen && <CaptureFlow onClose={() => setIsCaptureOpen(false)} onCapture={handleCaptureResult} onRepeatMeal={() => {}} onBodyScanClick={() => {}} initialMode={captureMode} />}
        {isDesktop ? (
            <DesktopApp healthStats={healthStats} dashboardPrefs={dashboardPrefs} fuelProps={{ mealLog, savedMeals }} bodyProps={{ onSyncHealth: loadAllData, onUpdatePrefs: setDashboardPrefs }} userRole={user?.role || 'user'} onLogout={logout} user={user} onCameraClick={m => { setCaptureMode(m as any); setIsCaptureOpen(true); }} />
        ) : (
            <MobileApp healthStats={healthStats} dashboardPrefs={dashboardPrefs} onCameraClick={() => { setCaptureMode('meal'); setIsCaptureOpen(true); }} fuelProps={{ mealLog, savedMeals }} bodyProps={{ onSyncHealth: loadAllData, onUpdatePrefs: setDashboardPrefs }} userRole={user?.role || 'user'} onLogout={logout} user={user} />
        )}
    </>
  );
};

export default App;
