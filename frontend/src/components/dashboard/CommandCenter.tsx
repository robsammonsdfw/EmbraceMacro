
import React from 'react';
import { TodayStrip } from './TodayStrip';
import { DigitalTwinPanel } from './DigitalTwinPanel';
import { CameraIcon, BarcodeIcon, ChefHatIcon, UtensilsIcon, UploadIcon } from '../icons';

interface CommandCenterProps {
    dailyCalories: number;
    dailyProtein: number;
    rewardsBalance: number;
    userName: string;
    onScanClick: () => void;
    onCameraClick: () => void;
    onBarcodeClick: () => void;
    onPantryChefClick: () => void;
    onRestaurantClick: () => void;
    onUploadClick: () => void;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({ 
    dailyCalories, dailyProtein, rewardsBalance, userName, onScanClick,
    onCameraClick, onBarcodeClick, onPantryChefClick, onRestaurantClick, onUploadClick
}) => {
    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <header className="mb-6">
                <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Command Center</h2>
                <p className="text-slate-500 font-medium">Welcome back, {userName}. Let's hit your goals.</p>
            </header>

            {/* Main Split Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Left Column: Digital Twin (Visual Centerpiece) */}
                <div className="lg:h-[600px] flex flex-col">
                    <DigitalTwinPanel 
                        calories={dailyCalories}
                        calorieGoal={2000}
                        protein={dailyProtein}
                        proteinGoal={150}
                        activityScore={75}
                        onScanClick={onScanClick}
                    />
                </div>

                {/* Right Column: Data & Actions */}
                <div className="flex flex-col gap-6">
                    <TodayStrip 
                        calories={Math.round(dailyCalories)}
                        calorieGoal={2000}
                        activityScore={75}
                        rewardsBalance={rewardsBalance}
                    />

                    {/* Quick Actions */}
                    <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wide">Quick Actions</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <button onClick={onCameraClick} className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-xl hover:bg-emerald-50 hover:border-emerald-200 border border-transparent transition-all group">
                                <div className="w-12 h-12 rounded-full bg-white text-emerald-600 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                    <CameraIcon />
                                </div>
                                <span className="text-xs font-bold text-slate-600">Snap Meal</span>
                            </button>

                            <button onClick={onBarcodeClick} className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-xl hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-all group">
                                <div className="w-12 h-12 rounded-full bg-white text-blue-600 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                    <BarcodeIcon />
                                </div>
                                <span className="text-xs font-bold text-slate-600">Scan Item</span>
                            </button>

                            <button onClick={onPantryChefClick} className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-xl hover:bg-amber-50 hover:border-amber-200 border border-transparent transition-all group">
                                <div className="w-12 h-12 rounded-full bg-white text-amber-600 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                    <ChefHatIcon />
                                </div>
                                <span className="text-xs font-bold text-slate-600">Pantry Chef</span>
                            </button>

                            <button onClick={onRestaurantClick} className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 border border-transparent transition-all group">
                                <div className="w-12 h-12 rounded-full bg-white text-indigo-600 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                    <UtensilsIcon />
                                </div>
                                <span className="text-xs font-bold text-slate-600">Restaurant</span>
                            </button>
                            
                            <button onClick={onUploadClick} className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 hover:border-slate-300 border border-transparent transition-all group">
                                <div className="w-12 h-12 rounded-full bg-white text-slate-600 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                    <UploadIcon />
                                </div>
                                <span className="text-xs font-bold text-slate-600">Upload</span>
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};
