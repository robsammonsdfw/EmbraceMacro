import React from 'react';
import { TodayStrip } from './TodayStrip';
import { DigitalTwinPanel } from './DigitalTwinPanel';
import { OrdersCard } from './OrdersCard';
import { LabsCard } from './LabsCard';
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

            <TodayStrip 
                calories={Math.round(dailyCalories)}
                calorieGoal={2000}
                activityScore={75} // Placeholder
                rewardsBalance={rewardsBalance}
            />

            {/* Quick Actions Grid - Restored from original specs */}
            <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
                <button onClick={onCameraClick} className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow-sm border border-slate-100 hover:bg-emerald-50 hover:border-emerald-200 transition-all group">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <CameraIcon />
                    </div>
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Snap Meal</span>
                </button>

                <button onClick={onBarcodeClick} className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow-sm border border-slate-100 hover:bg-blue-50 hover:border-blue-200 transition-all group">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <BarcodeIcon />
                    </div>
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Scan Item</span>
                </button>

                <button onClick={onPantryChefClick} className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow-sm border border-slate-100 hover:bg-amber-50 hover:border-amber-200 transition-all group">
                    <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <ChefHatIcon />
                    </div>
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Pantry Chef</span>
                </button>

                <button onClick={onRestaurantClick} className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow-sm border border-slate-100 hover:bg-indigo-50 hover:border-indigo-200 transition-all group">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <UtensilsIcon />
                    </div>
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Restaurant</span>
                </button>
                 <button onClick={onUploadClick} className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow-sm border border-slate-100 hover:bg-slate-100 hover:border-slate-300 transition-all group col-span-2 md:col-span-1">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <UploadIcon />
                    </div>
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Upload</span>
                </button>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <DigitalTwinPanel 
                        calories={dailyCalories}
                        calorieGoal={2000}
                        protein={dailyProtein}
                        proteinGoal={150}
                        activityScore={75}
                        onScanClick={onScanClick}
                    />
                </div>
                
                {/* On larger screens, this content is duplicated in RightRail via AppLayout. 
                    On smaller screens (lg but not xl), we show it here. */}
                <div className="space-y-6 xl:hidden">
                    <OrdersCard />
                    <LabsCard />
                </div>
            </div>
        </div>
    );
};