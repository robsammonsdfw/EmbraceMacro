import React from 'react';

export const Loader: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[2.5rem] shadow-xl border border-slate-100">
    <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
        <div className="absolute inset-0 border-4 border-slate-50 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <img src="/icon.png" alt="EH" className="w-10 h-10 object-contain animate-pulse" />
    </div>
    <p className="text-slate-800 font-black uppercase tracking-widest text-xs mb-1">{message}</p>
    <p className="text-xs text-slate-400 font-bold uppercase tracking-tighter">Synchronizing Life-Data...</p>
  </div>
);