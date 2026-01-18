
import React, { useEffect, useState, useRef } from 'react';
import * as apiService from '../../services/apiService';
import { UserProfile, Friendship } from '../../types';
import { UserCircleIcon, UserGroupIcon, PlusIcon, XIcon, UploadIcon } from '../icons';

export const SocialManager: React.FC = () => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [friends, setFriends] = useState<Friendship[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [searchEmail, setSearchEmail] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [uploadStatus, setUploadStatus] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadData = async () => {
        try {
            setIsLoading(true);
            const [p, f, r] = await Promise.all([
                apiService.getSocialProfile(),
                apiService.getFriends(),
                apiService.getFriendRequests()
            ]);
            setProfile(p);
            setFriends(f);
            setRequests(r);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleUpdatePrivacy = async (mode: 'public' | 'private') => {
        if (!profile) return;
        await apiService.updateSocialProfile({ privacyMode: mode });
        setProfile({ ...profile, privacyMode: mode });
    };

    const handleSendRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await apiService.sendFriendRequest(searchEmail);
            alert("Request sent!");
            setSearchEmail('');
        } catch (e) {
            alert("Could not find user.");
        }
    };

    const handleRespond = async (requestId: number, status: 'accepted' | 'rejected') => {
        await apiService.respondToFriendRequest(requestId, status);
        loadData();
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
            const text = ev.target?.result as string;
            const lines = text.split('\n');
            const contacts: { name: string; email: string }[] = [];
            
            lines.forEach(line => {
                const parts = line.split(',');
                if (parts.length >= 2) {
                    const name = parts[0].trim();
                    const email = parts[1].trim();
                    if (email.includes('@')) {
                        contacts.push({ name, email });
                    }
                }
            });

            if (contacts.length === 0) {
                alert("No valid contacts found. Please format as: Name, Email");
                return;
            }

            setUploadStatus('Processing...');
            try {
                const result = await apiService.sendBulkInvites(contacts);
                setUploadStatus(`Processed ${contacts.length} contacts! Sent ${result.invitesSent} invites, ${result.requestsSent} requests, and added ${result.friendsAdded} new friends. Earned ${result.pointsAwarded} points!`);
                loadData();
            } catch (err) {
                setUploadStatus('Failed to process upload.');
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset
    };

    if (isLoading) return <div className="p-8 text-center text-slate-500">Loading social hub...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-fade-in">
            <header className="text-center">
                <h2 className="text-3xl font-extrabold text-slate-900">Social Hub</h2>
                <p className="text-slate-500 mt-1">Connect and share your journey.</p>
            </header>

            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <UserCircleIcon /> My Privacy
                </h3>
                <div className="flex gap-4">
                    <button 
                        onClick={() => handleUpdatePrivacy('private')}
                        className={`flex-1 p-4 rounded-xl border-2 transition-all text-left ${profile?.privacyMode === 'private' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100'}`}
                    >
                        <p className="font-bold text-slate-800">Private Profile</p>
                        <p className="text-xs text-slate-500">Must approve friend requests.</p>
                    </button>
                    <button 
                        onClick={() => handleUpdatePrivacy('public')}
                        className={`flex-1 p-4 rounded-xl border-2 transition-all text-left ${profile?.privacyMode === 'public' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100'}`}
                    >
                        <p className="font-bold text-slate-800">Public Profile</p>
                        <p className="text-xs text-slate-500">Visible to community.</p>
                    </button>
                </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <PlusIcon /> Add Friends
                        </h3>
                    </div>
                    
                    {uploadStatus && (
                        <div className="mb-4 p-3 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-100">
                            {uploadStatus}
                        </div>
                    )}

                    <form onSubmit={handleSendRequest} className="flex gap-2 mb-6">
                        <input 
                            type="email" 
                            placeholder="Friend's email" 
                            value={searchEmail}
                            onChange={e => setSearchEmail(e.target.value)}
                            className="flex-grow p-2 border border-slate-300 rounded-lg text-sm"
                        />
                        <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold">Invite</button>
                    </form>

                    {/* Bulk Upload Section - Moved Below Input */}
                    <div className="mb-6 pt-6 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Or import contacts</p>
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            className="w-full flex items-center justify-center gap-2 p-3 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 rounded-xl text-slate-600 font-bold text-sm transition-all" 
                            title="Import Contacts (CSV)"
                        >
                            <UploadIcon className="w-5 h-5" />
                            <span>Upload CSV List</span>
                        </button>
                        <input type="file" ref={fileInputRef} accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                        <p className="text-[10px] text-slate-400 mt-2 text-center">Format: Name, Email (one per line)</p>
                    </div>

                    {requests.length > 0 && (
                        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                            <p className="text-xs font-bold text-slate-400 uppercase">Requests</p>
                            {requests.map(req => (
                                <div key={req.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                    <span className="text-sm font-medium">{req.email}</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleRespond(req.id, 'accepted')} className="text-emerald-600"><PlusIcon /></button>
                                        <button onClick={() => handleRespond(req.id, 'rejected')} className="text-red-600"><XIcon /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <UserGroupIcon /> Friends ({friends.length})
                    </h3>
                    <div className="space-y-3">
                        {friends.map(friend => (
                            <div key={friend.friendId} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-500 font-bold">
                                    {friend.email[0].toUpperCase()}
                                </div>
                                <span className="text-sm font-medium">{friend.email}</span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};
