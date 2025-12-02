
import React from 'react';
import type { Venue } from '../types';
import { XIcon, MapPinIcon, StarIcon, MailIcon, UserGroupIcon } from './icons';

interface VenueProfileProps {
    venue: Venue;
    onClose: () => void;
}

export const VenueProfile: React.FC<VenueProfileProps> = ({ venue, onClose }) => {
    
    const handleGoogleRate = () => {
        // Construct the Google Maps write review URL
        // Reference: https://developers.google.com/maps/documentation/urls/get-started#search-action
        const url = `https://search.google.com/local/writereview?placeid=${venue.google_place_id}`;
        window.open(url, '_blank');
    };

    const handlePrivateFeedback = () => {
        const subject = `Feedback regarding ${venue.name}`;
        const body = `Hi,\n\nI visited ${venue.name} recently and wanted to share some feedback...\n\n`;
        // In a real app, this might query an owner's email from the DB if claimed, or use a placeholder
        const mailto = `mailto:support@embracehealth.ai?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(mailto, '_blank');
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
             <button 
                onClick={onClose} 
                className="absolute top-4 right-4 p-2 bg-white/20 text-white rounded-full hover:bg-white/30 transition-colors z-50"
                aria-label="Close"
            >
                <XIcon />
            </button>
            
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm m-auto overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="h-32 bg-slate-200 relative">
                     {/* Static Map or Image Placeholder */}
                     <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                     <div className="absolute bottom-4 left-4 text-white">
                         <div className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded text-xs font-bold mb-1">
                             <MapPinIcon /> Restaurant
                         </div>
                         <h2 className="text-xl font-bold leading-tight">{venue.name}</h2>
                     </div>
                </div>

                <div className="p-6">
                    <p className="text-slate-500 text-sm mb-6 flex items-start gap-2">
                        <MapPinIcon /> {venue.address}
                    </p>

                    <h3 className="font-bold text-slate-800 mb-3 text-sm uppercase tracking-wide">Rate this Spot</h3>
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <button 
                            onClick={handleGoogleRate}
                            className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                        >
                            <div className="text-amber-400 mb-2 group-hover:scale-110 transition-transform"><StarIcon /></div>
                            <span className="font-bold text-slate-700 text-sm">Public Review</span>
                            <span className="text-[10px] text-slate-400">Post on Google</span>
                        </button>

                        <button 
                            onClick={handlePrivateFeedback}
                            className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
                        >
                             <div className="text-indigo-400 mb-2 group-hover:scale-110 transition-transform"><MailIcon /></div>
                            <span className="font-bold text-slate-700 text-sm">Private Msg</span>
                            <span className="text-[10px] text-slate-400">Email Owner</span>
                        </button>
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                        <h3 className="font-bold text-slate-800 mb-2 text-sm uppercase tracking-wide flex items-center gap-2">
                            <UserGroupIcon /> Interest Graph
                        </h3>
                        <p className="text-xs text-slate-500 mb-4">
                            You tagged this location. Future updates will show other members who frequent this spot for potential matches.
                        </p>
                        <div className="flex -space-x-2 overflow-hidden">
                            <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-slate-200"></div>
                            <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-slate-300"></div>
                            <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">+12</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
