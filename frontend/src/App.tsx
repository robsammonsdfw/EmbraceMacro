import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as apiService from './services/apiService';
import { getProductByBarcode } from './services/openFoodFactsService';
import type { NutritionInfo, Ingredient, SavedMeal, Recipe, FoodPlanItem } from './types';
import { ImageUploader } from './components/ImageUploader';
import { NutritionCard } from './components/NutritionCard';
import { FoodPlan } from './components/FoodPlan';
import { Loader } from './components/Loader';
import { ErrorAlert } from './components/ErrorAlert';
import { Hero } from './components/Hero';
import { BarcodeScanner } from './components/BarcodeScanner';
import { MealLibrary } from './components/MealLibrary';
import { GroceryList } from './components/GroceryList';
import { AppNav } from './components/AppNav';
import { MealSuggester } from './components/MealSuggester';
import { RecipeCard } from './components/RecipeCard';
import { useAuth } from './hooks/useAuth';
import { Login } from './components/Login';


type ActiveView = 'plan' | 'meals' | 'grocery' | 'suggestions';

const App: React.FC = () => {
  const { isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();
  
  const [image, setImage] = useState<string | null>(null);
  const [nutritionData, setNutritionData] = useState<NutritionInfo | null>(null);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [foodPlan, setFoodPlan] = useState<FoodPlanItem[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisMessage, setAnalysisMessage] = useState<string>('');
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
          const [meals, plan] = await Promise.all([
            apiService.getSavedMeals(),
            apiService.getFoodPlan()
          ]);
          setSavedMeals(meals);
          setFoodPlan(plan);
        } catch (err) {
          setError("Could not load your data. Please try refreshing the page.");
        } finally {
          setIsDataLoading(false);
        }
      };
      loadInitialData();
    }
  }, [isAuthenticated]);
  
  const resetState = () => {
      setImage(null);
      setNutritionData(null);
      setRecipes(null);
      setError(null);
  };

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    resetState();
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      setImage(reader.result as string);
      setIsAnalyzing(true);
      setAnalysisMessage('Analyzing your meal...');
      try {
        const data = await apiService.analyzeImageWithGemini(base64String, file.type);
        setNutritionData(data);
      } catch (err) { setError('Failed to analyze the image. Please try again.'); } finally { setIsAnalyzing(false); }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }, []);
  
  const handleFridgeFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    resetState();
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      setImage(reader.result as string);
      setIsAnalyzing(true);
      setAnalysisMessage('Generating recipe ideas...');
      try {
        const recipeData = await apiService.getRecipesFromImage(base64String, file.type);
        setRecipes(recipeData);
      } catch (err) { setError('Failed to get recipes from your image. Please try again.'); } finally { setIsAnalyzing(false); }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }, []);

  const handleScanSuccess = useCallback(async (barcode: string) => {
    setIsScanning(false);
    resetState();
    setIsAnalyzing(true);
    setAnalysisMessage('Fetching product data...');
    try {
        const data = await getProductByBarcode(barcode);
        setNutritionData(data);
    } catch(err) { setError(`Could not find product for barcode ${barcode}.`); } finally { setIsAnalyzing(false); }
  }, []);

  const handleAddToPlan = useCallback(async (ingredients: Ingredient[]) => {
    try {
      const newItems = await apiService.addItemsToFoodPlan(ingredients);
      setFoodPlan(prevPlan => [...prevPlan, ...newItems]);
      if (nutritionData && ingredients.some(ing => nutritionData.ingredients.includes(ing))) {
          resetState();
      }
    } catch (err) {
      setError('Could not add items to your plan. Please try again.');
    }
  }, [nutritionData]);

  const handleAddRecipeToPlan = useCallback(async (recipe: Recipe) => {
    const recipeAsIngredient: Ingredient = {
        name: recipe.recipeName, weightGrams: 0, calories: recipe.nutrition.totalCalories,
        protein: recipe.nutrition.totalProtein, carbs: recipe.nutrition.totalCarbs, fat: recipe.nutrition.totalFat,
    };
    await handleAddToPlan([recipeAsIngredient]);
  }, [handleAddToPlan]);

  const handleSaveMeal = useCallback(async (mealData: NutritionInfo) => {
    try {
      const newMeal = await apiService.saveMeal(mealData);
      setSavedMeals(prevMeals => [newMeal, ...prevMeals]);
      if (nutritionData === mealData) {
          resetState();
      }
    } catch (err) {
      setError('Could not save your meal. Please try again.');
    }
  }, [nutritionData]);

  const handleAddSavedMealToPlan = useCallback(async (meal: SavedMeal) => {
    await handleAddToPlan(meal.ingredients);
  }, [handleAddToPlan]);
  
  const handleRemoveFromPlan = useCallback(async (itemId: number) => {
    const originalPlan = foodPlan;
    setFoodPlan(prevPlan => prevPlan.filter(item => item.id !== itemId)); // Optimistic update
    try {
       await apiService.removeFoodPlanItem(itemId);
    } catch (err) {
      setError('Failed to remove item from plan.');
      setFoodPlan(originalPlan); // Revert on failure
    }
  }, [foodPlan]);

  const handleDeleteMeal = useCallback(async (mealId: number) => {
    const originalMeals = savedMeals;
    setSavedMeals(prevMeals => prevMeals.filter(meal => meal.id !== mealId)); // Optimistic update
    try {
      await apiService.deleteMeal(mealId);
    } catch (err) {
      setError('Failed to delete meal.');
      setSavedMeals(originalMeals); // Revert on failure
    }
  }, [savedMeals]);

  const handleGetSuggestions = useCallback(async (condition: string, cuisine: string) => {
    setIsSuggesting(true); setSuggestionError(null); setSuggestedMeals(null);
    try {
        const suggestions = await apiService.getMealSuggestions(condition, cuisine);
        setSuggestedMeals(suggestions);
    } catch (err) { setSuggestionError(err instanceof Error ? err.message : 'An unknown error occurred.'); } finally { setIsSuggesting(false); }
  }, []);

  const handleTriggerCamera = () => { cameraInputRef.current?.click(); };
  const handleTriggerUpload = () => { uploadInputRef.current?.click(); };
  const handleTriggerPantryUpload = () => { pantryInputRef.current?.click(); };
  const handleTriggerScanner = () => { setIsScanning(true); };
  
  if (isAuthLoading) { return <div className="min-h-screen flex items-center justify-center"><Loader message="Loading session..." /></div>; }
  if (!isAuthenticated) { return <Login />; }
  if (isDataLoading) { return <div className="min-h-screen flex items-center justify-center"><Loader message="Loading your data..." /></div>; }

  const showHero = !image && !isAnalyzing && !nutritionData && !isScanning && !recipes;
  const showAnalysisContent = image || isAnalyzing || error || nutritionData || recipes;

  const renderActiveView = () => {
    switch(activeView) {
        case 'plan': return <FoodPlan items={foodPlan} onRemove={handleRemoveFromPlan} />;
        case 'meals': return <MealLibrary meals={savedMeals} onAdd={handleAddSavedMealToPlan} onDelete={handleDeleteMeal} />;
        case 'suggestions': return <MealSuggester onGetSuggestions={handleGetSuggestions} suggestions={suggestedMeals} isLoading={isSuggesting} error={suggestionError} onAddToPlan={handleAddToPlan} onSaveMeal={handleSaveMeal} />;
        case 'grocery': return <GroceryList meals={savedMeals} />;
        default: return <FoodPlan items={foodPlan} onRemove={handleRemoveFromPlan} />;
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {isScanning && <BarcodeScanner onScanSuccess={handleScanSuccess} onCancel={() => setIsScanning(false)} />}
      <main className="max-w-4xl mx-auto p-4 md:p-8">
         <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleFileChange} className="hidden"/>
         <input type="file" accept="image/*" ref={uploadInputRef} onChange={handleFileChange} className="hidden"/>
         <input type="file" accept="image/*" ref={pantryInputRef} onChange={handleFridgeFileChange} className="hidden"/>

        <header className="text-center mb-8 relative">
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500">EmbraceHealth Meals</h1>
          <p className="text-slate-600 mt-2 text-lg">Your intelligent meal and grocery planner.</p>
          <button onClick={logout} className="absolute top-0 right-0 bg-slate-200 text-slate-700 font-semibold text-sm py-1 px-3 rounded-full hover:bg-slate-300 transition">Logout</button>
        </header>

        <div className="space-y-8">
          {showHero && <Hero onCameraClick={handleTriggerCamera} onUploadClick={handleTriggerUpload} onBarcodeClick={handleTriggerScanner} onPantryChefClick={handleTriggerPantryUpload} />}
          {showAnalysisContent ? (
            <div className="space-y-6">
                <ImageUploader image={image || nutritionData?.imageUrl || null} />
                {isAnalyzing && <Loader message={analysisMessage} />}
                {error && <ErrorAlert message={error} />}
                {nutritionData && !isAnalyzing && ( <NutritionCard data={nutritionData} onAddToPlan={() => handleAddToPlan(nutritionData.ingredients)} onSaveMeal={() => handleSaveMeal(nutritionData)} /> )}
                {recipes && !isAnalyzing && (
                  <div className="space-y-4">
                      <h2 className="text-2xl font-bold text-slate-800 text-center pt-4 border-t border-slate-200">Recipe Ideas From Your Ingredients</h2>
                      {recipes.map((recipe, index) => ( <RecipeCard key={index} recipe={recipe} onAddToPlan={() => handleAddRecipeToPlan(recipe)} /> ))}
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