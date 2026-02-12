
import React, { useState } from 'react';
import { FireIcon } from '../icons';

interface DigitalTwinPanelProps {
    calories: number;
    calorieGoal: number;
    protein: number;
    proteinGoal: number;
    activityScore: number;
    onScanClick: () => void;
    miniMode?: boolean;
}

export const DigitalTwinPanel: React.FC<DigitalTwinPanelProps> = ({ 
    miniMode
}) => {
    const [sliderValue, setSliderValue] = useState(50); // 50% split for before/after

    if (miniMode) {
        // Phase 2 Mini Progress Bar
        return (
            <div className="w-full">
                <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold text-slate-700">Score</span>
                    <span className="text-slate-500">75%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 w-3/4"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-full flex flex-col">
            <h3 className="font-bold text-slate-900 mb-6">Body Analysis</h3>
            
            {/* Phase 5: Before/After Comparison */}
            <div className="flex-grow flex items-center justify-center relative mb-8">
                <div className="relative w-48 h-64 bg-slate-100 rounded-2xl overflow-hidden border-4 border-white shadow-xl">
                    {/* "After" Image (Full) */}
                    <div className="absolute inset-0 bg-indigo-500 flex items-center justify-center text-white font-bold">
                        After
                    </div>
                    
                    {/* "Before" Image (Clipped) */}
                    <div 
                        className="absolute inset-0 bg-slate-300 flex items-center justify-center text-slate-500 font-bold border-r-2 border-white"
                        style={{ width: `${sliderValue}%` }}
                    >
                        <span className="whitespace-nowrap">Before</span>
                    </div>

                    {/* Slider Handle */}
                    <div 
                        className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize flex items-center justify-center"
                        style={{ left: `${sliderValue}%` }}
                    >
                        <div className="w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center">
                            <div className="w-1 h-3 bg-slate-300 rounded-full gap-0.5 flex"></div>
                        </div>
                    </div>
                    
                    {/* Invisible Range Input for Interaction */}
                    <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={sliderValue} 
                        onChange={(e) => setSliderValue(parseInt(e.target.value))}
                        className="absolute inset-0 opacity-0 cursor-ew-resize"
                    />
                </div>
            </div>

            {/* Phase 5: Date Slider */}
            <div className="mb-6">
                <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                    <span>Adjust to Date</span>
                    <span className="text-indigo-600">30 Days Ago</span>
                </div>
                <input 
                    type="range" 
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
            </div>

            {/* Phase 5: Share Button */}
            <button className="w-full bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2">
                <FireIcon />
                <span>Share Progress</span>
            </button>
        </div>
    );
};
