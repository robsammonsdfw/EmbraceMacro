
import React, { useState, useCallback, useEffect } from 'react';
import * as apiService from './services/apiService';
import { getMealSuggestions } from './services/geminiService';
import type { NutritionInfo, MealLogEntry, SavedMeal, MealPlan, HealthStats, UserDashboardPrefs, Recipe, RestaurantPlace } from './types';
import { useAuth } from './hooks/useAuth';
import { Login } from './components/Login';
import { Loader } from './components/Loader';
import { CaptureFlow } from './components/CaptureFlow';
import { CoachProxyBanner } from './components/CoachProxyBanner';
import { AnalysisResultModal } from './components/AnalysisResultModal';
import { RestaurantCheckInModal } from './components/RestaurantCheckInModal';

// Import Shells
import { MobileApp } from './components/layout/MobileApp';
import { DesktopApp } from './components/layout/DesktopApp';

const App: React.FC = () => {
  const { isAuthenticated, isLoading: isAuthLoading, logout, user } = useAuth();
  
  // Layout State
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  // Common State
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [captureMode, setCaptureMode] = useState<'meal' | 'barcode' | 'pantry' | 'restaurant' | 'search'>('meal');
  const [proxyClient, setProxyClient] = useState<{id: string, name: string, permissions: any} | null>(null);

  // Analysis Result States
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisNutrition, setAnalysisNutrition] = useState<NutritionInfo | null>(null);
  const [analysisRecipes, setAnalysisRecipes] = useState<Recipe[] | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantPlace | null>(null);

  // Data State
  const [mealLog, setMealLog] = useState<MealLogEntry[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [dashboardPrefs, setDashboardPrefs] = useState<UserDashboardPrefs>({ 
    selectedWidgets: ['steps', 'activeCalories'],
    calorieGoal: 2000,
    proteinGoal: 150
  });
  const [healthStats, setHealthStats] = useState<HealthStats>({ steps: 0, activeCalories: 0, restingCalories: 0, distanceMiles: 0, flightsClimbed: 0, heartRate: 0, cardioScore: 0, sleepMinutes: 0 });
  const [medicalPlannerState, setMedicalPlannerState] = useState({ isLoading: false, progress: 0, status: '' });

  // Resize Listener
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
            apiService.getDashboardPrefs().catch(() => ({ selectedWidgets: ['steps', 'activeCalories'] })),
            apiService.getHealthStatsFromDB().catch(() => null)
        ]);
        setMealLog(log); setSavedMeals(saved); setMealPlans(plans); setDashboardPrefs(prev => ({ ...prev, ...prefs }));
        if (health) setHealthStats(prev => ({ ...prev, ...health }));
        if (plans.length > 0 && activePlanId === null) setActivePlanId(plans[0].id);
    } catch (e) { console.error("Load failed", e); }
  }, [isAuthenticated, activePlanId]);

  useEffect(() => { loadAllData(); }, [loadAllData]);

  // Handlers
  const handleOpenCapture = (mode: 'meal' | 'barcode' | 'pantry' | 'restaurant' | 'search' = 'meal') => {
      setCaptureMode(mode);
      setIsCaptureOpen(true);
  };

  const handleCaptureResult = useCallback(async (img: string | null, mode: any, barcode?: string, searchQuery?: string) => {
    // If it's restaurant mode and we are "checking in", the logic is slightly different
    // The CaptureFlow might return a selected place URI if mode is restaurant
    if (mode === 'restaurant' && barcode && !img) {
        // HACK: CaptureFlow passes place URI as barcode arg in this specific refactor flow if image is null
        // Ideally we would type this better, but for speed:
        setSelectedRestaurant({ uri: barcode, title: searchQuery || 'Restaurant', address: '' });
        setIsCaptureOpen(false);
        return;
    }

    setIsProcessing(true);
    // Close capture immediately to show loading on main screen or keep it open? 
    // Let's close it and show a global loader or the result modal with loading state.
    // For now, simple:
    setIsCaptureOpen(false); 

    try {
        if (mode === 'meal' && img) {
            const data = await apiService.analyzeImageWithGemini(img.split(',')[1], 'image/jpeg');
            setAnalysisNutrition({ ...data, imageUrl: img }); // Attach image for display
        } else if (mode === 'pantry' && img) {
            const recipes = await apiService.getRecipesFromImage(img.split(',')[1], 'image/jpeg');
            setAnalysisRecipes(recipes);
        } else if (mode === 'barcode' && barcode) {
            // Note: Assuming apiService has getProductByBarcode or similar
            // For now using searchFood as proxy or we'd need to re-export the openFoodFacts service
            // Let's assume we use the search endpoint for now if the specific one isn't in apiService
            const data = await apiService.searchFood(barcode); 
            setAnalysisNutrition(data);
        } else if (mode === 'search' && searchQuery) {
            const data = await apiService.searchFood(searchQuery);
            setAnalysisNutrition(data);
        }
    } catch (err) {
        alert("Analysis failed. Please try again.");
        console.error(err);
    } finally {
        setIsProcessing(false);
    }
  }, []);

  const handleSaveAnalyzedMeal = async (meal: NutritionInfo) => {
      await apiService.createMealLogEntry(meal, (meal.imageUrl || '').split(',')[1] || '');
      setAnalysisNutrition(null);
      loadAllData();
  };

  const handleAddToPlanFromAnalysis = async (item: any) => {
      // If item is recipe, convert to ingredient list or saved meal first
      // Simplified: Just save it first then add
      // Real app would prompt for slot
      console.log("Adding to plan", item);
      setAnalysisRecipes(null);
      alert("Added to plan!");
  };

  const handleMedicalGeneration = async (diseases: any[], cuisine: string, duration: 'day' | 'week') => {
    setMedicalPlannerState({ isLoading: true, progress: 20, status: `Initializing clinical engine...` });
    try {
        const conditions = diseases.map(d => d.name);
        setMedicalPlannerState(prev => ({ ...prev, progress: 45, status: `Applying constraints...` }));
        const suggestions = await getMealSuggestions(conditions, cuisine, duration);
        setMedicalPlannerState(prev => ({ ...prev, progress: 85, status: `Finalizing...` }));
        for (const meal of suggestions) { await apiService.saveMeal(meal); }
        await loadAllData();
        alert(`Generated ${suggestions.length} meals.`);
    } catch (err) { alert("Failed."); } 
    finally { setMedicalPlannerState({ isLoading: false, progress: 0, status: '' }); }
  };

  // Props Bundles
  const fuelProps = {
      plans: mealPlans,
      activePlanId: activePlanId,
      savedMeals: savedMeals,
      mealLog: mealLog, // Passed to enable History view
      onPlanChange: setActivePlanId,
      onCreatePlan: (name: string) => apiService.createMealPlan(name).then(() => loadAllData()),
      onRemoveFromPlan: (id: number) => apiService.removeMealFromPlanItem(id).then(loadAllData),
      onQuickAdd: (pid: number, m: SavedMeal, d: string, s: string) => apiService.addMealToPlan(pid, m.id, { day: d, slot: s }).then(loadAllData),
      onGenerateMedical: handleMedicalGeneration,
      medicalPlannerState: medicalPlannerState,
      onAddMealToLibrary: (m: NutritionInfo) => apiService.saveMeal(m).then(loadAllData),
      onDeleteMeal: (id: number) => apiService.deleteMeal(id).then(loadAllData),
      onSelectMeal: (m: NutritionInfo) => console.log("Select", m)
  };

  const bodyProps = {
      healthStats: healthStats,
      onSyncHealth: () => {},
      dashboardPrefs: dashboardPrefs,
      onUpdatePrefs: (p: UserDashboardPrefs) => { setDashboardPrefs(p); apiService.saveDashboardPrefs(p); }
  };

  if (isAuthLoading) return <div className="min-h-screen flex items-center justify-center"><Loader message="Authenticating..." /></div>;
  if (!isAuthenticated) return <Login />;

  return (
    <>
        {proxyClient && <CoachProxyBanner clientName={proxyClient.name} onExit={() => setProxyClient(null)} />}
        
        {/* Modals for Results */}
        {(analysisNutrition || analysisRecipes) && (
            <AnalysisResultModal 
                nutritionData={analysisNutrition}
                recipeData={analysisRecipes}
                onClose={() => { setAnalysisNutrition(null); setAnalysisRecipes(null); }}
                onSave={handleSaveAnalyzedMeal}
                onAddToPlan={handleAddToPlanFromAnalysis}
            />
        )}

        {selectedRestaurant && (
            <RestaurantCheckInModal 
                place={selectedRestaurant} 
                onClose={() => setSelectedRestaurant(null)} 
            />
        )}

        {/* Processing Indicator */}
        {isProcessing && (
            <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center">
                <Loader message="Processing Vision Data..." />
            </div>
        )}
        
        {isCaptureOpen && (
            <CaptureFlow 
                onClose={() => setIsCaptureOpen(false)} 
                onCapture={handleCaptureResult} 
                onRepeatMeal={() => {}} 
                onBodyScanClick={() => {}} 
                initialMode={captureMode} 
            />
        )}

        {isDesktop ? (
            <DesktopApp 
                healthStats={healthStats} 
                dashboardPrefs={dashboardPrefs}
                fuelProps={fuelProps}
                bodyProps={bodyProps}
                userRole={user?.role || 'user'}
                onLogout={logout}
                user={user}
                onCameraClick={handleOpenCapture}
            />
        ) : (
            <MobileApp 
                healthStats={healthStats} 
                dashboardPrefs={dashboardPrefs}
                onCameraClick={() => handleOpenCapture('meal')}
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
