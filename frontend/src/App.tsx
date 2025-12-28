
import React, { useState, useCallback, useEffect } from 'react';
import * as apiService from './services/apiService';
import { analyzeFoodImage, searchFood } from './services/geminiService';
import { getProductByBarcode } from './services/openFoodFactsService';
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
import { CoachProxyBanner } from './components/CoachProxyBanner';
import { CoachProxyUI } from './components/CoachProxyUI';
import { CoachingHub } from './components/coaching/CoachingHub';
import { GoalSetupWizard } from './components/GoalSetupWizard';
import { ActivityIcon, XIcon } from './components/icons';

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
  const [viewingMealDetails, setViewingMealDetails] = useState<NutritionInfo | null>(null);
  
  const [mealLog, setMealLog] = useState<MealLogEntry[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [dashboardPrefs, setDashboardPrefs] = useState<UserDashboardPrefs>({ 
    selectedWidgets: ['steps', 'activeCalories'],
    selectedJourney: 'general-health',
    calorieGoal: 2000,
    proteinGoal: 150
  });
  
  const [healthStats, setHealthStats] = useState<HealthStats>({ 
    steps: 0, activeCalories: 0, restingCalories: 0, distanceMiles: 0, 
    flightsClimbed: 0, heartRate: 0, cardioScore: 0, sleepMinutes: 0 
  });
  const [isHealthConnected, setIsHealthConnected] = useState(false);
  const [isHealthSyncing, _setIsHealthSyncing] = useState(false);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadAllData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
        const [log, saved, plans, prefs, rewards, health] = await Promise.all([
            apiService.getMealLog().catch(() => []),
            apiService.getSavedMeals().catch(() => []),
            apiService.getMealPlans().catch(() => []),
            apiService.getDashboardPrefs().catch(() => ({ selectedWidgets: ['steps', 'activeCalories'], selectedJourney: 'general-health' as HealthJourney })),
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
    const savedProxyId = apiService.getProxyClient();
    if (savedProxyId) {
        apiService.getCoachClients().then(clients => {
            const match = clients.find(c => c.id === savedProxyId);
            if (match) setProxyClient({ id: match.id, name: match.firstName || match.email, permissions: match.permissions });
        });
    }
    if (user?.role === 'coach') apiService.getCoachClients().then(setCoachClients).catch(() => {});
  }, [loadAllData, user?.role]);

  const handleUpdateDashboardPrefs = async (newPrefs: UserDashboardPrefs) => {
      setDashboardPrefs(newPrefs);
      try {
          await apiService.saveDashboardPrefs(newPrefs);
      } catch (e) {
          console.error("Failed to save dashboard preferences:", e);
      }
  };

  const handleEnterProxy = (client: any) => {
      apiService.setProxyClient(client.id);
      setProxyClient({ id: client.id, name: client.firstName || client.email, permissions: client.permissions });
      loadAllData();
      handleNavigate('home');
  };

  const handleExitProxy = () => {
      apiService.setProxyClient(null);
      setProxyClient(null);
      loadAllData();
      handleNavigate('home');
  };

  const handleNavigate = (view: ActiveView) => {
    setActiveView(view);
    setImage(null);
    setNutritionData(null);
    setViewingMealDetails(null);
    setError(null);
    setIsProcessing(false);
    setMobileMenuOpen(false);
  };

  const handleCaptureResult = useCallback(async (img: string | null, mode: any, barcode?: string, searchQuery?: string) => {
    setIsCaptureOpen(false); 
    setImage(null); 
    setNutritionData(null); 
    setViewingMealDetails(null);
    setError(null); 
    setIsProcessing(true);
    setActiveView('home'); 
    try {
        if (mode === 'barcode' && barcode) { const data = await getProductByBarcode(barcode); setNutritionData(data); }
        else if (mode === 'search' && searchQuery) { const data = await searchFood(searchQuery); setNutritionData(data); }
        else if (img) { setImage(img); const result = await analyzeFoodImage(img.split(',')[1], 'image/jpeg'); setNutritionData(result); }
    } catch (err) { setError('Analysis failed.'); }
    finally { setIsProcessing(false); }
  }, []);

  const handleSaveToHistory = async (updatedData: NutritionInfo) => {
    try {
      setIsProcessing(true);
      setError(null);
      const newEntry = await apiService.createMealLogEntry(updatedData, image ? image.split(',')[1] : "");
      setMealLog(prev => [newEntry, ...prev]);
      setImage(null); 
      setNutritionData(null); 
      setActiveView('home');
    } catch (err) { 
      setError("Failed to save. This is likely a temporary server issue."); 
    }
    finally { setIsProcessing(false); }
  };

  const renderActiveView = () => {
      // 1. Detailed View Modal (Override)
      if (viewingMealDetails) {
          return (
              <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
                  <div className="flex justify-between items-center px-4">
                      <button 
                        onClick={() => setViewingMealDetails(null)} 
                        className="text-slate-400 hover:text-slate-600 flex items-center gap-2 font-bold uppercase text-xs tracking-widest"
                      >
                         <XIcon className="w-4 h-4" /> Close Details
                      </button>
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Saved Records</span>
                  </div>
                  <NutritionCard data={viewingMealDetails} isReadOnly onSaveToHistory={() => setViewingMealDetails(null)} />
              </div>
          );
      }

      // 2. Transient analysis/error view
      if (activeView === 'home' && (image || isProcessing || nutritionData || error)) {
          const mealsPerm = proxyClient?.permissions?.meals || 'full';
          return (
              <div className="max-w-2xl mx-auto space-y-6">
                {image && <ImageUploader image={image} />}
                {isProcessing && <Loader message="Analyzing..." />}
                {error && <ErrorAlert message={error} />}
                {nutritionData && !isProcessing && (
                  <CoachProxyUI permission={mealsPerm}>
                    <NutritionCard data={nutritionData} onSaveToHistory={handleSaveToHistory} />
                  </CoachProxyUI>
                )}
                <button onClick={() => { setImage(null); setNutritionData(null); setError(null); setIsCaptureOpen(true); }} className="w-full py-4 text-emerald-600 font-black uppercase tracking-widest text-sm">Cancel Analysis</button>
            </div>
          );
      }

      const perms = proxyClient?.permissions || {
          journey: 'full', meals: 'full', grocery: 'full', body: 'full', assessments: 'full', blueprint: 'full'
      };

      const todayLog = mealLog.filter(e => new Date(e.createdAt).toDateString() === new Date().toDateString());
      const dailyCalories = todayLog.reduce((acc, e) => acc + e.totalCalories, 0);
      const dailyProtein = todayLog.reduce((acc, e) => acc + e.totalProtein, 0);

      switch (activeView) {
          case 'home':
              return (
                <CommandCenter 
                    dailyCalories={dailyCalories} dailyProtein={dailyProtein} rewardsBalance={walletBalance} userName={user?.firstName || 'Hero'}
                    healthStats={healthStats} isHealthConnected={isHealthConnected} isHealthSyncing={isHealthSyncing}
                    onConnectHealth={_source => {}} onScanClick={() => handleNavigate('body')}
                    onCameraClick={() => setIsCaptureOpen(true)} onBarcodeClick={() => setIsCaptureOpen(true)} 
                    onPantryChefClick={() => setIsCaptureOpen(true)} onRestaurantClick={() => setIsCaptureOpen(true)}
                    onUploadClick={() => setIsCaptureOpen(true)} dashboardPrefs={dashboardPrefs}
                    isProxy={!!proxyClient}
                />
              );
          case 'clients':
              return (
                  <div className="max-w-xl mx-auto space-y-4">
                      <h2 className="text-2xl font-black text-slate-800">My Clients</h2>
                      {coachClients.map(c => (
                          <div key={c.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center">
                              <div><p className="font-bold text-lg">{c.firstName || c.email}</p><p className="text-xs text-slate-400">{c.email}</p></div>
                              <button onClick={() => handleEnterProxy(c)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold">Act as Proxy</button>
                          </div>
                      ))}
                  </div>
              );
          case 'coaching': return <CoachingHub userRole={user?.role as any} onUpgrade={() => {}} />;
          case 'plan': return <CoachProxyUI permission={perms.meals}><MealPlanManager plans={mealPlans} activePlanId={activePlanId} savedMeals={savedMeals} onPlanChange={setActivePlanId} onCreatePlan={_name => {}} onRemoveFromPlan={_id => {}} onQuickAdd={(_pId, _meal, _day, _slot) => {}} /></CoachProxyUI>;
          case 'meals': return <CoachProxyUI permission={perms.meals}><MealLibrary meals={savedMeals} onAdd={_m => {}} onDelete={_id => {}} onSelectMeal={setViewingMealDetails} /></CoachProxyUI>;
          case 'history': return <CoachProxyUI permission={perms.meals}><MealHistory logEntries={mealLog} onAddToPlan={_d => {}} onSaveMeal={_d => {}} onSelectMeal={setViewingMealDetails} /></CoachProxyUI>;
          case 'grocery': return <CoachProxyUI permission={perms.grocery}><GroceryList mealPlans={mealPlans} /></CoachProxyUI>;
          case 'rewards': return <CoachProxyUI permission={proxyClient ? 'none' : 'full'} fallback={<div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">Private Module: Rewards Wallet is hidden for Proxy Sessions.</div>}><RewardsDashboard /></CoachProxyUI>;
          case 'social': return <CoachProxyUI permission={proxyClient ? 'none' : 'full'} fallback={<div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">Private Module: Social Hub is hidden for Proxy Sessions.</div>}><SocialManager /></CoachProxyUI>;
          case 'assessments': return <CoachProxyUI permission={perms.assessments}><AssessmentHub /></CoachProxyUI>;
          case 'blueprint': return <CoachProxyUI permission={perms.blueprint}><PartnerBlueprint /></CoachProxyUI>;
          case 'body': return <CoachProxyUI permission={perms.body}><BodyHub healthStats={healthStats} onSyncHealth={_s => {}} dashboardPrefs={dashboardPrefs} onUpdatePrefs={handleUpdateDashboardPrefs} /></CoachProxyUI>;
          default: return <div className="p-8 text-center text-slate-400">View Not Found</div>;
      }
  };

  if (isAuthLoading) return <div className="min-h-screen flex items-center justify-center"><Loader message="Loading..." /></div>;
  if (!isAuthenticated) return <Login />;

  return (
    <AppLayout 
        activeView={activeView} onNavigate={v => handleNavigate(v as ActiveView)} onLogout={logout} 
        mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} 
        selectedJourney={dashboardPrefs.selectedJourney} 
        onJourneyChange={j => handleUpdateDashboardPrefs({ ...dashboardPrefs, selectedJourney: j })} 
        showClientsTab={user?.role === 'coach'}
    >
        {proxyClient && <CoachProxyBanner clientName={proxyClient.name} onExit={handleExitProxy} />}
        {isCaptureOpen && !proxyClient && <CaptureFlow onClose={() => setIsCaptureOpen(false)} onCapture={handleCaptureResult} onRepeatMeal={() => {}} onBodyScanClick={() => handleNavigate('body')} />}
        {isGoalWizardOpen && (
            <GoalSetupWizard 
                onClose={() => setIsGoalWizardOpen(false)} 
                onSave={(cal, prot) => {
                    handleUpdateDashboardPrefs({ ...dashboardPrefs, calorieGoal: cal, proteinGoal: prot });
                    setIsGoalWizardOpen(false);
                }} 
            />
        )}
        {renderActiveView()}
        {activeView === 'home' && !nutritionData && !isProcessing && !error && !image && !viewingMealDetails && (
            <button 
                onClick={() => setIsGoalWizardOpen(true)}
                className="fixed bottom-24 right-4 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-2 z-30 animate-bounce-short font-black uppercase text-[10px] tracking-widest border border-slate-700"
            >
                <ActivityIcon className="w-4 h-4 text-emerald-400" /> Set Targets
            </button>
        )}
    </AppLayout>
  );
};
export default App;
