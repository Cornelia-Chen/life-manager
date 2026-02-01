import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat, GenerateContentResponse, FunctionCall, LiveServerMessage, Modality } from "@google/genai";
import { OCRResult, ReceiptItem, processImageWithAI, LanguageCode, ButlerConfig, Personality, generateRecipes, Recipe, findItemTool, setTravelModeTool, addItemTool, consumeItemTool, TravelConfig } from '../services/geminiService';

interface ButlerViewProps {
  onBack: () => void;
  inventory: ReceiptItem[];
  addToInventory: (items: Partial<ReceiptItem & { price: number; quantity: number }>[]) => void;
  targetLang: LanguageCode;
  config: ButlerConfig;
  onChange: React.Dispatch<React.SetStateAction<ButlerConfig>>;
  onCook?: (recipe: Recipe) => void;
  onFindItem?: (name: string) => boolean; 
  onAddItemRequest?: (name?: string) => void; 
  onConsumeItemRequest?: (name: string) => string; 
  travelConfig?: TravelConfig;
  onSetTravelConfig?: (config: TravelConfig) => void;
}

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
};

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): any {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const PRESET_AVATARS = [
    {
        id: 'preset_alice_black',
        name: 'Alice (Default)',
        src: "https://raw.githubusercontent.com/Cornelia-Chen/fox-ai-butler-model/ca95e7a85fcefb8c8e932d6afa4a0a35dcc38a25/Subject%20(2).png"
    },
    {
        id: 'preset_fox',
        name: 'Fox Spirit',
        src: "https://raw.githubusercontent.com/Cornelia-Chen/fox-ai-butler-model/main/Subject.png"
    },
    {
        id: 'preset_robot_bean',
        name: 'pinkbean',
        src: "https://github.com/Cornelia-Chen/fox-ai-butler-model/blob/main/Subject%20(3).png?raw=true"
    }
];

const TEXT: Record<LanguageCode, any> = {
    'zh-CN': { chat: '聊天', style: '形象', scan: '扫描', chef: '厨師', placeholder: '告訴艾莉絲... (例如：相機在哪?)', review: '確認清單', confirm: '確認入庫', name: '稱呼', personality: '性格', appearance: '外觀', eyes: '眼睛', face: '臉型', customAvatar: '自定義形象', uploadAvatar: '上傳圖片', scale: '體型大小', presets: '預設形象', voxel: '3D原生' },
    'en': { chat: 'Chat', style: 'Style', scan: 'Scan', chef: 'Chef', placeholder: "Ask Alice... (e.g. 'Where is my camera?')", review: 'Review Items', confirm: 'Confirm', name: 'Name', personality: 'Personality', appearance: 'Appearance', eyes: 'Eyes', face: 'Face', customAvatar: 'Custom Avatar', uploadAvatar: 'Upload Image', scale: 'Avatar Scale', presets: 'Presets', voxel: 'Reset to Voxel' },
    'fr': { chat: 'Chat', style: 'Style', scan: 'Scan', chef: 'Chef', placeholder: 'Demandez à Alice...', review: 'Revisar', confirm: 'Confirmer', name: 'Nom', personality: 'Personnalité', appearance: 'Apparence', eyes: 'Yeux', face: 'Visage', customAvatar: 'Avatar Perso', uploadAvatar: 'Télécharger', scale: 'Taille Avatar', presets: 'Préréglages', voxel: 'Voxel 3D' },
    'ja': { chat: 'チャット', style: 'スタイル', scan: 'スキャン', chef: 'シェフ', placeholder: 'アリスに聞く... (例：カメラはどこ？)', review: '確認', confirm: '確定', name: '名前', personality: '性格', appearance: '外見', eyes: '目', face: '顔', customAvatar: 'カスタム画像', uploadAvatar: '画像をアップ', scale: 'サイズ', presets: 'プリセット', voxel: '3Dボクセル' },
    'es': { chat: 'Chat', style: 'Estilo', scan: 'Escanear', chef: 'Chef', placeholder: 'Pregunta a Alice...', review: 'Revisar', confirm: 'Confirmar', name: 'Nombre', personality: 'Personalidad', appearance: 'Apariencia', eyes: 'Ojos', face: 'Cara', customAvatar: 'Avatar Pers.', uploadAvatar: 'Subir Imagen', scale: 'Escala', presets: 'Preajustes', voxel: 'Voxel 3D' }
};

export const ButlerView: React.FC<ButlerViewProps> = ({ onBack, inventory, addToInventory, targetLang, config, onChange, onCook, onFindItem, onAddItemRequest, onConsumeItemRequest, travelConfig, onSetTravelConfig }) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'settings'>('chat');
  const [currentAiResponse, setCurrentAiResponse] = useState<string>('');
  const [inputMessage, setInputMessage] = useState<string>('');
  const [lastUserMessage, setLastUserMessage] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [ocrReviewItems, setOcrReviewItems] = useState<Partial<ReceiptItem & { price: number; quantity: number }>[] | null>(null);
  
  const [suggestedRecipes, setSuggestedRecipes] = useState<Recipe[] | null>(null);
  const [isChefLoading, setIsChefLoading] = useState(false);
  
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const liveSessionRef = useRef<any>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioWorkletNodeRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  const [ingredientAdjustments, setIngredientAdjustments] = useState<Record<string, number>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const isMounted = useRef(true);

  const t = TEXT[targetLang] || TEXT['zh-CN'];
  const API_KEY = process.env.API_KEY;

  useEffect(() => {
    isMounted.current = true;
    return () => { 
        isMounted.current = false; 
        cleanupVoice();
    };
  }, []);

  const cleanupVoice = () => {
      if (liveSessionRef.current) {
          liveSessionRef.current.close();
          liveSessionRef.current = null;
      }
      if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop());
          audioStreamRef.current = null;
      }
      if (inputAudioContextRef.current) {
          inputAudioContextRef.current.close();
          inputAudioContextRef.current = null;
      }
      if (outputAudioContextRef.current) {
          outputAudioContextRef.current.close();
          outputAudioContextRef.current = null;
      }
      audioSourcesRef.current.forEach(source => source.stop());
      audioSourcesRef.current.clear();
      setIsVoiceActive(false);
  };

  const toggleVoice = async () => {
      if (isVoiceActive) {
          cleanupVoice();
          return;
      }
      if (!API_KEY) {
          setCurrentAiResponse("No API Key for voice.");
          return;
      }
      try {
          setIsVoiceActive(true);
          const ai = new GoogleGenAI({ apiKey: API_KEY });
          const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
          const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          inputAudioContextRef.current = inputCtx;
          outputAudioContextRef.current = outputCtx;
          const outputNode = outputCtx.createGain();
          outputNode.connect(outputCtx.destination);
          const langInstructions: Record<LanguageCode, string> = { 'zh-CN': 'Chinese (Simplified)', 'en': 'English', 'fr': 'French', 'ja': 'Japanese', 'es': 'Spanish' };
          const systemInstruction = `You are '${config.name}', a helpful butler. Personality: ${config.personality}. Speak in ${langInstructions[targetLang] || 'English'}. Keep responses conversational and concise.`;
          const sessionPromise = ai.live.connect({
              model: 'gemini-2.5-flash-native-audio-preview-12-2025',
              config: {
                  responseModalities: [Modality.AUDIO],
                  systemInstruction: systemInstruction,
                  speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
              },
              callbacks: {
                  onopen: async () => {
                      try {
                          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                          audioStreamRef.current = stream;
                          const source = inputCtx.createMediaStreamSource(stream);
                          const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                          audioWorkletNodeRef.current = processor;
                          processor.onaudioprocess = (e) => {
                              const inputData = e.inputBuffer.getChannelData(0);
                              const pcmBlob = createBlob(inputData);
                              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                          };
                          source.connect(processor);
                          processor.connect(inputCtx.destination);
                      } catch (err) { cleanupVoice(); }
                  },
                  onmessage: async (msg: LiveServerMessage) => {
                      const base64Audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                      if (base64Audio) {
                          const ctx = outputAudioContextRef.current;
                          if (!ctx) return;
                          const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                          const source = ctx.createBufferSource();
                          source.buffer = audioBuffer;
                          source.connect(outputNode);
                          let startTime = nextStartTimeRef.current;
                          if (startTime < ctx.currentTime) startTime = ctx.currentTime;
                          source.start(startTime);
                          nextStartTimeRef.current = startTime + audioBuffer.duration;
                          audioSourcesRef.current.add(source);
                          source.onended = () => audioSourcesRef.current.delete(source);
                      }
                      if (msg.serverContent?.interrupted) {
                          audioSourcesRef.current.forEach(s => s.stop());
                          audioSourcesRef.current.clear();
                          nextStartTimeRef.current = 0;
                      }
                  },
                  onclose: () => setIsVoiceActive(false),
                  onerror: () => cleanupVoice()
              }
          });
          liveSessionRef.current = await sessionPromise;
      } catch (e) { cleanupVoice(); }
  };

  useEffect(() => {
    if (!API_KEY) {
      setCurrentAiResponse('API Key Missing!');
      return;
    }
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const langInstructions: Record<LanguageCode, string> = { 'zh-CN': 'Chinese (Simplified)', 'en': 'English', 'fr': 'French', 'ja': 'Japanese', 'es': 'Spanish' };
    const currentLangName = langInstructions[targetLang] || 'Chinese';
    const personalityMap: Record<Personality, string> = { 'strict': 'Strict, professional, no-nonsense.', 'gentle': 'Gentle, motherly, caring.', 'witty': 'Witty, sarcastic, playful.', 'robotic': 'Robotic, precise, efficient.' };
    const defaultPersona = personalityMap[config.personality] || personalityMap['strict'];
    const finalInstruction = config.customPrompt || `You are '${config.name}', a chibi intelligent butler. Your personality is: ${defaultPersona}
        1. Keep responses concise (under 40 words).
        2. Respond in ${currentLangName}.
        3. Help master manage assets and FIND items.
        4. Use tools: findItemInInventory, setTravelMode, addItemToInventory, consumeItem.`;
    const newChat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: finalInstruction,
        tools: [{ functionDeclarations: [findItemTool, setTravelModeTool, addItemTool, consumeItemTool] }],
      },
    });
    setChatSession(newChat);
    const greetings: Record<LanguageCode, string> = { 'zh-CN': `${config.name} 隨時為您服務。`, 'en': `${config.name} at your service.`, 'fr': `${config.name} à votre service.`, 'ja': `${config.name} です。ご用件は？`, 'es': `${config.name} a su servicio.` };
    if (travelConfig?.isTravelMode) {
        setCurrentAiResponse(travelConfig.endDate ? `Travel mode ON until ${new Date(travelConfig.endDate).toLocaleDateString()}.` : `Travel mode ON.`);
    } else {
        setCurrentAiResponse(greetings[targetLang] || greetings['en']);
    }
  }, [API_KEY, targetLang, config.name, config.personality, travelConfig, config.customPrompt]);

  const handleAiAction = async (actionPrompt: string) => {
    if (!chatSession || isAiLoading || !actionPrompt.trim()) return;
    setLastUserMessage(actionPrompt);
    setInputMessage('');
    setIsAiLoading(true);
    try {
      const response = await chatSession.sendMessage({ message: actionPrompt });
      if (response.functionCalls && response.functionCalls.length > 0) {
        const call = response.functionCalls[0];
        if (call.name === 'findItemInInventory') {
            const args = call.args as any;
            const found = onFindItem?.(args.itemName);
            if (!found) {
                const fr = await chatSession.sendMessage({ message: [{ functionResponse: { id: call.id, name: call.name, response: { result: 'Not found.' } } }] });
                if (isMounted.current) setCurrentAiResponse(fr.text || "Not found.");
            }
        } else if (call.name === 'consumeItem') {
            const args = call.args as any;
            const resultMsg = onConsumeItemRequest?.(args.itemName) || "Error.";
            const fr = await chatSession.sendMessage({ message: [{ functionResponse: { id: call.id, name: call.name, response: { result: resultMsg } } }] });
            if (isMounted.current) setCurrentAiResponse(fr.text || resultMsg);
        } else if (call.name === 'addItemToInventory') {
            onAddItemRequest?.((call.args as any).itemName);
        } else if (call.name === 'setTravelMode') {
            const args = call.args as any;
            onSetTravelConfig?.({ isTravelMode: args.isActive, startDate: args.startDate==='now'?Date.now():(args.startDate?new Date(args.startDate).getTime():undefined), endDate: args.endDate==='unknown'?undefined:(args.endDate?new Date(args.endDate).getTime():undefined) });
            const fr = await chatSession.sendMessage({ message: [{ functionResponse: { id: call.id, name: call.name, response: { result: 'Updated.' } } }] });
            if (isMounted.current) setCurrentAiResponse(fr.text || "Updated.");
        }
      } else {
        if (isMounted.current) setCurrentAiResponse(response.text || '...');
      }
    } catch (error) {
      if (isMounted.current) setCurrentAiResponse('My brain hurts.');
    } finally { if (isMounted.current) setIsAiLoading(false); }
  };

  const processUploadedImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || isAiLoading) return;
    setLastUserMessage('Scanning...');
    setCurrentAiResponse('Analyzing...');
    setIsAiLoading(true);
    try {
      const b64 = await blobToBase64(file);
      const res = await processImageWithAI(b64.split(',')[1], file.type, targetLang, inventory);
      if (isMounted.current) {
          if (res.items?.length) setOcrReviewItems(res.items);
          else setCurrentAiResponse('Nothing found.');
      }
    } catch (e) { setCurrentAiResponse('Failed.'); } finally { if (isMounted.current) { setIsAiLoading(false); event.target.value = ''; } }
  };

  const handleGetRecipes = async () => {
    setIsChefLoading(true);
    setLastUserMessage("What can I cook?");
    setCurrentAiResponse("Checking pantry...");
    setIngredientAdjustments({});
    try {
      const res = await generateRecipes(inventory, targetLang, config.personality);
      if (isMounted.current) {
          if (res?.length) setSuggestedRecipes(res);
          else setCurrentAiResponse("Nothing to cook.");
      }
    } catch (e) { setCurrentAiResponse("Failed."); } finally { if (isMounted.current) setIsChefLoading(false); }
  };

  const handleAdjustIngredient = (recipeId: string, itemId: string, delta: number) => {
    const key = `${recipeId}_${itemId}`;
    const invItem = inventory.find(i => i.id === itemId);
    const maxQty = invItem ? invItem.currentQuantity : Infinity;

    setIngredientAdjustments(prev => {
       let curr = prev[key];
       if (curr === undefined) {
           const ing = suggestedRecipes?.find(r => r.id === recipeId)?.ingredientsUsed.find(i => i.inventoryItemId === itemId);
           curr = ing ? ing.quantityToConsume : 1;
       }
       // Apply cap: clamp between 0 and max available stock
       // Use delta of 1 for portion-based adjustments as per request
       const nextVal = parseFloat((Number(curr) + delta).toFixed(2));
       return { ...prev, [key]: Math.min(maxQty, Math.max(0, nextVal)) };
    });
  };

  const handleCookRecipe = (recipe: Recipe) => {
    const mod: Recipe = { ...recipe, ingredientsUsed: recipe.ingredientsUsed.map(ing => ({ ...ing, quantityToConsume: ingredientAdjustments[`${recipe.id}_${ing.inventoryItemId}`] ?? ing.quantityToConsume })) };
    onCook?.(mod);
    setSuggestedRecipes(null);
    setCurrentAiResponse(`Cooked ${mod.name}. Info updated on main page.`);
  };

  const updateAppearance = (key: keyof ButlerConfig['appearance'], value: any) => onChange(p => ({ ...p, appearance: { ...p.appearance, [key]: value } }));

  return (
    <div className="animate-in fade-in duration-500 flex flex-col flex-1 h-full bg-gradient-to-br from-purple-100 to-pink-100 p-4 rounded-3xl shadow-lg relative">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-purple-400 text-white rounded-lg shadow-md mr-4 active:scale-95 transition-all"><i className="fas fa-chevron-left text-sm"></i></button>
          <h2 className="text-xl font-black text-purple-800 tracking-wide">{config.name}</h2>
        </div>
        <div className="flex bg-white/50 p-1 rounded-xl">
          <button onClick={() => setActiveTab('chat')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'chat' ? 'bg-pink-500 text-white shadow-md' : 'text-purple-400'}`}>{t.chat}</button>
          <button onClick={() => setActiveTab('settings')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'settings' ? 'bg-purple-600 text-white shadow-md' : 'text-purple-400'}`}>{t.style}</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center p-4 relative overflow-y-auto">
        <div className={`relative w-32 h-32 rounded-full overflow-hidden shadow-xl border-4 border-white mb-8 ${isAiLoading || isChefLoading || isVoiceActive ? 'animate-pulse' : ''}`}>
          {config.appearance.customAvatar ? <img src={config.appearance.customAvatar} className="w-full h-full object-cover object-top" alt="Avatar" /> : <div className={`absolute w-full h-full flex items-center justify-center ${config.personality === 'strict' ? 'bg-slate-700' : config.personality === 'gentle' ? 'bg-pink-200' : 'bg-indigo-400'}`}><div className="text-4xl text-white">👤</div></div>}
        </div>

        {activeTab === 'chat' ? (
          <>
            <div className="relative w-full p-5 bg-white/90 backdrop-blur border-2 border-purple-200 rounded-3xl shadow-lg text-center mb-6 min-h-[80px] flex items-center justify-center">
              <p className="text-sm font-bold text-purple-800 leading-relaxed">{isVoiceActive ? <span className="animate-pulse text-pink-500">Listening...</span> : (currentAiResponse || t.placeholder)}</p>
            </div>
            <div className="w-full mt-auto space-y-3">
              <div className="flex space-x-2 w-full">
                <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-3 bg-pink-500 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all text-[10px] flex flex-col items-center justify-center gap-1"><i className="fas fa-camera text-sm"></i><span>{t.scan}</span></button>
                <input type="file" ref={fileInputRef} onChange={processUploadedImage} className="hidden" accept="image/*" />
                <button onClick={handleGetRecipes} className="flex-1 py-3 bg-orange-400 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all text-[10px] flex flex-col items-center justify-center gap-1"><i className="fas fa-utensils text-sm"></i><span>{t.chef}</span></button>
              </div>
              <div className="w-full flex items-center bg-white rounded-full shadow-md border border-purple-100 p-1">
                <input value={inputMessage} onChange={e => setInputMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAiAction(inputMessage)} placeholder={t.placeholder} className="flex-1 px-4 py-2 text-xs text-purple-800 bg-transparent outline-none" />
                <button onClick={() => handleAiAction(inputMessage)} className="w-10 h-10 rounded-full bg-purple-100 text-purple-500 flex items-center justify-center mr-1"><i className="fas fa-paper-plane text-xs"></i></button>
                <button onClick={toggleVoice} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isVoiceActive ? 'bg-red-500 text-white animate-pulse' : 'bg-purple-100 text-purple-500'}`}><i className={`fas ${isVoiceActive ? 'fa-stop' : 'fa-microphone'} text-xs`}></i></button>
              </div>
            </div>
          </>
        ) : (
          <div className="w-full space-y-6 pb-10">
             <div className="space-y-2">
               <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest ml-2">{t.name}</label>
               <input value={config.name} onChange={e => onChange(p => ({...p, name: e.target.value}))} className="w-full p-4 bg-white rounded-2xl border border-purple-100 text-purple-800 font-bold outline-none focus:border-pink-300" />
             </div>
             <div className="space-y-2">
               <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest ml-2">{t.personality}</label>
               <div className="grid grid-cols-2 gap-2">
                 {(['strict', 'gentle', 'witty', 'robotic'] as Personality[]).map(p => (
                   <button key={p} onClick={() => onChange(prev => ({...prev, personality: p}))} className={`py-3 rounded-xl text-xs font-bold capitalize transition-all border-2 ${config.personality === p ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-transparent bg-white text-purple-300'}`}>{p}</button>
                 ))}
               </div>
             </div>
             <div className="space-y-2">
               <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest ml-2">{t.appearance}</label>
               <div className="bg-white p-4 rounded-2xl border border-purple-100 space-y-4">
                  <div className="flex justify-between items-center"><span className="text-xs font-bold text-purple-800">{t.customAvatar}</span><button onClick={() => avatarInputRef.current?.click()} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-pink-500 text-white shadow-md active:scale-95 transition-transform"><i className="fas fa-upload"></i></button><input type="file" ref={avatarInputRef} onChange={e => { const f = e.target.files?.[0]; if(f){ const r = new FileReader(); r.onloadend = () => updateAppearance('customAvatar', r.result as string); r.readAsDataURL(f); } }} className="hidden" /></div>
                  <div className="space-y-2"><label className="text-[9px] font-black text-purple-400 uppercase tracking-widest">{t.presets}</label><div className="grid grid-cols-4 gap-2"><button onClick={() => updateAppearance('customAvatar', undefined)} className={`aspect-square rounded-xl border-2 overflow-hidden relative ${!config.appearance.customAvatar ? 'border-pink-500' : 'border-purple-100'}`}><div className="flex items-center justify-center h-full text-xl">👩‍🍳</div></button>{PRESET_AVATARS.map(p => (<button key={p.id} onClick={() => updateAppearance('customAvatar', p.src)} className={`aspect-square rounded-xl border-2 overflow-hidden ${config.appearance.customAvatar === p.src ? 'border-pink-500' : 'border-purple-100'}`}><img src={p.src} className="w-full h-full object-cover" /></button>))}</div></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-purple-400 uppercase ml-2">{t.scale}: {(config.appearance.scale || 1).toFixed(2)}x</label><input type="range" min="0.1" max="2.0" step="0.05" value={config.appearance.scale || 1} onChange={e => updateAppearance('scale', parseFloat(e.target.value))} className="w-full accent-pink-500" /></div>
               </div>
             </div>
          </div>
        )}
      </div>

      {suggestedRecipes && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border border-purple-200 w-full max-w-sm max-h-[85vh] flex flex-col">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-black text-purple-800">Alice's Menu</h3>
                <button onClick={() => setSuggestedRecipes(null)} className="w-8 h-8 flex items-center justify-center bg-purple-50 text-purple-400 rounded-full active:scale-90 transition-transform"><i className="fas fa-times"></i></button>
             </div>
             <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                {suggestedRecipes.map((recipe) => (
                   <div key={recipe.id} className="bg-purple-50 p-4 rounded-2xl border border-purple-100 flex flex-col gap-2">
                       <div className="flex items-center gap-2 mb-1">
                           <span className="text-2xl">{recipe.emoji || '🍽️'}</span>
                           <div className="font-black text-purple-800 text-sm">{recipe.name}</div>
                       </div>
                       <p className="text-[10px] text-purple-600 italic mb-2 leading-relaxed">"{recipe.description}"</p>
                       <div className="space-y-2">
                           <div className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Ingredients & Adjustment:</div>
                           {recipe.ingredientsUsed.map((ing, i) => {
                               const key = `${recipe.id}_${ing.inventoryItemId}`;
                               const cur = ingredientAdjustments[key] ?? ing.quantityToConsume;
                               const inv = inventory.find(v => v.id === ing.inventoryItemId);
                               const maxAvailable = inv ? inv.currentQuantity : 0;
                               
                               return (
                                 <div key={i} className="flex justify-between items-center bg-white border border-purple-100 px-3 py-2 rounded-xl">
                                     <div className="flex flex-col flex-1 min-w-0">
                                         <span className="text-[10px] font-bold text-purple-700 truncate">{ing.name}</span>
                                         <span className="text-[7px] font-black text-purple-300 uppercase">Stock: {maxAvailable.toFixed(1)}</span>
                                     </div>
                                     <div className="flex items-center gap-2">
                                        <div className="flex items-center bg-purple-50 rounded-lg p-0.5 border border-purple-100">
                                            <button 
                                              onClick={() => handleAdjustIngredient(recipe.id, ing.inventoryItemId, -1)} 
                                              className="w-7 h-7 flex items-center justify-center text-purple-400 active:bg-purple-100 rounded-md transition-all"
                                            >
                                              <i className="fas fa-minus text-[10px]"></i>
                                            </button>
                                            <span className={`text-xs font-black w-8 text-center ${cur >= maxAvailable && maxAvailable > 0 ? 'text-pink-500' : 'text-purple-800'}`}>{cur}</span>
                                            <button 
                                              onClick={() => handleAdjustIngredient(recipe.id, ing.inventoryItemId, 1)} 
                                              className="w-7 h-7 flex items-center justify-center text-purple-400 active:bg-purple-100 rounded-md transition-all disabled:opacity-30"
                                              disabled={cur >= maxAvailable}
                                            >
                                              <i className="fas fa-plus text-[10px]"></i>
                                            </button>
                                        </div>
                                        <span className="text-[9px] font-black text-purple-300 w-6 uppercase">{inv?.unit}</span>
                                     </div>
                                 </div>
                               );
                           })}
                       </div>
                       <button onClick={() => handleCookRecipe(recipe)} className="mt-4 w-full py-3.5 bg-orange-400 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all text-xs flex items-center justify-center gap-2"><i className="fas fa-fire-burner"></i><span>Cook & Consume</span></button>
                   </div>
                ))}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};