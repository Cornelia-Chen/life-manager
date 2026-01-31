
import React, { useState } from 'react';
import { LanguageCode } from '../services/geminiService';

interface LayoutProps {
  children: React.ReactNode;
  currentLang: LanguageCode;
  onLangChange: (lang: LanguageCode) => void;
}

const LANGUAGES: { code: LanguageCode; label: string; flag: string }[] = [
  { code: 'zh-CN', label: '中文', flag: '🇨🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'es', label: 'Español', flag: '🇪🇸' }
];

export const Layout: React.FC<LayoutProps> = ({ children, currentLang, onLangChange }) => {
  const [isLangOpen, setIsLangOpen] = useState(false);

  const currentLangObj = LANGUAGES.find(l => l.code === currentLang) || LANGUAGES[0];

  return (
    <div className="min-h-screen flex flex-col selection:bg-pink-100 selection:text-pink-900">
      <header className="bg-white/80 backdrop-blur-md border-b border-purple-100 sticky top-0 z-50">
        <div className="max-w-md mx-auto px-6 h-16 flex items-center justify-between relative">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-pink-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-pink-200">
              <i className="fas fa-magic text-sm"></i> 
            </div>
            <h1 className="text-base font-extrabold text-purple-800 tracking-tight">Life Manager</h1>
          </div>
          
          <div className="flex items-center space-x-3">
             <div className="hidden sm:flex items-center space-x-2">
               <div className="w-2 h-2 rounded-full bg-pink-400 animate-pulse"></div>
               <span className="text-[9px] font-extrabold text-purple-400 uppercase tracking-widest">v3.0</span>
             </div>
             
             {/* Language Switcher */}
             <div className="relative">
               <button 
                 onClick={() => setIsLangOpen(!isLangOpen)}
                 className="flex items-center space-x-1.5 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-full border border-purple-100 transition-all active:scale-95"
               >
                 <span className="text-lg leading-none">{currentLangObj.flag}</span>
                 <i className={`fas fa-chevron-down text-[8px] text-purple-400 transition-transform ${isLangOpen ? 'rotate-180' : ''}`}></i>
               </button>

               {isLangOpen && (
                 <>
                   <div className="fixed inset-0 z-10" onClick={() => setIsLangOpen(false)}></div>
                   <div className="absolute right-0 top-full mt-2 w-32 bg-white rounded-xl shadow-xl border border-purple-100 p-1.5 z-20 animate-in fade-in zoom-in-95 duration-200">
                     {LANGUAGES.map((lang) => (
                       <button
                         key={lang.code}
                         onClick={() => { onLangChange(lang.code); setIsLangOpen(false); }}
                         className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                           currentLang === lang.code 
                             ? 'bg-purple-50 text-purple-800' 
                             : 'text-gray-500 hover:bg-gray-50'
                         }`}
                       >
                         <span className="text-base">{lang.flag}</span>
                         <span>{lang.label}</span>
                       </button>
                     ))}
                   </div>
                 </>
               )}
             </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto px-6 py-10">
        {children}
      </main>

      <footer className="py-8 text-center">
        <p className="text-[10px] font-bold text-purple-300 uppercase tracking-widest">
          Intelligent Inventory Assistant (哼)
        </p>
      </footer>
    </div>
  );
};
