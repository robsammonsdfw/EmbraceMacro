import React, { useState, useEffect } from 'react';
import { MenuIcon, XIcon, HomeIcon, PlusIcon, BookOpenIcon, ClockIcon, LightBulbIcon, ClipboardListIcon, StarIcon, Squares2X2Icon, TrophyIcon } from './icons';
import * as apiService from '../services/apiService';

interface NavbarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  onBackToHub: () => void;
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

export const Navbar: React.FC<NavbarProps> = ({ activeView, onNavigate, onLogout, onBackToHub }) => {
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
    }, [activeView]); // Refresh when view changes (e.g., after logging a meal)

    const handleNav = (view: string) => {
        onNavigate(view);
        setIsOpen(false);
    };

    const handleBackToHub = () => {
        onBackToHub();
        setIsOpen(false);
    };
    
    // Calculation based on user example: 2000 pts = $18.00 (approx $0.009 per point)
    const cashValue = (points * 0.009).toFixed(2);

    return (
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
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
                                    <span className="text-xs text-slate-400 font-medium">·</span>
                                    <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-1 rounded">
                                        ${cashValue}
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

                    {/* Mobile Menu Button */}
                    <div className="flex items-center md:hidden">
                         <button 
                            onClick={() => handleNav('rewards')}
                            className="mr-3 flex items-center space-x-1 bg-slate-50 px-2 py-1 rounded-full border border-slate-200"
                        >
                            <span className="text-xs font-bold text-slate-700">{points} pts</span>
                             <span className="text-[10px] text-emerald-600 font-bold">${cashValue}</span>
                        </button>
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="p-2 rounded-md text-slate-500 hover:text-emerald-600 hover:bg-slate-100 focus:outline-none"
                            aria-expanded={isOpen}
                        >
                            <span className="sr-only">Open main menu</span>
                            {isOpen ? <XIcon /> : <MenuIcon />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu Dropdown */}
            {isOpen && (
                <div className="md:hidden bg-white border-t border-slate-200 absolute w-full left-0 z-50 shadow-lg">
                    <div className="pt-2 pb-3 space-y-1">
                        <MobileNavLink active={false} onClick={handleBackToHub} icon={<Squares2X2Icon />}>Main Menu</MobileNavLink>
                        <div className="border-t border-slate-100 my-1"></div>
                        <MobileNavLink active={activeView === 'home'} onClick={() => handleNav('home')} icon={<HomeIcon />}>Home</MobileNavLink>
                        <MobileNavLink active={activeView === 'plan'} onClick={() => handleNav('plan')} icon={<PlusIcon />}>Plan</MobileNavLink>
                        <MobileNavLink active={activeView === 'meals'} onClick={() => handleNav('meals')} icon={<BookOpenIcon />}>Meals</MobileNavLink>
                        <MobileNavLink active={activeView === 'history'} onClick={() => handleNav('history')} icon={<ClockIcon />}>History</MobileNavLink>
                        <MobileNavLink active={activeView === 'suggestions'} onClick={() => handleNav('suggestions')} icon={<LightBulbIcon />}>Ideas</MobileNavLink>
                        <MobileNavLink active={activeView === 'grocery'} onClick={() => handleNav('grocery')} icon={<ClipboardListIcon />}>List</MobileNavLink>
                         <MobileNavLink active={activeView === 'rewards'} onClick={() => handleNav('rewards')} icon={<StarIcon />}>Rewards (Health Wallet)</MobileNavLink>
                        <div className="border-t border-slate-100 my-2 pt-2">
                             <MobileNavLink active={false} onClick={onLogout}>Logout</MobileNavLink>
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
};