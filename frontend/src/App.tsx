import React, { useState, useCallback, useRef } from 'react';
import { analyzeImageWithGemini, getMealSuggestions, getRecipesFromImage } from './services/geminiService';
import { getProductByBarcode } from './services/openFoodFactsService';
import type { NutritionInfo, Ingredient, SavedMeal, Recipe } from './types';
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
  const { isAuthenticated, isLoading, logout } = useAuth();
  
  // State is now managed in memory for the duration of the session.
  // The backend will be responsible for persistence.
  const [image, setImage] = useState<string | null>(null);
  const [nutritionData, setNutritionData] = useState<NutritionInfo | null>(null);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [foodPlan, setFoodPlan] = useState<Ingredient[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisMessage, setAnalysisMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<ActiveView>('plan');

  const [suggestedMeals, setSuggestedMeals] = useState<NutritionInfo[] | null>(null);
  const [isSuggesting, setIsSuggesting] = useState<boolean>(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const pantryInputRef = useRef<HTMLInputElement>(null);

  // NOTE: useEffects for localStorage have been removed.
  
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
        const data = await analyzeImageWithGemini(base64String, file.type);
        setNutritionData(data);
      } catch (err) {
        setError('Failed to analyze the image. Please try again.');
        console.error(err);
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = ''; // Allow re-uploading the same file
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
        const recipeData = await getRecipesFromImage(base64String, file.type);
        setRecipes(recipeData);
      } catch (err)
      {
        setError('Failed to get recipes from your image. Please try again.');
        console.error(err);
      } finally {
        setIsAnalyzing(false);
      }
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
    } catch(err) {
        setError(`Could not find product for barcode ${barcode}. Please try another.`);
        console.error(err);
    } finally {
        setIsAnalyzing(false);
    }
  }, []);

  const handleAddToPlan = useCallback((ingredients: Ingredient[]) => {
    setFoodPlan(prevPlan => [...prevPlan, ...ingredients]);
    if (nutritionData) {
        resetState();
    }
  }, [nutritionData]);

  const handleAddRecipeToPlan = useCallback((recipe: Recipe) => {
    const recipeAsIngredient: Ingredient = {
        name: recipe.recipeName,
        weightGrams: 0, // Not applicable
        calories: recipe.nutrition.totalCalories,
        protein: recipe.nutrition.totalProtein,
        carbs: recipe.nutrition.totalCarbs,
        fat: recipe.nutrition.totalFat,
    };
    setFoodPlan(prevPlan => [...prevPlan, recipeAsIngredient]);
  }, []);


  const handleSaveMeal = useCallback((mealData: NutritionInfo) => {
    // In a real app, this would be an API call to the backend.
    const newMeal: SavedMeal = {
        ...mealData,
        id: new Date().toISOString(), // The backend would generate a real ID.
    };
    setSavedMeals(prevMeals => [newMeal, ...prevMeals]);
    if (nutritionData === mealData) {
        resetState();
    }
  }, [nutritionData]);

  const handleAddSavedMealToPlan = useCallback((meal: SavedMeal) => {
    setFoodPlan(prevPlan => [...prevPlan, ...meal.ingredients]);
  }, []);
  
  const handleRemoveFromPlan = useCallback((index: number) => {
     setFoodPlan(prevPlan => prevPlan.filter((_, i) => i !== index));
  }, []);

  const handleDeleteMeal = useCallback((id: string) => {
    // In a real app, this would be an API call.
    setSavedMeals(prevMeals => prevMeals.filter(meal => meal.id !== id));
  }, []);

  const handleGetSuggestions = useCallback(async (condition: string, cuisine: string) => {
    setIsSuggesting(true);
    setSuggestionError(null);
    setSuggestedMeals(null);
    try {
        const suggestions = await getMealSuggestions(condition, cuisine);
        setSuggestedMeals(suggestions);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred.';
        setSuggestionError(message);
        console.error(err);
    } finally {
        setIsSuggesting(false);
    }
  }, []);

  const handleTriggerCamera = () => { cameraInputRef.current?.click(); };
  const handleTriggerUpload = () => { uploadInputRef.current?.click(); };
  const handleTriggerPantryUpload = () => { pantryInputRef.current?.click(); };
  const handleTriggerScanner = () => { setIsScanning(true); };
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader message="Loading session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  const showHero = !image && !isAnalyzing && !nutritionData && !isScanning && !recipes;
  const showAnalysisContent = image || isAnalyzing || error || nutritionData || recipes;

  const renderActiveView = () => {
    switch(activeView) {
        case 'plan':
            return <FoodPlan items={foodPlan} onRemove={handleRemoveFromPlan} />;
        case 'meals':
            return <MealLibrary meals={savedMeals} onAdd={handleAddSavedMealToPlan} onDelete={handleDeleteMeal} />;
        case 'suggestions':
            return <MealSuggester 
                        onGetSuggestions={handleGetSuggestions}
                        suggestions={suggestedMeals}
                        isLoading={isSuggesting}
                        error={suggestionError}
                        onAddToPlan={handleAddToPlan}
                        onSaveMeal={handleSaveMeal}
                    />;
        case 'grocery':
            return <GroceryList meals={savedMeals} />;
        default:
            return <FoodPlan items={foodPlan} onRemove={handleRemoveFromPlan} />;
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
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500">
            EmbraceHealth Meals
          </h1>
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
                {nutritionData && !isAnalyzing && (
                    <NutritionCard 
                        data={nutritionData} 
                        onAddToPlan={() => handleAddToPlan(nutritionData.ingredients)} 
                        onSaveMeal={() => handleSaveMeal(nutritionData)}
                    />
                )}
                {recipes && !isAnalyzing && (
                  <div className="space-y-4">
                      <h2 className="text-2xl font-bold text-slate-800 text-center pt-4 border-t border-slate-200">
                          Recipe Ideas From Your Ingredients
                      </h2>
                      {recipes.map((recipe, index) => (
                          <RecipeCard 
                              key={index} 
                              recipe={recipe} 
                              onAddToPlan={() => handleAddRecipeToPlan(recipe)} 
                          />
                      ))}
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