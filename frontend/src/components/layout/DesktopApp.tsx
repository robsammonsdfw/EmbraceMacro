
import React, { useState } from 'react';
import { 
    HomeIcon, DumbbellIcon, BrainIcon, SparklesIcon, 
    UsersIcon, BeakerIcon, ActivityIcon, PlusIcon, 
    BookOpenIcon, ClipboardListIcon, UtensilsIcon,
    UserCircleIcon, TrophyIcon, HeartIcon
} from '../icons';
import type { HealthStats, UserDashboardPrefs } from '../../types';

// Import Views
import { FuelSection } from '../sections/FuelSection';
import { BodyHub } from '../body/BodyHub';
import { CoachingHub } from '../coaching/CoachingHub';
import { SocialManager } from '../social/SocialManager';
import { RewardsDashboard } from '../RewardsDashboard';
import { LabsCard } from '../dashboard/LabsCard';
import { MealPlanManager } from '../MealPlanManager'; // Direct use for right pane

interface DesktopAppProps {
    healthStats: HealthStats;
    dashboardPrefs: UserDashboardPrefs;
    fuelProps: any;
    bodyProps: any;
    userRole: 'coach' | 'user';
    onLogout: () => void;
    user?: any;
}

type Module = 'dashboard' | 'physical' | 'mental' | 'spiritual' | 'clients';

