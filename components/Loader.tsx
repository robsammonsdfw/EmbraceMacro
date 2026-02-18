
import React from 'react';

export const Loader: React.FC = () => (
  <div className="relative w-12 h-12 flex items-center justify-center">
    <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
    <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);
