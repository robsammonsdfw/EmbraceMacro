import React, { useState, useCallback, useEffect } from 'react';
import * as apiService from './services/apiService';
import { analyzeFoodImage } from './services/geminiService';
import { getProductByBarcode } from './services/openFoodFactsService';
import { connectHealthProvider, syncHealthData } from './services/healthService';
import type { NutritionInfo, MealLogEntry, SavedMeal, MealPlan, HealthStats, UserDashboardPrefs, HealthJourney } from './types';
import { ImageUploader } from './components/ImageUploader';
import { NutritionCard } from './components/NutritionCard';
import { Loader } from './components/Loader';
import { ErrorAlert } from './components/ErrorAlert';
import { useAuth } from './hooks/useAuth';
import { Login } from './components/Login';
import { AppLayout } from './components/layout/AppLayout';
import { CommandCenter } from './components/dashboard/CommandCenter';
import { CaptureFlow } from './components/CaptureFlow';
import { MealPlanManager } from './components/MealPlanManager';
import { MealLibrary } from './components/MealLibrary';
import { MealHistory } from './components/MealHistory';
import { GroceryList } from './components/GroceryList';
import { RewardsDashboard } from './components/RewardsDashboard';
import { AssessmentHub } from './components/tests/AssessmentHub';
import { PartnerBlueprint } from './components/matching/PartnerBlueprint';
import { SocialManager } from './components/social/SocialManager';
import { BodyHub } from './components/body/BodyHub';

type ActiveView = 'home' | 'plan' | 'meals' | 'history' | 'grocery' | 'rewards' | 'body' | 'social' | 'assessments' | 'blueprint' | 'labs' | 'orders';

