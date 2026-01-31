// ... existing imports
import React, { useState, useEffect } from 'react';
import { ReceiptItem, LanguageCode, MoodPost, Comment } from '../services/geminiService';

interface CommunityViewProps {
  items: ReceiptItem[];
  onItemClick: (item: ReceiptItem) => void;
  currentLang: LanguageCode;
  initialView?: 'map' | 'market' | 'square';
  onUserClick: (userName: string) => void;
  onViewChange?: (view: 'map' | 'market' | 'square') => void;
}

type ViewState = 'map' | 'market' | 'square';

// --- 2D Building Components ---
// ... (MarketHouse2D and ExchangeStation2D components remain unchanged)
const MarketHouse2D: React.FC<{ onClick: () => void, label: string }> = ({ onClick, label }) => (
    <div onClick={onClick} className="absolute left-[10%] top-[20%] w-40 cursor-pointer group hover:scale-105 transition-transform duration-300 z-10">
        {/* Garden/Shadow Base */}
        <div className="absolute -bottom-4 -left-4 w-[120%] h-12 bg-green-700/10 rounded-[50%] blur-sm pointer-events-none" />
        
        {/* House Container */}
        <div className="relative flex flex-col items-center">
            {/* Chimney */}
            <div className="absolute top-2 right-8 w-4 h-8 bg-orange-300 rounded-sm border-2 border-orange-400">
                 <div className="absolute -top-6 -right-2 w-8 h-8 bg-white/40 rounded-full blur-md animate-pulse"></div>
            </div>

            {/* Roof (Trapezoid) */}
            <div className="w-full h-20 bg-pink-500 rounded-t-3xl relative z-10 overflow-hidden border-4 border-pink-700 shadow-sm"
                 style={{ clipPath: 'polygon(10% 0, 90% 0, 100% 100%, 0% 100%)' }}>
                 {/* Roof Tiles Pattern */}
                 <div className="absolute inset-0 opacity-20" 
                      style={{ backgroundImage: 'radial-gradient(circle at 10px 10px, white 2px, transparent 2.5px)', backgroundSize: '20px 20px' }} />
                 {/* Dormer Window */}
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-pink-800 rounded-full border-4 border-white shadow-inner" />
            </div>

            {/* Awning (Striped) */}
            <div className="w-[110%] h-4 bg-[repeating-linear-gradient(90deg,#fbcfe8,#fbcfe8_10px,#db2777_10px,#db2777_20px)] rounded-full shadow-md z-20 -mt-1 border border-pink-200"></div>

            {/* Main Body */}
            <div className="w-[85%] h-24 bg-pink-100 border-x-4 border-b-4 border-pink-200 rounded-b-2xl relative shadow-lg flex flex-col items-center justify-end pb-0 overflow-hidden">
                {/* Windows */}
                <div className="absolute top-4 w-full px-4 flex justify-between">
                     <div className="w-8 h-10 bg-blue-200 rounded-t-full border-2 border-white shadow-inner overflow-hidden">
                         <div className="w-full h-1/2 border-b border-white/50"></div>
                         <div className="h-full w-1/2 border-r border-white/50 absolute top-0 left-0"></div>
                     </div>
                     <div className="w-8 h-10 bg-blue-200 rounded-t-full border-2 border-white shadow-inner overflow-hidden">
                         <div className="w-full h-1/2 border-b border-white/50"></div>
                         <div className="h-full w-1/2 border-r border-white/50 absolute top-0 left-0"></div>
                     </div>
                </div>

                {/* Door */}
                <div className="w-12 h-14 bg-pink-900 rounded-t-full border-x-2 border-t-2 border-white relative group-hover:bg-pink-800 transition-colors">
                    <div className="absolute top-6 right-2 w-1.5 h-1.5 bg-yellow-400 rounded-full shadow-sm"></div>
                </div>
            </div>

            {/* Sign Board */}
            <div className="absolute -bottom-8 bg-white border-2 border-pink-400 px-3 py-1.5 rounded-xl shadow-lg flex flex-col items-center animate-bounce-custom z-30">
                 <i className="fas fa-store text-pink-500 mb-0.5 text-sm"></i>
                 <span className="text-[10px] font-black text-pink-800 uppercase tracking-widest whitespace-nowrap">{label}</span>
            </div>
        </div>
    </div>
);

