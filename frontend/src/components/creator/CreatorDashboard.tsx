
import React, { useState, useEffect } from 'react';
import { NewspaperIcon, PlusIcon, UserGroupIcon, TrophyIcon, ActivityIcon } from '../icons';
import { Article } from '../../types';
import * as apiService from '../../services/apiService';
import { ArticleEditorModal } from './ArticleEditorModal';

export const CreatorDashboard: React.FC = () => {
    const [stats, setStats] = useState({ points: 0, reach: 0, actions: 0 });
    const [articles, setArticles] = useState<Article[]>([]);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        try {
            setLoading(true);
            const [rewards, content] = await Promise.all([
                apiService.getRewardsSummary(),
                apiService.getArticles()
            ]);
            
            // Filter articles authored by current user (in a real app, backend would filter, or we check author_id)
            // For now, assume if we are in creator dashboard, we show all "My" articles. 
            // Since GET /pulse returns all, we might need to filter by author if available, but for simplicity showing all for now.
            setArticles(content);
            
            // Calculate pseudo-stats from rewards history
            const creatorActions = rewards.history.filter(h => h.event_type === 'creator.action_completed');
            setStats({
                points: rewards.points_total,
                reach: content.length * 150 + creatorActions.length * 10, // Mock calculation
                actions: creatorActions.length
            });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handlePublish = async (articleData: Partial<Article>) => {
        try {
            await apiService.publishArticle(articleData);
            setIsEditorOpen(false);
            loadData();
            alert("Article published successfully!");
        } catch (e) {
            alert("Failed to publish.");
        }
    };

    if (loading) return <div className="p-12 text-center text-slate-400 font-medium animate-pulse">Loading Creator Studio...</div>;

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-fade-in">
            {isEditorOpen && <ArticleEditorModal onClose={() => setIsEditorOpen(false)} onPublish={handlePublish} />}

            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Creator Studio</h2>
                    <p className="text-slate-500 font-medium text-lg">Manage your content, community, and impact.</p>
                </div>
                <button 
                    onClick={() => setIsEditorOpen(true)}
                    className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black transition-all shadow-lg active:scale-95 flex items-center gap-2"
                >
                    <PlusIcon className="w-4 h-4" /> New Pulse
                </button>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-indigo-100 text-indigo-600 rounded-2xl">
                        <TrophyIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Earnings</p>
                        <p className="text-3xl font-black text-slate-900">{stats.points.toLocaleString()}</p>
                        <p className="text-xs font-bold text-emerald-500">Pts Available</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-amber-100 text-amber-600 rounded-2xl">
                        <UserGroupIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Reach</p>
                        <p className="text-3xl font-black text-slate-900">{stats.reach.toLocaleString()}</p>
                        <p className="text-xs font-bold text-slate-400">Est. Views</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-emerald-100 text-emerald-600 rounded-2xl">
                        <ActivityIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Impact</p>
                        <p className="text-3xl font-black text-slate-900">{stats.actions}</p>
                        <p className="text-xs font-bold text-emerald-500">Actions Taken</p>
                    </div>
                </div>
            </div>

            {/* Content List */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm min-h-[400px]">
                <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                    <NewspaperIcon className="w-6 h-6 text-slate-400" /> Published Content
                </h3>

                <div className="space-y-4">
                    {articles.map(article => (
                        <div key={article.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 hover:bg-white hover:shadow-md transition-all rounded-2xl border border-slate-100 group">
                            <div className="flex items-center gap-4 mb-4 md:mb-0">
                                <div className="w-16 h-16 bg-slate-200 rounded-xl overflow-hidden shrink-0">
                                    {article.image_url ? (
                                        <img src={article.image_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-400"><NewspaperIcon /></div>
                                    )}
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-900 text-sm">{article.title}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs font-medium text-slate-500">{new Date(article.created_at).toLocaleDateString()}</span>
                                        {article.is_squad_exclusive && (
                                            <span className="bg-amber-100 text-amber-700 text-[9px] font-black uppercase px-2 py-0.5 rounded">Squad Only</span>
                                        )}
                                        {article.embedded_actions && (
                                            <span className="bg-indigo-100 text-indigo-700 text-[9px] font-black uppercase px-2 py-0.5 rounded">Smart Action</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-slate-400 text-xs font-bold uppercase tracking-wide">
                                <span className="flex items-center gap-1 group-hover:text-emerald-600 transition-colors"><ActivityIcon className="w-4 h-4" /> High Engagement</span>
                                <button className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">Edit</button>
                            </div>
                        </div>
                    ))}
                    
                    {articles.length === 0 && (
                        <div className="text-center py-20">
                            <div className="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                <NewspaperIcon className="w-10 h-10" />
                            </div>
                            <p className="text-slate-400 font-medium">You haven't published any Pulse articles yet.</p>
                            <button onClick={() => setIsEditorOpen(true)} className="mt-4 text-indigo-600 font-bold uppercase text-xs tracking-widest hover:underline">Draft your first post</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
