import React, { useState, useEffect } from 'react';
import { XIcon } from './icons';
import * as apiService from '../services/apiService';

interface ImageViewModalProps {
    itemId: number;
    type: 'history' | 'saved';
    onClose: () => void;
}

export const ImageViewModal: React.FC<ImageViewModalProps> = ({ itemId, type, onClose }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchImage = async () => {
            try {
                setLoading(true);
                let data;
                if (type === 'history') {
                    data = await apiService.getMealLogEntryById(itemId);
                } else {
                    data = await apiService.getSavedMealById(itemId);
                }
                
                if (data && data.imageUrl) {
                    setImageUrl(data.imageUrl);
                } else {
                    setError("No image available for this item.");
                }
            } catch (err) {
                setError("Failed to load image.");
            } finally {
                setLoading(false);
            }
        };
        fetchImage();
    }, [itemId, type]);

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
             <button 
                onClick={onClose} 
                className="absolute top-4 right-4 p-2 bg-white/20 text-white rounded-full hover:bg-white/30 transition-colors z-50"
                aria-label="Close"
            >
                <XIcon />
            </button>
            
            <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
                {loading && (
                    <div className="text-white flex flex-col items-center">
                        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                        <p>Loading image...</p>
                    </div>
                )}
                
                {error && (
                    <div className="bg-red-500/80 text-white p-4 rounded-lg">
                        {error}
                    </div>
                )}

                {!loading && !error && imageUrl && (
                    <img 
                        src={imageUrl} 
                        alt="Meal" 
                        className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" 
                    />
                )}
            </div>
        </div>
    );
};