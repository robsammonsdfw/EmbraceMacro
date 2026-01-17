
import React, { useState } from 'react';
import { VideoIcon, UserGroupIcon, GlobeAltIcon, FireIcon, ClockIcon, PlusIcon, HeartIcon, ChatIcon } from '../icons';

interface Video {
    id: string;
    title: string;
    thumbnail: string;
    author: string;
    authorAvatar: string;
    views: string;
    postedAt: string;
    duration: string;
    isFriend: boolean;
    category: string;
    description: string;
}

// Mock Data
const MOCK_VIDEOS: Video[] = [
    { id: '1', title: 'High Protein Meal Prep for the Week', thumbnail: 'https://images.unsplash.com/photo-1543353071-873f17a7a088?auto=format&fit=crop&w=800&q=80', author: 'Chef Mike', authorAvatar: 'bg-indigo-500', views: '12K', postedAt: '2 days ago', duration: '12:45', isFriend: false, category: 'Meal Prep', description: 'Save time and money with these 5 high protein meals.' },
    { id: '2', title: 'Keto Breakfast Burritos', thumbnail: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=800&q=80', author: 'Sarah LowCarb', authorAvatar: 'bg-emerald-500', views: '8.5K', postedAt: '5 hours ago', duration: '08:30', isFriend: true, category: 'Keto', description: 'Low carb, high fat, and delicious breakfast on the go.' },
    { id: '3', title: 'Vegan Buddha Bowls in 20 Mins', thumbnail: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80', author: 'Plant Power', authorAvatar: 'bg-green-600', views: '22K', postedAt: '1 week ago', duration: '15:10', isFriend: false, category: 'Vegan', description: 'Quick and nutritious plant-based bowls.' },
    { id: '4', title: 'My Sunday Prep Routine', thumbnail: 'https://images.unsplash.com/photo-1556910103-1c02745a30bf?auto=format&fit=crop&w=800&q=80', author: 'FitFam Jen', authorAvatar: 'bg-rose-500', views: '305', postedAt: 'Just now', duration: '22:00', isFriend: true, category: 'Vlog', description: 'Join me as I prep meals for my family of 4.' },
    { id: '5', title: 'Chicken & Rice 3 Ways', thumbnail: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=800&q=80', author: 'Gym Bro', authorAvatar: 'bg-blue-600', views: '45K', postedAt: '3 days ago', duration: '10:15', isFriend: false, category: 'Muscle', description: 'Never get bored of chicken and rice again.' },
    { id: '6', title: 'Healthy Snacks for Work', thumbnail: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=800&q=80', author: 'Wellness Wendy', authorAvatar: 'bg-amber-500', views: '1.2K', postedAt: '1 day ago', duration: '05:45', isFriend: true, category: 'Snacks', description: 'Stop eating vending machine junk.' },
];

export const MealPrepVideos: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'community' | 'friends'>('community');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const filteredVideos = activeTab === 'friends' 
        ? MOCK_VIDEOS.filter(v => v.isFriend) 
        : MOCK_VIDEOS;

    const MobileFeed = () => (
        <div className="pb-24 space-y-6">
            {filteredVideos.map(video => (
                <div key={video.id} className="bg-white border-b border-slate-100 pb-6">
                    <div className="relative aspect-video w-full bg-black mb-3">
                        <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                            {video.duration}
                        </div>
                    </div>
                    <div className="px-4 flex gap-3 items-start">
                        <div className={`w-10 h-10 rounded-full ${video.authorAvatar} flex items-center justify-center text-white font-bold shrink-0`}>
                            {video.author[0]}
                        </div>
                        <div className="flex-grow">
                            <h3 className="font-bold text-slate-900 text-sm leading-tight mb-1">{video.title}</h3>
                            <p className="text-xs text-slate-500">{video.author} • {video.views} views • {video.postedAt}</p>
                        </div>
                        <button className="text-slate-400">
                            <span className="text-xl">⋮</span>
                        </button>
                    </div>
                    {/* Social Actions for Mobile Feed */}
                    <div className="px-4 mt-3 flex justify-between items-center max-w-xs mx-auto">
                        <button className="flex flex-col items-center gap-1 text-slate-500">
                            <HeartIcon className="w-6 h-6" />
                            <span className="text-[10px] font-bold">Like</span>
                        </button>
                        <button className="flex flex-col items-center gap-1 text-slate-500">
                            <ChatIcon className="w-5 h-5" />
                            <span className="text-[10px] font-bold">Comment</span>
                        </button>
                        <button className="flex flex-col items-center gap-1 text-slate-500">
                            <PlusIcon className="w-6 h-6" />
                            <span className="text-[10px] font-bold">Save</span>
                        </button>
                    </div>
                </div>
            ))}
            {filteredVideos.length === 0 && (
                <div className="p-8 text-center">
                    <UserGroupIcon className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-700">No friend activity yet</h3>
                    <p className="text-slate-500 text-sm mb-6">Invite friends to see their meal preps here!</p>
                    <button className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-xl w-full">Invite Friends</button>
                </div>
            )}
        </div>
    );

    const DesktopGrid = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
            {filteredVideos.map(video => (
                <div key={video.id} className="group cursor-pointer">
                    <div className="relative aspect-video rounded-xl overflow-hidden mb-3">
                        <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-300" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                            {video.duration}
                        </div>
                    </div>
                    <div className="flex gap-3 items-start">
                        <div className={`w-9 h-9 rounded-full ${video.authorAvatar} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                            {video.author[0]}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 text-sm leading-tight mb-1 line-clamp-2 group-hover:text-indigo-600 transition-colors">{video.title}</h3>
                            <p className="text-xs text-slate-500 hover:text-slate-700">{video.author}</p>
                            <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                                <span>{video.views} views</span>
                                <span>•</span>
                                <span>{video.postedAt}</span>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
             {filteredVideos.length === 0 && (
                <div className="col-span-full p-12 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <UserGroupIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-700">No videos from friends</h3>
                    <p className="text-slate-500 mb-6">Connect with friends to share meal prep inspiration.</p>
                </div>
            )}
        </div>
    );

    return (
        <div className={`h-full ${isMobile ? 'bg-white' : 'max-w-6xl mx-auto space-y-6'}`}>
            {/* Header / Tabs */}
            <div className={`sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-100 ${isMobile ? 'px-4 py-3' : 'py-4 flex justify-between items-center rounded-b-xl'}`}>
                <div className="flex items-center gap-2 mb-2 md:mb-0">
                    <VideoIcon className={`w-6 h-6 ${isMobile ? 'text-red-500' : 'text-slate-700'}`} />
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Meal Prep TV</h2>
                </div>
                
                <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
                    <button 
                        onClick={() => setActiveTab('community')}
                        className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'community' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <GlobeAltIcon className="w-3 h-3" /> Community
                    </button>
                    <button 
                        onClick={() => setActiveTab('friends')}
                        className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'friends' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <UserGroupIcon className="w-3 h-3" /> Friends
                    </button>
                </div>
            </div>

            {/* Filter Chips (Desktop Only visual enhancement) */}
            {!isMobile && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                    {['All', 'High Protein', 'Keto', 'Vegan', 'Budget Friendly', 'Under 30 Mins', 'Breakfast'].map((chip, i) => (
                        <button key={chip} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${i === 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                            {chip}
                        </button>
                    ))}
                </div>
            )}

            {/* Main Content */}
            <div className="animate-fade-in">
                {isMobile ? <MobileFeed /> : <DesktopGrid />}
            </div>
        </div>
    );
};
