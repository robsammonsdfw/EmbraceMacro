
import React, { useState } from 'react';
import { 
    HomeIcon, DumbbellIcon, BrainIcon, 
    UtensilsIcon, UserCircleIcon, BeakerIcon, 
    ActivityIcon, ClipboardCheckIcon, UsersIcon, 
    UserGroupIcon, HeartIcon, TrophyIcon, 
    Squares2X2Icon, CogIcon, PillIcon, RunningIcon, 
    VideoIcon, BriefcaseIcon, BadgeCheckIcon, ClockIcon,
    ClipboardListIcon, BookOpenIcon, BarcodeIcon, GlobeAltIcon, ChefHatIcon,
    CameraIcon, MoonIcon, ShoppingCartIcon
} from '../icons';
import { HealthJourney, ActiveView } from '../../types';
import { JOURNEYS } from './AppLayout';

// Feature Flag: Set to false to show "For Her" category
const HIDE_FOR_HER = true;

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
    superIndent?: boolean;
}> = ({ label, icon, isActive, onClick, indent, superIndent }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all duration-200 group ${
            isActive 
            ? 'bg-slate-900 text-white font-bold shadow-md' 
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
        } ${indent ? 'ml-2 w-[calc(100%-0.5rem)] text-xs' : ''} ${superIndent ? 'ml-6 w-[calc(100%-1.5rem)] text-[11px]' : ''}`}
    >
        <span className={`${isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-600'} ${indent || superIndent ? 'scale-90' : ''}`}>
            {icon}
        </span>
        <span className={`${indent || superIndent ? 'font-bold tracking-wide' : 'text-sm font-black uppercase tracking-tight'}`}>{label}</span>
    </button>
);

const CategoryHeader: React.FC<{
    label: string;
    color: string;
    isOpen: boolean;
    onClick: () => void;
}> = ({ label, color, isOpen, onClick }) => (
    <button 
        onClick={onClick}
        className="w-full flex items-center justify-between px-4 py-2 mt-4 mb-1 text-left hover:bg-slate-50 rounded-lg transition-colors group"
    >
        <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${color} group-hover:opacity-100 opacity-80`}>{label}</span>
        <span className={`text-slate-300 text-[10px] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
    </button>
);

const SubCategoryHeader: React.FC<{
    label: string;
    isOpen: boolean;
    onClick: () => void;
}> = ({ label, isOpen, onClick }) => (
    <button 
        onClick={onClick}
        className="w-full flex items-center justify-between px-6 py-1.5 mt-2 text-left hover:bg-slate-50 transition-colors group rounded-md"
    >
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-600 transition-colors">{label}</span>
        <span className={`text-slate-300 text-[9px] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
    </button>
);

export const SidebarNav: React.FC<SidebarNavProps> = ({ activeView, onNavigate, onLogout, selectedJourney, onJourneyChange }) => {
    // Categories state
    const [openCategories, setOpenCategories] = useState({
        telemedicine: true, 
        account: true,
        physical: true,
        nutrition: true,
        mental: true,
        sleep: true,
        labs: true,
        roles: true,
        rewards: true
    });

    // Sub-category state for Prescriptions
    const [openSubCategories, setOpenSubCategories] = useState({
        him: false,
        her: false
    });

    // Sub-category state for Roles
    const [rolesSubCategories, setRolesSubCategories] = useState({
        independent: true,
        smb: false,
        enterprise: false,
        institutional: false
    });

    const toggleCategory = (cat: keyof typeof openCategories) => {
        setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
    };

    const toggleSubCategory = (sub: keyof typeof openSubCategories) => {
        setOpenSubCategories(prev => ({ ...prev, [sub]: !prev[sub] }));
    };

    const toggleRoleSubCategory = (sub: keyof typeof rolesSubCategories) => {
        setRolesSubCategories(prev => ({ ...prev, [sub]: !prev[sub] }));
    };

    return (
        <div className="h-full flex flex-col bg-white border-r border-slate-200">
            {/* Header / Logo */}
            <div className="p-6 pt-8">
                <div className="mb-6 flex justify-start cursor-pointer" onClick={() => onNavigate('home')}>
                    <img src="/logo.png" alt="EmbraceHealth AI" className="w-auto h-8 object-contain" />
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
            <div className="flex-grow px-3 space-y-1 overflow-y-auto no-scrollbar pb-10">
                <NavItem label="Dashboard" icon={<HomeIcon />} isActive={activeView === 'home'} onClick={() => onNavigate('home')} />

                {/* 1. PRESCRIPTIONS - RX */}
                <CategoryHeader label="Prescriptions - Rx" color="text-sky-600" isOpen={openCategories.telemedicine} onClick={() => toggleCategory('telemedicine')} />
                {openCategories.telemedicine && (
                    <div className="space-y-0.5 animate-fade-in pl-2 border-l border-sky-100 ml-4">
                        
                        <NavItem indent label="Weight Loss" icon={<ActivityIcon />} isActive={activeView === 'telemed.everyone.weight_loss'} onClick={() => onNavigate('telemed.everyone.weight_loss')} />

                        <SubCategoryHeader label="For Him" isOpen={openSubCategories.him} onClick={() => toggleSubCategory('him')} />
                        {openSubCategories.him && (
                            <div className="animate-fade-in">
                                <NavItem superIndent label="Hair Loss" icon={<UserCircleIcon />} isActive={activeView === 'telemed.him.hair_loss'} onClick={() => onNavigate('telemed.him.hair_loss')} />
                                <NavItem superIndent label="Erectile Dysfunction" icon={<ActivityIcon />} isActive={activeView === 'telemed.him.ed'} onClick={() => onNavigate('telemed.him.ed')} />
                                <NavItem superIndent label="Low Testosterone" icon={<HeartIcon />} isActive={activeView === 'telemed.him.low_t'} onClick={() => onNavigate('telemed.him.low_t')} />
                                <NavItem superIndent label="Premature Ejaculation" icon={<ClockIcon />} isActive={activeView === 'telemed.him.pe'} onClick={() => onNavigate('telemed.him.pe')} />
                            </div>
                        )}

                        {!HIDE_FOR_HER && (
                            <>
                                <SubCategoryHeader label="For Her" isOpen={openSubCategories.her} onClick={() => toggleSubCategory('her')} />
                                {openSubCategories.her && (
                                    <div className="animate-fade-in">
                                        <NavItem superIndent label="Menopause" icon={<HeartIcon />} isActive={activeView === 'telemed.her.menopause'} onClick={() => onNavigate('telemed.her.menopause')} />
                                        <NavItem superIndent label="Estrogen Therapy" icon={<PillIcon />} isActive={activeView === 'telemed.her.estrogen'} onClick={() => onNavigate('telemed.her.estrogen')} />
                                    </div>
                                )}
                            </>
                        )}
                        
                        <div className="my-2 border-t border-slate-100"></div>
                        <NavItem indent label="Order History" icon={<ClipboardListIcon />} isActive={activeView === 'account.pharmacy'} onClick={() => onNavigate('account.pharmacy')} />
                    </div>
                )}

                {/* 2. NUTRITION + MEALS */}
                <CategoryHeader label="Nutrition + Meals" color="text-amber-500" isOpen={openCategories.nutrition} onClick={() => toggleCategory('nutrition')} />
                {openCategories.nutrition && (
                    <div className="space-y-0.5 animate-fade-in pl-2 border-l border-amber-100 ml-4">
                        <NavItem indent label="Meal Plans" icon={<UtensilsIcon />} isActive={activeView === 'nutrition.planner'} onClick={() => onNavigate('nutrition.planner')} />
                        <NavItem indent label="Grocery List" icon={<ClipboardListIcon />} isActive={activeView === 'nutrition.pantry'} onClick={() => onNavigate('nutrition.pantry')} />
                        <NavItem indent label="Pantry Chef" icon={<ChefHatIcon />} isActive={activeView === 'nutrition.pantry_chef'} onClick={() => onNavigate('nutrition.pantry_chef')} />
                        <NavItem indent label="Dining Out" icon={<BarcodeIcon />} isActive={activeView === 'nutrition.dining'} onClick={() => onNavigate('nutrition.dining')} />
                        <NavItem indent label="Saved Recipes" icon={<BookOpenIcon />} isActive={activeView === 'nutrition.library'} onClick={() => onNavigate('nutrition.library')} />
                        <NavItem indent label="Prep Videos" icon={<VideoIcon />} isActive={activeView === 'nutrition.videos'} onClick={() => onNavigate('nutrition.videos')} />
                    </div>
                )}

                {/* 3. BODY + FITNESS */}
                <CategoryHeader label="Body + Fitness" color="text-emerald-500" isOpen={openCategories.physical} onClick={() => toggleCategory('physical')} />
                {openCategories.physical && (
                    <div className="space-y-0.5 animate-fade-in pl-2 border-l border-emerald-100 ml-4">
                        <NavItem indent label="3D Body Scan" icon={<UserCircleIcon />} isActive={activeView === 'physical.scan'} onClick={() => onNavigate('physical.scan')} />
                        <NavItem indent label="Body Pics" icon={<CameraIcon />} isActive={activeView === 'physical.pics'} onClick={() => onNavigate('physical.pics')} />
                        <NavItem indent label="Workout Log" icon={<DumbbellIcon />} isActive={activeView === 'physical.workout_log'} onClick={() => onNavigate('physical.workout_log')} />
                        <NavItem indent label="Exercise Plans" icon={<ClipboardCheckIcon />} isActive={activeView === 'physical.plans'} onClick={() => onNavigate('physical.plans')} />
                        <NavItem indent label="Form Checker" icon={<ActivityIcon />} isActive={activeView === 'physical.form_check'} onClick={() => onNavigate('physical.form_check')} />
                        <NavItem indent label="Running App" icon={<RunningIcon />} isActive={activeView === 'physical.run'} onClick={() => onNavigate('physical.run')} />
                    </div>
                )}

                {/* 4. MENTAL + MOTIVATION */}
                <CategoryHeader label="Mental + Motivation" color="text-violet-500" isOpen={openCategories.mental} onClick={() => toggleCategory('mental')} />
                {openCategories.mental && (
                    <div className="space-y-0.5 animate-fade-in pl-2 border-l border-violet-100 ml-4">
                        <NavItem indent label="Psych Quizzes" icon={<BrainIcon />} isActive={activeView === 'mental.assessments'} onClick={() => onNavigate('mental.assessments')} />
                        <NavItem indent label="Readiness Score" icon={<ActivityIcon />} isActive={activeView === 'mental.readiness'} onClick={() => onNavigate('mental.readiness')} />
                    </div>
                )}

                {/* 5. SLEEP */}
                <CategoryHeader label="Sleep" color="text-indigo-500" isOpen={openCategories.sleep} onClick={() => toggleCategory('sleep')} />
                {openCategories.sleep && (
                    <div className="space-y-0.5 animate-fade-in pl-2 border-l border-indigo-100 ml-4">
                        <NavItem indent label="Sleep Log" icon={<MoonIcon />} isActive={activeView === 'sleep.log'} onClick={() => onNavigate('sleep.log')} />
                        <NavItem indent label="Order Home Test" icon={<ClipboardCheckIcon />} isActive={activeView === 'sleep.order_test'} onClick={() => onNavigate('sleep.order_test')} />
                        <NavItem indent label="Oral Appliances" icon={<UserCircleIcon />} isActive={activeView === 'sleep.appliances'} onClick={() => onNavigate('sleep.appliances')} />
                        <NavItem indent label="Test Results" icon={<ActivityIcon />} isActive={activeView === 'sleep.results'} onClick={() => onNavigate('sleep.results')} />
                    </div>
                )}

                {/* 6. LABS */}
                <CategoryHeader label="Labs" color="text-cyan-500" isOpen={openCategories.labs} onClick={() => toggleCategory('labs')} />
                {openCategories.labs && (
                    <div className="space-y-0.5 animate-fade-in pl-2 border-l border-cyan-100 ml-4">
                        <NavItem indent label="Lab Results" icon={<BeakerIcon />} isActive={activeView === 'labs.results'} onClick={() => onNavigate('labs.results')} />
                        <NavItem indent label="Order Test Kits" icon={<ShoppingCartIcon />} isActive={activeView === 'labs.store'} onClick={() => onNavigate('labs.store')} />
                    </div>
                )}

                {/* 7. ROLES & BUSINESS TYPES */}
                <CategoryHeader label="Roles & Business Types" color="text-rose-500" isOpen={openCategories.roles} onClick={() => toggleCategory('roles')} />
                {openCategories.roles && (
                    <div className="space-y-0.5 animate-fade-in pl-2 border-l border-rose-100 ml-4">
                        
                        {/* Independent Coach */}
                        <SubCategoryHeader label="Independent Coach" isOpen={rolesSubCategories.independent} onClick={() => toggleRoleSubCategory('independent')} />
                        {rolesSubCategories.independent && (
                            <div className="animate-fade-in">
                                <NavItem superIndent label="Personal Trainer" icon={<UsersIcon />} isActive={activeView === 'roles.trainer'} onClick={() => onNavigate('roles.trainer')} />
                                <NavItem superIndent label="Nutrition Coach" icon={<UtensilsIcon />} isActive={activeView === 'roles.nutrition'} onClick={() => onNavigate('roles.nutrition')} />
                                <NavItem superIndent label="Sports Coach" icon={<TrophyIcon />} isActive={activeView === 'roles.sports'} onClick={() => onNavigate('roles.sports')} />
                                <NavItem superIndent label="Health & Wellness" icon={<HeartIcon />} isActive={activeView === 'roles.wellness'} onClick={() => onNavigate('roles.wellness')} />
                                <NavItem superIndent label="Influencer/Creator" icon={<BadgeCheckIcon />} isActive={activeView === 'roles.influencer'} onClick={() => onNavigate('roles.influencer')} />
                            </div>
                        )}

                        {/* Small to Medium Business */}
                        <SubCategoryHeader label="Small to Medium Business" isOpen={rolesSubCategories.smb} onClick={() => toggleRoleSubCategory('smb')} />
                        {rolesSubCategories.smb && (
                            <div className="animate-fade-in">
                                <NavItem superIndent label="Training Studios" icon={<DumbbellIcon />} isActive={activeView === 'roles.studio'} onClick={() => onNavigate('roles.studio')} />
                                <NavItem superIndent label="Gym" icon={<ActivityIcon />} isActive={activeView === 'roles.gym'} onClick={() => onNavigate('roles.gym')} />
                                <NavItem superIndent label="Health Center" icon={<BeakerIcon />} isActive={activeView === 'roles.clinic'} onClick={() => onNavigate('roles.clinic')} />
                            </div>
                        )}

                        {/* Large Business */}
                        <SubCategoryHeader label="Large Business" isOpen={rolesSubCategories.enterprise} onClick={() => toggleRoleSubCategory('enterprise')} />
                        {rolesSubCategories.enterprise && (
                            <div className="animate-fade-in">
                                <NavItem superIndent label="Fitness Club" icon={<UserGroupIcon />} isActive={activeView === 'roles.club'} onClick={() => onNavigate('roles.club')} />
                                <NavItem superIndent label="Recreation Center" icon={<ActivityIcon />} isActive={activeView === 'roles.rec'} onClick={() => onNavigate('roles.rec')} />
                                <NavItem superIndent label="Corporate Wellness" icon={<BriefcaseIcon />} isActive={activeView === 'roles.employer'} onClick={() => onNavigate('roles.employer')} />
                            </div>
                        )}

                        {/* Institutional & Other */}
                        <SubCategoryHeader label="Institutional & Other" isOpen={rolesSubCategories.institutional} onClick={() => toggleRoleSubCategory('institutional')} />
                        {rolesSubCategories.institutional && (
                            <div className="animate-fade-in">
                                <NavItem superIndent label="Health Systems" icon={<HeartIcon />} isActive={activeView === 'roles.health_systems'} onClick={() => onNavigate('roles.health_systems')} />
                                <NavItem superIndent label="Payors & Insurers" icon={<ClipboardCheckIcon />} isActive={activeView === 'roles.payor'} onClick={() => onNavigate('roles.payor')} />
                                <NavItem superIndent label="Government" icon={<GlobeAltIcon />} isActive={activeView === 'roles.government'} onClick={() => onNavigate('roles.government')} />
                                <NavItem superIndent label="Unions" icon={<UserGroupIcon />} isActive={activeView === 'roles.union'} onClick={() => onNavigate('roles.union')} />
                                <NavItem superIndent label="Logistics & Trucking" icon={<BriefcaseIcon />} isActive={activeView === 'roles.logistics'} onClick={() => onNavigate('roles.logistics')} />
                            </div>
                        )}
                    </div>
                )}

                {/* 8. REWARDS & HISTORY */}
                <CategoryHeader label="Rewards & History" color="text-blue-500" isOpen={openCategories.rewards} onClick={() => toggleCategory('rewards')} />
                {openCategories.rewards && (
                    <div className="space-y-0.5 animate-fade-in pl-2 border-l border-blue-100 ml-4">
                        <NavItem indent label="My Rewards" icon={<TrophyIcon />} isActive={activeView === 'rewards'} onClick={() => onNavigate('rewards')} />
                        <NavItem indent label="History" icon={<ClockIcon />} isActive={activeView === 'history'} onClick={() => onNavigate('history')} />
                    </div>
                )}

                {/* 9. MY ACCOUNT */}
                <CategoryHeader label="My Account" color="text-slate-500" isOpen={openCategories.account} onClick={() => toggleCategory('account')} />
                {openCategories.account && (
                    <div className="space-y-0.5 animate-fade-in pl-2 border-l border-slate-100 ml-4">
                        <NavItem indent label="Personalize / Setup" icon={<CogIcon />} isActive={activeView === 'account.setup'} onClick={() => onNavigate('account.setup')} />
                        <NavItem indent label="My Widgets" icon={<Squares2X2Icon />} isActive={activeView === 'account.widgets'} onClick={() => onNavigate('account.widgets')} />
                        <NavItem indent label="Device Sync" icon={<ActivityIcon />} isActive={activeView === 'account.sync'} onClick={() => onNavigate('account.sync')} />
                        <NavItem indent label="Pharmacy History" icon={<PillIcon />} isActive={activeView === 'account.pharmacy'} onClick={() => onNavigate('account.pharmacy')} />
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
