
import React, { useEffect, useState } from 'react';
import type { Assessment } from '../../types';
import * as apiService from '../../services/apiService';
import { TestRunner } from './TestRunner';
import { ClipboardCheckIcon } from '../icons';

export const AssessmentHub: React.FC = () => {
    const [assessments, setAssessments] = useState<Assessment[]>([]);
    const [activeTest, setActiveTest] = useState<Assessment | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await apiService.getAssessments();
                setAssessments(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleComplete = async (responses: any) => {
        if (!activeTest) return;
        try {
            await apiService.submitAssessment(activeTest.id, responses);
            setActiveTest(null);
            alert("Assessment Complete! Points awarded.");
        } catch (err) {
            alert("Failed to save results.");
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading tests...</div>;

    if (activeTest) {
        return <TestRunner assessment={activeTest} onComplete={handleComplete} onClose={() => setActiveTest(null)} />;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <header className="flex items-center space-x-3 mb-8">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full">
                    <ClipboardCheckIcon />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Assessments</h2>
                    <p className="text-slate-500">Know yourself to find better matches.</p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {assessments.map(test => (
                    <div key={test.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-bold text-slate-800">{test.title}</h3>
                            <span className="bg-emerald-50 text-emerald-600 text-xs font-bold px-2 py-1 rounded border border-emerald-100">+50 pts</span>
                        </div>
                        <p className="text-slate-600 text-sm mb-6">{test.description}</p>
                        <button 
                            onClick={() => setActiveTest(test)}
                            className="w-full bg-indigo-50 text-indigo-700 font-bold py-2 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                            Start Assessment
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
