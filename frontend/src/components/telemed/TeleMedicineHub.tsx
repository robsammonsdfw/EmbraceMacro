
import React, { useEffect, useState } from 'react';
import { PillIcon, ShoppingCartIcon, ActivityIcon, UserCircleIcon, HeartIcon, ClockIcon, BeakerIcon, GlobeAltIcon } from '../icons';
import { ShopifyProduct, ActiveView } from '../../types';
import * as apiService from '../../services/apiService';

interface TeleMedicineHubProps {
    view: ActiveView;
}

// Configuration for products mapped to views
const PRODUCT_MAP: Record<string, { label: string, handle: string, desc: string }[]> = {
    // Everyone
    'telemed.everyone.weight_loss': [
        { label: 'Semaglutide', handle: 'semaglutide', desc: 'GLP-1 Agonist for weight management.' },
        { label: 'Tirzepatide', handle: 'tirzepatide', desc: 'Dual GIP/GLP-1 receptor agonist.' }
    ],
    'telemed.everyone.lab_kits': [
        { label: 'Comprehensive Male Panel', handle: 'male-hormone-panel', desc: 'Complete biomarker analysis for men.' },
        { label: 'Comprehensive Female Panel', handle: 'female-hormone-panel', desc: 'Complete biomarker analysis for women.' },
        { label: 'Metabolic Health Panel', handle: 'metabolic-panel', desc: 'Insulin, Glucose, and Lipid analysis.' }
    ],
    'telemed.everyone.dna_kits': [
        { label: 'EmbraceDNA Genetic Test', handle: 'dna-test-kit', desc: 'Unlock your genetic blueprint for nutrition.' },
        { label: 'Epigenetic Age Test', handle: 'biological-age-test', desc: 'Measure your true biological age.' }
    ],
    // Combined Store View for Desktop
    'labs.store': [
        { label: 'Comprehensive Male Panel', handle: 'male-hormone-panel', desc: 'Complete biomarker analysis for men.' },
        { label: 'Comprehensive Female Panel', handle: 'female-hormone-panel', desc: 'Complete biomarker analysis for women.' },
        { label: 'Metabolic Health Panel', handle: 'metabolic-panel', desc: 'Insulin, Glucose, and Lipid analysis.' },
        { label: 'EmbraceDNA Genetic Test', handle: 'dna-test-kit', desc: 'Unlock your genetic blueprint for nutrition.' },
        { label: 'Epigenetic Age Test', handle: 'biological-age-test', desc: 'Measure your true biological age.' }
    ],

    // For Him
    'telemed.him.hair_loss': [
        { label: 'Finasteride', handle: 'finasteride', desc: 'Clinically proven hair loss treatment.' },
        { label: 'Oral Minoxidil', handle: 'oral-minoxidil', desc: 'Effective oral hair growth medication.' },
        { label: 'Topical Spray', handle: 'topical-spray', desc: 'Combined Finasteride & Minoxidil spray.' }
    ],
    'telemed.him.ed': [
        { label: 'Sildenafil', handle: 'sildenafil', desc: 'Treatment for erectile dysfunction (Generic Viagra).' },
        { label: 'Tadalafil', handle: 'tadalafil', desc: 'Treatment for erectile dysfunction (Generic Cialis).' }
    ],
    'telemed.him.low_t': [
        { label: 'Enclomiphene', handle: 'enclomiphene', desc: 'Boosts natural testosterone production.' },
        { label: 'TRT Cream', handle: 'trt-cream', desc: 'Topical testosterone replacement therapy.' }
    ],
    'telemed.him.pe': [
        { label: 'Sertraline', handle: 'sertraline', desc: 'Treatment for premature ejaculation.' }
    ],

    // For Her
    'telemed.her.menopause': [
        { label: 'Menopause Support', handle: 'menopause-kit', desc: 'Symptom relief and hormone balance.' }
    ],
    'telemed.her.estrogen': [
        { label: 'Estrogen Cream', handle: 'estrogen-cream', desc: 'Bioidentical hormone therapy.' },
        { label: 'Progesterone', handle: 'progesterone', desc: 'Hormone support therapy.' }
    ]
};

// Map views to external collection URLs
const CATEGORY_URLS: Record<string, string> = {
    'telemed.everyone.weight_loss': 'https://embracehealth.ai/collections/weight-loss',
    'telemed.everyone.lab_kits': 'https://embracehealth.ai/collections/lab-tests',
    'telemed.everyone.dna_kits': 'https://embracehealth.ai/collections/dna-tests',
    'labs.store': 'https://embracehealth.ai/collections/all-tests',
    'telemed.him.hair_loss': 'https://embracehealth.ai/collections/hair-loss',
    'telemed.him.ed': 'https://embracehealth.ai/collections/erectile-dysfunction',
    'telemed.him.low_t': 'https://embracehealth.ai/collections/low-testosterone',
    'telemed.him.pe': 'https://embracehealth.ai/collections/premature-ejaculation',
    'telemed.her.menopause': 'https://embracehealth.ai/collections/menopause',
    'telemed.her.estrogen': 'https://embracehealth.ai/collections/estrogen-therapy'
};

