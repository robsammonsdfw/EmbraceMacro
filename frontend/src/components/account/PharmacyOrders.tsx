import React, { useEffect, useState } from 'react';
import { api } from '../../services/apiService';
import { Order } from '../../types';
import { Package, ExternalLink, AlertCircle, RefreshCw } from 'lucide-react';

const PharmacyOrders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const data = await api.get('/shopify/orders');
      setOrders(data);
    } catch (err) {
      setError('Failed to load pharmacy orders');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading order history...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800">Pharmacy Orders</h2>
        <button onClick={fetchOrders} className="p-2 hover:bg-slate-100 rounded-full">
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {orders.length === 0 && !error ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No medication orders found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-600">#{order.orderNumber}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      order.status === 'FULFILLED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {new Date(order.date).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-800">${order.total}</div>
                  <div className="text-xs text-slate-400">{order.paymentStatus}</div>
                </div>
              </div>

              <div className="space-y-2">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white rounded border border-slate-200 flex items-center justify-center">
                        <span className="text-xs font-bold text-slate-400">{item.quantity}x</span>
                      </div>
                      <span className="text-sm font-medium text-slate-700">{item.title}</span>
                    </div>
                    
                    {/* FIX: Use item.url from backend to ensure we link to Collection/Group page */}
                    {item.url && (
                      <a 
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        Buy Again <ExternalLink className="w-3 h-3" />
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

export default PharmacyOrders;