
import React, { useEffect, useState } from 'react';
import { BeakerIcon } from '../icons';
import * as apiService from '../../services/apiService';
import type { LabResult } from '../../types';

export const LabsCard: React.FC = () => {
    const [labs, setLabs] = useState<LabResult[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLabs = async () => {
            try {
                const data = await apiService.getLabs();
                setLabs(data);
            } catch (error) {
                console.error("Failed to load labs", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLabs();
    }, []);

    const getStatusColor = (status: string) => {
        if (status === 'Processing') return 'bg-blue-50 text-blue-600';
        if (status === 'Ordered') return 'bg-amber-50 text-amber-600';
        if (status === 'Results Ready') return 'bg-emerald-50 text-emerald-600';
        return 'bg-slate-50 text-slate-600';
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <BeakerIcon /> Labs
                </h3>
                <span className="text-xs text-emerald-600 font-bold cursor-pointer hover:underline">Details</span>
            </div>
            
            {loading ? (
                <div className="space-y-3">
                    <div className="h-10 bg-slate-100 rounded animate-pulse"></div>
                </div>
            ) : (
                <div className="space-y-3">
                    {labs.length === 0 ? (
                        <div className="text-center py-2">
                            <p className="text-xs text-slate-400 italic mb-2">No active labs found.</p>
                            <a href="https://shop.embracehealth.ai" target="_blank" rel="noreferrer" className="text-xs text-emerald-600 font-bold hover:underline">Browse Lab Tests</a>
                        </div>
                    ) : (
                        labs.map(lab => (
                            <div key={lab.id} className="flex justify-between items-center text-sm border-b border-slate-50 last:border-0 pb-2 last:pb-0">
                                <div>
                                    <p className="font-medium text-slate-700 truncate max-w-[150px]">{lab.name}</p>
                                    <p className="text-xs text-slate-400">{new Date(lab.date).toLocaleDateString()}</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusColor(lab.status)}`}>
                                    {lab.status}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