const ExchangeStation2D: React.FC<{ onClick: () => void, label: string }> = ({ onClick, label }) => (
    <div onClick={onClick} className="absolute right-[10%] bottom-[20%] w-36 cursor-pointer group hover:scale-105 transition-transform duration-300 z-10">
        {/* Shadow Base */}
        <div className="absolute -bottom-2 -left-2 w-[110%] h-8 bg-blue-900/10 rounded-[50%] blur-sm pointer-events-none" />

        <div className="relative flex flex-col items-center">
            {/* Antenna */}
            <div className="absolute -top-8 right-4 w-1 h-10 bg-slate-400 z-0">
                <div className="absolute -top-2 -left-1.5 w-4 h-4 rounded-full border-2 border-blue-400 animate-ping opacity-75"></div>
                <div className="absolute -top-2 -left-1.5 w-4 h-4 bg-blue-500 rounded-full border-2 border-white"></div>
            </div>

            {/* Main Block (Glassy) */}
            <div className="w-full h-28 bg-gradient-to-br from-blue-100 to-blue-50 border-4 border-white rounded-[2rem] shadow-xl relative overflow-hidden flex items-center justify-center">
                {/* Reflection Lines */}
                <div className="absolute -top-10 -left-10 w-20 h-40 bg-white/30 rotate-45 blur-md pointer-events-none"></div>
                
                {/* Icon */}
                <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center shadow-inner text-white text-3xl">
                    <i className="fas fa-comments"></i>
                </div>
                
                {/* Decor Dots */}
                <div className="absolute bottom-3 flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-blue-300 rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-blue-300 rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-blue-300 rounded-full"></div>
                </div>
            </div>

            {/* Sign Board */}
            <div className="absolute -bottom-6 bg-white border-2 border-blue-400 px-3 py-1.5 rounded-xl shadow-lg flex flex-col items-center animate-bounce-custom animation-delay-500 z-30">
                 <i className="fas fa-exchange-alt text-blue-500 mb-0.5 text-sm"></i>
                 <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest whitespace-nowrap">{label}</span>
            </div>
        </div>
    </div>
);

// --- Main Community View ---

