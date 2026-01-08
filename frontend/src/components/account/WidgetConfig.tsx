
import React from 'react';
import { ActivityIcon, FireIcon, TrophyIcon, GlobeAltIcon, HeartIcon, Squares2X2Icon, IconProps } from '../icons';
import type { UserDashboardPrefs } from '../../types';

interface WidgetConfigProps {
    currentPrefs: UserDashboardPrefs;
    onSave: (prefs: UserDashboardPrefs) => void;
}

export const WidgetConfig: React.FC<WidgetConfigProps> = ({ currentPrefs, onSave }) => {
    const widgetOptions = [
        { id: 'steps', label: 'Steps', icon: <ActivityIcon /> },
        { id: 'activeCalories', label: 'Active Energy', icon: <FireIcon /> },
        { id: 'restingCalories', label: 'Resting Energy', icon: <TrophyIcon /> },
        { id: 'distanceMiles', label: 'Distance', icon: <GlobeAltIcon /> },
        { id: 'flightsClimbed', label: 'Flights', icon: <ActivityIcon /> },
        { id: 'heartRate', label: 'Heart Rate', icon: <HeartIcon /> }
    ];

    const handleToggle = (id: string) => {
        let newList = [...(currentPrefs.selectedWidgets || [])];
        if (newList.includes(id)) {
            newList = newList.filter(item => item !== id);
        } else if (newList.length < 3) {
            newList.push(id);
        } else {
            alert("You can only select up to 3 widgets.");
            return;
        }
        onSave({ ...currentPrefs, selectedWidgets: newList });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
            <header className="text-center">
                <div className="mx-auto w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <Squares2X2Icon className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">My Widgets</h2>
                <p className="text-slate-500 font-medium">Customize the metrics pinned to your Command Center.</p>
            </header>

            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">Available Metrics</h3>
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                        {currentPrefs.selectedWidgets?.length || 0}/3 Selected
                    </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {widgetOptions.map(opt => {
                        const isSelected = currentPrefs.selectedWidgets?.includes(opt.id);
                        const selectionIndex = currentPrefs.selectedWidgets?.indexOf(opt.id);
                        
                        return (
                            <button
                                key={opt.id}
                                onClick={() => handleToggle(opt.id)}
                                className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center justify-center gap-3 relative overflow-hidden group ${
                                    isSelected
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl scale-[1.02]'
                                    : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-white hover:border-indigo-200'
                                }`}
                            >
                                <div className={`p-3 rounded-full ${isSelected ? 'bg-white/20' : 'bg-white shadow-sm'} transition-colors`}>
                                    {React.cloneElement(opt.icon as React.ReactElement<IconProps>, { className: "w-6 h-6" })}
                                </div>
                                <span className={`font-black uppercase tracking-widest text-xs ${isSelected ? 'text-white' : 'text-slate-600'}`}>
                                    {opt.label}
                                </span>
                                
                                {isSelected && (
                                    <div className="absolute top-4 right-4 bg-white text-indigo-600 w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black shadow-sm">
                                        {selectionIndex !== undefined ? selectionIndex + 1 : ''}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
