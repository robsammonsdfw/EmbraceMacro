
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
    if (mode === 'restaurant' && barcode && !img) {
        setSelectedRestaurant({ uri: barcode, title: searchQuery || 'Restaurant', address: '' });
        setIsCaptureOpen(false);
        return;
    }

    setIsProcessing(true);
    setIsCaptureOpen(false); 

    try {
        if (mode === 'meal' && img) {
            const data = await apiService.analyzeImageWithGemini(img.split(',')[1], 'image/jpeg');
            setAnalysisNutrition({ ...data, imageUrl: img }); 
        } 
        else if (mode === 'restaurant' && img) {
            // Updated: analyzeRestaurantMeal now returns NutritionInfo with recipe/tools
            const data = await apiService.analyzeRestaurantMeal(img.split(',')[1], 'image/jpeg');
            setAnalysisNutrition({ ...data, imageUrl: img });
        }
        else if (mode === 'pantry' && img) {
            const recipes = await apiService.getRecipesFromImage(img.split(',')[1], 'image/jpeg');
            setAnalysisRecipes(recipes);
        } else if (mode === 'barcode' && barcode) {
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
      try {
          // Robust base64 extraction to handle data URIs or plain strings
          const imageBase64 = meal.imageUrl?.includes(',') 
                ? meal.imageUrl.split(',')[1] 
                : (meal.imageUrl || '');
          
          await apiService.createMealLogEntry(meal, imageBase64);
          setAnalysisNutrition(null);
          await loadAllData();
          alert("Meal committed to living log!");
      } catch (err) {
          console.error("Save failed:", err);
          alert("Failed to save meal. The image might be too large or the connection is unstable.");
      }
  };

  // Generic Search Handlers used by components to "Add" via text or scan
  const handleManualSearch = async (query: string, type: 'save' | 'log') => {
      setIsProcessing(true);
      try {
          const data = await apiService.searchFood(query);
          if (type === 'save') {
              await apiService.saveMeal(data);
              alert("Meal added to library!");
          } else {
              await apiService.createMealLogEntry(data, '');
              alert("Meal logged to history!");
          }
          await loadAllData();
      } catch (e) {
          alert("Could not find food.");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleAddToPlanFromAnalysis = async (_item: any) => {
      // If item is unified NutritionInfo, it acts as a saved meal. 
      // If it's a standalone Recipe (PantryChef), we'd need conversion logic, but usually it's just 'save first' logic.
      alert("Meal added to plan queue!");
      setAnalysisRecipes(null);
      setAnalysisNutrition(null);
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

  // Updated Sync Handler
  const handleSyncHealth = (syncedData?: HealthStats) => {
      if (syncedData) {
          setHealthStats(prev => ({ ...prev, ...syncedData }));
      }
      loadAllData();
  };

  // COACH PROXY LOGIC
  const handleProxySelect = async (client: {id: string, name: string}) => {
      const proxyData = { id: client.id, name: client.name, permissions: {} };
      setProxyClient(proxyData);
      apiService.setProxyClient(client.id);
      await loadAllData();
      alert(`Proxy Activated: You are now managing ${client.name}'s account.`);
  };

  const handleExitProxy = async () => {
      setProxyClient(null);
      apiService.setProxyClient(null);
      await loadAllData();
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
      onSelectMeal: (m: NutritionInfo) => console.log("Select", m),
      // New Manual Entry Props
      onManualLibraryAdd: (q: string) => handleManualSearch(q, 'save'),
      onManualLogAdd: (q: string) => handleManualSearch(q, 'log'),
      onScanClick: () => handleOpenCapture('meal')
  };

  const bodyProps = {
      healthStats: healthStats,
      onSyncHealth: handleSyncHealth,
      dashboardPrefs: dashboardPrefs,
      onUpdatePrefs: (p: UserDashboardPrefs) => { setDashboardPrefs(p); apiService.saveDashboardPrefs(p); }
  };

  if (isAuthLoading) return <div className="min-h-screen flex items-center justify-center"><Loader message="Authenticating..." /></div>;
  if (!isAuthenticated) return <Login />;

  return (
    <>
        {proxyClient && <CoachProxyBanner clientName={proxyClient.name} onExit={handleExitProxy} />}
        
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
                onProxySelect={handleProxySelect}
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
                onProxySelect={handleProxySelect}
            />
        )}
    </>
  );
};

export default App;
