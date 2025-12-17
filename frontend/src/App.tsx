
import React, { useState, useCallback, useEffect } from 'react';
import * as apiService from './services/apiService';
import { getProductByBarcode } from './services/openFoodFactsService';
import * as healthService from './services/healthService';
import type { NutritionInfo, SavedMeal, Recipe, MealLogEntry, MealPlan, HealthStats } from './types';
import { ImageUploader } from './components/ImageUploader';
import { NutritionCard } from './components/NutritionCard';
import { Loader } from './components/Loader';
import { ErrorAlert } from './components/ErrorAlert';
import { MealLibrary } from './components/MealLibrary';
import { Navbar } from './components/Navbar'; 
import { MealHistory } from './components/MealHistory';
import { MealSuggester } from './components/MealSuggester';
import { RecipeCard } from './components/RecipeCard';
import { useAuth } from './hooks/useAuth';
import { Login } from './components/Login';
import { GroceryList } from './components/GroceryList';
import { AddToPlanModal } from './components/AddToPlanModal';
import { MealPlanManager } from './components/MealPlanManager';
import { RewardsDashboard } from './components/RewardsDashboard';
import { Hub } from './components/Hub';
import { CaptureFlow } from './components/CaptureFlow';
import { AppLayout } from './components/layout/AppLayout';
import { CommandCenter } from './components/dashboard/CommandCenter';
import { OrdersCard } from './components/dashboard/OrdersCard';
import { AssessmentHub } from './components/tests/AssessmentHub';
import { PartnerBlueprint } from './components/matching/PartnerBlueprint';
import { CoachMatch } from './components/matching/CoachMatch';
import { InstallPrompt } from './components/InstallPrompt';
import { SocialManager } from './components/social/SocialManager';

type ActiveView = 'home' | 'plan' | 'meals' | 'history' | 'suggestions' | 'grocery' | 'rewards' | 'body' | 'labs' | 'orders' | 'assessments' | 'blueprint' | 'social';
type MealDataType = NutritionInfo | SavedMeal | MealLogEntry;
type AppMode = 'hub' | 'meals';

