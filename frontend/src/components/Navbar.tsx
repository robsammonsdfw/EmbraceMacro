
import React, { useState, useEffect } from 'react';
import { MenuIcon, XIcon, HomeIcon, PlusIcon, BookOpenIcon, ClockIcon, LightBulbIcon, ClipboardListIcon, StarIcon, Squares2X2Icon, TrophyIcon, CameraIcon } from './icons';
import * as apiService from '../services/apiService';

interface NavbarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  onBackToHub: () => void;
  onCaptureClick: () => void;
}

const NavLink: React.FC<{ 
    active: boolean; 
    onClick: () => void; 
    children: React.ReactNode; 
    icon?: React.ReactNode 
}> = ({ active, onClick, children, icon }) => (
    <button
        onClick={onClick}
        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
            active
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-600 hover:text-emerald-600 hover:bg-slate-50'
        }`}
    >
        {icon && <span className="text-current">{icon}</span>}
        <span>{children}</span>
    </button>
);

const MobileNavLink: React.FC<{ 
    active: boolean; 
    onClick: () => void; 
    children: React.ReactNode; 
    icon?: React.ReactNode
}> = ({ active, onClick, children, icon }) => (
    <button
        onClick={onClick}
        className={`w-full text-left px-4 py-3 text-base font-medium border-l-4 transition-colors flex items-center space-x-3 ${
            active
                ? 'border-emerald-500 text-emerald-700 bg-emerald-50'
                : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-emerald-600'
        }`}
    >
        {icon && <span className="text-current w-5 h-5">{icon}</span>}
        <span>{children}</span>
    </button>
);

export const Navbar: React.FC<NavbarProps> = ({ activeView, onNavigate, onLogout, onBackToHub, onCaptureClick }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [points, setPoints] = useState<number>(0);

    // Fetch basic rewards data for the wallet pill
    useEffect(() => {
        const fetchWallet = async () => {
            try {
                const data = await apiService.getRewardsSummary();
                setPoints(data.points_total);
            } catch (e) {
                console.error("Failed to fetch wallet balance", e);
            }
        };
        fetchWallet();
    }, [activeView]); 

    const handleNav = (view: string) => {
        onNavigate(view);
        setIsOpen(false);
    };

    const handleBackToHub = () => {
        onBackToHub();
        setIsOpen(false);
    };
    
    const cashValue = (points * 0.009).toFixed(2);

    return (
        <>
            <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm hidden md:block">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center cursor-pointer" onClick={() => handleNav('home')}>
                            <span className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500">
                                EmbraceHealth
                            </span>
                        </div>

                        {/* Desktop Menu */}
                        <div className="hidden md:flex items-center space-x-2 lg:space-x-4">
                            <NavLink active={false} onClick={handleBackToHub} icon={<Squares2X2Icon />}>Main Menu</NavLink>
                            <div className="h-6 w-px bg-slate-200 mx-1"></div>
                            <NavLink active={activeView === 'home'} onClick={() => handleNav('home')} icon={<HomeIcon />}>Home</NavLink>
                            <NavLink active={activeView === 'plan'} onClick={() => handleNav('plan')} icon={<PlusIcon />}>Plan</NavLink>
                            <NavLink active={activeView === 'meals'} onClick={() => handleNav('meals')} icon={<BookOpenIcon />}>Meals</NavLink>
                            <NavLink active={activeView === 'history'} onClick={() => handleNav('history')} icon={<ClockIcon />}>History</NavLink>
                            <NavLink active={activeView === 'grocery'} onClick={() => handleNav('grocery')} icon={<ClipboardListIcon />}>List</NavLink>
                            
                            <button 
                                onClick={onCaptureClick}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-full shadow-lg transform hover:scale-105 transition"
                                title="Open Camera"
                            >
                                <CameraIcon />
                            </button>

                            {/* Health Wallet Pill */}
                            <button 
                                onClick={() => handleNav('rewards')}
                                className={`ml-2 flex items-center space-x-2 px-3 py-1.5 rounded-full border transition-all shadow-sm ${
                                    activeView === 'rewards' 
                                    ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100' 
                                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                <div className={`p-1 rounded-full ${activeView === 'rewards' ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                    <TrophyIcon /> 
                                </div>
                                <div className="flex flex-col items-start leading-tight">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Health Wallet</span>
                                    <div className="flex items-baseline space-x-1">
                                        <span className={`text-sm font-bold ${activeView === 'rewards' ? 'text-indigo-700' : 'text-slate-700'}`}>
                                            {points.toLocaleString()} pts
                                        </span>
                                    </div>
                                </div>
                            </button>

                            <div className="h-6 w-px bg-slate-200 mx-2"></div>
                            <button 
                                onClick={onLogout}
                                className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Mobile Bottom Navigation with Super Button */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe z-40 flex justify-around items-end shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
                <button 
                    onClick={() => handleNav('home')} 
                    className={`p-3 flex flex-col items-center gap-1 flex-1 ${activeView === 'home' ? 'text-emerald-600' : 'text-slate-400'}`}
                >
                    <HomeIcon />
                    <span className="text-[10px] font-bold">Home</span>
                </button>
                <button 
                    onClick={() => handleNav('plan')} 
                    className={`p-3 flex flex-col items-center gap-1 flex-1 ${activeView === 'plan' ? 'text-emerald-600' : 'text-slate-400'}`}
                >
                    <PlusIcon />
                    <span className="text-[10px] font-bold">Plan</span>
                </button>
                
                {/* Center Super Button */}
                <div className="relative -top-6">
                    <button 
                        onClick={onCaptureClick}
                        className="bg-emerald-500 text-white w-16 h-16 rounded-full shadow-xl flex items-center justify-center border-4 border-slate-50 transform active:scale-95 transition-all"
                    >
                        <CameraIcon />
                    </button>
                </div>

                <button 
                    onClick={() => handleNav('history')} 
                    className={`p-3 flex flex-col items-center gap-1 flex-1 ${activeView === 'history' ? 'text-emerald-600' : 'text-slate-400'}`}
                >
                    <ClockIcon />
                    <span className="text-[10px] font-bold">History</span>
                </button>
                <button 
                    onClick={() => handleNav('rewards')} 
                    className={`p-3 flex flex-col items-center gap-1 flex-1 ${activeView === 'rewards' ? 'text-emerald-600' : 'text-slate-400'}`}
                >
                    <TrophyIcon />
                    <span className="text-[10px] font-bold">Wallet</span>
                </button>
            </div>
        </>
    );
};
