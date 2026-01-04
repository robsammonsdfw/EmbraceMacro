import React from 'react';
import { UserCircleIcon, GlobeAltIcon, UtensilsIcon } from './icons';

interface HubProps {
    onEnterMeals: () => void;
    onLogout: () => void;
}

const MenuCard: React.FC<{
    title: string;
    description: string;
    icon: React.ReactNode;
    colorClass: string;
    onClick?: () => void;
    href?: string;
}> = ({ title, description, icon, colorClass, onClick, href }) => {
    const Content = (
        <>
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${colorClass} bg-opacity-10 text-opacity-100`}>
                <div className={colorClass.replace('bg-', 'text-')}>
                    {icon}
                </div>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
            <p className="text-slate-600 text-sm">{description}</p>
        </>
    );

    const baseClasses = "flex flex-col items-center text-center p-6 bg-white rounded-[2rem] shadow-lg border border-slate-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 h-full cursor-pointer group";

    if (href) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" className={baseClasses}>
                {Content}
            </a>
        );
    }

    return (
        <div onClick={onClick} className={baseClasses}>
            {Content}
        </div>
    );
};

export const Hub: React.FC<HubProps> = ({ onEnterMeals, onLogout }) => {

    const handleGoToScanner = () => {
        const token = localStorage.getItem('embracehealth-api-token');
        if (token) {
            window.location.href = `https://app.embracehealth.ai?token=${encodeURIComponent(token)}`;
        } else {
            window.location.href = 'https://app.embracehealth.ai';
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
             <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                     <div className="flex items-center">
                        <img src="/logo.png" alt="EH" className="h-8 w-auto" />
                     </div>
                    <button 
                        onClick={onLogout}
                        className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-colors"
                    >
                        Sign Out
                    </button>
                </div>
            </header>

            <main className="flex-grow flex items-center justify-center p-4 md:p-8">
                <div className="max-w-5xl w-full">
                    <div className="text-center mb-12">
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter mb-4">Central Intelligence</h1>
                        <p className="text-slate-500 text-lg font-medium">Select a metabolic domain to manage your digital twin.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <MenuCard 
                            title="EmbraceHealth 3D Body" 
                            description="Access clinical biometric reports and scan results."
                            icon={<UserCircleIcon className="w-8 h-8" />}
                            colorClass="bg-indigo-500 text-indigo-500"
                            onClick={handleGoToScanner}
                        />
                        <MenuCard 
                            title="EmbraceHealth Meals" 
                            description="Plan clinical nutrition, analyze meals, and generate AI recipes."
                            icon={<UtensilsIcon className="w-8 h-8" />}
                            colorClass="bg-emerald-500 text-emerald-500"
                            onClick={onEnterMeals}
                        />
                         <MenuCard 
                            title="EmbraceHealth Main Website" 
                            description="Visit our homepage to learn about the health methodology."
                            icon={<GlobeAltIcon className="w-8 h-8" />}
                            colorClass="bg-cyan-500 text-cyan-500"
                            href="https://www.embracehealth.ai"
                        />
                    </div>
                    
                    <div className="mt-16 text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">EmbraceHealth AI • Connected Living</p>
                    </div>
                </div>
            </main>
        </div>
    );
};