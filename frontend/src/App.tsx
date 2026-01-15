
import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { Login } from './components/Login';
import { Loader } from './components/Loader';
import { DesktopApp } from './components/layout/DesktopApp';
import { MobileApp } from './components/layout/MobileApp';
import { AnalysisResultModal } from './components/AnalysisResultModal';
import * as apiService from './services/apiService';
import { getProductByBarcode } from './services/openFoodFactsService';
import { HealthStats, UserDashboardPrefs, SavedMeal, MealLogEntry, MealPlan, NutritionInfo, Recipe } from './types';
import { CaptureFlow } from './components/CaptureFlow';

const App: React.FC = () => {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Global Data State
  const [healthStats, setHealthStats] = useState<HealthStats>({ 
      steps: 0, 
      activeCalories: 0, 
      restingCalories: 0, 
      distanceMiles: 0, 
      flightsClimbed: 0, 
      heartRate: 0,
      cardioScore: 0,
      sleepMinutes: 0
  });
  const [dashboardPrefs, setDashboardPrefs] = useState<UserDashboardPrefs>({ selectedWidgets: [] });
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [mealLog, setMealLog] = useState<MealLogEntry[]>([]);
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [medicalPlannerState, setMedicalPlannerState] = useState({ isLoading: false, progress: 0, status: '' });
  
  // UI State
  const [showCapture, setShowCapture] = useState(false);
  const [captureMode, setCaptureMode] = useState<'meal' | 'barcode' | 'pantry' | 'restaurant' | 'search' | 'vitals'>('meal');
  
  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<NutritionInfo | null>(null);
  const [analysisRecipes, setAnalysisRecipes] = useState<Recipe[] | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadAllData = async () => {
      if (!isAuthenticated) return;
      
      // Load independent data streams separately so one failure doesn't crash the app
      try {
          const meals = await apiService.getSavedMeals().catch(e => { console.warn("Failed saved meals", e); return []; });
          setSavedMeals(meals);
      } catch (e) {}

      try {
          const plansData = await apiService.getMealPlans().catch(e => { console.warn("Failed plans", e); return []; });
          setPlans(plansData);
          if (plansData.length > 0 && !activePlanId) setActivePlanId(plansData[0].id);
      } catch (e) {}

      try {
          const log = await apiService.getMealLogEntries().catch(e => { console.warn("Failed log", e); return []; });
          setMealLog(log);
      } catch (e) {}

      try {
          const stats = await apiService.getHealthMetrics().catch(e => { console.warn("Failed health stats", e); return null; });
          if (stats) setHealthStats(prev => ({...prev, ...stats}));
      } catch (e) {}

      try {
          const prefs = await apiService.getDashboardPrefs().catch(e => { console.warn("Failed prefs", e); return null; });
          if (prefs) setDashboardPrefs(prefs);
      } catch (e) {}
  };

  useEffect(() => { loadAllData(); }, [isAuthenticated]);

  const handleCaptureClick = (mode: 'meal' | 'barcode' | 'pantry' | 'restaurant' | 'search' | 'vitals' = 'meal') => {
      setCaptureMode(mode);
      setShowCapture(true);
  };

  const handleCaptureComplete = async (img: string | null, mode: string, barcode?: string, searchQuery?: string) => {
      setShowCapture(false);
      
      if (mode === 'vitals' && img) {
          // Trigger Vision Sync
          setIsAnalyzing(true);
          try {
              const base64 = img.startsWith('data:') ? img.split(',')[1] : img;
              const analyzedStats = await apiService.analyzeHealthScreenshot(base64);
              if (analyzedStats) {
                  const updated = await apiService.syncHealthStatsToDB(analyzedStats);
                  setHealthStats(prev => ({ ...prev, ...updated }));
                  alert("Vision Sync Complete! Dashboard updated.");
              }
          } catch (e) {
              console.error("Vision Sync Failed", e);
              alert("Failed to analyze health screenshot. Please try again.");
          } finally {
              setIsAnalyzing(false);
          }
          return;
      }

      // Food & Nutrition Analysis Logic
      setIsAnalyzing(true);
      setAnalysisResult(null);
      setAnalysisRecipes(null);

      try {
          let result: NutritionInfo | null = null;
          let recipes: Recipe[] | null = null;

          if (mode === 'barcode' && barcode) {
              result = await getProductByBarcode(barcode);
          } else if (mode === 'search' && searchQuery) {
              result = await apiService.searchFood(searchQuery);
          } else if (img) {
              const base64 = img.startsWith('data:') ? img.split(',')[1] : img;
              const mimeType = img.startsWith('data:') ? img.split(';')[0].split(':')[1] : 'image/jpeg';

              if (mode === 'meal') {
                  result = await apiService.analyzeImageWithGemini(base64, mimeType);
              } else if (mode === 'restaurant') {
                  result = await apiService.analyzeRestaurantMeal(base64, mimeType);
              } else if (mode === 'pantry') {
                  recipes = await apiService.getRecipesFromImage(base64, mimeType);
              }
          }

          if (result) {
              setAnalysisResult(result);
              setShowAnalysisModal(true);
          } else if (recipes && recipes.length > 0) {
              setAnalysisRecipes(recipes);
              setShowAnalysisModal(true);
          } else {
              if (mode !== 'search' && mode !== 'barcode' && !img) {
                  // User cancelled or no input, do nothing
                  return;
              }
              alert("Could not analyze input. Please try again.");
          }

      } catch (e) {
          console.error("Analysis failed", e);
          alert("Analysis failed. Please check your connection and try again.");
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleAnalysisSave = async (data: any) => {
      try {
          // Normalize data for saving
          let mealToSave: NutritionInfo = data;
          
          // If it's a raw recipe from Pantry Chef, wrap it
          if (!data.ingredients && data.recipeName) {
             mealToSave = {
                mealName: data.recipeName,
                totalCalories: data.nutrition.totalCalories,
                totalProtein: data.nutrition.totalProtein,
                totalCarbs: data.nutrition.totalCarbs,
                totalFat: data.nutrition.totalFat,
                ingredients: [], 
                recipe: data,
                source: 'pantry'
             };
          }

          await apiService.saveMeal(mealToSave);
          await loadAllData();
          setShowAnalysisModal(false);
          alert("Saved to Library!");
      } catch (e) {
          alert("Failed to save.");
      }
  };

  const handleAnalysisAddToPlan = async (data: any) => {
      if (!activePlanId) {
          alert("Please create or select a meal plan first.");
          return;
      }

      try {
          // 1. Save meal first (backend requirement for relational integrity)
          let mealToSave: NutritionInfo = data;
          if (!data.ingredients && data.recipeName) {
             mealToSave = {
                mealName: data.recipeName,
                totalCalories: data.nutrition.totalCalories,
                totalProtein: data.nutrition.totalProtein,
                totalCarbs: data.nutrition.totalCarbs,
                totalFat: data.nutrition.totalFat,
                ingredients: [],
                recipe: data,
                source: 'pantry'
             };
          }

          const saved = await apiService.saveMeal(mealToSave);
          
          // 2. Add to Plan
          await apiService.addMealToPlan(activePlanId, saved.id, { day: 'Today', slot: 'Snack' });
          
          await loadAllData();
          setShowAnalysisModal(false);
          alert("Added to Plan!");
      } catch (e) {
          alert("Failed to add to plan.");
      }
  };

  const onProxySelect = (client: { id: string; name: string }) => {
      console.log("Proxy selected:", client);
      alert(`Switching to proxy view for ${client.name}. This is a simulation of coach access.`);
  };

  // --- Handlers ---
  const handleCreatePlan = async (name: string) => {
      try {
          const newPlan = await apiService.createMealPlan(name);
          setPlans(prev => [...prev, newPlan]);
          setActivePlanId(newPlan.id);
      } catch (e) { alert("Failed to create plan."); }
  };

  const handleQuickAdd = async (planId: number, meal: SavedMeal, day: string, slot: string) => {
      try {
          await apiService.addMealToPlan(planId, meal.id, { day, slot });
          alert(`Added ${meal.mealName} to ${day} ${slot}`);
          await loadAllData(); 
      } catch (e) { alert("Failed to add to plan."); }
  };

  const handleRemoveFromPlan = async (itemId: number) => {
      try {
          await apiService.removeMealFromPlan(itemId);
          alert("Item removed from plan.");
          loadAllData();
      } catch (e) { alert("Failed to remove item."); }
  };

  const handleGenerateMedical = async (diseases: any[], cuisine: string, duration: 'day' | 'week') => {
      setMedicalPlannerState({ isLoading: true, progress: 10, status: 'Analyzing Clinical Constraints...' });
      setTimeout(() => setMedicalPlannerState(s => ({ ...s, progress: 40, status: 'Optimizing Macros...' })), 1000);
      setTimeout(() => setMedicalPlannerState(s => ({ ...s, progress: 80, status: 'Generating Recipes...' })), 2000);
      setTimeout(async () => {
          try {
            const suggestions = await apiService.getMealSuggestions(diseases.map(d => d.name), cuisine, duration);
            const planName = `Medical: ${diseases.length} Conditions (${cuisine}, ${duration})`;
            const newPlan = await apiService.createMealPlan(planName);
            // Add suggested meals to plan
            for (const meal of suggestions) {
                const saved = await apiService.saveMeal(meal);
                await apiService.addMealToPlan(newPlan.id, saved.id, { day: 'Monday', slot: 'Lunch' }); // Mock scheduling
            }
            setPlans(prev => [...prev, newPlan]);
            setActivePlanId(newPlan.id);
            setMedicalPlannerState({ isLoading: false, progress: 100, status: 'Complete' });
            alert("Medical Plan Generated!");
          } catch (e) {
            alert("Failed to generate plan");
            setMedicalPlannerState({ isLoading: false, progress: 0, status: 'Failed' });
          }
      }, 3000);
  };

  const handleDeleteMeal = async (id: number) => {
      try {
          await apiService.deleteMeal(id);
          alert("Meal deleted.");
          loadAllData();
      } catch (e) { alert("Failed to delete."); }
  };

  const handleSaveMeal = async (meal: NutritionInfo) => {
      try {
          await apiService.saveMeal(meal);
          loadAllData();
      } catch (e) { alert("Failed to save meal."); }
  };

  const fuelProps = {
      plans, activePlanId, savedMeals, mealLog, 
      onPlanChange: setActivePlanId, onCreatePlan: handleCreatePlan, 
      onRemoveFromPlan: handleRemoveFromPlan, onQuickAdd: handleQuickAdd, 
      onGenerateMedical: handleGenerateMedical, medicalPlannerState, 
      onAddMealToLibrary: handleSaveMeal, onDeleteMeal: handleDeleteMeal, 
      onSelectMeal: (meal: NutritionInfo) => { setAnalysisResult(meal); setShowAnalysisModal(true); }, 
      onScanClick: () => handleCaptureClick('meal'),
      onManualLibraryAdd: (q: string) => handleCaptureComplete(null, 'search', undefined, q),
      onManualLogAdd: (q: string) => handleCaptureComplete(null, 'search', undefined, q)
  };

  const bodyProps = {
      healthStats, 
      onSyncHealth: (_source?: 'apple' | 'fitbit') => { 
          apiService.syncHealthStatsToDB({ steps: 8500, activeCalories: 450 }).then(() => loadAllData());
      },
      dashboardPrefs, 
      onUpdatePrefs: (p: UserDashboardPrefs) => {
          setDashboardPrefs(p);
          apiService.saveDashboardPrefs(p); // Fire and forget
      }
  };

  if (isLoading) return <Loader message="Initializing..." />;
  if (!isAuthenticated) return <Login />;

  return (
    <>
        {isAnalyzing && (
            <div className="fixed inset-0 z-[120] bg-white/80 backdrop-blur-sm flex items-center justify-center">
                <Loader message="AI Processing..." />
            </div>
        )}

        {showCapture && <CaptureFlow onClose={() => setShowCapture(false)} onCapture={handleCaptureComplete} initialMode={captureMode} />}
        
        {showAnalysisModal && (
            <AnalysisResultModal 
                nutritionData={analysisResult}
                recipeData={analysisRecipes}
                onClose={() => setShowAnalysisModal(false)}
                onSave={handleAnalysisSave}
                onAddToPlan={handleAnalysisAddToPlan}
            />
        )}
        
        {isMobile ? (
            <MobileApp 
                healthStats={healthStats} dashboardPrefs={dashboardPrefs} 
                onCameraClick={() => handleCaptureClick('meal')} 
                fuelProps={fuelProps} bodyProps={bodyProps} 
                userRole="user" onLogout={logout} user={user}
                onProxySelect={onProxySelect}
                onVisionSync={() => handleCaptureClick('vitals')}
            />
        ) : (
            <DesktopApp 
                healthStats={healthStats} dashboardPrefs={dashboardPrefs} 
                fuelProps={fuelProps} bodyProps={bodyProps} 
                userRole="user" onLogout={logout} user={user}
                onCameraClick={handleCaptureClick}
                onProxySelect={onProxySelect}
            />
        )}
    </>
  );
};
export default App;
