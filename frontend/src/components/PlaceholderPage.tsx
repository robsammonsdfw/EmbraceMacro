
import React from 'react';
import { SparklesIcon } from './icons';

interface PlaceholderPageProps {
    title: string;
    description?: string;
    icon?: React.ReactNode;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title, description, icon }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center animate-fade-in">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 text-slate-400">
                {icon || <SparklesIcon className="w-12 h-12" />}
            </div>
            <h1 className="text-3xl font-black text-slate-900 mb-4">{title}</h1>
            <p className="text-lg text-slate-500 max-w-md mb-8">
                {description || "This feature is currently under development and will be available in the next release."}
            </p>
            <div className="inline-block bg-indigo-50 border border-indigo-100 rounded-xl px-6 py-3">
                <span className="text-indigo-600 font-bold uppercase tracking-widest text-xs">Coming Soon</span>
            </div>
        </div>
    );
};
