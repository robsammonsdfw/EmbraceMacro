
import React, { useEffect, useState } from 'react';
import * as apiService from '../../services/apiService';
import { Article } from '../../types';
import { UserCircleIcon, FireIcon } from '../icons';

interface PulseFeedProps {
    onArticleSelect?: (article: Article) => void;
}

export const PulseFeed: React.FC<PulseFeedProps> = ({ onArticleSelect }) => {
    const [articles, setArticles] = useState<Article[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchArticles = async () => {
            try {
                const data = await apiService.getArticles();
                setArticles(data);
            } catch (e) {
                console.error("Failed to load pulse feed", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchArticles();
    }, []);

    if (isLoading) return <div className="p-12 text-center text-slate-400 font-medium">Loading knowledge stream...</div>;

    const handleSelect = (article: Article) => {
        if (onArticleSelect) {
            onArticleSelect(article);
        } else {
            // Phase 2 Placeholder Action
            alert(`Opening "${article.title}"... (Viewer coming in Phase 3)`);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-fade-in">
            <header className="flex items-center gap-4 px-2">
                <div className="p-3 bg-amber-100 text-amber-600 rounded-full">
                    <FireIcon className="w-8 h-8" />
                </div>
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Pulse</h2>
                    <p className="text-slate-500 font-medium">Daily knowledge, actionable science, and creator insights.</p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {articles.map(article => (
                    <article 
                        key={article.id} 
                        onClick={() => handleSelect(article)}
                        className="bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer overflow-hidden group flex flex-col h-full"
                    >
                        {/* Image Header */}
                        <div className="relative h-48 bg-slate-200 overflow-hidden">
                            {article.image_url ? (
                                <img src={article.image_url} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-300">
                                    <FireIcon className="w-12 h-12" />
                                </div>
                            )}
                            {/* Action Badge */}
                            {article.embedded_actions && (
                                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-600 shadow-sm">
                                    Interactive
                                </div>
                            )}
                        </div>

                        {/* Content Body */}
                        <div className="p-6 flex flex-col flex-grow">
                            <div className="flex items-center gap-2 mb-3">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${article.author_avatar && article.author_avatar.startsWith('bg-') ? article.author_avatar : 'bg-slate-400'}`}>
                                    {article.author_avatar && !article.author_avatar.startsWith('bg-') ? (
                                        <img src={article.author_avatar} alt="" className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                        <UserCircleIcon className="w-full h-full" />
                                    )}
                                </div>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{article.author_name || 'EmbraceHealth'}</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(article.created_at).toLocaleDateString()}</span>
                            </div>

                            <h3 className="text-xl font-black text-slate-900 leading-tight mb-2 group-hover:text-indigo-600 transition-colors">
                                {article.title}
                            </h3>
                            
                            <p className="text-slate-500 text-sm font-medium line-clamp-3 mb-4 flex-grow">
                                {article.summary}
                            </p>

                            <div className="pt-4 border-t border-slate-50 mt-auto flex justify-between items-center">
                                <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest group-hover:underline">Read Article</span>
                                {article.embedded_actions && (
                                    <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded text-[10px] font-black uppercase">
                                        + Action
                                    </span>
                                )}
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    );
};
