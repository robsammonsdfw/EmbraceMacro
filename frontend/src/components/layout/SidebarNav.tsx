
import React, { useState } from 'react';
import { 
    HomeIcon, DumbbellIcon, BrainIcon, 
    UtensilsIcon, UserCircleIcon, BeakerIcon, 
    ActivityIcon, ClipboardCheckIcon, UsersIcon, 
    UserGroupIcon, HeartIcon, TrophyIcon, 
    Squares2X2Icon
} from '../icons';
import { HealthJourney, ActiveView } from '../../types';
import { JOURNEYS } from './AppLayout';

interface SidebarNavProps {
    activeView: ActiveView;
    onNavigate: (view: ActiveView) => void;
    onLogout: () => void;
    selectedJourney?: HealthJourney;
    onJourneyChange?: (journey: HealthJourney) => void;
    showClientsTab?: boolean;
}

const NavItem: React.FC<{ 
    label: string; 
    icon: React.ReactNode; 
    isActive: boolean; 
    onClick: () => void;
    indent?: boolean;
}> = ({ label, icon, isActive, onClick, indent }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
            isActive 
            ? 'bg-slate-900 text-white font-bold shadow-md' 
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
        } ${indent ? 'ml-4 w-[calc(100%-1rem)] text-xs' : ''}`}
    >
        <span className={`${isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-600'} ${indent ? 'scale-90' : ''}`}>
            {icon}
        </span>
        <span className={`${indent ? 'font-bold tracking-wide' : 'text-sm font-black uppercase tracking-tight'}`}>{label}</span>
    </button>
);

const CategoryHeader: React.FC<{
    label: string;
    color: string;
    icon: React.ReactNode;
    isOpen: boolean;
    onClick: () => void;
}> = ({ label, color, icon, isOpen, onClick }) => (
    <button 
        onClick={onClick}
        className="w-full flex items-center justify-between px-4 py-3 mt-4 mb-1 text-left hover:bg-slate-50 rounded-xl transition-colors group"
    >
        <div className="flex items-center gap-3">
            <span className={`${color}`}>{icon}</span>
            <span className="text-xs font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-600">{label}</span>
        </div>
        <span className={`text-slate-300 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
    </button>
);

export const SidebarNav: React.FC<SidebarNavProps> = ({ activeView, onNavigate, onLogout, showClientsTab, selectedJourney, onJourneyChange }) => {
    // Categories state
    const [openCategories, setOpenCategories] = useState({
        physical: true,
        mental: true,
        social: true
    });

    const toggleCategory = (cat: 'physical' | 'mental' | 'social') => {
        setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
    };

    return (
        <div className="h-full flex flex-col bg-white border-r border-slate-200">
            {/* Header / Logo */}
            <div className="p-6 pt-8">
                <div className="mb-6 flex justify-start cursor-pointer" onClick={() => onNavigate('home')}>
                    <img src="/logo.png" alt="EmbraceHealth AI" className="max-w-full h-auto max-h-12 object-contain" />
                </div>
                
                {onJourneyChange && (
                    <div className="mt-4 md:hidden">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Active Journey</label>
                        <select 
                            value={selectedJourney} 
                            onChange={(e) => onJourneyChange(e.target.value as HealthJourney)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 transition-all appearance-none"
                        >
                            {JOURNEYS.map(j => (<option key={j.id} value={j.id}>{j.label}</option>))}
                        </select>
                    </div>
                )}
            </div>

            {/* Navigation Content */}
            <div className="flex-grow px-4 space-y-1 overflow-y-auto no-scrollbar pb-10">
                <NavItem label="Command Center" icon={<HomeIcon />} isActive={activeView === 'home'} onClick={() => onNavigate('home')} />

                {showClientsTab && (
                    <div className="mt-4">
                        <NavItem label="My Clients" icon={<UsersIcon />} isActive={activeView === 'clients'} onClick={() => onNavigate('clients')} />
                    </div>
                )}

                {/* PHYSICAL HUB */}
                <CategoryHeader 
                    label="Physical" 
                    color="text-emerald-500" 
                    icon={<DumbbellIcon />} 
                    isOpen={openCategories.physical} 
                    onClick={() => toggleCategory('physical')} 
                />
                {openCategories.physical && (
                    <div className="space-y-1 animate-fade-in">
                        <NavItem indent label="Fuel & Nutrition" icon={<UtensilsIcon />} isActive={activeView === 'physical.fuel'} onClick={() => onNavigate('physical.fuel')} />
                        <NavItem indent label="Body & Movement" icon={<UserCircleIcon />} isActive={activeView === 'physical.body'} onClick={() => onNavigate('physical.body')} />
                        <NavItem indent label="Health Reports" icon={<BeakerIcon />} isActive={activeView === 'physical.reports'} onClick={() => onNavigate('physical.reports')} />
                    </div>
                )}

                {/* MENTAL HUB */}
                <CategoryHeader 
                    label="Mental" 
                    color="text-indigo-500" 
                    icon={<BrainIcon />} 
                    isOpen={openCategories.mental} 
                    onClick={() => toggleCategory('mental')} 
                />
                {openCategories.mental && (
                    <div className="space-y-1 animate-fade-in">
                        <NavItem indent label="Daily Readiness" icon={<ActivityIcon />} isActive={activeView === 'mental.readiness'} onClick={() => onNavigate('mental.readiness')} />
                        <NavItem indent label="Assessments" icon={<ClipboardCheckIcon />} isActive={activeView === 'mental.assessments'} onClick={() => onNavigate('mental.assessments')} />
                        <NavItem indent label="Care Team" icon={<UsersIcon />} isActive={activeView === 'mental.care'} onClick={() => onNavigate('mental.care')} />
                    </div>
                )}

                {/* SOCIAL HUB */}
                <CategoryHeader 
                    label="Social" 
                    color="text-amber-500" 
                    icon={<UserGroupIcon />} 
                    isOpen={openCategories.social} 
                    onClick={() => toggleCategory('social')} 
                />
                {openCategories.social && (
                    <div className="space-y-1 animate-fade-in">
                        <NavItem indent label="Community" icon={<UserGroupIcon />} isActive={activeView === 'social.community'} onClick={() => onNavigate('social.community')} />
                        <NavItem indent label="My Journey" icon={<HeartIcon />} isActive={activeView === 'social.journey'} onClick={() => onNavigate('social.journey')} />
                        <NavItem indent label="Rewards" icon={<TrophyIcon />} isActive={activeView === 'social.rewards'} onClick={() => onNavigate('social.rewards')} />
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <button onClick={() => onNavigate('hub')} className="w-full flex items-center space-x-3 px-4 py-3 text-slate-500 transition-colors text-left group hover:bg-white rounded-xl">
                    <Squares2X2Icon className="group-hover:rotate-90 transition-transform text-slate-400 w-5 h-5" />
                    <span className="font-bold text-[10px] uppercase tracking-widest">Switch App</span>
                </button>
                <button onClick={onLogout} className="w-full text-left px-8 py-2 text-[10px] font-black text-slate-400 hover:text-rose-500 mt-1 uppercase tracking-widest">Sign Out</button>
            </div>
        </div>
    );
};
