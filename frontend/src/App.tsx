
import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { Login } from './components/Login';
import { Loader } from './components/Loader';
import { DesktopApp } from './components/layout/DesktopApp';
import { MobileApp } from './components/layout/MobileApp';
import * as apiService from './services/apiService';
import { HealthStats, UserDashboardPrefs, SavedMeal, MealLogEntry, MealPlan, NutritionInfo } from './types';
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
      onSelectMeal: () => {}, 
      onScanClick: () => handleCaptureClick('meal')
  };

  const bodyProps = {
      healthStats, 
      onSyncHealth: (source?: 'apple' | 'fitbit') => { 
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
        {showCapture && <CaptureFlow onClose={() => setShowCapture(false)} onCapture={(img, mode) => { console.log(img, mode); setShowCapture(false); }} initialMode={captureMode} />}
        
        {isMobile ? (
            <MobileApp 
                healthStats={healthStats} dashboardPrefs={dashboardPrefs} 
                onCameraClick={() => handleCaptureClick()} 
                fuelProps={fuelProps} bodyProps={bodyProps} 
                userRole="user" onLogout={logout} user={user}
            />
        ) : (
            <DesktopApp 
                healthStats={healthStats} dashboardPrefs={dashboardPrefs} 
                fuelProps={fuelProps} bodyProps={bodyProps} 
                userRole="user" onLogout={logout} user={user}
                onCameraClick={handleCaptureClick}
            />
        )}
    </>
  );
};
export default App;
