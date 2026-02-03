
import React, { useEffect, useState } from 'react';
import { XIcon, MapPinIcon, UserGroupIcon, UtensilsIcon, StarIcon, CheckIcon } from './icons';
import type { RestaurantPlace, RestaurantActivity } from '../types';
import * as apiService from '../services/apiService';

interface RestaurantCheckInModalProps {
    place: RestaurantPlace;
    onClose: () => void;
}

export const RestaurantCheckInModal: React.FC<RestaurantCheckInModalProps> = ({ place, onClose }) => {
    const [friendsActivity, setFriendsActivity] = useState<RestaurantActivity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCheckedIn, setIsCheckedIn] = useState(false);

    useEffect(() => {
        const loadFriends = async () => {
            try {
                const activity = await apiService.getRestaurantActivity(place.uri);
                setFriendsActivity(activity);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        loadFriends();
    }, [place]);

    const handleCheckIn = () => {
        setIsCheckedIn(true);
        // apiService.checkInAtLocation(place.title); // Fire and forget
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[120] p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl relative">
                
                {/* Header Image / Map Placeholder */}
                <div className="h-48 bg-slate-200 relative">
                    <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                        <MapPinIcon className="w-16 h-16" />
                    </div>
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent"></div>
                    
                    <button 
                        onClick={onClose} 
                        className="absolute top-6 right-6 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-md transition-all"
                    >
                        <XIcon />
                    </button>

                    <div className="absolute bottom-6 left-6 text-white">
                        <h2 className="text-2xl font-black uppercase tracking-tight leading-none mb-1">{place.title}</h2>
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">{place.address || 'Local Hotspot'}</p>
                    </div>
                </div>

                <div className="p-6">
                    {/* Friends Section */}
                    <div className="mb-8">
                        <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                            <UserGroupIcon className="w-4 h-4 text-indigo-500" /> Friends who ate here
                        </h3>
                        
                        {isLoading ? (
                            <div className="text-center py-4 text-slate-400 text-sm">Finding friends...</div>
                        ) : friendsActivity.length > 0 ? (
                            <div className="space-y-4">
                                {friendsActivity.map((activity, idx) => (
                                    <div key={idx} className="flex gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div className="w-12 h-12 rounded-xl bg-slate-200 overflow-hidden flex-shrink-0">
                                            {activity.imageUrl ? (
                                                <img src={activity.imageUrl} className="w-full h-full object-cover" alt="Meal" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">{activity.friendInitial}</div>
                                            )}
                                        </div>
                                        <div className="flex-grow">
                                            <div className="flex justify-between items-start">
                                                <p className="text-sm font-bold text-slate-900">{activity.friendName}</p>
                                                <div className="flex text-amber-400 text-[10px]">
                                                    {[...Array(activity.rating)].map((_, i) => <StarIcon key={i} className="w-3 h-3 fill-current" />)}
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-600 mt-0.5">Ordered: <span className="font-bold text-indigo-600">{activity.mealName}</span></p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">{activity.date}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 bg-slate-50 rounded-2xl text-slate-400 text-sm font-medium">
                                No friends have checked in here yet. Be the first!
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button className="flex-1 bg-slate-100 text-slate-700 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors">
                            <UtensilsIcon className="w-5 h-5" />
                            <span>View Menu</span>
                        </button>
                        <button 
                            onClick={handleCheckIn}
                            disabled={isCheckedIn}
                            className={`flex-[2] text-white font-black uppercase tracking-widest text-sm py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all ${isCheckedIn ? 'bg-emerald-500' : 'bg-slate-900 hover:bg-black active:scale-95'}`}
                        >
                            {isCheckedIn ? <CheckIcon className="w-5 h-5" /> : <MapPinIcon className="w-5 h-5" />}
                            <span>{isCheckedIn ? 'Checked In' : 'Check In'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
