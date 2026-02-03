
import React from 'react';

interface ImageUploaderProps {
  image: string | null;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ image }) => {
  if (!image) {
    return null;
  }

  return (
    <div className="bg-white p-4 rounded-xl shadow-md border border-slate-200 animate-fade-in">
      <h2 className="text-xl font-bold mb-4 text-slate-700">Your Meal</h2>
      <img src={image} alt="Uploaded meal" className="w-full h-auto max-h-96 object-cover rounded-lg" />
    </div>
  );
};