const App: React.FC = () => {
  const { isAuthenticated, isLoading: isAuthLoading, logout, user } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Data State
  const [image, setImage] = useState<string | null>(null);
  const [nutritionData, setNutritionData] = useState<NutritionInfo | null>(null);
  const [mealLog, setMealLog] = useState<MealLogEntry[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [dashboardPrefs, setDashboardPrefs] = useState<UserDashboardPrefs>({ 
    selectedWidgets: ['steps', 'activeCalories', 'distanceMiles'],
    selectedJourney: 'general-health'
  });
  
  // Health State
  const [healthStats, setHealthStats] = useState<HealthStats>({ 
    steps: 0, activeCalories: 0, restingCalories: 0, distanceMiles: 0, 
    flightsClimbed: 0, heartRate: 0, cardioScore: 0, hrv: 0, sleepMinutes: 0 
  });
  const [isHealthConnected, setIsHealthConnected] = useState(false);
  const [isHealthSyncing, setIsHealthSyncing] = useState(false);

  // UI State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshWallet = useCallback(async () => {
    try {
        const rewards = await apiService.getRewardsSummary();
        setWalletBalance(rewards.points_total);
    } catch (e) {
        console.error("Failed to refresh wallet", e);
    }
  }, []);

  const refreshHealth = useCallback(async () => {
      try {
          const stats = await apiService.getHealthStatsFromDB();
          if (stats && Object.keys(stats).length > 0) {
              setHealthStats(prev => ({ ...prev, ...stats }));
              setIsHealthConnected(true);
          }
      } catch (e) {
          console.error("Failed to fetch health from DB", e);
      }
  }, []);

  // Initial Data Load
  useEffect(() => {
    if (isAuthenticated) {
        Promise.all([
            apiService.getMealLog().catch(() => []),
            apiService.getSavedMeals().catch(() => []),
            apiService.getMealPlans().catch(() => []),
            apiService.getDashboardPrefs().catch(() => ({ selectedWidgets: ['steps', 'activeCalories', 'distanceMiles'], selectedJourney: 'general-health' as HealthJourney })),
            refreshWallet().catch(() => null),
            refreshHealth().catch(() => null)
        ]).then(([log, saved, plans, prefs]) => {
            setMealLog(log);
            setSavedMeals(saved);
            setMealPlans(plans);
            setDashboardPrefs(prefs);
            if (plans.length > 0) setActivePlanId(plans[0].id);
        });
    }
  }, [isAuthenticated, refreshWallet, refreshHealth]);

  const handleConnectHealth = async (source: 'apple' | 'fitbit' = 'apple') => {
      setIsHealthSyncing(true);
      try {
          const provider = source === 'apple' ? 'ios' : 'fitbit';
          const success = await connectHealthProvider(provider);
          if (success) {
              const freshDeviceStats = await syncHealthData(source);
              await apiService.syncHealthStatsToDB(freshDeviceStats);
              await refreshHealth();
          }
      } catch (e) {
          console.error("Health sync failed", e);
      } finally {
          setIsHealthSyncing(false);
      }
  };

  const handleUpdateDashboardPrefs = async (newPrefs: UserDashboardPrefs) => {
      setDashboardPrefs(newPrefs);
      await apiService.saveDashboardPrefs(newPrefs);
  };

  const handleJourneyChange = async (journey: HealthJourney) => {
      const journeyToWidgets: Record<HealthJourney, string[]> = {
          'weight-loss': ['steps', 'activeCalories', 'distanceMiles'],
          'muscle-cut': ['activeCalories', 'steps', 'heartRate'],
          'muscle-bulk': ['restingCalories', 'activeCalories', 'flightsClimbed'],
          'heart-health': ['heartRate', 'activeCalories', 'steps'],
          'blood-pressure': ['heartRate', 'restingCalories', 'sleepMinutes'],
          'general-health': ['steps', 'distanceMiles', 'flightsClimbed']
      };
      
      const newPrefs: UserDashboardPrefs = {
          ...dashboardPrefs,
          selectedJourney: journey,
          selectedWidgets: journeyToWidgets[journey] || dashboardPrefs.selectedWidgets
      };
      
      handleUpdateDashboardPrefs(newPrefs);
  };

  const handleCaptureResult = useCallback(async (img: string | null, mode: any, barcode?: string) => {
    setIsCaptureOpen(false);
    setImage(null);
    setNutritionData(null);
    setError(null);
    setIsProcessing(true);

    try {
        if (mode === 'barcode' && barcode) {
            const data = await getProductByBarcode(barcode);
            setNutritionData(data);
        } else if (img) {
            setImage(img);
            const base64Data = img.split(',')[1];
            const result = await analyzeFoodImage(base64Data, 'image/jpeg');
            setNutritionData(result);
        }
    } catch (err) {
        setError('Analysis failed. Please try a clearer photo.');
    } finally {
        setIsProcessing(false);
    }
  }, []);

  const handleSaveToHistory = async () => {
    if (!nutritionData || !image) return;
    try {
      setIsProcessing(true);
      const newEntry = await apiService.createMealLogEntry(nutritionData, image.split(',')[1]);
      setMealLog(prev => [newEntry, ...prev]);
      setNutritionData(null);
      setImage(null);
      setActiveView('home');
      refreshWallet(); 
    } catch (err) {
      setError("Failed to save to log.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddSavedMealToPlan = async (meal: SavedMeal) => {
      if (!activePlanId) return;
      try {
          const newItem = await apiService.addMealToPlan(activePlanId, meal.id, { slot: 'Lunch', day: 'Monday' });
          setMealPlans(prev => prev.map(p => p.id === activePlanId ? { ...p, items: [...p.items, newItem] } : p));
      } catch (e) {
          alert("Failed to add to plan.");
      }
  };

  const renderActiveView = () => {
      if (image || isProcessing || nutritionData || error) {
          return (
              <div className="max-w-2xl mx-auto space-y-6">
                {image && <ImageUploader image={image} />}
                {isProcessing && <Loader message="Gemini is analyzing your meal..." />}
                {error && <ErrorAlert message={error} />}
                {nutritionData && !isProcessing && (
                    <NutritionCard data={nutritionData} onSaveToHistory={handleSaveToHistory} />
                )}
                <button 
                    onClick={() => { setImage(null); setNutritionData(null); setIsCaptureOpen(true); }}
                    className="w-full py-4 text-emerald-600 font-black uppercase tracking-widest text-sm"
                >
                    Retake Photo
                </button>
            </div>
          );
      }

      switch (activeView) {
          case 'home':
              return (
                <CommandCenter 
                    dailyCalories={mealLog.filter(e => new Date(e.createdAt).toDateString() === new Date().toDateString()).reduce((s, e) => s + e.totalCalories, 0)} 
                    dailyProtein={mealLog.filter(e => new Date(e.createdAt).toDateString() === new Date().toDateString()).reduce((s, e) => s + e.totalProtein, 0)} 
                    rewardsBalance={walletBalance} 
                    userName={user?.firstName || 'Hero'}
                    healthStats={healthStats}
                    isHealthConnected={isHealthConnected} 
                    isHealthSyncing={isHealthSyncing}
                    onConnectHealth={handleConnectHealth} 
                    onScanClick={() => setActiveView('body')}
                    onCameraClick={() => setIsCaptureOpen(true)}
                    onBarcodeClick={() => { setIsCaptureOpen(true); }} 
                    onPantryChefClick={() => setIsCaptureOpen(true)}
                    onRestaurantClick={() => { setIsCaptureOpen(true); }}
                    onUploadClick={() => setIsCaptureOpen(true)}
                    dashboardPrefs={dashboardPrefs}
                />
              );
          case 'plan':
              return <MealPlanManager 
                        plans={mealPlans} 
                        activePlanId={activePlanId} 
                        savedMeals={savedMeals}
                        onPlanChange={setActivePlanId}
                        onCreatePlan={async (name) => {
                            const p = await apiService.createMealPlan(name);
                            setMealPlans(prev => [...prev, p]);
                            setActivePlanId(p.id);
                        }}
                        onAddToPlan={() => setIsCaptureOpen(true)}
                        onRemoveFromPlan={async (id) => {
                            await apiService.removeMealFromPlanItem(id);
                            setMealPlans(prev => prev.map(p => ({ ...p, items: p.items.filter(i => i.id !== id) })));
                        }}
                        onQuickAdd={async (pId, meal, day, slot) => {
                            const item = await apiService.addMealToPlan(pId, meal.id, { day, slot });
                            setMealPlans(prev => prev.map(p => p.id === pId ? { ...p, items: [...p.items, item] } : p));
                        }}
                    />;
          case 'meals':
              return <MealLibrary 
                        meals={savedMeals} 
                        onAdd={handleAddSavedMealToPlan} 
                        onDelete={async (id) => {
                            await apiService.deleteMeal(id);
                            setSavedMeals(prev => prev.filter(m => m.id !== id));
                        }} 
                    />;
          case 'history':
              return <MealHistory 
                        logEntries={mealLog} 
                        onAddToPlan={async (data) => {
                            const saved = await apiService.saveMeal(data);
                            setSavedMeals(prev => [saved, ...prev]);
                            handleAddSavedMealToPlan(saved);
                            setActiveView('plan');
                            refreshWallet();
                        }} 
                        onSaveMeal={async (data) => {
                            const saved = await apiService.saveMeal(data);
                            setSavedMeals(prev => [saved, ...prev]);
                            alert("Saved to Library!");
                            refreshWallet();
                        }} 
                    />;
          case 'grocery':
              return <GroceryList mealPlans={mealPlans} />;
          case 'rewards':
              return <RewardsDashboard />;
          case 'social':
              return <SocialManager />;
          case 'assessments':
              return <AssessmentHub />;
          case 'blueprint':
              return <PartnerBlueprint />;
          case 'body':
              return (
                  <BodyHub 
                    healthStats={healthStats} 
                    onSyncHealth={handleConnectHealth}
                    dashboardPrefs={dashboardPrefs}
                    onUpdatePrefs={handleUpdateDashboardPrefs}
                  />
              );
          default:
              return <div className="p-8 text-center text-slate-400">View coming soon...</div>;
      }
  };

  if (isAuthLoading) return <div className="min-h-screen flex items-center justify-center"><Loader message="Loading..." /></div>;
  if (!isAuthenticated) return <Login />;

  return (
    <AppLayout 
        activeView={activeView} 
        onNavigate={(v) => setActiveView(v as ActiveView)} 
        onLogout={logout} 
        mobileMenuOpen={mobileMenuOpen} 
        setMobileMenuOpen={setMobileMenuOpen}
        selectedJourney={dashboardPrefs.selectedJourney}
        onJourneyChange={handleJourneyChange}
    >
        {isCaptureOpen && (
            <CaptureFlow 
                onClose={() => setIsCaptureOpen(false)} 
                onCapture={handleCaptureResult} 
                onRepeatMeal={() => {}} 
                onBodyScanClick={() => setActiveView('body')} 
            />
        )}
        {renderActiveView()}
    </AppLayout>
  );
};

export default App;