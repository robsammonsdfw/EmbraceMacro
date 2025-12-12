
import React from 'react';
import { ClipboardListIcon } from '../icons';

export const OrdersCard: React.FC = () => {
    // Placeholder data matching "Orders" context
    const orders = [
        { id: 1, item: 'GLP-1 Monthly', status: 'Shipped', date: 'Oct 24' },
        { id: 2, item: 'Protein Complex', status: 'Delivered', date: 'Oct 10' },
    ];

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <ClipboardListIcon /> Orders
                </h3>
                <span className="text-xs text-emerald-600 font-bold cursor-pointer">View All</span>
            </div>
            <div className="space-y-3">
                {orders.map(order => (
                    <div key={order.id} className="flex justify-between items-center text-sm border-b border-slate-50 last:border-0 pb-2 last:pb-0">
                        <div>
                            <p className="font-medium text-slate-700">{order.item}</p>
                            <p className="text-xs text-slate-400">{order.date}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            order.status === 'Shipped' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                            {order.status}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
