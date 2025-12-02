

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import * as apiService from './services/apiService';
import { getProductByBarcode } from './services/openFoodFactsService';
import type { NutritionInfo, SavedMeal, Recipe, MealLogEntry, MealPlan, MealPlanItemMetadata } from './types';
import { ImageUploader } from './components/ImageUploader';
import { NutritionCard } from './components/NutritionCard';
import { Loader } from './components/Loader';
import { ErrorAlert } from './components/ErrorAlert';
import { HomeDashboard } from './components/HomeDashboard';
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

type ActiveView = 'home' | 'plan' | 'meals' | 'history' | 'suggestions' | 'grocery' | 'rewards';
type MealDataType = NutritionInfo | SavedMeal | MealLogEntry;
type AppMode = 'hub' | 'meals';

const App: React.FC = () => {
  const { isAuthenticated, isLoading: isAuthLoading, logout, user } = useAuth();
  
  // App Navigation State
  const [appMode, setAppMode] = useState<AppMode>('hub');
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);

  // App Data State
  const [image, setImage] = useState<string | null>(null);
  const [nutritionData, setNutritionData] = useState<NutritionInfo | null>(null);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [mealLog, setMealLog] = useState<MealLogEntry[]>([]);
  
  // UI/Process State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingMessage, setProcessingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);
  
  // Modal State
  const [isAddToPlanModalOpen, setIsAddToPlanModalOpen] = useState(false);
  const [mealToAdd, setMealToAdd] = useState<MealDataType | null>(null);

  // Suggestions State
  const [suggestedMeals, setSuggestedMeals] = useState<NutritionInfo[] | null>(null);
  const [isSuggesting, setIsSuggesting] = useState<boolean>(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  const activePlan = useMemo(() => {
    return mealPlans.find(p => p.id === activePlanId) || null;
  }, [mealPlans, activePlanId]);

  useEffect(() => {
    if (isAuthenticated) {
      const loadInitialData = async () => {
        try {
          // Keep data loading in background if we are at the hub, or load it immediately.
          setIsDataLoading(true);
          const [plans, meals, log] = await Promise.all([
            apiService.getMealPlans(),
            apiService.getSavedMeals(),
            apiService.getMealLog(),
          ]);
          setMealPlans(plans);
          if (plans.length > 0 && !activePlanId) {
            setActivePlanId(plans[0].id);
          }
          setSavedMeals(meals);
          setMealLog(log);
        } catch (err) {
          setError("Could not load your data. Please try refreshing the page.");
        } finally {
          setIsDataLoading(false);
        }
      };
      loadInitialData();
    }
  }, [isAuthenticated]);
  
  const resetAnalysisState = () => {
      setImage(null);
      setNutritionData(null);
      setRecipes(null);
      setError(null);
  };

  const handleNavigation = (view: string) => {
    resetAnalysisState();
    setActiveView(view as ActiveView);
  };

  const handleLogout = () => {
      setAppMode('hub');
      logout();
  };

  const handleCaptureResult = useCallback(async (
      img: string | null, 
      mode: 'meal' | 'barcode' | 'pantry' | 'restaurant', 
      barcode?: string
  ) => {
    setIsCaptureOpen(false);
    resetAnalysisState();
    setIsProcessing(true);

    try {
        if (mode === 'barcode' && barcode) {
            setProcessingMessage('Fetching product data...');
            const data = await getProductByBarcode(barcode);
            setNutritionData(data);
        } else if (img) {
            setImage(img);
            const base64Data = img.split(',')[1];

            if (mode === 'pantry') {
                setProcessingMessage('Generating recipe ideas from ingredients...');
                const recipeData = await apiService.getRecipesFromImage(base64Data, 'image/jpeg');
                setRecipes(recipeData);
            } else if (mode === 'restaurant') {
                 setProcessingMessage('Analyzing restaurant meal...');
                 const data = await apiService.analyzeRestaurantMeal(base64Data, 'image/jpeg');
                 setNutritionData(data);
            } else {
                 setProcessingMessage('Analyzing nutritional data...');
                 const data = await apiService.analyzeImageWithGemini(base64Data, 'image/jpeg');
                 setNutritionData(data);
            }
        }
    } catch (err) {
        setError('Analysis failed. Please try again.');
        console.error(err);
    } finally {
        setIsProcessing(false);
    }
  }, []);

  const handleRepeatMeal = useCallback((meal: MealLogEntry) => {
      setIsCaptureOpen(false);
      resetAnalysisState();
      // Directly hydrate the nutrition card with the previous meal data
      setNutritionData({
          ...meal,
          // Use generic image if original is gone, or keep it if possible (though complex with types)
          imageUrl: meal.imageUrl 
      });
  }, []);
  
  const handleBodyScanClick = () => {
      const token = localStorage.getItem('embracehealth-api-token');
      if (token) {
          window.location.href = `https://app.embracehealth.ai?token=${encodeURIComponent(token)}`;
      } else {
          window.location.href = 'https://app.embracehealth.ai';
      }
  };

  const handleSaveToHistory = useCallback(async (mealData: NutritionInfo, imageBase64: string) => {
    setIsProcessing(true);
    setProcessingMessage("Saving to your history...");
    try {
      const newLogEntry = await apiService.createMealLogEntry(mealData, imageBase64);
      setMealLog(prevLog => [newLogEntry, ...prevLog]);
      resetAnalysisState();
      handleNavigation('history'); 
    } catch (err) {
      setError("Could not save to history. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleSaveMeal = useCallback(async (mealData: NutritionInfo): Promise<SavedMeal | null> => {
      try {
        const newMeal = await apiService.saveMeal(mealData);
        if (!savedMeals.some(m => m.id === newMeal.id)) {
            setSavedMeals(prevMeals => [newMeal, ...prevMeals]);
        }
        return newMeal;
      } catch (err) {
        setError('Could not save your meal.');
        return null;
      }
  }, [savedMeals]);
  
  const handleDeleteMeal = useCallback(async (mealId: number) => {
    setSavedMeals(prev => prev.filter(m => m.id !== mealId));
    try { await apiService.deleteMeal(mealId); } 
    catch (err) { setError('Failed to delete meal.'); }
  }, []);

  const handleGetSuggestions = useCallback(async (condition: string, cuisine: string) => {
    setIsSuggesting(true); setSuggestionError(null); setSuggestedMeals(null);
    try {
        const suggestions = await apiService.getMealSuggestions(condition, cuisine);
        setSuggestedMeals(suggestions);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred.';
        setSuggestionError(message);
    } finally { setIsSuggesting(false); }
  }, []);
  
  const handleCreateMealPlan = async (name: string) => {
    try {
      const newPlan = await apiService.createMealPlan(name);
      setMealPlans(prev => [...prev, newPlan]);
      setActivePlanId(newPlan.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create plan.");
    }
  };

  const handleInitiateAddToPlan = (meal: MealDataType) => {
    setMealToAdd(meal);
    setIsAddToPlanModalOpen(true);
  };
  
  const handleConfirmAddToPlan = async (planId: number, metadata: MealPlanItemMetadata) => {
    if (!mealToAdd) return;
    try {
        let newItem;
        if ('id' in mealToAdd && 'createdAt' in mealToAdd) { // MealLogEntry
            newItem = await apiService.addMealFromHistoryToPlan(planId, mealToAdd, metadata);
        } else if ('id' in mealToAdd) { // SavedMeal
            newItem = await apiService.addMealToPlan(planId, mealToAdd.id, metadata);
        } else { // NutritionInfo from suggestion or recipe
            newItem = await apiService.addMealFromHistoryToPlan(planId, mealToAdd, metadata);
        }
        
        if (newItem) {
            setMealPlans(plans => plans.map(p => p.id === planId ? { ...p, items: [...p.items, newItem] } : p));
        }

        if (metadata.addToGrocery) {
             await apiService.addGroceryItem(activePlanId || 0, mealToAdd.mealName); 
        }

    } catch(err) {
        setError("Failed to add meal to plan.");
    } finally {
        setIsAddToPlanModalOpen(false);
        setMealToAdd(null);
    }
  };

  const handleRemoveFromPlan = useCallback(async (planItemId: number) => {
      if (!activePlan) return;
      const originalItems = activePlan.items;
      const updatedItems = originalItems.filter(item => item.id !== planItemId);
      setMealPlans(plans => plans.map(p => p.id === activePlanId ? { ...p, items: updatedItems } : p));
      
      try { 
        await apiService.removeMealFromPlanItem(planItemId);
      } catch (err) { 
        setError("Failed to remove meal from plan.");
        setMealPlans(plans => plans.map(p => p.id === activePlanId ? { ...p, items: originalItems } : p));
      }
  }, [activePlan, activePlanId]);

  
  if (isAuthLoading) { return <div className="min-h-screen flex items-center justify-center"><Loader message="Loading session..." /></div>; }
  
  if (!isAuthenticated) { return <Login />; }

  // New Navigation Hub
  if (appMode === 'hub') {
      return <Hub onEnterMeals={() => setAppMode('meals')} onLogout={handleLogout} />;
  }

  // Meal Planning App
  if (isDataLoading) { return <div className="min-h-screen flex items-center justify-center"><Loader message="Loading your data..." /></div>; }

  const hasAnalysisContent = image || isProcessing || error || nutritionData || recipes;
  
  const renderContent = () => {
      if (hasAnalysisContent) {
          return (
            <div className="space-y-6">
                <ImageUploader image={image} />
                {isProcessing && <Loader message={processingMessage} />}
                {error && <ErrorAlert message={error} />}
                {nutritionData && !isProcessing && image && ( <NutritionCard data={nutritionData} onSaveToHistory={() => handleSaveToHistory(nutritionData, image)} /> )}
                {recipes && !isProcessing && (
                  <div className="space-y-4">
                      <h2 className="text-2xl font-bold text-slate-800 text-center pt-4 border-t border-slate-200">
                        {processingMessage.includes('ingredients') ? 'Pantry Chef Ideas' : 'Recipe for Your Dish'}
                      </h2>
                      {recipes.map((recipe, index) => ( 
                        <RecipeCard 
                          key={index} 
                          recipe={recipe} 
                          onAddToPlan={() => {
                            const ingredientsList = recipe.ingredients.map(i => ({
                                name: i.name,
                                weightGrams: 0, 
                                calories: 0,
                                protein: 0,
                                carbs: 0,
                                fat: 0
                            }));
                            
                            const mealData: NutritionInfo = { 
                              ...recipe.nutrition, 
                              mealName: recipe.recipeName, 
                              ingredients: ingredientsList 
                            };
                            handleInitiateAddToPlan(mealData);
                          }} 
                        /> 
                      ))}
                  </div>
                )}
            </div>
          );
      }

      switch(activeView) {
        case 'home': return (
            <HomeDashboard 
              onCameraClick={() => setIsCaptureOpen(true)}
              onUploadClick={() => setIsCaptureOpen(true)}
              onBarcodeClick={() => setIsCaptureOpen(true)}
              onPantryChefClick={() => setIsCaptureOpen(true)}
              onGetRecipeClick={() => setIsCaptureOpen(true)}
              mealLog={mealLog}
              userName={user?.firstName || 'User'}
            />
        );
        case 'plan': return (
             <MealPlanManager 
                plans={mealPlans} 
                activePlanId={activePlanId} 
                savedMeals={savedMeals}
                onPlanChange={setActivePlanId}
                onCreatePlan={handleCreateMealPlan}
                onAddToPlan={handleInitiateAddToPlan}
                onRemoveFromPlan={handleRemoveFromPlan}
            />
        );
        case 'meals': return <MealLibrary meals={savedMeals} onAdd={handleInitiateAddToPlan} onDelete={handleDeleteMeal} />;
        case 'history': return <MealHistory logEntries={mealLog} onSaveMeal={handleSaveMeal} onAddToPlan={handleInitiateAddToPlan} />;
        case 'suggestions': return <MealSuggester 
                                      onGetSuggestions={handleGetSuggestions} suggestions={suggestedMeals}
                                      isLoading={isSuggesting} error={suggestionError}
                                      onAddToPlan={handleInitiateAddToPlan} onSaveMeal={handleSaveMeal}
                                  />;
        case 'grocery': return <GroceryList mealPlans={mealPlans} />;
        case 'rewards': return <RewardsDashboard />;
        default: return (
             <HomeDashboard 
              onCameraClick={() => setIsCaptureOpen(true)}
              onUploadClick={() => setIsCaptureOpen(true)}
              onBarcodeClick={() => setIsCaptureOpen(true)}
              onPantryChefClick={() => setIsCaptureOpen(true)}
              onGetRecipeClick={() => setIsCaptureOpen(true)}
              mealLog={mealLog}
              userName={user?.firstName || 'User'}
            />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <Navbar 
        activeView={activeView} 
        onNavigate={handleNavigation} 
        onLogout={handleLogout} 
        onBackToHub={() => setAppMode('hub')}
        onCaptureClick={() => setIsCaptureOpen(true)}
      />
      
      {isCaptureOpen && (
          <CaptureFlow 
            onClose={() => setIsCaptureOpen(false)}
            onCapture={handleCaptureResult}
            lastMeal={mealLog.length > 0 ? mealLog[0] : undefined}
            onRepeatMeal={handleRepeatMeal}
            onBodyScanClick={handleBodyScanClick}
          />
      )}
      
      {isAddToPlanModalOpen && (
        <AddToPlanModal 
            plans={mealPlans}
            onSelectPlan={handleConfirmAddToPlan}
            onClose={() => setIsAddToPlanModalOpen(false)}
        />
      )}
      
      {/* Added extra bottom padding (pb-40) to main container to ensure content is visible above mobile nav */}
      <main className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 pb-40 md:pb-8">
        <div className="space-y-8">
            {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
