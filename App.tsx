
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { analyzeImageWithGemini, getMealSuggestions } from './services/geminiService';
import { getProductByBarcode } from './services/openFoodFactsService';
import type { NutritionInfo, Ingredient, SavedMeal } from './types';
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

const FOOD_PLAN_STORAGE_KEY = 'macro-vision-ai-food-plan';
const SAVED_MEALS_STORAGE_KEY = 'macro-vision-ai-saved-meals';

type ActiveView = 'plan' | 'meals' | 'grocery' | 'suggestions';

const App: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [nutritionData, setNutritionData] = useState<NutritionInfo | null>(null);
  const [foodPlan, setFoodPlan] = useState<Ingredient[]>(() => {
    try {
      const savedPlan = window.localStorage.getItem(FOOD_PLAN_STORAGE_KEY);
      return savedPlan ? JSON.parse(savedPlan) : [];
    } catch (error) {
      console.error("Could not load food plan from local storage", error);
      return [];
    }
  });
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>(() => {
    try {
      const saved = window.localStorage.getItem(SAVED_MEALS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Could not load saved meals from local storage", error);
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<ActiveView>('plan');

  const [suggestedMeals, setSuggestedMeals] = useState<NutritionInfo[] | null>(null);
  const [isSuggesting, setIsSuggesting] = useState<boolean>(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(FOOD_PLAN_STORAGE_KEY, JSON.stringify(foodPlan));
    } catch (error) {
      console.error("Could not save food plan to local storage", error);
    }
  }, [foodPlan]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SAVED_MEALS_STORAGE_KEY, JSON.stringify(savedMeals));
    } catch (error) {
      console.error("Could not save meals to local storage", error);
    }
  }, [savedMeals]);
  
  const resetState = () => {
      setImage(null);
      setNutritionData(null);
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
      setIsLoading(true);
      try {
        const data = await analyzeImageWithGemini(base64String, file.type);
        setNutritionData(data);
      } catch (err) {
        setError('Failed to analyze the image. Please try again.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = ''; // Allow re-uploading the same file
  }, []);

  const handleScanSuccess = useCallback(async (barcode: string) => {
    setIsScanning(false);
    resetState();
    setIsLoading(true);
    try {
        const data = await getProductByBarcode(barcode);
        setNutritionData(data);
    } catch(err) {
        setError(`Could not find product for barcode ${barcode}. Please try another.`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, []);

  const handleAddToPlan = useCallback((ingredients: Ingredient[]) => {
    setFoodPlan(prevPlan => [...prevPlan, ...ingredients]);
    if (nutritionData) {
        resetState();
    }
  }, [nutritionData]);

  const handleSaveMeal = useCallback((mealData: NutritionInfo) => {
    const newMeal: SavedMeal = {
        ...mealData,
        id: new Date().toISOString(),
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
  const handleTriggerScanner = () => { setIsScanning(true); };

  const showHero = !image && !isLoading && !nutritionData && !isScanning;
  const showAnalysisContent = image || isLoading || error || nutritionData;

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

        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500">
            Macro Vision AI
          </h1>
          <p className="text-slate-600 mt-2 text-lg">Your intelligent meal and grocery planner.</p>
        </header>

        <div className="space-y-8">
          {showHero && <Hero onCameraClick={handleTriggerCamera} onUploadClick={handleTriggerUpload} onBarcodeClick={handleTriggerScanner} />}

          {showAnalysisContent ? (
            <>
                <ImageUploader image={image || nutritionData?.imageUrl || null} />
                {isLoading && <Loader />}
                {error && <ErrorAlert message={error} />}
                {nutritionData && !isLoading && (
                    <NutritionCard 
                        data={nutritionData} 
                        onAddToPlan={() => handleAddToPlan(nutritionData.ingredients)} 
                        onSaveMeal={() => handleSaveMeal(nutritionData)}
                    />
                )}
            </>
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