export const DesktopApp: React.FC<DesktopAppProps> = ({ 
    healthStats, dashboardPrefs, fuelProps, bodyProps, userRole, onLogout, user
}) => {
    const [activeModule, setActiveModule] = useState<Module>('dashboard');
    const [rightPaneMode, setRightPaneMode] = useState<'planner' | 'config'>('planner');

    const SidebarItem = ({ id, icon, label }: { id: Module, icon: React.ReactNode, label: string }) => (
        <button 
            onClick={() => setActiveModule(id)}
            className={`w-full p-4 flex flex-col items-center gap-1 transition-colors ${activeModule === id ? 'text-emerald-500 bg-emerald-50 border-r-4 border-emerald-500' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
            title={label}
        >
            <div className="w-6 h-6">{icon}</div>
            <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
        </button>
    );

    const renderCenterPane = () => {
        if (activeModule === 'dashboard') {
            return (
                <div className="p-8 space-y-8 desktop-density overflow-y-auto h-full">
                    <header className="flex justify-between items-center border-b border-slate-200 pb-6">
                        <div>
                            <h1 className="text-3xl font-black text-slate-800">Command Center</h1>
                            <p className="text-slate-500 font-medium">Business Intelligence View</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="text-right">
                                <p className="text-xs font-bold text-slate-400 uppercase">Health Score</p>
                                <p className="text-2xl font-black text-emerald-500">850</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold text-slate-400 uppercase">Active Clients</p>
                                <p className="text-2xl font-black text-indigo-500">{userRole === 'coach' ? '12' : '--'}</p>
                            </div>
                        </div>
                    </header>

                    {/* Analytics Row */}
                    <div className="grid grid-cols-3 gap-6">
                        <div className="chart-container h-64 bg-white rounded-xl shadow-sm p-4">
                            <h3 className="font-bold text-slate-700 text-xs uppercase mb-4">Caloric Trend (30d)</h3>
                            <div className="h-full flex items-end justify-center text-slate-300 bg-slate-50 rounded">
                                [Area Chart Placeholder]
                            </div>
                        </div>
                        <div className="chart-container h-64 bg-white rounded-xl shadow-sm p-4">
                            <h3 className="font-bold text-slate-700 text-xs uppercase mb-4">Activity Volume</h3>
                            <div className="h-full flex items-end justify-center text-slate-300 bg-slate-50 rounded">
                                [Bar Chart Placeholder]
                            </div>
                        </div>
                        <div className="chart-container h-64 bg-white rounded-xl shadow-sm p-4 flex flex-col">
                            <h3 className="font-bold text-slate-700 text-xs uppercase mb-4">Digital Twin Status</h3>
                            <div className="flex-grow flex items-center justify-center">
                                <UserCircleIcon className="w-32 h-32 text-indigo-100" />
                            </div>
                            <button className="mt-auto w-full py-2 bg-indigo-50 text-indigo-600 font-bold text-xs rounded uppercase">Open 3D View</button>
                        </div>
                    </div>

                    {/* Report Tables */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700">Recent Clinical Reports</h3>
                            <button className="text-xs text-emerald-600 font-bold uppercase">View All</button>
                        </div>
                        <div className="p-4">
                            <LabsCard />
                        </div>
                    </div>
                </div>
            );
        }

        if (activeModule === 'physical') {
            return (
                <div className="h-full overflow-y-auto p-4 desktop-density">
                    <FuelSection {...fuelProps} />
                </div>
            );
        }

        if (activeModule === 'mental') {
            return (
                <div className="h-full overflow-y-auto p-8 desktop-density">
                    <div className="grid grid-cols-2 gap-8">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="font-black text-slate-800 mb-4">Daily Readiness</h3>
                            <div className="flex items-center gap-4">
                                <div className="text-5xl font-black text-emerald-500">92</div>
                                <p className="text-sm text-slate-600">Optimal recovery detected. Push hard today.</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="font-black text-slate-800 mb-4">Cognitive Load</h3>
                            <div className="flex items-center gap-4">
                                <div className="text-5xl font-black text-amber-500">Low</div>
                                <p className="text-sm text-slate-600">Mental stress is within baseline limits.</p>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (activeModule === 'clients') {
            return (
                <div className="h-full overflow-y-auto p-4 desktop-density">
                    <CoachingHub userRole={userRole} onUpgrade={() => {}} />
                </div>
            );
        }

        return <div className="p-8">Module Under Construction</div>;
    };

    return (
        <div className="desktop-grid-container font-sans text-slate-900 bg-slate-100">
            {/* PANE 1: Sidebar (80px) */}
            <aside className="bg-slate-900 flex flex-col items-center py-6 border-r border-slate-800 z-20">
                <div className="mb-8">
                    <img src="/logo.png" className="w-8 h-8 opacity-80" alt="" />
                </div>
                <nav className="flex-grow space-y-2 w-full">
                    <SidebarItem id="dashboard" icon={<HomeIcon />} label="Home" />
                    <SidebarItem id="physical" icon={<DumbbellIcon />} label="Phys" />
                    <SidebarItem id="mental" icon={<BrainIcon />} label="Ment" />
                    <SidebarItem id="spiritual" icon={<SparklesIcon />} label="Spirit" />
                    {userRole === 'coach' && <SidebarItem id="clients" icon={<UsersIcon />} label="CRM" />}
                </nav>
                <button onClick={onLogout} className="mt-auto text-slate-500 hover:text-rose-500 p-2">
                    <span className="text-[9px] font-black uppercase">Exit</span>
                </button>
            </aside>

            {/* PANE 2: Center Analysis (Fluid) */}
            <main className="bg-slate-50 overflow-hidden relative">
                {renderCenterPane()}
            </main>

            {/* PANE 3: Management (350px) */}
            <aside className="bg-white border-l border-slate-200 flex flex-col h-full z-10 shadow-xl">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setRightPaneMode('planner')}
                            className={`px-3 py-1 text-[10px] font-black uppercase rounded ${rightPaneMode === 'planner' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-slate-200'}`}
                        >
                            Planner
                        </button>
                        <button 
                            onClick={() => setRightPaneMode('config')}
                            className={`px-3 py-1 text-[10px] font-black uppercase rounded ${rightPaneMode === 'config' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-slate-200'}`}
                        >
                            Config
                        </button>
                    </div>
                    <ActivityIcon className="text-slate-300 w-4 h-4" />
                </div>

                <div className="flex-grow overflow-y-auto p-4 desktop-density">
                    {rightPaneMode === 'planner' ? (
                        <div className="space-y-6">
                            {/* Condensed Meal Planner View */}
                            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
                                <h4 className="font-bold text-indigo-800 text-xs uppercase mb-2 flex items-center gap-2">
                                    <UtensilsIcon className="w-3 h-3" /> Today's Agenda
                                </h4>
                                <ul className="space-y-2">
                                    <li className="flex justify-between text-xs bg-white p-2 rounded shadow-sm">
                                        <span className="font-bold text-slate-700">Breakfast</span>
                                        <span className="text-slate-500">Oatmeal & Berries</span>
                                    </li>
                                    <li className="flex justify-between text-xs bg-white p-2 rounded shadow-sm">
                                        <span className="font-bold text-slate-700">Lunch</span>
                                        <span className="text-slate-500">Grilled Chicken Salad</span>
                                    </li>
                                    <li className="flex justify-between text-xs bg-white p-2 rounded shadow-sm border-l-2 border-amber-400">
                                        <span className="font-bold text-slate-700">Dinner</span>
                                        <span className="text-amber-600 font-bold">Not Planned</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Reuse the Logic Component but styled for sidebar */}
                            <div className="scale-90 origin-top -ml-4 w-[110%]">
                                <MealPlanManager 
                                    plans={fuelProps.plans} 
                                    activePlanId={fuelProps.activePlanId} 
                                    savedMeals={fuelProps.savedMeals}
                                    onPlanChange={fuelProps.onPlanChange}
                                    onCreatePlan={fuelProps.onCreatePlan}
                                    onRemoveFromPlan={fuelProps.onRemoveFromPlan}
                                    onQuickAdd={fuelProps.onQuickAdd}
                                    onGenerateMedical={fuelProps.onGenerateMedical}
                                    medicalPlannerState={fuelProps.medicalPlannerState}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Mobile Configurator</h3>
                            <div className="space-y-4">
                                <div className="p-3 border rounded-lg">
                                    <label className="text-xs font-bold text-slate-500 block mb-1">Active Journey</label>
                                    <select className="w-full text-sm font-bold bg-slate-50 p-2 rounded border border-slate-200">
                                        <option>Weight Loss</option>
                                        <option>Muscle Gain</option>
                                    </select>
                                </div>
                                <div className="p-3 border rounded-lg">
                                    <label className="text-xs font-bold text-slate-500 block mb-1">Daily Calorie Goal</label>
                                    <input type="number" className="w-full text-sm font-bold bg-slate-50 p-2 rounded border border-slate-200" defaultValue={2000} />
                                </div>
                                <button className="w-full py-2 bg-slate-800 text-white font-bold text-xs uppercase rounded hover:bg-slate-900">
                                    Push to Mobile
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
};
