
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, analyzeHaggling, LanguageCode } from '../services/geminiService';

interface ChatViewProps {
  sellerName: string;
  itemName: string;
  basePrice: number;
  targetLang: LanguageCode;
  onBack: () => void;
  initialMessages?: ChatMessage[];
  onMessageSent?: (text: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ sellerName, itemName, basePrice, targetLang, onBack, initialMessages, onMessageSent }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages || []);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), sender: 'me', text: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    
    if (onMessageSent) {
      onMessageSent(input);
    }

    const currentInput = input;
    setInput('');
    setIsTyping(true);

    // AI 代理分析对方心理
    const hint = await analyzeHaggling(currentInput, basePrice, targetLang);
    
    setTimeout(() => {
      const reply: ChatMessage = {
        id: (Date.now()+1).toString(),
        sender: 'other',
        text: 'Message received. The seller will get back to you shortly.',
        timestamp: Date.now(),
        aliceHint: hint
      };
      setMessages(prev => [...prev, reply]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-purple-50 flex flex-col animate-in slide-in-from-right duration-300">
      <div className="bg-white/80 backdrop-blur-xl border-b border-purple-100 px-6 py-4 flex items-center">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center text-purple-400"><i className="fas fa-chevron-left"></i></button>
        <div className="ml-3">
          <div className="font-black text-purple-800 text-sm">Chat with {sellerName}</div>
          <div className="text-[9px] text-pink-500 font-bold uppercase tracking-widest">Item: {itemName} (¥{basePrice})</div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 pb-32 custom-scrollbar">
        {messages.length === 0 && (
           <div className="text-center mt-10 text-purple-300 text-xs font-bold px-10">
              Start a private conversation with {sellerName} about this item.
           </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] px-5 py-3.5 rounded-3xl text-xs font-medium shadow-sm leading-relaxed ${
              msg.sender === 'me' ? 'bg-purple-800 text-white rounded-tr-none' : 'bg-white text-purple-900 rounded-tl-none border border-purple-100'
            }`}>
              {msg.text}
            </div>
            {msg.aliceHint && (
              <div className="mt-3 flex items-start space-x-2 animate-in fade-in slide-in-from-left duration-500 max-w-[90%]">
                 <div className="w-7 h-7 bg-pink-500 rounded-xl flex items-center justify-center text-white text-[10px] shrink-0 shadow-lg shadow-pink-200">
                    <i className="fas fa-robot"></i>
                 </div>
                 <div className="bg-pink-50 border border-pink-200 border-dashed rounded-2xl px-4 py-2.5 text-[10px] text-pink-700 italic leading-snug">
                    <span className="font-black uppercase block mb-1">Butler Analysis:</span>
                    {msg.aliceHint}
                 </div>
              </div>
            )}
          </div>
        ))}
        {isTyping && <div className="text-[9px] text-purple-300 font-black animate-pulse uppercase tracking-widest">Sending...</div>}
      </div>

      <div className="p-6 bg-white border-t border-purple-100">
        <div className="flex items-center bg-purple-50 rounded-[2rem] px-5 py-1">
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`Message ${sellerName}...`}
            className="flex-1 bg-transparent py-4 outline-none text-xs text-purple-900 font-bold"
          />
          <button onClick={handleSend} className="text-pink-500 p-2"><i className="fas fa-paper-plane"></i></button>
        </div>
      </div>
    </div>
  );
};
