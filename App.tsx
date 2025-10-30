
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { analyzeImageWithGemini } from './services/geminiService';
import type { NutritionInfo, Ingredient } from './types';
import { ImageUploader } from './components/ImageUploader';
import { NutritionCard } from './components/NutritionCard';
import { FoodPlan } from './components/FoodPlan';
import { Loader } from './components/Loader';
import { ErrorAlert } from './components/ErrorAlert';
import { Hero } from './components/Hero';
import { CameraIcon, UploadIcon } from './components/icons';

const FOOD_PLAN_STORAGE_KEY = 'macro-vision-ai-food-plan';

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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(FOOD_PLAN_STORAGE_KEY, JSON.stringify(foodPlan));
    } catch (error) {
      console.error("Could not save food plan to local storage", error);
    }
  }, [foodPlan]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      setImage(reader.result as string);
      setNutritionData(null);
      setError(null);
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

  const handleAddMealToPlan = useCallback(() => {
    if (nutritionData?.ingredients) {
      setFoodPlan(prevPlan => [...prevPlan, ...nutritionData.ingredients]);
      setNutritionData(null);
      setImage(null);
    }
  }, [nutritionData]);
  
  const handleRemoveFromPlan = useCallback((index: number) => {
     setFoodPlan(prevPlan => prevPlan.filter((_, i) => i !== index));
  }, []);

  const handleTriggerCamera = () => {
    cameraInputRef.current?.click();
  };
  
  const handleTriggerUpload = () => {
    uploadInputRef.current?.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <main className="max-w-4xl mx-auto p-4 md:p-8">
         <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={cameraInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            type="file"
            accept="image/*"
            ref={uploadInputRef}
            onChange={handleFileChange}
            className="hidden"
          />

        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500">
            Macro Vision AI
          </h1>
          <p className="text-slate-600 mt-2 text-lg">Snap your food, know your macros.</p>
        </header>

        <div className="space-y-8">
          {!image && !isLoading && <Hero onCameraClick={handleTriggerCamera} onUploadClick={handleTriggerUpload} />}

          <ImageUploader image={image} />

          {isLoading && <Loader />}
          {error && <ErrorAlert message={error} />}

          {nutritionData && !isLoading && (
            <NutritionCard 
              data={nutritionData} 
              onAddToPlan={handleAddMealToPlan} 
            />
          )}
          
          <FoodPlan items={foodPlan} onRemove={handleRemoveFromPlan} />
        </div>

        {!image && !isLoading && (
           <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-sm border-t border-slate-200 flex justify-center items-center gap-4 md:hidden">
              <button
                onClick={handleTriggerCamera}
                className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 ease-in-out flex items-center justify-center space-x-3"
              >
                <CameraIcon />
                <span>Take Photo</span>
              </button>
              <button
                onClick={handleTriggerUpload}
                className="w-full bg-white text-slate-700 font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl border border-slate-200 transform hover:-translate-y-1 transition-all duration-300 ease-in-out flex items-center justify-center space-x-3"
              >
                <UploadIcon />
                <span>Upload</span>
              </button>
           </div>
        )}
      </main>
    </div>
  );
};

export default App;
