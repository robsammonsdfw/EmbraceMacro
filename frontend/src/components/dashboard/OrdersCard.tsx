import React, { useState, useEffect } from 'react';
import { ClipboardListIcon, CheckIcon, ClockIcon } from '../icons'; 
import type { Order } from '../../types';
import * as apiService from '../../services/apiService';

export const OrdersCard: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const data = await apiService.getShopifyOrders();
                setOrders(data);
            } catch (err) {
                console.error(err);
                setError("Could not load orders.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrders();
    }, []);

    const toggleExpand = (id: string) => {
        setExpandedOrderId(expandedOrderId === id ? null : id);
    };

    const getStatusColor = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'fulfilled') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        if (s === 'unfulfilled') return 'bg-amber-100 text-amber-700 border-amber-200';
        if (s === 'partially_fulfilled') return 'bg-blue-100 text-blue-700 border-blue-200';
        return 'bg-slate-100 text-slate-600 border-slate-200';
    };

    const getPaymentColor = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'paid') return 'text-emerald-600';
        if (s === 'pending') return 'text-amber-600';
        return 'text-slate-500';
    };

    if (isLoading) return <div className="p-4 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">Loading History...</div>;
    if (error) return <div className="p-4 text-center text-rose-500 text-xs font-bold">{error}</div>;
    if (orders.length === 0) return <div className="p-4 text-center text-slate-400 text-sm">No orders found. Link your account to see history.</div>;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-black text-slate-800 flex items-center gap-2 text-sm uppercase tracking-tight">
                    <ClipboardListIcon className="w-4 h-4 text-indigo-500" /> Order History
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{orders.length} Records</span>
            </div>
            
            <div className="divide-y divide-slate-50">
                {orders.map(order => (
                    <div key={order.id} className="group">
                        <div 
                            onClick={() => toggleExpand(order.id)}
                            className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-black text-slate-800 text-sm">#{order.orderNumber}</span>
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${getStatusColor(order.status)}`}>
                                        {order.status}
                                    </span>
                                </div>
                                <span className="font-bold text-slate-900 text-sm">${order.total}</span>
                            </div>
                            
                            <div className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-1 text-slate-400 font-medium">
                                    <ClockIcon className="w-3 h-3" />
                                    {new Date(order.date).toLocaleDateString()}
                                </div>
                                <span className={`font-bold uppercase text-[10px] tracking-wider ${getPaymentColor(order.paymentStatus)}`}>
                                    {order.paymentStatus}
                                </span>
                            </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedOrderId === order.id && (
                            <div className="bg-slate-50 p-4 border-t border-slate-100 animate-fade-in">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Items</h4>
                                <div className="space-y-3">
                                    {order.items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-indigo-50 rounded-md flex items-center justify-center text-indigo-200">
                                                    <CheckIcon className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 text-xs">{item.title}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Qty: {item.quantity}</p>
                                                </div>
                                            </div>
                                            
                                            {/* Valid Buy Again Button */}
                                            {item.url && (
                                                <a 
                                                    href={item.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[10px] font-black uppercase tracking-wider text-indigo-600 border border-indigo-200 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                                                >
                                                    Buy Again
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};