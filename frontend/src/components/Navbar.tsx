
import React, { useState, useEffect } from 'react';
import { HomeIcon, PlusIcon, BookOpenIcon, ClockIcon, ClipboardListIcon, Squares2X2Icon, TrophyIcon, CameraIcon, UserGroupIcon, UserCircleIcon, MenuIcon } from './icons';
import * as apiService from '../services/apiService';

interface NavbarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  onBackToHub: () => void;
  onCaptureClick: () => void;
  onOpenMenu: () => void;
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

export const Navbar: React.FC<NavbarProps> = ({ activeView, onNavigate, onLogout, onBackToHub, onCaptureClick, onOpenMenu }) => {
    const [points, setPoints] = useState<number>(0);

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
    };

    return (
        <>
            <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm hidden md:block">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center cursor-pointer" onClick={() => handleNav('home')}>
                            <span className="text-2xl font-extrabold text-slate-900">
                                EmbraceHealth
                            </span>
                        </div>

                        {/* Desktop Menu */}
                        <div className="hidden md:flex items-center space-x-2 lg:space-x-4">
                            <NavLink active={false} onClick={onBackToHub} icon={<Squares2X2Icon />}>Main Menu</NavLink>
                            <div className="h-6 w-px bg-slate-200 mx-1"></div>
                            <NavLink active={activeView === 'home'} onClick={() => handleNav('home')} icon={<HomeIcon />}>Home</NavLink>
                            <NavLink active={activeView === 'plan'} onClick={() => handleNav('plan')} icon={<PlusIcon />}>Plan</NavLink>
                            <NavLink active={activeView === 'meals'} onClick={() => handleNav('meals')} icon={<BookOpenIcon />}>Meals</NavLink>
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

            {/* Mobile Bottom Navigation - Updated layout including Plan and Menu */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)] pb-safe z-40 flex justify-around items-center h-20 px-2">
                <button 
                    onClick={() => handleNav('home')} 
                    className={`p-2 flex flex-col items-center gap-1 flex-1 ${activeView === 'home' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <HomeIcon />
                    <span className="text-[10px] font-bold">Home</span>
                </button>
                
                <button 
                    onClick={() => handleNav('plan')} 
                    className={`p-2 flex flex-col items-center gap-1 flex-1 ${activeView === 'plan' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <PlusIcon />
                    <span className="text-[10px] font-bold">Plan</span>
                </button>
                
                {/* Central Action Button */}
                <button 
                    onClick={onCaptureClick}
                    className="relative -top-6 bg-emerald-500 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center border-4 border-white transform active:scale-95 transition-all"
                >
                    <CameraIcon />
                </button>

                <button 
                    onClick={() => handleNav('meals')} 
                    className={`p-2 flex flex-col items-center gap-1 flex-1 ${activeView === 'meals' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <BookOpenIcon />
                    <span className="text-[10px] font-bold">Meals</span>
                </button>
                
                {/* Mobile Menu Button - Opens Full Sidebar */}
                <button 
                    onClick={onOpenMenu} 
                    className={`p-2 flex flex-col items-center gap-1 flex-1 text-slate-400 hover:text-slate-600`}
                >
                    <MenuIcon />
                    <span className="text-[10px] font-bold">Menu</span>
                </button>
            </div>
        </>
    );
};