const App: React.FC = () => {
  const { isAuthenticated, isLoading: isAuthLoading, logout, user } = useAuth();
  
  const [appMode, setAppMode] = useState<AppMode>('hub');
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [image, setImage] = useState<string | null>(null);
  const [nutritionData, setNutritionData] = useState<NutritionInfo | null>(null);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [mealLog, setMealLog] = useState<MealLogEntry[]>([]);
  
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingMessage, setProcessingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);
  
  const [isAddToPlanModalOpen, setIsAddToPlanModalOpen] = useState(false);
  const [mealToAdd, setMealToAdd] = useState<MealDataType | null>(null);

  const [suggestedMeals, setSuggestedMeals] = useState<NutritionInfo[] | null>(null);
  const [isSuggesting, setIsSuggesting] = useState<boolean>(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  // Health Stats State
  const [healthStats, setHealthStats] = useState<HealthStats>({ steps: 0, activeCalories: 0, cardioScore: 0 });
  const [isHealthConnected, setIsHealthConnected] = useState(false);
  const [isHealthSyncing, setIsHealthSyncing] = useState(false);

  useEffect(() => {
    if (isAuthenticated && appMode === 'meals') {
      const loadInitialData = async () => {
        try {
          setIsDataLoading(true);
          const [plans, meals, log] = await Promise.all([
            apiService.getMealPlans(),
            apiService.getSavedMeals(),
            apiService.getMealLog(),
          ]);
          setMealPlans(plans);
          if (plans.length > 0 && !activePlanId) setActivePlanId(plans[0].id);
          setSavedMeals(meals);
          setMealLog(log);
        } catch (err) {
          console.error(err);
        } finally {
          setIsDataLoading(false);
        }
      };
      loadInitialData();

      // Check if health was connected previously in this session/device
      const savedHealth = localStorage.getItem('health_connected');
      if (savedHealth === 'true') {
          setIsHealthConnected(true);
          handleHealthSync();
      }
    }
  }, [isAuthenticated, appMode, activePlanId]);

  const handleHealthSync = async () => {
      setIsHealthSyncing(true);
      try {
          const data = await healthService.syncHealthData();
          setHealthStats(data);
      } catch (e) {
          console.error("Health sync failed", e);
      } finally {
          setIsHealthSyncing(false);
      }
  };

  const handleConnectHealth = async () => {
      setIsHealthSyncing(true);
      const platform = healthService.getPlatform();
      try {
          const success = await healthService.connectHealthProvider(platform);
          if (success) {
              setIsHealthConnected(true);
              localStorage.setItem('health_connected', 'true');
              await handleHealthSync();
          }
      } catch (e) {
          setError("Could not connect to health provider.");
      } finally {
          setIsHealthSyncing(false);
      }
  };
  
  const resetAnalysisState = () => { 
    setImage(null); 
    setNutritionData(null); 
    setRecipes(null); 
    setError(null); 
  };

  const handleNavigation = (view: string) => {
    if (view === 'hub') { setAppMode('hub'); return; }
    resetAnalysisState();
    setActiveView(view as ActiveView);
  };

  const handleCaptureResult = useCallback(async (img: string | null, mode: any, barcode?: string) => {
    setIsCaptureOpen(false); resetAnalysisState(); setIsProcessing(true);
    try {
        if (mode === 'barcode' && barcode) {
            setProcessingMessage('Fetching product data...');
            setNutritionData(await getProductByBarcode(barcode));
        } else if (img) {
            setImage(img);
            const base64Data = img.split(',')[1];
            if (mode === 'pantry') {
                const results = await apiService.getRecipesFromImage(base64Data, 'image/jpeg');
                setRecipes(results);
            } else {
                setNutritionData(await apiService.analyzeImageWithGemini(base64Data, 'image/jpeg'));
            }
        }
    } catch (err) { setError('Analysis failed.'); } finally { setIsProcessing(false); }
  }, []);

  const handleSaveToHistory = useCallback(async (mealData: NutritionInfo, imageBase64: string) => {
    setIsProcessing(true);
    try {
      const newLogEntry = await apiService.createMealLogEntry(mealData, imageBase64);
      setMealLog(prevLog => [newLogEntry, ...prevLog]);
      resetAnalysisState();
      handleNavigation('history'); 
    } catch (err) { setError("Could not save to history."); } finally { setIsProcessing(false); }
  }, []);

  const handleGetSuggestions = useCallback(async (condition: string, cuisine: string) => {
    setIsSuggesting(true);
    setSuggestionError(null);
    setSuggestedMeals(null);
    try {
        const suggestions = await apiService.getMealSuggestions(condition, cuisine);
        setSuggestedMeals(suggestions);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred.';
        setSuggestionError(message);
    } finally {
        setIsSuggesting(false);
    }
  }, []);

  const renderContent = () => {
      if (image || isProcessing || error || nutritionData || recipes) {
          return (
            <div className="space-y-6">
                {image && <ImageUploader image={image} />}
                {isProcessing && <Loader message={processingMessage} />}
                {error && <ErrorAlert message={error} />}
                {nutritionData && !isProcessing && (
                    <NutritionCard data={nutritionData} onSaveToHistory={() => handleSaveToHistory(nutritionData, image || '')} />
                )}
                {recipes && !isProcessing && (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-center text-slate-800">Pantry Chef Suggestions</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {recipes.map((recipe, idx) => (
                                <RecipeCard 
                                    key={idx} 
                                    recipe={recipe} 
                                    onAddToPlan={() => { setMealToAdd(recipe as any); setIsAddToPlanModalOpen(true); }} 
                                />
                            ))}
                        </div>
                    </div>
                )}
                <button onClick={resetAnalysisState} className="w-full py-3 text-slate-500 font-bold">Back to Dashboard</button>
            </div>
          );
      }
      switch(activeView) {
        case 'home': return (
            <CommandCenter 
                dailyCalories={mealLog.reduce((acc, curr) => acc + curr.totalCalories, 0)} 
                dailyProtein={0} 
                rewardsBalance={2000} 
                userName={user?.firstName || 'User'} 
                healthStats={healthStats}
                isHealthConnected={isHealthConnected}
                isHealthSyncing={isHealthSyncing}
                onConnectHealth={handleConnectHealth}
                onScanClick={() => {}} 
                onCameraClick={() => { setCaptureInitialMode('meal'); setIsCaptureOpen(true); }} 
                onBarcodeClick={() => { setCaptureInitialMode('barcode'); setIsCaptureOpen(true); }} 
                onPantryChefClick={() => { setCaptureInitialMode('pantry'); setIsCaptureOpen(true); }} 
                onRestaurantClick={() => { setCaptureInitialMode('restaurant'); setIsCaptureOpen(true); }} 
                onUploadClick={() => setIsCaptureOpen(true)} 
            />
        );
        case 'social': return <SocialManager />;
        case 'plan': return <MealPlanManager plans={mealPlans} activePlanId={activePlanId} savedMeals={savedMeals} onPlanChange={setActivePlanId} onCreatePlan={async (n) => setMealPlans([...mealPlans, await apiService.createMealPlan(n)])} onAddToPlan={m => {setMealToAdd(m); setIsAddToPlanModalOpen(true);}} onRemoveFromPlan={id => apiService.removeMealFromPlanItem(id)} onQuickAdd={(p, m, d, s) => apiService.addMealToPlan(p, m.id, {day: d, slot: s})} />;
        case 'meals': return <MealLibrary meals={savedMeals} onAdd={m => {setMealToAdd(m); setIsAddToPlanModalOpen(true);}} onDelete={id => apiService.deleteMeal(id)} />;
        case 'history': return <MealHistory logEntries={mealLog} onSaveMeal={async m => { const s = await apiService.saveMeal(m); setSavedMeals([...savedMeals, s]); return s; }} onAddToPlan={m => {setMealToAdd(m); setIsAddToPlanModalOpen(true);}} />;
        case 'suggestions': return <MealSuggester onGetSuggestions={handleGetSuggestions} suggestions={suggestedMeals} isLoading={isSuggesting} error={suggestionError} onAddToPlan={m => { setMealToAdd(m as any); setIsAddToPlanModalOpen(true); }} onSaveMeal={async m => { const s = await apiService.saveMeal(m); setSavedMeals([...savedMeals, s]); return s; }} />;
        case 'grocery': return <GroceryList mealPlans={mealPlans} />;
        case 'rewards': return <RewardsDashboard />;
        case 'assessments': return <AssessmentHub />;
        case 'blueprint': return <><PartnerBlueprint /><CoachMatch /></>;
        case 'orders': return <OrdersCard />;
        default: return null;
    }
  };

  const [captureInitialMode, setCaptureInitialMode] = useState<'meal' | 'barcode' | 'pantry' | 'restaurant'>('meal');

  if (isAuthLoading) return <div className="min-h-screen flex items-center justify-center"><Loader message="Loading..." /></div>;
  if (!isAuthenticated) return <Login />;
  if (appMode === 'hub') return <Hub onEnterMeals={() => setAppMode('meals')} onLogout={logout} />;
  if (isDataLoading) return <div className="min-h-screen flex items-center justify-center"><Loader message="Syncing..." /></div>;

  return (
    <AppLayout activeView={activeView} onNavigate={handleNavigation} onLogout={logout} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen}>
        <InstallPrompt />
        {isCaptureOpen && <CaptureFlow onClose={() => setIsCaptureOpen(false)} initialMode={captureInitialMode} onCapture={handleCaptureResult} onRepeatMeal={m => setNutritionData(m)} onBodyScanClick={() => {}} />}
        {isAddToPlanModalOpen && <AddToPlanModal plans={mealPlans} onSelectPlan={async (pid, meta) => { if(mealToAdd) await apiService.addMealToPlan(pid, (mealToAdd as any).id, meta); setIsAddToPlanModalOpen(false); }} onClose={() => setIsAddToPlanModalOpen(false)} />}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40">
             <Navbar activeView={activeView} onNavigate={handleNavigation} onLogout={logout} onBackToHub={() => setAppMode('hub')} onCaptureClick={() => setIsCaptureOpen(true)} onOpenMenu={() => setMobileMenuOpen(true)} />
        </div>
        {renderContent()}
    </AppLayout>
  );
};

export default App;