const ProductCard: React.FC<{ 
    label: string; 
    handle: string; 
    desc: string; 
    categoryUrl?: string;
}> = ({ label, handle, desc, categoryUrl }) => {
    const [product, setProduct] = useState<ShopifyProduct | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        apiService.getShopifyProduct(handle)
            .then(data => {
                if (isMounted) {
                    if (!('error' in data)) {
                        setProduct(data);
                    }
                    setLoading(false);
                }
            })
            .catch(() => {
                if (isMounted) setLoading(false);
            });
        return () => { isMounted = false; };
    }, [handle]);

    // Use category URL with hash for deep linking if available, otherwise fallback to product URL
    const buyUrl = categoryUrl ? `${categoryUrl}#${handle}` : (product?.url || '#');

    return (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col h-full hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-4">
                <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600">
                    <PillIcon className="w-6 h-6" />
                </div>
                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border tracking-wide ${product ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                    {product ? 'In Stock' : 'Available'}
                </span>
            </div>
            
            <h3 className="text-xl font-black text-slate-900 mb-1">{label}</h3>
            <p className="text-sm text-slate-500 font-medium mb-4 flex-grow">{desc}</p>

            {loading ? (
                <div className="h-12 bg-slate-50 rounded-2xl animate-pulse"></div>
            ) : (
                <div className="mt-auto">
                    <div className="space-y-4">
                        <div className="flex items-end gap-1">
                            {product ? (
                                <>
                                    <span className="text-2xl font-black text-slate-900">${parseFloat(product.price).toFixed(0)}</span>
                                    <span className="text-xs font-bold text-slate-400 mb-1 uppercase">{product.currency}</span>
                                </>
                            ) : (
                                <span className="text-lg font-black text-slate-800 flex items-center gap-1">
                                    View Options
                                </span>
                            )}
                        </div>
                        
                        {product?.imageUrl ? (
                            <img src={product.imageUrl} alt={label} className="w-full h-32 object-contain mb-4" />
                        ) : (
                            <div className="w-full h-32 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300 border border-slate-100 mb-4">
                                <PillIcon className="w-12 h-12 opacity-20" />
                            </div>
                        )}

                        <a 
                            href={buyUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block w-full py-3 bg-slate-900 text-white text-center rounded-xl font-black uppercase tracking-widest text-xs hover:bg-black transition-colors shadow-lg active:scale-95"
                        >
                            ORDER NOW
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
};

export const TeleMedicineHub: React.FC<TeleMedicineHubProps> = ({ view }) => {
    const getHeaderInfo = () => {
        switch(view) {
            // Everyone
            case 'telemed.everyone.weight_loss': return { title: 'Weight Loss', icon: <ActivityIcon className="w-8 h-8" />, color: 'text-emerald-500', bg: 'bg-emerald-100' };
            case 'telemed.everyone.lab_kits': return { title: 'Lab Diagnostics', icon: <BeakerIcon className="w-8 h-8" />, color: 'text-indigo-500', bg: 'bg-indigo-100' };
            case 'telemed.everyone.dna_kits': return { title: 'Genetics & DNA', icon: <GlobeAltIcon className="w-8 h-8" />, color: 'text-blue-500', bg: 'bg-blue-100' };
            case 'labs.store': return { title: 'Diagnostic Lab Store', icon: <ShoppingCartIcon className="w-8 h-8" />, color: 'text-cyan-500', bg: 'bg-cyan-100' };
            
            // Him
            case 'telemed.him.hair_loss': return { title: 'Hair Restoration', icon: <UserCircleIcon className="w-8 h-8" />, color: 'text-amber-500', bg: 'bg-amber-100' };
            case 'telemed.him.ed': return { title: 'Erectile Dysfunction', icon: <ActivityIcon className="w-8 h-8" />, color: 'text-blue-500', bg: 'bg-blue-100' };
            case 'telemed.him.low_t': return { title: 'Low Testosterone', icon: <HeartIcon className="w-8 h-8" />, color: 'text-rose-500', bg: 'bg-rose-100' };
            case 'telemed.him.pe': return { title: 'Premature Ejaculation', icon: <ClockIcon className="w-8 h-8" />, color: 'text-indigo-500', bg: 'bg-indigo-100' };

            // Her
            case 'telemed.her.menopause': return { title: 'Menopause Support', icon: <HeartIcon className="w-8 h-8" />, color: 'text-pink-500', bg: 'bg-pink-100' };
            case 'telemed.her.estrogen': return { title: 'Estrogen Therapy', icon: <PillIcon className="w-8 h-8" />, color: 'text-purple-500', bg: 'bg-purple-100' };

            default:
                return { title: 'Prescriptions - Rx', icon: <PillIcon className="w-8 h-8" />, color: 'text-slate-500', bg: 'bg-slate-100' };
        }
    };

    const header = getHeaderInfo();
    const products = PRODUCT_MAP[view] || [];
    const categoryUrl = CATEGORY_URLS[view];

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
                        <ProductCard key={idx} {...prod} categoryUrl={categoryUrl} />
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
