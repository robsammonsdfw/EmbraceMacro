
import React from 'react';
import { BeakerIcon } from '../icons';

export const LabsCard: React.FC = () => {
    // Placeholder data for Labs
    const labs = [
        { id: 1, name: 'Metabolic Panel', result: 'Normal', date: 'Sep 15' },
        { id: 2, name: 'Lipid Profile', result: 'Review', date: 'Sep 15' },
    ];

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <BeakerIcon /> Labs
                </h3>
                <span className="text-xs text-emerald-600 font-bold cursor-pointer">Details</span>
            </div>
            <div className="space-y-3">
                {labs.map(lab => (
                    <div key={lab.id} className="flex justify-between items-center text-sm border-b border-slate-50 last:border-0 pb-2 last:pb-0">
                        <div>
                            <p className="font-medium text-slate-700">{lab.name}</p>
                            <p className="text-xs text-slate-400">{lab.date}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            lab.result === 'Normal' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                            {lab.result}
                        </span>
                    </div>
                ))}
                {labs.length === 0 && <p className="text-xs text-slate-400 italic">No recent labs found.</p>}
            </div>
        </div>
    );
};
