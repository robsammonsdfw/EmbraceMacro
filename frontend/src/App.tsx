import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as apiService from './services/apiService';
import { getProductByBarcode } from './services/openFoodFactsService';
import type { NutritionInfo, SavedMeal, Recipe, MealLogEntry, MealPlanGroup } from './types';
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
import { RecipeCard } from './components/RecipeCard';
import { useAuth } from './hooks/useAuth';
import { Login } from './components/Login';

type ActiveView = 'plan' | 'meals' | 'history';

const App: React.FC = () => {
  const { isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();
  
  const [image, setImage] = useState<string | null>(null);
  const [nutritionData, setNutritionData] = useState<NutritionInfo | null>(null);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [foodPlan, setFoodPlan] = useState<MealPlanGroup[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [mealLog, setMealLog] = useState<MealLogEntry[]>([]);
  
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingMessage, setProcessingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<ActiveView>('history');
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const pantryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAuthenticated) {
      const loadInitialData = async () => {
        try {
          setIsDataLoading(true);
          const [meals, plan, log] = await Promise.all([
            apiService.getSavedMeals(),
            apiService.getFoodPlan(),
            apiService.getMealLog(),
          ]);
          setSavedMeals(meals);
          setFoodPlan(plan);
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
      setActiveView('history');
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

  const handleSaveMealFromLog = useCallback(async (mealData: NutritionInfo) => {
      try {
        const newMeal = await apiService.saveMeal(mealData);
        // Avoid duplicates in local state
        if (!savedMeals.some(m => m.id === newMeal.id)) {
            setSavedMeals(prevMeals => [newMeal, ...prevMeals]);
        }
        return newMeal;
      } catch (err) {
        setError('Could not save your meal.');
        return null;
      }
  }, [savedMeals]);
  
  const handleAddMealToPlan = useCallback(async (mealData: NutritionInfo) => {
    // A meal must be in "Saved Meals" to be added to a plan, as we need its ID.
    try {
        let savedMeal = savedMeals.find(m => m.mealName === mealData.mealName);
        if (!savedMeal) {
            savedMeal = await handleSaveMealFromLog(mealData);
        }
        
        if (savedMeal) {
            const newPlanGroup = await apiService.addMealToPlan(savedMeal.id);
            if(newPlanGroup && !foodPlan.some(p => p.id === newPlanGroup.id)) {
              setFoodPlan(prevPlan => [...prevPlan, newPlanGroup]);
            }
        }
    } catch (err) {
        setError("Failed to add meal to today's plan.");
    }
  }, [savedMeals, foodPlan, handleSaveMealFromLog]);

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
        case 'meals': return <MealLibrary meals={savedMeals} onAdd={handleAddMealToPlan} onDelete={handleDeleteMeal} />;
        case 'history': return <MealHistory logEntries={mealLog} onSaveMeal={handleSaveMealFromLog} onAddToPlan={handleAddMealToPlan} />;
        default: return <MealHistory logEntries={mealLog} onSaveMeal={handleSaveMealFromLog} onAddToPlan={handleAddMealToPlan} />;
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
                  <div className="space-y-4"> {/* Recipe display logic can be simplified or removed if not a core feature now */}
                      <h2 className="text-2xl font-bold text-slate-800 text-center pt-4 border-t border-slate-200">Recipe Ideas</h2>
                      {recipes.map((recipe, index) => ( <RecipeCard key={index} recipe={recipe} onAddToPlan={()=>{/*This needs a new flow*/}} /> ))}
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
