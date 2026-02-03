import React from 'react';
import { CameraIcon, UploadIcon, BarcodeIcon, ChefHatIcon } from './icons';

interface HeroProps {
    onCameraClick: () => void;
    onUploadClick: () => void;
    onBarcodeClick: () => void;
    onPantryChefClick: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onCameraClick, onUploadClick, onBarcodeClick, onPantryChefClick }) => {
    return (
        <div className="text-center p-8 bg-white rounded-xl shadow-md border border-slate-200">
            <div className="mx-auto bg-emerald-100 text-emerald-600 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Get Started in a Snap</h2>
            <p className="text-slate-600 mb-6 max-w-lg mx-auto">
                Analyze a meal's nutrition, scan a barcode, or get recipe ideas from a photo of your ingredients.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                 <button
                    onClick={onCameraClick}
                    className="w-full inline-flex items-center justify-center space-x-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 ease-in-out"
                >
                    <CameraIcon />
                    <span>Take Photo</span>
                </button>
                 <button
                    onClick={onBarcodeClick}
                    className="w-full inline-flex items-center justify-center space-x-3 bg-slate-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 ease-in-out"
                >
                    <BarcodeIcon />
                    <span>Scan Barcode</span>
                </button>
                 <button
                    onClick={onPantryChefClick}
                    className="w-full inline-flex items-center justify-center space-x-3 bg-amber-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 ease-in-out"
                >
                    <ChefHatIcon />
                    <span>Pantry Chef</span>
                </button>
                 <button
                    onClick={onUploadClick}
                    className="w-full inline-flex items-center justify-center space-x-3 bg-white text-slate-700 font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-lg border border-slate-200 hover:bg-slate-50 transform hover:-translate-y-0.5 transition-all duration-300 ease-in-out"
                >
                    <UploadIcon />
                    <span>Upload</span>
                </button>
            </div>
        </div>
    );
};
