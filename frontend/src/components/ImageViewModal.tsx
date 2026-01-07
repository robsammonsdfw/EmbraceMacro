
import React, { useState, useEffect } from 'react';
import { XIcon } from './icons';
import * as apiService from '../services/apiService';

interface ImageViewModalProps {
    itemId: number;
    type: 'history' | 'saved' | 'body' | 'pantry';
    onClose: () => void;
}

export const ImageViewModal: React.FC<ImageViewModalProps> = ({ itemId, type, onClose }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const fetchImage = async () => {
            try {
                if (isMounted) setLoading(true);
                let data;
                if (type === 'history') {
                    data = await apiService.getMealLogEntryById(itemId);
                } else if (type === 'saved') {
                    data = await apiService.getSavedMealById(itemId);
                } else if (type === 'body') {
                    data = await apiService.getBodyPhotoById(itemId);
                } else if (type === 'pantry') {
                    data = await apiService.getPantryLogEntryById(itemId);
                }
                
                if (isMounted) {
                    if (data && data.imageUrl) {
                        setImageUrl(data.imageUrl);
                    } else {
                        setError("No image available for this item.");
                    }
                }
            } catch (err) {
                if (isMounted) setError("Failed to load image. The URL might be malformed or too large for the session.");
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchImage();
        return () => { isMounted = false; };
    }, [itemId, type]);

    return (
        <div 
            className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-4 animate-fade-in backdrop-blur-sm" 
            onClick={onClose}
        >
             <button 
                onClick={onClose} 
                className="absolute top-6 right-6 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all z-[110] shadow-xl"
                aria-label="Close"
            >
                <XIcon />
            </button>
            
            <div 
                className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center justify-center" 
                onClick={(e) => e.stopPropagation()}
            >
                {loading && (
                    <div className="text-white flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="font-bold tracking-widest uppercase text-xs opacity-60">Decrypting Vision...</p>
                    </div>
                )}
                
                {error && (
                    <div className="bg-rose-500/90 text-white p-6 rounded-2xl shadow-2xl text-center max-w-sm">
                        <p className="font-bold mb-2 uppercase tracking-tight">Access Error</p>
                        <p className="text-sm opacity-90">{error}</p>
                        <button onClick={onClose} className="mt-4 bg-white text-rose-600 px-4 py-2 rounded-xl text-xs font-black uppercase">Close Viewer</button>
                    </div>
                )}

                {!loading && !error && imageUrl && (
                    <img 
                        src={imageUrl} 
                        alt="Evidence" 
                        className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10" 
                        onError={() => setError("Image data is corrupted or blocked by the browser.")}
                    />
                )}
            </div>
        </div>
    );
};
