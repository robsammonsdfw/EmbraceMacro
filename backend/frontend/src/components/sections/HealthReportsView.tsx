
import React from 'react';
import { LabsCard } from '../dashboard/LabsCard';
import { OrdersCard } from '../dashboard/OrdersCard';
import { BeakerIcon } from '../icons';

export const HealthReportsView: React.FC = () => {
    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-fade-in">
            <header>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <BeakerIcon className="w-8 h-8 text-emerald-500" />
                    Clinical Reports
                </h2>
                <p className="text-slate-500 font-medium mt-2">View your lab results, biomarker analysis, and kit orders.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h3 className="font-bold text-slate-700 uppercase tracking-widest text-xs">Recent Labs</h3>
                    <LabsCard />
                </div>
                <div className="space-y-4">
                    <h3 className="font-bold text-slate-700 uppercase tracking-widest text-xs">Order History</h3>
                    <OrdersCard />
                </div>
            </div>

            <section className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center">
                <div className="max-w-md mx-auto">
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Connect Provider</h3>
                    <p className="text-slate-500 text-sm mb-6">Link your Quest Diagnostics or LabCorp account to automatically sync your latest bloodwork.</p>
                    <button className="bg-indigo-600 text-white font-black uppercase tracking-widest text-xs px-8 py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg active:scale-95">
                        Link Account
                    </button>
                </div>
            </section>
        </div>
    );
};
