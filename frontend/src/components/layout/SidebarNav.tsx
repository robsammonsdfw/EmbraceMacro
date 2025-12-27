
import React from 'react';
import { HomeIcon, BookOpenIcon, UserCircleIcon, BeakerIcon, ClipboardListIcon, TrophyIcon, Squares2X2Icon, ClipboardCheckIcon, HeartIcon, PlusIcon, UserGroupIcon, UsersIcon } from '../icons';

interface SidebarNavProps {
    activeView: string;
    onNavigate: (view: string) => void;
    onLogout: () => void;
    showClientsTab?: boolean;
}

const NavItem: React.FC<{ 
    id: string; 
    label: string; 
    icon: React.ReactNode; 
    isActive: boolean; 
    onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
            isActive 
            ? 'bg-emerald-50 text-emerald-700 font-bold shadow-sm' 
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
        }`}
    >
        <span className={`${isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
            {icon}
        </span>
        <span>{label}</span>
    </button>
);

export const SidebarNav: React.FC<SidebarNavProps> = ({ activeView, onNavigate, onLogout, showClientsTab }) => {
    return (
        <div className="h-full flex flex-col bg-white">
            <div className="p-6">
                <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500">Embrace</h1>
            </div>

            <div className="flex-grow px-4 space-y-2 overflow-y-auto">
                {showClientsTab && (
                    <div className="mb-4">
                        <NavItem id="clients" label="My Clients" icon={<UsersIcon />} isActive={activeView === 'clients'} onClick={() => onNavigate('clients')} />
                        <div className="h-px bg-slate-100 my-4"></div>
                    </div>
                )}

                <NavItem id="home" label="Command Center" icon={<HomeIcon />} isActive={activeView === 'home'} onClick={() => onNavigate('home')} />
                <NavItem id="social" label="Social Hub" icon={<UserGroupIcon />} isActive={activeView === 'social'} onClick={() => onNavigate('social')} />
                <NavItem id="plan" label="Meal Planner" icon={<PlusIcon />} isActive={activeView === 'plan'} onClick={() => onNavigate('plan')} />
                <NavItem id="meals" label="My Meals" icon={<BookOpenIcon />} isActive={activeView === 'meals'} onClick={() => onNavigate('meals')} />
                <NavItem id="grocery" label="Grocery List" icon={<ClipboardListIcon />} isActive={activeView === 'grocery'} onClick={() => onNavigate('grocery')} />
                <NavItem id="body" label="My Body" icon={<UserCircleIcon />} isActive={activeView === 'body'} onClick={() => onNavigate('body')} />
                <NavItem id="assessments" label="Assessments" icon={<ClipboardCheckIcon />} isActive={activeView === 'assessments'} onClick={() => onNavigate('assessments')} />
                <NavItem id="blueprint" label="Blueprint & Match" icon={<HeartIcon />} isActive={activeView === 'blueprint'} onClick={() => onNavigate('blueprint')} />
                <NavItem id="labs" label="Labs" icon={<BeakerIcon />} isActive={activeView === 'labs'} onClick={() => onNavigate('labs')} />
                <NavItem id="orders" label="Orders" icon={<ClipboardListIcon />} isActive={activeView === 'orders'} onClick={() => onNavigate('orders')} />
                <NavItem id="rewards" label="Rewards" icon={<TrophyIcon />} isActive={activeView === 'rewards'} onClick={() => onNavigate('rewards')} />
            </div>

            <div className="p-4 border-t border-slate-100">
                <button onClick={() => onNavigate('hub')} className="w-full flex items-center space-x-3 px-4 py-3 text-slate-500 transition-colors">
                    <Squares2X2Icon />
                    <span className="font-medium text-sm">Switch App</span>
                </button>
                <button onClick={onLogout} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-400 hover:text-red-500 mt-2 uppercase">Sign Out</button>
            </div>
        </div>
    );
};
