
import React from 'react';
import { Article, Recipe } from '../../types';
import { XIcon, ActivityIcon, BeakerIcon, UtensilsIcon, UserCircleIcon, UserGroupIcon, PlusIcon } from '../icons';
import { CookModeModal } from '../CookModeModal';

interface ArticleViewerProps {
    article: Article;
    onClose: () => void;
    onAction: (type: string, payload: any) => void;
}

export const ArticleViewer: React.FC<ArticleViewerProps> = ({ article, onClose, onAction }) => {
    // Cook Mode Logic is internal to the Viewer for seamless experience
    const [isCooking, setIsCooking] = React.useState(false);

    // Helper to determine icon for action
    const getActionIcon = (type: string) => {
        switch (type) {
            case 'OPEN_FORM_CHECK': return <ActivityIcon className="w-5 h-5" />;
            case 'GENERATE_MEDICAL_PLAN': return <BeakerIcon className="w-5 h-5" />;
            case 'OPEN_COOK_MODE': return <UtensilsIcon className="w-5 h-5" />;
            default: return <PlusIcon className="w-5 h-5" />;
        }
    };

    const handleMainAction = () => {
        const action = article.embedded_actions;
        if (!action) return;

        if (action.type === 'OPEN_COOK_MODE') {
            setIsCooking(true);
        } else {
            // Delegate other actions to the parent (Desktop/Mobile App)
            onAction(action.type, action);
        }
    };

    const handleHireCoach = () => {
        // Placeholder for phase 3 part 3 - connect to coach
        alert("Coach connection request sent!");
    };

    if (isCooking && article.embedded_actions?.recipe) {
        return <CookModeModal recipe={article.embedded_actions.recipe as Recipe} onClose={() => setIsCooking(false)} />;
    }

    return (
        <div className="fixed inset-0 bg-white z-[60] flex flex-col animate-slide-up overflow-hidden">
            {/* Header / Nav */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
                <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>
            </div>

            <div className="flex-grow overflow-y-auto pb-32">
                {/* Hero Image */}
                <div className="relative h-96 w-full">
                    {article.image_url ? (
                        <img src={article.image_url} alt={article.title} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-600">
                            <ActivityIcon className="w-20 h-20" />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent"></div>
                </div>

                <div className="px-6 md:px-20 max-w-4xl mx-auto -mt-20 relative z-10">
                    {/* Meta Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-lg border-2 border-white ${article.author_avatar?.startsWith('bg-') ? article.author_avatar : 'bg-slate-900'}`}>
                                {article.author_avatar && !article.author_avatar.startsWith('bg-') ? (
                                    <img src={article.author_avatar} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <UserCircleIcon />
                                )}
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 text-sm">{article.author_name}</p>
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{new Date(article.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleHireCoach}
                            className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors flex items-center gap-2"
                        >
                            <UserGroupIcon className="w-4 h-4" /> Hire Coach
                        </button>
                    </div>

                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-6">{article.title}</h1>
                    
                    <p className="text-xl text-slate-600 font-medium leading-relaxed mb-8 border-l-4 border-indigo-500 pl-6">
                        {article.summary}
                    </p>

                    <div className="prose prose-lg prose-slate max-w-none mb-20 text-slate-800">
                        {/* Simple rendering for now, can be upgraded to Markdown parser later */}
                        {article.content.split('\n').map((paragraph, idx) => (
                            <p key={idx} className="mb-4 leading-relaxed">{paragraph}</p>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sticky Action Bar */}
            {article.embedded_actions && (
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/90 backdrop-blur-xl border-t border-slate-200">
                    <div className="max-w-md mx-auto">
                        <button 
                            onClick={handleMainAction}
                            className="w-full bg-slate-900 text-white font-black text-sm uppercase tracking-widest py-5 rounded-2xl shadow-xl hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-3 group"
                        >
                            <span className="group-hover:scale-110 transition-transform">{getActionIcon(article.embedded_actions.type)}</span>
                            {article.embedded_actions.label || 'Take Action'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
