
import React from 'react';

export const Loader: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center p-8 bg-white rounded-xl shadow-md border border-slate-200">
    <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    <p className="mt-4 text-slate-600 font-semibold">{message}</p>
    <p className="mt-1 text-sm text-slate-500">This might take a moment.</p>
  </div>
);
