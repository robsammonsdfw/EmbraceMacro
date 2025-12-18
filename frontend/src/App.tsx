
import React, { useState, useCallback } from 'react';
import * as apiService from './services/apiService';
import { analyzeFoodImage } from './services/geminiService';
import { getProductByBarcode } from './services/openFoodFactsService';
import type { NutritionInfo } from './types';
import { ImageUploader } from './components/ImageUploader';
import { NutritionCard } from './components/NutritionCard';
import { Loader } from './components/Loader';
import { ErrorAlert } from './components/ErrorAlert';
import { useAuth } from './hooks/useAuth';
import { Login } from './components/Login';
import { AppLayout } from './components/layout/AppLayout';
import { CommandCenter } from './components/dashboard/CommandCenter';
import { CaptureFlow } from './components/CaptureFlow';

type ActiveView = 'home' | 'plan' | 'meals' | 'history' | 'grocery' | 'rewards' | 'body' | 'social';

const App: React.FC = () => {
  const { isAuthenticated, isLoading: isAuthLoading, logout, user } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  
  const [image, setImage] = useState<string | null>(null);
  const [nutritionData, setNutritionData] = useState<NutritionInfo | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleCaptureResult = useCallback(async (img: string | null, mode: any, barcode?: string) => {
    setIsCaptureOpen(false);
    setImage(null);
    setNutritionData(null);
    setError(null);
    setIsProcessing(true);

    try {
        if (mode === 'barcode' && barcode) {
            setNutritionData(await getProductByBarcode(barcode));
        } else if (img) {
            setImage(img);
            const base64Data = img.split(',')[1];
            const result = await analyzeFoodImage(base64Data, 'image/jpeg');
            setNutritionData(result);
        }
    } catch (err) {
        setError('Analysis failed. Please try a clearer photo.');
    } finally {
        setIsProcessing(false);
    }
  }, []);

  const handleSaveToHistory = async () => {
    if (!nutritionData || !image) return;
    try {
      setIsProcessing(true);
      await apiService.createMealLogEntry(nutritionData, image.split(',')[1]);
      setNutritionData(null);
      setImage(null);
      setActiveView('home');
    } catch (err) {
      setError("Failed to save to log.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (isAuthLoading) return <div className="min-h-screen flex items-center justify-center"><Loader message="Loading..." /></div>;
  if (!isAuthenticated) return <Login />;

  return (
    <AppLayout activeView={activeView} onNavigate={(v) => setActiveView(v as ActiveView)} onLogout={logout} mobileMenuOpen={false} setMobileMenuOpen={() => {}}>
        {isCaptureOpen && (
            <CaptureFlow 
                onClose={() => setIsCaptureOpen(false)} 
                onCapture={handleCaptureResult} 
                onRepeatMeal={() => {}} 
                onBodyScanClick={() => {}} 
            />
        )}

        <div className="max-w-2xl mx-auto space-y-6">
            {(image || isProcessing || nutritionData || error) ? (
                <div className="space-y-6">
                    {image && <ImageUploader image={image} />}
                    {isProcessing && <Loader message="Gemini is analyzing your meal..." />}
                    {error && <ErrorAlert message={error} />}
                    {nutritionData && !isProcessing && (
                        <NutritionCard data={nutritionData} onSaveToHistory={handleSaveToHistory} />
                    )}
                    <button 
                        onClick={() => { setImage(null); setNutritionData(null); setIsCaptureOpen(true); }}
                        className="w-full py-4 text-emerald-600 font-black uppercase tracking-widest text-sm"
                    >
                        Retake Photo
                    </button>
                </div>
            ) : (
                <CommandCenter 
                    dailyCalories={0} dailyProtein={0} rewardsBalance={0} 
                    userName={user?.firstName || 'Hero'}
                    healthStats={{ steps: 0, activeCalories: 0, cardioScore: 0 }}
                    isHealthConnected={false} isHealthSyncing={false}
                    onConnectHealth={() => {}} onScanClick={() => {}}
                    onCameraClick={() => { setIsCaptureOpen(true); }}
                    onBarcodeClick={() => {}} onPantryChefClick={() => {}}
                    onRestaurantClick={() => { setIsCaptureOpen(true); }}
                    onUploadClick={() => {}}
                />
            )}
        </div>
    </AppLayout>
  );
};

export default App;
