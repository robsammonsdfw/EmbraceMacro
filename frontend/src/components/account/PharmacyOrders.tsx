import React, { useEffect, useState } from 'react';
import type { Order } from '../../types';
import * as apiService from '../../services/apiService';
import { ClipboardListIcon, ClockIcon } from '../icons';

export const PharmacyOrders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      // EXACT MATCH: Calling the specific function from your apiService.ts
      const data = await apiService.getShopifyOrders();
      setOrders(data);
    } catch (err) {
      setError('Failed to load pharmacy orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'fulfilled') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (s === 'unfulfilled') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (s === 'partially_fulfilled') return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  if (loading) return <div className="p-8 text-center text-slate-400 font-bold tracking-widest text-xs uppercase">Loading order history...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
          <ClipboardListIcon className="w-5 h-5 text-indigo-500" /> Pharmacy Orders
        </h2>
        <button onClick={fetchOrders} className="text-xs font-bold text-indigo-500 hover:text-indigo-600 uppercase tracking-wider">
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 text-rose-600 rounded-lg text-sm font-bold border border-rose-200">
          {error}
        </div>
      )}

      {orders.length === 0 && !error ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
          <ClipboardListIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">No medication orders found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-black text-slate-800 text-sm uppercase tracking-wider">#{order.orderNumber}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-black tracking-widest border ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                    <ClockIcon className="w-3 h-3" />
                    {new Date(order.date).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-slate-800 text-lg">${order.total}</div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{order.paymentStatus}</div>
                </div>
              </div>

              <div className="space-y-2">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white rounded border border-slate-200 flex items-center justify-center">
                        <span className="text-xs font-black text-slate-400">{item.quantity}x</span>
                      </div>
                      <span className="text-sm font-bold text-slate-700">{item.title}</span>
                    </div>
                    
                    {item.url && (
                      <a 
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-white border border-indigo-200 px-3 py-1.5 rounded shadow-sm hover:bg-indigo-50 transition-colors"
                      >
                        Buy Again
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};