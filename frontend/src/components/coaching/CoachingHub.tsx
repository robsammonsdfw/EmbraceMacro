
import React, { useState, useEffect } from 'react';
import * as apiService from '../../services/apiService';
import { CoachingRelation } from '../../types';
import { UsersIcon, UserCircleIcon, PlusIcon, XIcon, ActivityIcon, CheckIcon, TrophyIcon, BeakerIcon } from '../icons';

interface CoachingHubProps {
    userRole: 'coach' | 'user';
    onUpgrade: () => void;
}

export const CoachingHub: React.FC<CoachingHubProps> = ({ userRole, onUpgrade }) => {
    const [tab, setTab] = useState<'practice' | 'care'>('practice');
    const [clientEmail, setClientEmail] = useState('');
    const [asCoachRelations, setAsCoachRelations] = useState<CoachingRelation[]>([]);
    const [asClientRelations, setAsClientRelations] = useState<CoachingRelation[]>([]);
    const [loading, setLoading] = useState(true);
    const [isInviting, setIsInviting] = useState(false);
    const [isUpgrading, setIsUpgrading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const [coachRel, clientRel] = await Promise.all([
                apiService.getCoachingRelations('coach'),
                apiService.getCoachingRelations('client')
            ]);
            setAsCoachRelations(coachRel);
            setAsClientRelations(clientRel);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleUpgrade = async () => {
        setIsUpgrading(true);
        try {
            await onUpgrade();
        } finally {
            setIsUpgrading(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientEmail.trim()) return;
        setIsInviting(true);
        try {
            await apiService.inviteClient(clientEmail);
            alert(`Coaching invitation sent to ${clientEmail}!`);
            setClientEmail('');
            loadData();
        } catch (err: any) {
            alert(err.message || "Could not invite client.");
        } finally {
            setIsInviting(false);
        }
    };

    const handleRespond = async (id: string, status: 'active' | 'rejected') => {
        try {
            await apiService.respondToCoachingInvite(id, status);
            loadData();
        } catch (e) {
            alert("Response failed.");
        }
    };

    const handleRevoke = async (id: string) => {
        if (!window.confirm("Are you sure you want to end this coaching relationship?")) return;
        try {
            await apiService.revokeCoachingAccess(id);
            loadData();
        } catch (e) {
            alert("Revoke failed.");
        }
    };

    if (loading) return <div className="p-12 text-center text-slate-500 animate-pulse">Synchronizing professional data...</div>;

    // --- Onboarding / Upgrade View for Standard Users ---
    if (userRole !== 'coach' && tab === 'practice') {
        return (
            <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-fade-in">
                <div className="bg-white rounded-[3rem] p-12 shadow-2xl border border-slate-100 text-center space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-20 opacity-5 -mr-10">
                        <TrophyIcon className="w-64 h-64" />
                    </div>
                    <div className="relative z-10 space-y-6">
                        <div className="mx-auto w-24 h-24 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-xl rotate-3">
                            <ActivityIcon className="w-12 h-12" />
                        </div>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Become a Professional Coach</h2>
                        <p className="text-xl text-slate-500 max-w-xl mx-auto font-medium">
                            Take control of your clients' health journeys with medical-grade proxy access, meal planning, and biometric tracking.
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left py-6">
                            <div className="p-6 bg-slate-50 rounded-3xl">
                                <BeakerIcon className="text-indigo-600 mb-3" />
                                <h4 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-2">Proxy Control</h4>
                                <p className="text-sm text-slate-500">Act as your client to view their 3D scans and daily nutrition.</p>
                            </div>
                            <div className="p-6 bg-slate-50 rounded-3xl">
                                <PlusIcon className="text-indigo-600 mb-3" />
                                <h4 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-2">Prescribed Plans</h4>
                                <p className="text-sm text-slate-500">Remotely build meal plans and grocery lists for your roster.</p>
                            </div>
                            <div className="p-6 bg-slate-50 rounded-3xl">
                                <UsersIcon className="text-indigo-600 mb-3" />
                                <h4 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-2">Roster Management</h4>
                                <p className="text-sm text-slate-500">Manage unlimited clients and track their metabolic compliance.</p>
                            </div>
                        </div>

                        <button 
                            onClick={handleUpgrade}
                            disabled={isUpgrading}
                            className="w-full py-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-2xl transform active:scale-95 transition-all text-lg flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {isUpgrading ? 'Activating Profile...' : 'Activate Professional Profile'}
                            <CheckIcon className="w-6 h-6" />
                        </button>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Limited-time Beta Access</p>
                    </div>
                </div>

                <div className="flex justify-center">
                    <button 
                        onClick={() => setTab('care')}
                        className="text-slate-400 hover:text-slate-600 font-bold text-sm uppercase tracking-widest"
                    >
                        Switch to "My Care Team"
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-fade-in">
            <header className="text-center md:text-left flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Coaching Hub</h2>
                    <p className="text-slate-500 font-medium text-lg">Manage professional clinical relationships.</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 w-full md:w-auto shadow-inner">
                    <button 
                        onClick={() => setTab('practice')}
                        className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-sm font-black transition-all ${tab === 'practice' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        My Practice
                    </button>
                    <button 
                        onClick={() => setTab('care')}
                        className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-sm font-black transition-all ${tab === 'care' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        My Care Team
                    </button>
                </div>
            </header>

            {tab === 'practice' ? (
                <div className="space-y-6">
                    {/* Invite Section */}
                    <section className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl"></div>
                        <div className="relative z-10">
                            <h3 className="text-2xl font-black mb-1 flex items-center gap-2">
                                <PlusIcon className="w-6 h-6 text-emerald-400" /> 
                                Invite a New Client
                            </h3>
                            <p className="text-slate-400 mb-6 font-medium">Enter the email of an existing user to request coaching access.</p>
                            <form onSubmit={handleInvite} className="flex gap-3">
                                <input 
                                    type="email" 
                                    placeholder="client@example.com" 
                                    value={clientEmail}
                                    onChange={e => setClientEmail(e.target.value)}
                                    className="flex-grow p-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-white placeholder-slate-500"
                                    required
                                />
                                <button 
                                    type="submit" 
                                    disabled={isInviting}
                                    className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg active:scale-95 disabled:opacity-50"
                                >
                                    {isInviting ? 'Inviting...' : 'Send Invite'}
                                </button>
                            </form>
                        </div>
                    </section>

                    {/* Practice List */}
                    <section className="space-y-4">
                        <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs flex items-center gap-2">
                            <UsersIcon className="w-4 h-4" /> Professional Roster
                        </h3>
                        {asCoachRelations.length === 0 ? (
                            <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
                                <UsersIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                <p className="text-slate-400 font-medium">You don't have any clients yet. Use the tool above to invite someone to your practice.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {asCoachRelations.map(rel => (
                                    <div key={rel.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white ${rel.status === 'pending' ? 'bg-amber-400' : 'bg-indigo-500'}`}>
                                                {rel.clientEmail?.[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 leading-tight">{rel.clientName || rel.clientEmail}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${rel.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                                        {rel.status}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-bold">Since {new Date(rel.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleRevoke(rel.id)}
                                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                            title="Remove Client"
                                        >
                                            <XIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Incoming Requests */}
                    <section className="space-y-4">
                        <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs flex items-center gap-2">
                            <ActivityIcon className="w-4 h-4 text-amber-500" /> Pending Access Requests
                        </h3>
                        {asClientRelations.filter(r => r.status === 'pending').length === 0 ? (
                            <p className="text-slate-400 text-sm italic font-medium">No new requests for medical management access.</p>
                        ) : (
                            <div className="space-y-3">
                                {asClientRelations.filter(r => r.status === 'pending').map(rel => (
                                    <div key={rel.id} className="bg-white p-5 rounded-3xl border-2 border-amber-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-pulse-slow">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                                                <UserCircleIcon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 uppercase tracking-tight">Access Request from {rel.coachEmail}</p>
                                                <p className="text-xs text-slate-500 font-medium">This professional wants to manage your journey, meals, and track biometrics.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleRespond(rel.id, 'active')}
                                                className="flex-1 md:flex-none bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center gap-2"
                                            >
                                                <CheckIcon className="w-4 h-4" /> Accept
                                            </button>
                                            <button 
                                                onClick={() => handleRespond(rel.id, 'rejected')}
                                                className="flex-1 md:flex-none bg-white border border-slate-200 text-slate-400 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
                                            >
                                                Decline
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Active Coaches */}
                    <section className="space-y-4">
                        <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs flex items-center gap-2">
                            <UsersIcon className="w-4 h-4 text-emerald-500" /> Verified Care Team
                        </h3>
                        {asClientRelations.filter(r => r.status === 'active').length === 0 ? (
                            <div className="bg-white p-8 rounded-3xl border border-slate-100 text-center">
                                <p className="text-slate-400 font-medium">You are currently self-managing. Any coach requests you accept will appear here.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {asClientRelations.filter(r => r.status === 'active').map(rel => (
                                    <div key={rel.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black">
                                                {rel.coachEmail?.[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 leading-tight">Coach {rel.coachName || rel.coachEmail}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                        AUTHORIZED
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-bold">Full Access</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleRevoke(rel.id)}
                                            className="text-xs font-black text-rose-500 uppercase tracking-widest hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            Revoke
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            )}

            <style>{`
                @keyframes pulse-slow {
                    0%, 100% { border-color: rgba(251, 191, 36, 0.1); }
                    50% { border-color: rgba(251, 191, 36, 0.5); }
                }
                .animate-pulse-slow { animation: pulse-slow 3s infinite ease-in-out; }
            `}</style>
        </div>
    );
};
