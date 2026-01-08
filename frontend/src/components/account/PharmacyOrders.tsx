
import React from 'react';
import { PillIcon, ShoppingCartIcon } from '../icons';
import { OrdersCard } from '../dashboard/OrdersCard';

export const PharmacyOrders: React.FC = () => {
    const handleShopRedirect = () => {
        // In a real scenario, this would redirect to your Shopify storefront URL
        alert("Redirecting to EmbraceHealth Pharmacy Storefront...");
        // window.open('https://your-store.myshopify.com', '_blank');
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
            <header className="text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <div className="mx-auto md:mx-0 bg-rose-100 text-rose-600 p-4 rounded-full w-20 h-20 flex items-center justify-center mb-4 shadow-inner">
                        <PillIcon className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Pharmacy & Orders</h2>
                    <p className="text-slate-500 font-medium mt-2">Manage prescriptions and track shipments.</p>
                </div>
                
                <button 
                    onClick={handleShopRedirect}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest text-xs px-8 py-4 rounded-2xl shadow-lg shadow-emerald-200 active:scale-95 transition-all flex items-center gap-2"
                >
                    <ShoppingCartIcon className="w-5 h-5" />
                    <span>Shop Store</span>
                </button>
            </header>

            <div className="grid grid-cols-1 gap-8">
                {/* Active Orders / History */}
                <div className="space-y-4">
                    <h3 className="font-black text-slate-700 uppercase tracking-widest text-xs ml-1">Order History</h3>
                    <OrdersCard />
                </div>

                {/* Info Card */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                    <div className="bg-white p-4 rounded-2xl shadow-sm text-indigo-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h4 className="font-bold text-indigo-900 text-sm mb-1">Need help with a prescription?</h4>
                        <p className="text-xs text-indigo-700 leading-relaxed">
                            If your order contains prescription medications, tracking information will be updated once clinical approval is complete. Contact support for urgent refills.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
