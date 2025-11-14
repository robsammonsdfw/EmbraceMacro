import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as apiService from './services/apiService';
import { getProductByBarcode } from './services/openFoodFactsService';
import type { NutritionInfo, SavedMeal, Recipe, MealLogEntry, MealPlanGroup, GroceryItem } from './types';
import { ImageUploader } from './components/ImageUploader';
import { NutritionCard } from './components/NutritionCard';
import { FoodPlan } from './components/FoodPlan';
import { Loader } from './components/Loader';
import { ErrorAlert } from './components/ErrorAlert';
import { Hero } from './components/Hero';
import { BarcodeScanner } from './components/BarcodeScanner';
import { MealLibrary } from './components/MealLibrary';
import { AppNav } from './components/AppNav';
import { MealHistory } from './components/MealHistory';
import { MealSuggester } from './components/MealSuggester';
import { RecipeCard } from './components/RecipeCard';
import { useAuth } from './hooks/useAuth';
import { Login } from './components/Login';
import { GroceryList } from './components/GroceryList';

type ActiveView = 'plan' | 'meals' | 'history' | 'suggestions' | 'grocery';

const App: React.FC = () => {
  const { isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();
  
  const [image, setImage] = useState<string | null>(null);
  const [nutritionData, setNutritionData] = useState<NutritionInfo | null>(null);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [foodPlan, setFoodPlan] = useState<MealPlanGroup[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [mealLog, setMealLog] = useState<MealLogEntry[]>([]);
  const [groceryList, setGroceryList] = useState<GroceryItem[]>([]);
  
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingMessage, setProcessingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<ActiveView>('plan');
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);

  const [suggestedMeals, setSuggestedMeals] = useState<NutritionInfo[] | null>(null);
  const [isSuggesting, setIsSuggesting] = useState<boolean>(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const pantryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAuthenticated) {
      const loadInitialData = async () => {
        try {
          setIsDataLoading(true);
          const [meals, plan, log, groceries] = await Promise.all([
            apiService.getSavedMeals(),
            apiService.getFoodPlan(),
            apiService.getMealLog(),
            apiService.getGroceryList(),
          ]);
          setSavedMeals(meals);
          setFoodPlan(plan);
          setMealLog(log);
          setGroceryList(groceries);
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
      setActiveView('plan');
  };

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>, isPantry: boolean = false) => {
    const file = event.target.files?.[0];
    if (!file) return;
    resetAnalysisState();
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string);
      const base64Data = base64String.split(',')[1];
      setImage(base64String);
      setIsProcessing(true);
      try {
        if(isPantry) {
          setProcessingMessage('Generating recipe ideas...');
          const recipeData = await apiService.getRecipesFromImage(base64Data, file.type);
          setRecipes(recipeData);
        } else {
          setProcessingMessage('Analyzing your meal...');
          const data = await apiService.analyzeImageWithGemini(base64Data, file.type);
          setNutritionData(data);
        }
      } catch (err) { setError('Analysis failed. Please try again.'); } finally { setIsProcessing(false); }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }, []);

  const handleScanSuccess = useCallback(async (barcode: string) => {
    setIsScanning(false);
    resetAnalysisState();
    setIsProcessing(true);
    setProcessingMessage('Fetching product data...');
    try {
        const data = await getProductByBarcode(barcode);
        setNutritionData(data);
    } catch(err) { setError(`Could not find product for barcode ${barcode}.`); } finally { setIsProcessing(false); }
  }, []);

  const handleSaveToHistory = useCallback(async (mealData: NutritionInfo, imageBase64: string) => {
    setIsProcessing(true);
    setProcessingMessage("Saving to your history...");
    try {
      const newLogEntry = await apiService.createMealLogEntry(mealData, imageBase64);
      setMealLog(prevLog => [newLogEntry, ...prevLog]);
      resetAnalysisState();
    } catch (err) {
      setError("Could not save to history. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleSaveMealFromLog = useCallback(async (mealData: NutritionInfo): Promise<SavedMeal | null> => {
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
  
  const handleAddSavedMealToPlan = useCallback(async (meal: SavedMeal) => {
    try {
      const newPlanGroup = await apiService.addMealToPlan(meal.id);
      if (newPlanGroup && !foodPlan.some(p => p.id === newPlanGroup.id)) {
        setFoodPlan(prevPlan => [...prevPlan, newPlanGroup]);
      }
    } catch (err) {
      setError("Failed to add saved meal to today's plan.");
      console.error(err);
    }
  }, [foodPlan]);

  const handleAddMealFromLogToPlan = useCallback(async (mealData: NutritionInfo) => {
    try {
      const newPlanGroup = await apiService.addMealFromHistoryToPlan(mealData);
      if (newPlanGroup && !foodPlan.some(p => p.id === newPlanGroup.id)) {
        setFoodPlan(prevPlan => [...prevPlan, newPlanGroup]);
        
        const newSavedMeal = newPlanGroup.meal;
        if (!savedMeals.some(m => m.id === newSavedMeal.id)) {
            setSavedMeals(prev => [newSavedMeal, ...prev]);
        }
      }
      setActiveView('plan');
    } catch (err) {
      setError("Failed to add meal from history to today's plan.");
      console.error(err);
    }
  }, [foodPlan, savedMeals]);

  const handleDeleteMeal = useCallback(async (mealId: number) => {
    setSavedMeals(prev => prev.filter(m => m.id !== mealId));
    try { await apiService.deleteMeal(mealId); } 
    catch (err) { setError('Failed to delete meal.'); /* Revert not implemented for simplicity */ }
  }, []);

  const handleRemoveFromPlan = useCallback(async (planGroupId: number) => {
      setFoodPlan(prev => prev.filter(p => p.id !== planGroupId));
      try { await apiService.removeMealFromPlan(planGroupId); }
      catch (err) { setError("Failed to remove meal from plan."); }
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
        console.error(err);
    } finally {
        setIsSuggesting(false);
    }
  }, []);
  
  const handleGenerateGroceryList = useCallback(async () => {
    try {
        const newList = await apiService.generateGroceryList();
        setGroceryList(newList);
    } catch (err) {
        setError("Failed to generate grocery list.");
    }
  }, []);

  const handleToggleGroceryItem = useCallback(async (itemId: number, checked: boolean) => {
      setGroceryList(prevList => 
          prevList.map(item => item.id === itemId ? { ...item, checked } : item)
      );
      try {
          await apiService.updateGroceryItem(itemId, checked);
      } catch (err) {
          setError("Failed to update grocery item. Reverting change.");
          // Revert optimistic update on failure
          setGroceryList(prevList => 
              prevList.map(item => item.id === itemId ? { ...item, checked: !checked } : item)
          );
      }
  }, []);


  const handleTriggerCamera = () => { cameraInputRef.current?.click(); };
  const handleTriggerUpload = () => { uploadInputRef.current?.click(); };
  const handleTriggerPantryUpload = () => { pantryInputRef.current?.click(); };
  const handleTriggerScanner = () => { setIsScanning(true); };
  
  if (isAuthLoading) { return <div className="min-h-screen flex items-center justify-center"><Loader message="Loading session..." /></div>; }
  if (!isAuthenticated) { return <Login />; }
  if (isDataLoading) { return <div className="min-h-screen flex items-center justify-center"><Loader message="Loading your data..." /></div>; }

  const showHero = !image && !isProcessing && !nutritionData && !isScanning && !recipes;
  const showAnalysisContent = image || isProcessing || error || nutritionData || recipes;

  const renderActiveView = () => {
    switch(activeView) {
        case 'plan': return <FoodPlan planGroups={foodPlan} onRemove={handleRemoveFromPlan} />;
        case 'meals': return <MealLibrary meals={savedMeals} onAdd={handleAddSavedMealToPlan} onDelete={handleDeleteMeal} />;
        case 'history': return <MealHistory logEntries={mealLog} onSaveMeal={handleSaveMealFromLog} onAddToPlan={handleAddMealFromLogToPlan} />;
        case 'suggestions': return <MealSuggester 
                                      onGetSuggestions={handleGetSuggestions}
                                      suggestions={suggestedMeals}
                                      isLoading={isSuggesting}
                                      error={suggestionError}
                                      onAddToPlan={handleAddMealFromLogToPlan}
                                      onSaveMeal={handleSaveMealFromLog}
                                  />;
        case 'grocery': return <GroceryList 
                                  items={groceryList}
                                  savedMealsCount={savedMeals.length}
                                  onGenerate={handleGenerateGroceryList}
                                  onToggle={handleToggleGroceryItem}
                                />;
        default: return <FoodPlan planGroups={foodPlan} onRemove={handleRemoveFromPlan} />;
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {isScanning && <BarcodeScanner onScanSuccess={handleScanSuccess} onCancel={() => setIsScanning(false)} />}
      <main className="max-w-4xl mx-auto p-4 md:p-8">
         <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={(e) => handleFileChange(e)} className="hidden"/>
         <input type="file" accept="image/*" ref={uploadInputRef} onChange={(e) => handleFileChange(e)} className="hidden"/>
         <input type="file" accept="image/*" ref={pantryInputRef} onChange={(e) => handleFileChange(e, true)} className="hidden"/>

        <header className="text-center mb-8 relative">
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500">EmbraceHealth Meals</h1>
          <p className="text-slate-600 mt-2 text-lg">Your intelligent meal and grocery planner.</p>
          <button onClick={logout} className="absolute top-0 right-0 bg-slate-200 text-slate-700 font-semibold text-sm py-1 px-3 rounded-full hover:bg-slate-300 transition">Logout</button>
        </header>

        <div className="space-y-8">
          {showHero && <Hero onCameraClick={handleTriggerCamera} onUploadClick={handleTriggerUpload} onBarcodeClick={handleTriggerScanner} onPantryChefClick={handleTriggerPantryUpload} />}
          {showAnalysisContent ? (
            <div className="space-y-6">
                <ImageUploader image={image} />
                {isProcessing && <Loader message={processingMessage} />}
                {error && <ErrorAlert message={error} />}
                {nutritionData && !isProcessing && image && ( <NutritionCard data={nutritionData} onSaveToHistory={() => handleSaveToHistory(nutritionData, image)} /> )}
                {recipes && !isProcessing && (
                  <div className="space-y-4">
                      <h2 className="text-2xl font-bold text-slate-800 text-center pt-4 border-t border-slate-200">Recipe Ideas</h2>
                      {recipes.map((recipe, index) => ( <RecipeCard key={index} recipe={recipe} onAddToPlan={() => {
                        const mealData: NutritionInfo = { ...recipe.nutrition, mealName: recipe.recipeName, ingredients: [] };
                        handleAddMealFromLogToPlan(mealData);
                      }} /> ))}
                  </div>
                )}
            </div>
          ) : (
            <div className="space-y-6">
                <AppNav activeView={activeView} onViewChange={setActiveView} />
                {renderActiveView()}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
export default App;