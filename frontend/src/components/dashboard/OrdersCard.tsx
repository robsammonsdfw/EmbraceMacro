
import React, { useState } from 'react';
import { ClipboardListIcon } from '../icons';
import type { Order } from '../../types';

export const OrdersCard: React.FC = () => {
    // Static dummy data as requested
    const [orders] = useState<Order[]>([
        {
            id: '1',
            orderNumber: 1024,
            date: new Date().toISOString(),
            total: '129.00',
            status: 'FULFILLED',
            paymentStatus: 'PAID',
            items: [{ title: 'Metabolic Reset Kit', quantity: 1 }]
        },
        {
            id: '2',
            orderNumber: 1025,
            date: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
            total: '45.00',
            status: 'UNFULFILLED',
            paymentStatus: 'PAID',
            items: [{ title: 'Vitamin D3 Supplements', quantity: 2 }]
        }
    ]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'FULFILLED': return 'bg-emerald-50 text-emerald-600';
            case 'UNFULFILLED': return 'bg-amber-50 text-amber-600';
            case 'PARTIALLY_FULFILLED': return 'bg-blue-50 text-blue-600';
            default: return 'bg-slate-50 text-slate-600';
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <ClipboardListIcon /> Orders
                </h3>
                <span className="text-xs text-emerald-600 font-bold cursor-pointer hover:underline">View All</span>
            </div>
            
            <div className="space-y-3">
                {orders.map(order => (
                    <div key={order.id} className="flex justify-between items-center text-sm border-b border-slate-50 last:border-0 pb-2 last:pb-0">
                        <div>
                            <p className="font-medium text-slate-700">
                                {order.items.length > 0 ? order.items[0].title : `Order #${order.orderNumber}`} 
                                {order.items.length > 1 && <span className="text-xs text-slate-400"> +{order.items.length - 1} more</span>}
                            </p>
                            <p className="text-xs text-slate-400">{new Date(order.date).toLocaleDateString()}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusColor(order.status)}`}>
                            {order.status || 'Pending'}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
