
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
import { CoachProxyBanner } from './components/CoachProxyBanner';
import { CoachProxyUI } from './components/CoachProxyUI';
import { CoachingHub } from './components/coaching/CoachingHub';

type ActiveView = 'home' | 'plan' | 'meals' | 'history' | 'grocery' | 'rewards' | 'body' | 'social' | 'assessments' | 'blueprint' | 'labs' | 'orders' | 'clients' | 'coaching';

const App: React.FC = () => {
  const { isAuthenticated, isLoading: isAuthLoading, logout, user } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const [proxyClient, setProxyClient] = useState<{id: string, name: string, permissions: any} | null>(null);
  const [coachClients, setCoachClients] = useState<any[]>([]);

  const [image, setImage] = useState<string | null>(null);
  const [nutritionData, setNutritionData] = useState<NutritionInfo | null>(null);
  const [mealLog, setMealLog] = useState<MealLogEntry[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [dashboardPrefs, setDashboardPrefs] = useState<UserDashboardPrefs>({ 
    selectedWidgets: ['steps', 'activeCalories'],
    selectedJourney: 'general-health'
  });
  
  const [healthStats, setHealthStats] = useState<HealthStats>({ 
    steps: 0, activeCalories: 0, restingCalories: 0, distanceMiles: 0, 
    flightsClimbed: 0, heartRate: 0, cardioScore: 0, sleepMinutes: 0 
  });
  const [isHealthConnected, setIsHealthConnected] = useState(false);
  const [isHealthSyncing, setIsHealthSyncing] = useState(false);

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
        setMealLog(log); setSavedMeals(saved); setMealPlans(plans); setDashboardPrefs(prefs); setWalletBalance(rewards.points_total);
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

  const handleEnterProxy = (client: any) => {
      apiService.setProxyClient(client.id);
      setProxyClient({ id: client.id, name: client.firstName || client.email, permissions: client.permissions });
      loadAllData();
      setActiveView('home');
  };

  const handleExitProxy = () => {
      apiService.setProxyClient(null);
      setProxyClient(null);
      loadAllData();
      setActiveView('home');
  };

  const handleCaptureResult = useCallback(async (img: string | null, mode: any, barcode?: string) => {
    setIsCaptureOpen(false); setImage(null); setNutritionData(null); setError(null); setIsProcessing(true);
    try {
        if (mode === 'barcode' && barcode) { const data = await getProductByBarcode(barcode); setNutritionData(data); }
        else if (img) { setImage(img); const result = await analyzeFoodImage(img.split(',')[1], 'image/jpeg'); setNutritionData(result); }
    } catch (err) { setError('Analysis failed.'); }
    finally { setIsProcessing(false); }
  }, []);

  const handleSaveToHistory = async () => {
    if (!nutritionData || !image) return;
    try {
      setIsProcessing(true);
      const newEntry = await apiService.createMealLogEntry(nutritionData, image.split(',')[1]);
      setMealLog(prev => [newEntry, ...prev]);
      setImage(null); setNutritionData(null); setActiveView('home');
    } catch (err) { setError("Failed to save."); }
    finally { setIsProcessing(false); }
  };

  const renderActiveView = () => {
      if (image || isProcessing || nutritionData || error) {
          return (
              <div className="max-w-2xl mx-auto space-y-6">
                {image && <ImageUploader image={image} />}
                {isProcessing && <Loader message="Analyzing..." />}
                {error && <ErrorAlert message={error} />}
                {nutritionData && !isProcessing && (
                  <CoachProxyUI permission={proxyClient ? 'read' : 'full'}>
                    <NutritionCard data={nutritionData} onSaveToHistory={handleSaveToHistory} />
                  </CoachProxyUI>
                )}
                <button onClick={() => { setImage(null); setNutritionData(null); setIsCaptureOpen(true); }} className="w-full py-4 text-emerald-600 font-black uppercase tracking-widest text-sm">Retake Photo</button>
            </div>
          );
      }

      // Proxy permission lookup
      const perms = proxyClient?.permissions || {
          journey: 'full', meals: 'full', grocery: 'full', body: 'full', assessments: 'full', blueprint: 'full', social: 'full', wallet: 'full'
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
                    onConnectHealth={source => {}} onScanClick={() => setActiveView('body')}
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
          case 'plan': return <CoachProxyUI permission={perms.meals}><MealPlanManager plans={mealPlans} activePlanId={activePlanId} savedMeals={savedMeals} onPlanChange={setActivePlanId} onCreatePlan={name => {}} onRemoveFromPlan={id => {}} onQuickAdd={(pId, meal, day, slot) => {}} /></CoachProxyUI>;
          case 'meals': return <CoachProxyUI permission={perms.meals}><MealLibrary meals={savedMeals} onAdd={m => {}} onDelete={id => {}} /></CoachProxyUI>;
          case 'history': return <CoachProxyUI permission={perms.meals}><MealHistory logEntries={mealLog} onAddToPlan={d => {}} onSaveMeal={d => {}} /></CoachProxyUI>;
          case 'grocery': return <CoachProxyUI permission={perms.grocery}><GroceryList mealPlans={mealPlans} /></CoachProxyUI>;
          case 'rewards': return <CoachProxyUI permission={proxyClient ? 'none' : 'full'} fallback={<ErrorAlert message="Restricted Module: Rewards Wallet" />}><RewardsDashboard /></CoachProxyUI>;
          case 'social': return <CoachProxyUI permission={proxyClient ? 'none' : 'full'} fallback={<ErrorAlert message="Restricted Module: Social Hub" />}><SocialManager /></CoachProxyUI>;
          case 'assessments': return <CoachProxyUI permission={perms.assessments}><AssessmentHub /></CoachProxyUI>;
          case 'blueprint': return <CoachProxyUI permission={perms.blueprint}><PartnerBlueprint /></CoachProxyUI>;
          case 'body': return <CoachProxyUI permission={perms.body}><BodyHub healthStats={healthStats} onSyncHealth={s => {}} dashboardPrefs={dashboardPrefs} onUpdatePrefs={p => {}} /></CoachProxyUI>;
          default: return <div className="p-8 text-center text-slate-400">View Not Found</div>;
      }
  };

  if (isAuthLoading) return <div className="min-h-screen flex items-center justify-center"><Loader message="Loading..." /></div>;
  if (!isAuthenticated) return <Login />;

  return (
    <AppLayout 
        activeView={activeView} onNavigate={v => setActiveView(v as ActiveView)} onLogout={logout} 
        mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} 
        selectedJourney={dashboardPrefs.selectedJourney} onJourneyChange={j => {}} 
        showClientsTab={user?.role === 'coach'}
    >
        {proxyClient && <CoachProxyBanner clientName={proxyClient.name} onExit={handleExitProxy} />}
        {isCaptureOpen && !proxyClient && <CaptureFlow onClose={() => setIsCaptureOpen(false)} onCapture={handleCaptureResult} onRepeatMeal={() => {}} onBodyScanClick={() => setActiveView('body')} />}
        {renderActiveView()}
    </AppLayout>
  );
};
export default App;
