
import React from 'react';

interface ImageUploaderProps {
  image: string | null;
  onImageChange: (file: File) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ image, onImageChange, fileInputRef }) => {
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImageChange(file);
    }
  };

  return (
    <>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      {image && (
        <div className="bg-white p-4 rounded-xl shadow-md border border-slate-200">
          <h2 className="text-xl font-bold mb-4 text-slate-700">Your Meal</h2>
          <img src={image} alt="Uploaded meal" className="w-full h-auto max-h-96 object-cover rounded-lg" />
        </div>
      )}
    </>
  );
};
