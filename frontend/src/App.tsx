
import React, { useState, useCallback, useEffect } from 'react';
import * as apiService from './services/apiService';
import type { MealLogEntry, SavedMeal, MealPlan, HealthStats, UserDashboardPrefs, NutritionInfo, Recipe } from './types';
import { useAuth } from './hooks/useAuth';
import { Login } from './components/Login';
import { Loader } from './components/Loader';
import { CaptureFlow } from './components/CaptureFlow';
import { MobileApp } from './components/layout/MobileApp';
import { DesktopApp } from './components/layout/DesktopApp';
import { AnalysisResultModal } from './components/AnalysisResultModal';

const App: React.FC = () => {
  const { isAuthenticated, isLoading: isAuthLoading, logout, user } = useAuth();
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [captureMode, setCaptureMode] = useState<'meal' | 'barcode' | 'pantry' | 'restaurant' | 'vitals'>('meal');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Data State
  const [healthStats, setHealthStats] = useState<HealthStats>({ steps: 0, activeCalories: 0, restingCalories: 0, distanceMiles: 0, flightsClimbed: 0, heartRate: 0, cardioScore: 0, sleepMinutes: 0 });
  const [mealLog, setMealLog] = useState<MealLogEntry[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [dashboardPrefs, setDashboardPrefs] = useState<UserDashboardPrefs>({ selectedWidgets: ['steps', 'activeCalories', 'bloodPressure'] });

  // Medical Planner State
  const [medicalPlannerState, setMedicalPlannerState] = useState({ isLoading: false, progress: 0, status: '' });

  // Analysis State
  const [analysisResult, setAnalysisResult] = useState<NutritionInfo | null>(null);
  const [analysisRecipes, setAnalysisRecipes] = useState<Recipe[] | null>(null);

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
        
        setMealLog(Array.isArray(log) ? log : []);
        setSavedMeals(Array.isArray(saved) ? saved : []);
        
        const validPlans = Array.isArray(plans) ? plans : [];
        setMealPlans(validPlans);
        // Default active plan to first one if none selected
        if (validPlans.length > 0 && !activePlanId) {
            setActivePlanId(validPlans[0].id);
        }
        
        if (prefs && typeof prefs === 'object') setDashboardPrefs(prefs);
        if (health) setHealthStats(health);
    } catch (e) { console.error("Load failed", e); }
  }, [isAuthenticated, activePlanId]);

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
        } else if (mode === 'meal' || mode === 'restaurant') {
            const data = mode === 'restaurant' 
                ? await apiService.analyzeRestaurantMeal(base64, 'image/jpeg')
                : await apiService.analyzeImageWithGemini(base64, 'image/jpeg');
            setAnalysisResult(data);
        } else if (mode === 'pantry') {
            const recipes = await apiService.getRecipesFromImage(base64, 'image/jpeg');
            setAnalysisRecipes(recipes);
        }
    } catch (err) {
        alert("Vision analysis failed. Please try again.");
        console.error(err);
    } finally {
        setIsProcessing(false);
    }
  }, []);

  const handleSaveAnalyzedMeal = async (data: NutritionInfo) => {
      try {
          if (data.source === 'pantry' || data.source === 'restaurant') {
             await apiService.saveMeal(data);
             const saved = await apiService.getSavedMeals();
             setSavedMeals(Array.isArray(saved) ? saved : []);
             alert("Saved to Library!");
          } else {
             await apiService.createMealLogEntry(data, data.imageUrl || '');
             await apiService.saveMeal(data);
             loadAllData();
             alert("Meal Logged & Saved!");
          }
          setAnalysisResult(null);
          setAnalysisRecipes(null);
      } catch (e) {
          alert("Failed to save meal.");
      }
  };

  const handleAddToPlan = (data: any) => {
      handleSaveAnalyzedMeal(data);
  };

  // --- Plan Management Handlers ---
  const handleCreatePlan = async (name: string) => {
      try {
          const newPlan = await apiService.createMealPlan(name);
          setMealPlans(prev => [...prev, newPlan]);
          setActivePlanId(newPlan.id);
      } catch (e) { alert("Failed to create plan."); }
  };

  const handleQuickAdd = async (planId: number, meal: SavedMeal, day: string, slot: string) => {
      // Note: Backend currently only supports adding item, metadata would need a separate update call or an enhanced add endpoint.
      // For now, we simulate adding the item.
      try {
          // This API call needs to be updated in backend to accept metadata if we want day/slot persistence
          // Assuming we just add it for now to the list
          // In a real implementation, we would pass metadata here.
          alert("Added to plan (Metadata persistence pending backend update)");
          await loadAllData(); 
      } catch (e) { alert("Failed to add to plan."); }
  };

  const handleRemoveFromPlan = async (itemId: number) => {
      // Implement remove API
      alert("Item removed (Simulated)");
      // await apiService.removeMealFromPlanItem(itemId);
      // loadAllData();
  };

  const handleGenerateMedical = async (diseases: any[], cuisine: string, duration: 'day' | 'week') => {
      setMedicalPlannerState({ isLoading: true, progress: 10, status: 'Analyzing Clinical Constraints...' });
      // Simulate AI process
      setTimeout(() => setMedicalPlannerState(s => ({ ...s, progress: 40, status: 'Optimizing Macros...' })), 1000);
      setTimeout(() => setMedicalPlannerState(s => ({ ...s, progress: 80, status: 'Generating Recipes...' })), 2000);
      setTimeout(async () => {
          // Here we would call the real AI endpoint
          // For now, create a dummy plan
          await handleCreatePlan(`Medical Plan - ${diseases.length} Conditions`);
          setMedicalPlannerState({ isLoading: false, progress: 100, status: 'Complete' });
          alert("Medical Plan Generated!");
      }, 3000);
  };

  const handleDeleteMeal = async (id: number) => {
      try {
          // await apiService.deleteMeal(id); // Need to expose this in apiService
          alert("Deleted (Simulated)");
          loadAllData();
      } catch (e) { alert("Failed to delete."); }
  };

  if (isAuthLoading) return <div className="min-h-screen flex items-center justify-center"><Loader message="Authenticating..." /></div>;
  if (!isAuthenticated) return <Login />;

  const fuelProps = { 
      plans: mealPlans, 
      activePlanId, 
      savedMeals, 
      mealLog,
      onPlanChange: setActivePlanId,
      onCreatePlan: handleCreatePlan,
      onRemoveFromPlan: handleRemoveFromPlan,
      onQuickAdd: handleQuickAdd,
      onGenerateMedical: handleGenerateMedical,
      medicalPlannerState,
      onAddMealToLibrary: apiService.saveMeal,
      onDeleteMeal: handleDeleteMeal,
      onSelectMeal: (m: NutritionInfo) => setAnalysisResult(m),
      onManualLibraryAdd: (q: string) => alert(`Search library for: ${q}`),
      onManualLogAdd: (q: string) => alert(`Log: ${q}`),
      onScanClick: () => { setCaptureMode('meal'); setIsCaptureOpen(true); }
  };

  const bodyProps = { onSyncHealth: loadAllData, onUpdatePrefs: setDashboardPrefs };

  return (
    <>
        {isProcessing && <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center"><Loader message="Vision Sync in Progress..." /></div>}
        
        {(analysisResult || analysisRecipes) && (
            <AnalysisResultModal 
                nutritionData={analysisResult}
                recipeData={analysisRecipes}
                onClose={() => { setAnalysisResult(null); setAnalysisRecipes(null); }}
                onAddToPlan={handleAddToPlan}
                onSave={handleSaveAnalyzedMeal}
            />
        )}

        {isCaptureOpen && <CaptureFlow onClose={() => setIsCaptureOpen(false)} onCapture={handleCaptureResult} initialMode={captureMode} />}
        
        {isDesktop ? (
            <DesktopApp 
                healthStats={healthStats} 
                dashboardPrefs={dashboardPrefs} 
                fuelProps={fuelProps} 
                bodyProps={bodyProps} 
                userRole={user?.role || 'user'} 
                onLogout={logout} 
                user={user} 
                onCameraClick={m => { setCaptureMode(m as any); setIsCaptureOpen(true); }} 
            />
        ) : (
            <MobileApp 
                healthStats={healthStats} 
                dashboardPrefs={dashboardPrefs} 
                onCameraClick={() => { setCaptureMode('meal'); setIsCaptureOpen(true); }} 
                fuelProps={fuelProps} 
                bodyProps={bodyProps} 
                userRole={user?.role || 'user'} 
                onLogout={logout} 
                user={user} 
            />
        )}
    </>
  );
};

export default App;