export const CommunityView: React.FC<CommunityViewProps> = ({ items, onItemClick, currentLang, initialView, onUserClick, onViewChange }) => {
  const [viewState, setViewState] = useState<ViewState>(initialView || 'map');
  const [moodInput, setMoodInput] = useState('');
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState('');
  
  const [posts, setPosts] = useState<MoodPost[]>([
    { 
      id: '1', 
      author: 'Suki', 
      avatar: '🐱', 
      content: 'Found a vintage camera today! So lucky!', 
      timestamp: Date.now() - 3600000, 
      likes: 5, 
      comments: [
        { id: 'c1', author: 'Kenji', text: 'Wow, nice find! Is it working?', timestamp: Date.now() - 3500000, likes: 2 },
        { id: 'c2', author: 'Mika', text: 'Love the retro vibes.', timestamp: Date.now() - 3400000, likes: 1 }
      ] 
    },
    { 
      id: '2', 
      author: 'Kenji', 
      avatar: '🦊', 
      content: 'Anyone want to trade Switch games? I have Mario Odyssey.', 
      timestamp: Date.now() - 7200000, 
      likes: 2, 
      comments: [] 
    },
  ]);

  useEffect(() => {
    if (initialView) {
        setViewState(initialView);
    }
  }, [initialView]);

  const changeView = (view: ViewState) => {
    setViewState(view);
    onViewChange?.(view);
  };

  const TEXT: Record<LanguageCode, any> = {
    'zh-CN': { 
        market: '闲置小屋', 
        square: '情报站',
        postPlace: '分享交换情报...',
        postBtn: '发布 (咻!)',
        back: '返回社区',
        emptyMarket: '市场空空如也',
        emptySquare: '还没有情报呢',
        comment: '评论...'
    },
    'en': { 
        market: 'Market Hut', 
        square: 'Info Hub',
        postPlace: 'Share exchange info...',
        postBtn: 'Post (Whoosh!)',
        back: 'Back to Neighborhood',
        emptyMarket: 'Market is empty',
        emptySquare: 'No info yet',
        comment: 'Comment...'
    },
    'fr': { market: 'Marché', square: 'Info', postPlace: 'Partagez...', postBtn: 'Publier', back: 'Retour', emptyMarket: 'Vide', emptySquare: 'Calme', comment: 'Commenter...' },
    'ja': { market: '市場の家', square: '情報局', postPlace: '情報をシェア...', postBtn: '投稿', back: '戻る', emptyMarket: '空っぽ', emptySquare: '静か', comment: 'コメント...' },
    'es': { market: 'Mercado', square: 'Info', postPlace: 'Comparte...', postBtn: 'Publicar', back: 'Volver', emptyMarket: 'Vacío', emptySquare: 'Silencio', comment: 'Comentar...' },
  };

  const t = TEXT[currentLang] || TEXT['zh-CN'];

  const handlePostMood = () => {
      if (!moodInput.trim()) return;
      const newPost: MoodPost = {
          id: Date.now().toString(),
          author: 'Me',
          avatar: '🧙‍♀️',
          content: moodInput,
          timestamp: Date.now(),
          likes: 0,
          comments: []
      };
      setPosts([newPost, ...posts]);
      setMoodInput('');
  };

  const handleSubmitComment = (postId: string) => {
    if (!commentInput.trim()) return;
    const newComment: Comment = {
      id: Date.now().toString(),
      author: 'Me',
      text: commentInput,
      timestamp: Date.now(),
      likes: 0
    };
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: [...p.comments, newComment] } : p));
    setCommentInput('');
    setActiveCommentId(null);
  };

  const handleLikePost = (postId: string) => {
    setPosts(prev => prev.map(p => 
        p.id === postId ? { ...p, likes: (p.likes || 0) + 1 } : p
    ));
  };

  const handleLikeComment = (postId: string, commentId: string) => {
    setPosts(prev => prev.map(p => {
        if (p.id === postId) {
            return {
                ...p,
                comments: p.comments.map(c => 
                    c.id === commentId ? { ...c, likes: (c.likes || 0) + 1 } : c
                )
            };
        }
        return p;
    }));
  };

  // --- Map View (2D) ---
  if (viewState === 'map') {
      return (
          <div className="flex-1 flex flex-col h-full animate-in fade-in duration-500 pb-20">
              <div className="flex-1 relative w-full h-full rounded-[3rem] overflow-hidden shadow-inner border-4 border-green-200 bg-[#a7f3d0]">
                   
                   {/* Background Pattern - 2D Grass */}
                   <div className="absolute inset-0 opacity-40" 
                        style={{ 
                            backgroundImage: 'radial-gradient(#059669 1.5px, transparent 1.5px)',
                            backgroundSize: '20px 20px' 
                        }} 
                   />
                   
                   {/* Winding Path (2D SVG) */}
                   <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-60" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {/* Main curve connecting buildings */}
                        <path d="M 20 40 Q 50 60 80 70" stroke="#fefce8" strokeWidth="8" fill="none" strokeDasharray="10 5" strokeLinecap="round" />
                        {/* Path to bottom */}
                        <path d="M 50 100 L 50 60" stroke="#fefce8" strokeWidth="6" fill="none" strokeLinecap="round"/>
                   </svg>

                   {/* Decor: Trees & Flowers (2D Emojis positioned nicely) */}
                   <div className="absolute top-10 left-6 text-4xl drop-shadow-md animate-bounce-custom animation-delay-1000">🌲</div>
                   <div className="absolute top-12 left-16 text-2xl drop-shadow-sm">🍄</div>
                   
                   <div className="absolute bottom-32 right-10 text-5xl drop-shadow-md animate-bounce-custom">🌳</div>
                   <div className="absolute bottom-28 right-24 text-2xl drop-shadow-sm">🌷</div>
                   
                   <div className="absolute top-1/2 left-10 text-3xl drop-shadow-sm opacity-80">🌻</div>
                   <div className="absolute bottom-10 left-20 text-3xl drop-shadow-sm opacity-80">🪨</div>

                   {/* Clouds (Animated) */}
                   <div className="absolute top-20 left-1/4 text-5xl opacity-80 animate-[float_10s_ease-in-out_infinite]">☁️</div>
                   <div className="absolute top-10 right-1/4 text-4xl opacity-60 animate-[float_15s_ease-in-out_infinite_reverse]">☁️</div>

                   {/* Buildings */}
                   <MarketHouse2D onClick={() => changeView('market')} label={t.market} />
                   <ExchangeStation2D onClick={() => changeView('square')} label={t.square} />
              </div>
              <style>{`
                  @keyframes float {
                      0%, 100% { transform: translateX(0px); }
                      50% { transform: translateX(20px); }
                  }
              `}</style>
          </div>
      );
  }

  // --- Market View ---
  if (viewState === 'market') {
      return (
          <div className="flex-1 flex flex-col h-full animate-in slide-in-from-left duration-500 pb-20">
              <div className="flex items-center mb-6">
                  <button onClick={() => changeView('map')} className="w-10 h-10 flex items-center justify-center bg-white text-purple-400 rounded-xl shadow-sm mr-4 hover:scale-105 transition-transform">
                      <i className="fas fa-chevron-left text-sm"></i>
                  </button>
                  <div>
                    <h2 className="text-2xl font-black text-purple-800 uppercase tracking-tight">{t.market}</h2>
                    <p className="text-[9px] text-pink-500 font-bold uppercase tracking-widest">Pre-loved Treasures</p>
                  </div>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {items.length === 0 ? (
                      <div className="h-64 flex flex-col items-center justify-center text-purple-300">
                          <i className="fas fa-box-open text-4xl mb-3 opacity-50"></i>
                          <p className="text-xs font-bold">{t.emptyMarket}</p>
                      </div>
                  ) : (
                      <div className="columns-2 gap-3 space-y-3 pb-20">
                          {items.map((item) => (
                              <div key={item.id} onClick={() => onItemClick(item)} className="break-inside-avoid bg-white rounded-2xl shadow-sm border border-purple-50 overflow-hidden group cursor-pointer hover:shadow-md transition-all relative">
                                  {item.marketStatus === 'sold' && (
                                    <div className="absolute inset-0 z-10 bg-black/10 flex items-center justify-center pointer-events-none">
                                        <div className="border-2 border-red-500 text-red-500 font-black text-xs px-2 py-0.5 rounded uppercase tracking-widest -rotate-12 bg-white/80">SOLD</div>
                                    </div>
                                  )}
                                  <div className={`relative aspect-square bg-purple-50/50 overflow-hidden ${item.marketStatus === 'sold' ? 'grayscale opacity-75' : ''}`}>
                                      {item.photo ? (
                                          <img src={item.photo} alt={item.translatedName} className="w-full h-full object-cover" />
                                      ) : (
                                          <div className="w-full h-full flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">{item.emoji}</div>
                                      )}
                                      <div className="absolute bottom-2 right-2 bg-white/90 px-2 py-1 rounded-lg text-xs font-black text-pink-500 shadow-sm">¥{item.priceTag}</div>
                                      {item.sellerName === 'Me' && (
                                          <div className="absolute top-2 left-2 bg-purple-500 text-white px-2 py-0.5 rounded text-[8px] font-bold uppercase">My Listing</div>
                                      )}
                                  </div>
                                  <div className="p-3">
                                      <div className="font-bold text-purple-800 text-xs truncate mb-1">{item.translatedName}</div>
                                      <div className="flex items-center justify-between">
                                          <div className="flex items-center space-x-1" onClick={(e) => { e.stopPropagation(); onUserClick(item.sellerName || 'Unknown'); }}>
                                              <div className="w-4 h-4 rounded-full bg-pink-100 flex items-center justify-center text-[8px]">👤</div>
                                              <span className="text-[8px] text-purple-400 truncate max-w-[50px] hover:underline cursor-pointer">{item.sellerName}</span>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>
      );
  }

  // --- Exchange/Square View ---
  if (viewState === 'square') {
      return (
          <div className="flex-1 flex flex-col h-full animate-in slide-in-from-right duration-500 pb-20">
              <div className="flex items-center mb-6">
                  <button onClick={() => changeView('map')} className="w-10 h-10 flex items-center justify-center bg-white text-purple-400 rounded-xl shadow-sm mr-4 hover:scale-105 transition-transform">
                      <i className="fas fa-chevron-left text-sm"></i>
                  </button>
                  <div>
                    <h2 className="text-2xl font-black text-purple-800 uppercase tracking-tight">{t.square}</h2>
                    <p className="text-[9px] text-blue-500 font-bold uppercase tracking-widest">Community Board</p>
                  </div>
              </div>

              {/* Input Area */}
              <div className="bg-white p-4 rounded-3xl shadow-sm border border-blue-50 mb-6">
                  <textarea 
                    value={moodInput}
                    onChange={(e) => setMoodInput(e.target.value)}
                    placeholder={t.postPlace}
                    className="w-full h-20 bg-blue-50/50 rounded-2xl p-3 text-xs text-purple-800 outline-none resize-none placeholder:text-blue-300 font-medium"
                  />
                  <div className="flex justify-end mt-2">
                      <button 
                        onClick={handlePostMood}
                        disabled={!moodInput.trim()}
                        className="bg-blue-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          {t.postBtn}
                      </button>
                  </div>
              </div>

              {/* Feed */}
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pb-10">
                  {posts.length === 0 ? (
                      <div className="text-center py-10 text-purple-300 text-xs font-bold">{t.emptySquare}</div>
                  ) : (
                      posts.map(post => (
                          <div key={post.id} className="bg-white p-4 rounded-3xl border border-purple-50 shadow-sm flex flex-col space-y-3">
                               <div className="flex space-x-3">
                                  <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center text-xl shrink-0 border-2 border-white shadow-sm cursor-pointer" onClick={() => onUserClick(post.author)}>
                                      {post.avatar}
                                  </div>
                                  <div className="flex-1">
                                      <div className="flex justify-between items-start">
                                          <span className="text-xs font-black text-purple-800 cursor-pointer hover:text-pink-500 transition-colors" onClick={() => onUserClick(post.author)}>{post.author}</span>
                                          <span className="text-[8px] text-purple-300 font-bold">{new Date(post.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                      </div>
                                      <p className="text-xs text-purple-600 mt-1 leading-relaxed font-medium bg-purple-50/50 p-2 rounded-xl rounded-tl-none">
                                          {post.content}
                                      </p>
                                      <div className="flex items-center space-x-4 mt-2">
                                          <button 
                                            onClick={() => handleLikePost(post.id)}
                                            className="flex items-center space-x-1 text-pink-400 hover:text-pink-600 transition-colors active:scale-110 transform"
                                          >
                                              <i className={`${(post.likes || 0) > 0 ? 'fas text-pink-500' : 'far'} fa-heart text-[10px]`}></i>
                                              <span className="text-[9px] font-bold">{post.likes}</span>
                                          </button>
                                          <button onClick={() => setActiveCommentId(activeCommentId === post.id ? null : post.id)} className="flex items-center space-x-1 text-blue-400 hover:text-blue-600 transition-colors">
                                              <i className="far fa-comment text-[10px]"></i>
                                              <span className="text-[9px] font-bold">{post.comments.length}</span>
                                          </button>
                                      </div>
                                  </div>
                               </div>

                               {/* Comments Section */}
                               {(post.comments.length > 0 || activeCommentId === post.id) && (
                                  <div className="ml-12 border-l-2 border-purple-50 pl-3 space-y-2">
                                     {post.comments.map(comment => (
                                       <div key={comment.id} className="flex items-start justify-between group/comment">
                                          <div className="text-[10px] pr-2">
                                              <span className="font-bold text-purple-800 mr-1 cursor-pointer hover:text-pink-500" onClick={(e) => { e.stopPropagation(); onUserClick(comment.author); }}>{comment.author}:</span>
                                              <span className="text-purple-600">{comment.text}</span>
                                          </div>
                                          <button 
                                              onClick={(e) => { e.stopPropagation(); handleLikeComment(post.id, comment.id); }}
                                              className="flex items-center space-x-1 text-purple-300 hover:text-pink-500 transition-colors active:scale-110 transform"
                                          >
                                              <i className={`${(comment.likes || 0) > 0 ? 'fas text-pink-500' : 'far'} fa-heart text-[9px]`}></i>
                                              {(comment.likes || 0) > 0 && <span className="text-[8px] font-bold">{comment.likes}</span>}
                                          </button>
                                       </div>
                                     ))}
                                     
                                     {activeCommentId === post.id && (
                                       <div className="flex items-center space-x-2 mt-2">
                                          <input 
                                            value={commentInput}
                                            onChange={(e) => setCommentInput(e.target.value)}
                                            placeholder={t.comment}
                                            className="flex-1 bg-purple-50 rounded-lg px-2 py-1 text-[10px] outline-none border border-transparent focus:border-purple-200"
                                            onKeyPress={(e) => e.key === 'Enter' && handleSubmitComment(post.id)}
                                          />
                                          <button onClick={() => handleSubmitComment(post.id)} className="text-blue-500 hover:text-blue-600">
                                            <i className="fas fa-paper-plane text-xs"></i>
                                          </button>
                                       </div>
                                     )}
                                  </div>
                               )}
                          </div>
                      ))
                  )}
              </div>
          </div>
      );
  }

  return null;
};