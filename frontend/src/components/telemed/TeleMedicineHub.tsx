
import React, { useEffect, useState } from 'react';
import { PillIcon, ShoppingCartIcon, ActivityIcon, UserCircleIcon, HeartIcon } from '../icons';
import { ShopifyProduct, ActiveView } from '../../types';
import * as apiService from '../../services/apiService';

interface TeleMedicineHubProps {
    view: ActiveView;
}

// Configuration for products mapped to views
const PRODUCT_MAP: Record<string, { label: string, handle: string, desc: string }[]> = {
    'telemed.weight_loss': [
        { label: 'Semaglutide', handle: 'semaglutide', desc: 'GLP-1 Agonist for weight management.' },
        { label: 'Tirzepatide', handle: 'tirzepatide', desc: 'Dual GIP/GLP-1 receptor agonist.' }
    ],
    'telemed.rx_mens': [
        { label: 'Sildenafil', handle: 'sildenafil', desc: 'Treatment for erectile dysfunction (Generic Viagra).' },
        { label: 'Tadalafil', handle: 'tadalafil', desc: 'Treatment for erectile dysfunction (Generic Cialis).' },
        { label: 'Finasteride', handle: 'finasteride', desc: 'Treatment for hair loss.' },
        { label: 'Oral Minoxidil', handle: 'oral-minoxidil', desc: 'Oral treatment for hair regrowth.' },
        { label: 'Enclomiphene', handle: 'enclomiphene', desc: 'Testosterone support.' },
        { label: 'Sertraline', handle: 'sertraline', desc: 'Treatment for premature ejaculation.' }
    ],
    'telemed.hair_loss': [
        { label: 'Finasteride', handle: 'finasteride', desc: 'Clinically proven hair loss treatment.' },
        { label: 'Oral Minoxidil', handle: 'oral-minoxidil', desc: 'Effective oral hair growth medication.' },
        { label: 'Topical Spray', handle: 'topical-spray', desc: 'Combined Finasteride & Minoxidil spray.' }
    ],
    'telemed.low_t': [
        { label: 'Enclomiphene', handle: 'enclomiphene', desc: 'Boosts natural testosterone production.' },
        { label: 'TRT Cream', handle: 'trt-cream', desc: 'Topical testosterone replacement therapy.' }
    ]
};

const ProductCard: React.FC<{ 
    label: string; 
    handle: string; 
    desc: string; 
}> = ({ label, handle, desc }) => {
    const [product, setProduct] = useState<ShopifyProduct | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        apiService.getShopifyProduct(handle)
            .then(data => {
                if (isMounted) {
                    if ('error' in data) {
                        // Product not found or error, likely because handles are placeholders
                        // We will just not set the product but keep the card layout
                        console.warn(`Product ${handle} not found in Shopify`);
                        setError(true);
                    } else {
                        setProduct(data);
                    }
                    setLoading(false);
                }
            })
            .catch(() => {
                if (isMounted) {
                    setError(true);
                    setLoading(false);
                }
            });
        return () => { isMounted = false; };
    }, [handle]);

    const buyUrl = product?.url || '#';

    return (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col h-full hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-4">
                <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600">
                    <PillIcon className="w-6 h-6" />
                </div>
                {product && (
                    <span className="bg-emerald-50 text-emerald-700 font-black text-xs px-2 py-1 rounded-lg border border-emerald-100 uppercase tracking-wide">
                        In Stock
                    </span>
                )}
            </div>
            
            <h3 className="text-xl font-black text-slate-900 mb-1">{label}</h3>
            <p className="text-sm text-slate-500 font-medium mb-4 flex-grow">{desc}</p>

            {loading ? (
                <div className="h-12 bg-slate-50 rounded-2xl animate-pulse"></div>
            ) : (
                <div className="mt-auto">
                    {product ? (
                        <div className="space-y-4">
                            <div className="flex items-end gap-1">
                                <span className="text-2xl font-black text-slate-900">${parseFloat(product.price).toFixed(0)}</span>
                                <span className="text-xs font-bold text-slate-400 mb-1 uppercase">{product.currency}</span>
                            </div>
                            {product.imageUrl && (
                                <img src={product.imageUrl} alt={label} className="w-full h-32 object-contain mb-4" />
                            )}
                            <a 
                                href={buyUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="block w-full py-3 bg-slate-900 text-white text-center rounded-xl font-black uppercase tracking-widest text-xs hover:bg-black transition-colors shadow-lg active:scale-95"
                            >
                                Buy Now
                            </a>
                        </div>
                    ) : (
                        <div className="bg-slate-50 p-4 rounded-xl text-center">
                            <p className="text-xs text-slate-400 font-bold uppercase">Product Unavailable</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const TeleMedicineHub: React.FC<TeleMedicineHubProps> = ({ view }) => {
    const getHeaderInfo = () => {
        switch(view) {
            case 'telemed.weight_loss':
                return { title: 'Metabolic Weight Loss', icon: <ActivityIcon className="w-8 h-8" />, color: 'text-emerald-500', bg: 'bg-emerald-100' };
            case 'telemed.rx_mens':
                return { title: "Men's Health (Rx)", icon: <UserCircleIcon className="w-8 h-8" />, color: 'text-blue-500', bg: 'bg-blue-100' };
            case 'telemed.hair_loss':
                return { title: 'Hair Restoration', icon: <UserCircleIcon className="w-8 h-8" />, color: 'text-amber-500', bg: 'bg-amber-100' };
            case 'telemed.low_t':
                return { title: 'Hormone Optimization', icon: <HeartIcon className="w-8 h-8" />, color: 'text-rose-500', bg: 'bg-rose-100' };
            default:
                return { title: 'Tele-Medicine Clinic', icon: <PillIcon className="w-8 h-8" />, color: 'text-indigo-500', bg: 'bg-indigo-100' };
        }
    };

    const header = getHeaderInfo();
    const products = PRODUCT_MAP[view] || [];

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-fade-in">
            <header className="flex items-center gap-4">
                <div className={`p-4 rounded-full ${header.bg} ${header.color}`}>
                    {header.icon}
                </div>
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">{header.title}</h2>
                    <p className="text-slate-500 font-medium text-lg">Clinical-grade treatments delivered to your door.</p>
                </div>
            </header>

            <div className="bg-indigo-900 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-10">
                    <ShoppingCartIcon className="w-64 h-64" />
                </div>
                <div className="relative z-10 max-w-2xl">
                    <div className="inline-block bg-indigo-800 border border-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
                        Physician Approved
                    </div>
                    <h3 className="text-2xl font-black mb-4">How it works</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="flex items-start gap-3">
                            <div className="bg-indigo-500 w-8 h-8 rounded-full flex items-center justify-center font-black shrink-0">1</div>
                            <p className="text-sm font-medium text-indigo-100">Choose your treatment plan below.</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="bg-indigo-500 w-8 h-8 rounded-full flex items-center justify-center font-black shrink-0">2</div>
                            <p className="text-sm font-medium text-indigo-100">Complete a quick medical intake form.</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="bg-indigo-500 w-8 h-8 rounded-full flex items-center justify-center font-black shrink-0">3</div>
                            <p className="text-sm font-medium text-indigo-100">Meds shipped discreetly to you.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.length > 0 ? (
                    products.map((prod, idx) => (
                        <ProductCard key={idx} {...prod} />
                    ))
                ) : (
                    <div className="col-span-full text-center py-12 text-slate-400 font-medium">
                        No treatments currently listed for this category.
                    </div>
                )}
            </div>
        </div>
    );
};
