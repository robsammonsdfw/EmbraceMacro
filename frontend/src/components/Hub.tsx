
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

    const baseClasses = "flex flex-col items-center text-center p-6 bg-white rounded-xl shadow-md border border-slate-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full cursor-pointer group";

    if (href) {
        return (
            <a href={href} className={baseClasses}>
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
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
             <header className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                     <span className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500">
                        EmbraceHealth
                    </span>
                    <button 
                        onClick={onLogout}
                        className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
                    >
                        Logout
                    </button>
                </div>
            </header>

            <main className="flex-grow flex items-center justify-center p-4">
                <div className="max-w-4xl w-full">
                    <div className="text-center mb-10">
                        <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2">Welcome Back</h1>
                        <p className="text-slate-600 text-lg">Choose a service to continue.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <MenuCard 
                            title="Body Scan" 
                            description="View your biometric reports and scan results."
                            icon={<UserCircleIcon />}
                            colorClass="bg-indigo-500 text-indigo-500"
                            href="https://app.embracehealth.ai"
                        />
                        <MenuCard 
                            title="Meal Planning" 
                            description="Plan your nutrition, analyze meals, and get recipes."
                            icon={<UtensilsIcon />}
                            colorClass="bg-emerald-500 text-emerald-500"
                            onClick={onEnterMeals}
                        />
                         <MenuCard 
                            title="EmbraceHealth" 
                            description="Visit our main website to learn more about us."
                            icon={<GlobeAltIcon />}
                            colorClass="bg-cyan-500 text-cyan-500"
                            href="https://www.embracehealth.ai"
                        />
                    </div>
                </div>
            </main>
        </div>
    );
};
