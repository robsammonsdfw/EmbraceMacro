
import React, { useState, useEffect, useRef } from 'react';
import { MapPinIcon, XIcon } from './icons';
import { searchPlaces } from '../services/apiService';
import type { GooglePlaceResult } from '../types';

interface LocationPickerProps {
    onSelect: (place: GooglePlaceResult) => void;
    onCancel: () => void;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({ onSelect, onCancel }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<GooglePlaceResult[]>([]);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const places = await searchPlaces(query);
                setResults(places);
            } catch (error) {
                console.error("Search failed", error);
            } finally {
                setLoading(false);
            }
        }, 500);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query]);

    return (
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm animate-fade-in mt-4 relative">
             <button onClick={onCancel} className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600">
                <XIcon />
            </button>
            <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1">
                <MapPinIcon /> Tag Location
            </h3>
            
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search places..."
                className="w-full p-2 border border-slate-300 rounded text-sm mb-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                autoFocus
            />

            {loading && <p className="text-xs text-slate-500 p-2">Searching...</p>}

            {!loading && results.length > 0 && (
                <ul className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                    {results.map((place) => (
                        <li 
                            key={place.place_id} 
                            onClick={() => onSelect(place)}
                            className="p-2 hover:bg-slate-50 cursor-pointer text-sm"
                        >
                            <p className="font-semibold text-slate-800">{place.name}</p>
                            <p className="text-xs text-slate-500 truncate">{place.formatted_address}</p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};