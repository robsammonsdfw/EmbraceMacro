
import React, { useState, useCallback, useEffect } from 'react';
import * as apiService from './services/apiService';
import { analyzeFoodImage, searchFood, analyzeRestaurantMeal, getRecipesFromImage } from './services/geminiService';
import { getProductByBarcode } from './services/openFoodFactsService';
import type { NutritionInfo, MealLogEntry, SavedMeal, MealPlan, HealthStats, UserDashboardPrefs, Recipe } from './types';
import { ImageUploader } from './components/ImageUploader';
import { NutritionCard } from './components/NutritionCard';
import { RecipeCard } from './components/RecipeCard';
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
import { CoachProxyBanner } from './components/CoachProxyBanner';
import { CoachProxyUI } from './components/CoachProxyUI';
import { CoachingHub } from './components/coaching/CoachingHub';
import { GoalSetupWizard } from './components/GoalSetupWizard';
import { ActivityIcon, XIcon, ChefHatIcon } from './components/icons';

type ActiveView = 'home' | 'plan' | 'meals' | 'history' | 'grocery' | 'rewards' | 'body' | 'social' | 'assessments' | 'blueprint' | 'labs' | 'orders' | 'clients' | 'coaching';

const App: React.FC = () => {
  const { isAuthenticated, isLoading: isAuthLoading, logout, user } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [isGoalWizardOpen, setIsGoalWizardOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const [proxyClient, setProxyClient] = useState<{id: string, name: string, permissions: any} | null>(null);
  const [coachClients, setCoachClients] = useState<any[]>([]);

  const [image, setImage] = useState<string | null>(null);
  const [nutritionData, setNutritionData] = useState<NutritionInfo | null>(null);
  const [chefRecipes, setChefRecipes] = useState<Recipe[]>([]);
  const [viewingMealDetails, setViewingMealDetails] = useState<NutritionInfo | null>(null);
  
  const [mealLog, setMealLog] = useState<MealLogEntry[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [dashboardPrefs, setDashboardPrefs] = useState<UserDashboardPrefs>({ 
    selectedWidgets: ['steps', 'activeCalories'],
    calorieGoal: 2000,
    proteinGoal: 150
  });
  
  const [healthStats, setHealthStats] = useState<HealthStats>({ steps: 0, activeCalories: 0, restingCalories: 0, distanceMiles: 0, flightsClimbed: 0, heartRate: 0, cardioScore: 0, sleepMinutes: 0 });
  const [isHealthConnected, setIsHealthConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadAllData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
        const [log, saved, plans, prefs, rewards, health] = await Promise.all([
            apiService.getMealLog().catch(() => []),
            apiService.getSavedMeals().catch(() => []),
            apiService.getMealPlans().catch(() => []),
            apiService.getDashboardPrefs().catch(() => ({ selectedWidgets: ['steps', 'activeCalories'] })),
            apiService.getRewardsSummary().catch(() => ({ points_total: 0 })),
            apiService.getHealthStatsFromDB().catch(() => null)
        ]);
        setMealLog(log); setSavedMeals(saved); setMealPlans(plans); setDashboardPrefs(prev => ({ ...prev, ...prefs })); setWalletBalance(rewards.points_total);
        if (health) { setHealthStats(prev => ({ ...prev, ...health })); setIsHealthConnected(true); }
        if (plans.length > 0) setActivePlanId(plans[0].id);
    } catch (e) { console.error("Load failed", e); }
  }, [isAuthenticated]);

  useEffect(() => {
    loadAllData();
    if (user?.role === 'coach') apiService.getCoachClients().then(setCoachClients).catch(() => {});
  }, [loadAllData, user?.role]);

  const handleCaptureResult = useCallback(async (img: string | null, mode: any, barcode?: string, searchQuery?: string) => {
    setIsCaptureOpen(false); 
    setImage(null); setNutritionData(null); setChefRecipes([]); setError(null); 
    setIsProcessing(true);
    try {
        if (mode === 'barcode' && barcode) { const data = await getProductByBarcode(barcode); setNutritionData(data); }
        else if (mode === 'search' && searchQuery) { const data = await searchFood(searchQuery); setNutritionData(data); }
        else if (mode === 'restaurant' && img) { setImage(img); const recipe = await analyzeRestaurantMeal(img.split(',')[1], 'image/jpeg'); setChefRecipes([recipe]); }
        else if (mode === 'pantry' && img) { setImage(img); const recipes = await getRecipesFromImage(img.split(',')[1], 'image/jpeg'); setChefRecipes(recipes); }
        else if (img) { setImage(img); const result = await analyzeFoodImage(img.split(',')[1], 'image/jpeg'); setNutritionData(result); }
    } catch (err) { setError('ChefGPT analysis failed. Please try again.'); }
    finally { setIsProcessing(false); }
  }, []);

  const handleSaveToHistory = async (updatedData: NutritionInfo) => {
    try {
      setIsProcessing(true);
      const newEntry = await apiService.createMealLogEntry(updatedData, image ? image.split(',')[1] : "");
      setMealLog(prev => [newEntry, ...prev]);
      setImage(null); setNutritionData(null); setChefRecipes([]);
    } catch (err) { setError("Failed to save to history."); }
    finally { setIsProcessing(false); }
  };

  const handleAddRecipeToPlan = async (recipe: Recipe) => {
      // Logic to convert recipe to a saved meal or nutrition item then add to plan
      alert("Recipe analysis for macro-integration added to plan logic placeholder.");
  };

  const renderActiveView = () => {
      if (viewingMealDetails) return <div className="max-w-2xl mx-auto space-y-6"><NutritionCard data={viewingMealDetails} isReadOnly onSaveToHistory={() => setViewingMealDetails(null)} /></div>;

      if (activeView === 'home' && (image || isProcessing || nutritionData || chefRecipes.length > 0 || error)) {
          return (
              <div className="max-w-2xl mx-auto space-y-6">
                {image && <ImageUploader image={image} />}
                {isProcessing && <Loader message="ChefGPT is Analyzing..." />}
                {error && <ErrorAlert message={error} />}
                {nutritionData && !isProcessing && <NutritionCard data={nutritionData} onSaveToHistory={handleSaveToHistory} />}
                {chefRecipes.length > 0 && !isProcessing && (
                  <div className="space-y-6">
                      <div className="flex items-center gap-2 px-2">
                        <ChefHatIcon className="text-emerald-500" />
                        <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">ChefGPT Culinary Analysis</h3>
                      </div>
                      {chefRecipes.map((r, i) => <RecipeCard key={i} recipe={r} onAddToPlan={() => handleAddRecipeToPlan(r)} />)}
                  </div>
                )}
                <button onClick={() => { setImage(null); setNutritionData(null); setChefRecipes([]); setError(null); setIsCaptureOpen(true); }} className="w-full py-4 text-emerald-600 font-black uppercase tracking-widest text-sm">Clear and Capture New</button>
            </div>
          );
      }

      const todayLog = mealLog.filter(e => new Date(e.createdAt).toDateString() === new Date().toDateString());
      const dailyCalories = todayLog.reduce((acc, e) => acc + e.totalCalories, 0);
      const dailyProtein = todayLog.reduce((acc, e) => acc + e.totalProtein, 0);

      switch (activeView) {
          case 'home': return <CommandCenter dailyCalories={dailyCalories} dailyProtein={dailyProtein} rewardsBalance={walletBalance} userName={user?.firstName || 'Hero'} healthStats={healthStats} isHealthConnected={isHealthConnected} isHealthSyncing={false} onConnectHealth={()=>{}} onScanClick={() => setActiveView('body')} onCameraClick={() => setIsCaptureOpen(true)} onBarcodeClick={() => setIsCaptureOpen(true)} onPantryChefClick={() => setIsCaptureOpen(true)} onRestaurantClick={() => setIsCaptureOpen(true)} onUploadClick={() => setIsCaptureOpen(true)} dashboardPrefs={dashboardPrefs} />;
          case 'plan': return <MealPlanManager plans={mealPlans} activePlanId={activePlanId} savedMeals={savedMeals} onPlanChange={setActivePlanId} onCreatePlan={name => apiService.createMealPlan(name).then(p => setMealPlans([...mealPlans, p]))} onRemoveFromPlan={id => apiService.removeMealFromPlanItem(id)} onQuickAdd={(pid, m, d, s) => apiService.addMealToPlan(pid, m.id, {day: d, slot: s})} />;
          case 'meals': return <MealLibrary meals={savedMeals} onAdd={() => {}} onDelete={id => apiService.deleteMeal(id)} onSelectMeal={setViewingMealDetails} />;
          case 'history': return <MealHistory logEntries={mealLog} onAddToPlan={() => {}} onSaveMeal={() => {}} onSelectMeal={setViewingMealDetails} />;
          case 'grocery': return <GroceryList mealPlans={mealPlans} />;
          case 'rewards': return <RewardsDashboard />;
          case 'social': return <SocialManager />;
          case 'assessments': return <AssessmentHub />;
          case 'blueprint': return <PartnerBlueprint />;
          case 'body': return <BodyHub healthStats={healthStats} onSyncHealth={()=>{}} dashboardPrefs={dashboardPrefs} onUpdatePrefs={p => apiService.saveDashboardPrefs(p)} />;
          default: return <div className="p-8 text-center text-slate-400">View Not Found</div>;
      }
  };

  if (isAuthLoading) return <div className="min-h-screen flex items-center justify-center"><Loader message="Loading..." /></div>;
  if (!isAuthenticated) return <Login />;

  return (
    <AppLayout activeView={activeView} onNavigate={v => setActiveView(v as ActiveView)} onLogout={logout} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} selectedJourney={dashboardPrefs.selectedJourney} onJourneyChange={j => apiService.saveDashboardPrefs({...dashboardPrefs, selectedJourney: j})} showClientsTab={user?.role === 'coach'}>
        {proxyClient && <CoachProxyBanner clientName={proxyClient.name} onExit={() => setProxyClient(null)} />}
        {isCaptureOpen && <CaptureFlow onClose={() => setIsCaptureOpen(false)} onCapture={handleCaptureResult} onRepeatMeal={() => {}} onBodyScanClick={() => setActiveView('body')} />}
        {isGoalWizardOpen && <GoalSetupWizard onClose={() => setIsGoalWizardOpen(false)} onSave={(c, p) => apiService.saveDashboardPrefs({...dashboardPrefs, calorieGoal: c, proteinGoal: p})} />}
        {renderActiveView()}
        {activeView === 'home' && !nutritionData && chefRecipes.length === 0 && !isProcessing && !error && !image && !viewingMealDetails && (
            <button onClick={() => setIsGoalWizardOpen(true)} className="fixed bottom-24 right-4 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-2 z-30 animate-bounce-short font-black uppercase text-[10px] tracking-widest border border-slate-700"><ActivityIcon className="w-4 h-4 text-emerald-400" /> Set Targets</button>
        )}
    </AppLayout>
  );
};
export default App;
