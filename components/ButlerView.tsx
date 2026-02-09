
// ... existing imports
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
  onFindItem?: (name: string) => boolean; // Callback to find item
  onAddItemRequest?: (name?: string) => void; // Callback to add item
  onConsumeItemRequest?: (name: string) => string; // Callback to consume item, returns status string
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

// --- Audio Helpers for Live API ---
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
    'zh-CN': { chat: '聊天', style: '形象', scan: '扫描', chef: '厨师', placeholder: '告诉艾莉丝... (例如：相机在哪?)', review: '确认清单', confirm: '确认入库', name: '称呼', personality: '性格', appearance: '外观', eyes: '眼睛', face: '脸型', customAvatar: '自定义形象', uploadAvatar: '上传图片', scale: '体型大小', presets: '预设形象', voxel: '3D原生' },
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
  
  // Recipe State
  const [suggestedRecipes, setSuggestedRecipes] = useState<Recipe[] | null>(null);
  const [isChefLoading, setIsChefLoading] = useState(false);
  
  // Voice/Live State
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const liveSessionRef = useRef<any>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioWorkletNodeRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // State to track ingredient adjustments: { "recipeId_inventoryItemId": newQuantity }
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
          
          // Setup Audio Contexts
          const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
          const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          inputAudioContextRef.current = inputCtx;
          outputAudioContextRef.current = outputCtx;
          
          const outputNode = outputCtx.createGain();
          outputNode.connect(outputCtx.destination);
          
          const langInstructions: Record<LanguageCode, string> = {
            'zh-CN': 'Chinese (Simplified)', 'en': 'English', 'fr': 'French', 'ja': 'Japanese', 'es': 'Spanish'
          };
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
                          // Use ScriptProcessor for broader compatibility (vs AudioWorklet which needs separate file)
                          const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                          audioWorkletNodeRef.current = processor;
                          
                          processor.onaudioprocess = (e) => {
                              const inputData = e.inputBuffer.getChannelData(0);
                              const pcmBlob = createBlob(inputData);
                              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                          };
                          
                          source.connect(processor);
                          processor.connect(inputCtx.destination);
                      } catch (err) {
                          console.error("Mic error", err);
                          cleanupVoice();
                      }
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
                          
                          // Gapless playback logic
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
                  onclose: () => {
                      setIsVoiceActive(false);
                  },
                  onerror: (e) => {
                      console.error("Live Error", e);
                      cleanupVoice();
                  }
              }
          });
          
          liveSessionRef.current = await sessionPromise;

      } catch (e) {
          console.error("Failed to start voice", e);
          cleanupVoice();
      }
  };

  useEffect(() => {
    if (!API_KEY) {
      setCurrentAiResponse('API Key Missing!');
      return;
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });
    
    const langInstructions: Record<LanguageCode, string> = {
      'zh-CN': 'Chinese (Simplified)',
      'en': 'English',
      'fr': 'French',
      'ja': 'Japanese',
      'es': 'Spanish'
    };
    
    const currentLangName = langInstructions[targetLang] || 'Chinese';
    
    // Personality instructions map
    const personalityMap: Record<Personality, string> = {
      'strict': 'Strict, professional, no-nonsense, slightly scary.',
      'gentle': 'Gentle, motherly, caring, soft-spoken.',
      'witty': 'Witty, sarcastic, playful, sharp.',
      'robotic': 'Robotic, precise, emotionless, efficient.'
    };
    
    const defaultPersona = personalityMap[config.personality] || personalityMap['strict'];
    const finalInstruction = config.customPrompt || `You are '${config.name}', a chibi intelligent butler. Your personality is: ${defaultPersona}
        1. Keep responses concise (under 40 words).
        2. Respond in ${currentLangName}.
        3. Help master manage assets, track prices, and FIND items in the house.
        4. If the user asks where something is, use the 'findItemInInventory' tool.
        5. If the user mentions going on a trip/vacation, use the 'setTravelMode' tool to pause consumption tracking.
        6. If the user wants to add, buy, or register a new item, use the 'addItemToInventory' tool.
        7. If the user says an item is finished/empty/consumed, use the 'consumeItem' tool to mark it and calculate usage.`;

    const newChat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: finalInstruction,
        tools: [{ functionDeclarations: [findItemTool, setTravelModeTool, addItemTool, consumeItemTool] }],
      },
    });
    setChatSession(newChat);
    
    const greetings: Record<LanguageCode, string> = {
      'zh-CN': `${config.name} 随时为您服务。`,
      'en': `${config.name} at your service.`,
      'fr': `${config.name} à votre service.`,
      'ja': `${config.name} です。ご用件は？`,
      'es': `${config.name} a su servicio.`
    };
    
    // Special Travel Mode Greeting
    if (travelConfig?.isTravelMode) {
        setCurrentAiResponse(travelConfig.endDate 
            ? `Travel mode ON until ${new Date(travelConfig.endDate).toLocaleDateString()}. Relax, I'm watching the house.` 
            : `Travel mode ON. I'll pause consumption tracking.`);
    } else {
        setCurrentAiResponse(greetings[targetLang] || greetings['en']);
    }

  }, [API_KEY, targetLang, config.name, config.personality, travelConfig, config.customPrompt]);

  const handleAiAction = async (actionPrompt: string) => {
    if (!chatSession || isAiLoading || !actionPrompt.trim()) return;
    
    setLastUserMessage(actionPrompt);
    setInputMessage(''); // Clear input immediately for better UX
    setIsAiLoading(true);
    
    try {
      const response = await chatSession.sendMessage({ message: actionPrompt });
      
      // Handle Function Calling
      if (response.functionCalls && response.functionCalls.length > 0) {
        const call = response.functionCalls[0];
        if (call.name === 'findItemInInventory') {
            const args = call.args as any;
            const itemName = args.itemName;
            
            // Execute Client Logic
            const found = onFindItem?.(itemName);
            
            if (found) {
                return;
            } else {
                const functionResponse = await chatSession.sendMessage({
                    message: [{
                        functionResponse: {
                            id: call.id,
                            name: call.name,
                            response: { result: 'Item not found in inventory.' }
                        }
                    }]
                });
                if (isMounted.current) {
                    setCurrentAiResponse(functionResponse.text || "I couldn't find that item in your records.");
                }
            }
        } else if (call.name === 'consumeItem') {
            const args = call.args as any;
            const resultMsg = onConsumeItemRequest?.(args.itemName) || "Could not consume item.";
            
            // Send result back to model to let it confirm naturally
            const functionResponse = await chatSession.sendMessage({
                message: [{
                    functionResponse: {
                        id: call.id,
                        name: call.name,
                        response: { result: resultMsg }
                    }
                }]
            });
            if (isMounted.current) {
                setCurrentAiResponse(functionResponse.text || resultMsg);
            }
        } else if (call.name === 'addItemToInventory') {
            const args = call.args as any;
            onAddItemRequest?.(args.itemName);
            return;
        } else if (call.name === 'setTravelMode') {
            const args = call.args as any;
            const isActive = args.isActive;
            const start = args.startDate === 'now' ? Date.now() : (args.startDate ? new Date(args.startDate).getTime() : undefined);
            const end = args.endDate === 'unknown' ? undefined : (args.endDate ? new Date(args.endDate).getTime() : undefined);

            onSetTravelConfig?.({ isTravelMode: isActive, startDate: start, endDate: end });

            const functionResponse = await chatSession.sendMessage({
                message: [{
                    functionResponse: {
                        id: call.id,
                        name: call.name,
                        response: { result: isActive ? 'Travel mode activated.' : 'Travel mode deactivated.' }
                    }
                }]
            });
            if (isMounted.current) {
                setCurrentAiResponse(functionResponse.text || (isActive ? "Safe travels! I'll hold the fort." : "Welcome back!"));
            }
        }
      } else {
        if (isMounted.current) {
            setCurrentAiResponse(response.text || '...');
        }
      }

    } catch (error) {
      if (isMounted.current) {
          setCurrentAiResponse('Troublesome... my brain hurts.');
      }
    } finally {
      if (isMounted.current) {
          setIsAiLoading(false);
      }
    }
  };

  const processUploadedImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || isAiLoading) return;
    
    setLastUserMessage('Scanning receipt...');
    setCurrentAiResponse('Analyzing...');
    setIsAiLoading(true);
    
    try {
      const base64Data = await blobToBase64(file);
      const ocrResult = await processImageWithAI(base64Data.split(',')[1], file.type, targetLang, inventory);
      if (isMounted.current) {
          if (ocrResult.items && ocrResult.items.length > 0) {
            setOcrReviewItems(ocrResult.items);
            setCurrentAiResponse('Done. Please review items and add prices if needed.');
          } else {
            setCurrentAiResponse('Found nothing.');
          }
      }
    } catch (error: any) {
      if (isMounted.current) {
          setCurrentAiResponse('Recognition failed.');
      }
    } finally {
      if (isMounted.current) {
          setIsAiLoading(false);
          event.target.value = '';
      }
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              updateAppearance('customAvatar', reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleReviewItemUpdate = (index: number, field: string, value: any) => {
    setOcrReviewItems(prev => {
      if (!prev) return prev;
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [field]: value };
      return newItems;
    });
  };

  const handleConfirmAddToInventory = () => {
    if (ocrReviewItems) {
      addToInventory(ocrReviewItems);
      setCurrentAiResponse(`Added to inventory.`);
      setOcrReviewItems(null);
    }
  };

  const handleGetRecipes = async () => {
    setIsChefLoading(true);
    setLastUserMessage("What can I cook with my current inventory?");
    setCurrentAiResponse("Checking the pantry... don't expect a Michelin meal.");
    setIngredientAdjustments({}); // Reset adjustments
    
    try {
      const recipes = await generateRecipes(inventory, targetLang, config.personality);
      if (isMounted.current) {
          if (recipes && recipes.length > 0) {
            setSuggestedRecipes(recipes);
            setCurrentAiResponse("I found a few things even you couldn't ruin.");
          } else {
            setCurrentAiResponse("You have nothing useful. Go shopping.");
          }
      }
    } catch (e) {
      if (isMounted.current) setCurrentAiResponse("Failed to find recipes.");
    } finally {
      if (isMounted.current) setIsChefLoading(false);
    }
  };

  const handleAdjustIngredient = (recipeId: string, itemId: string, delta: number) => {
    const key = `${recipeId}_${itemId}`;
    setIngredientAdjustments(prev => {
       let currentVal = prev[key];
       if (currentVal === undefined) {
           const recipe = suggestedRecipes?.find(r => r.id === recipeId);
           const ingredient = recipe?.ingredientsUsed.find(i => i.inventoryItemId === itemId);
           currentVal = ingredient ? ingredient.quantityToConsume : 1;
       }
       const newVal = Math.max(0, currentVal + delta);
       return { ...prev, [key]: newVal };
    });
  };

  const handleCookRecipe = (originalRecipe: Recipe) => {
    const modifiedRecipe: Recipe = {
        ...originalRecipe,
        ingredientsUsed: originalRecipe.ingredientsUsed.map(ing => {
            const key = `${originalRecipe.id}_${ing.inventoryItemId}`;
            const adjustedQty = ingredientAdjustments[key];
            return {
                ...ing,
                quantityToConsume: adjustedQty !== undefined ? adjustedQty : ing.quantityToConsume
            };
        })
    };

    onCook?.(modifiedRecipe);
    setSuggestedRecipes(null);
    setCurrentAiResponse(`Ingredients consumed for ${modifiedRecipe.name}. Bon appétit!`);
  };

  // --- Settings Handlers ---
  const updateConfig = (key: keyof ButlerConfig, value: any) => {
    onChange(prev => ({ ...prev, [key]: value }));
  };
  
  const updateAppearance = (key: keyof ButlerConfig['appearance'], value: any) => {
    onChange(prev => ({ ...prev, appearance: { ...prev.appearance, [key]: value } }));
  };

  return (
    <div className="animate-in fade-in duration-500 flex flex-col flex-1 h-full bg-gradient-to-br from-purple-100 to-pink-100 p-4 rounded-3xl shadow-lg relative">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-purple-400 text-white rounded-lg shadow-md mr-4 hover:bg-purple-500 transition-colors">
            <i className="fas fa-chevron-left text-sm"></i>
          </button>
          <h2 className="text-xl font-black text-purple-800 tracking-wide">{config.name}</h2>
        </div>
        <div className="flex bg-white/50 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('chat')} 
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'chat' ? 'bg-pink-500 text-white shadow-md' : 'text-purple-400'}`}
          >
            {t.chat}
          </button>
          <button 
            onClick={() => setActiveTab('settings')} 
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'settings' ? 'bg-purple-600 text-white shadow-md' : 'text-purple-400'}`}
          >
            {t.style}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center p-4 relative overflow-y-auto">
        
        {/* Avatar Display (Large) */}
        <div className={`relative w-32 h-32 rounded-full overflow-hidden shadow-xl border-4 border-white mb-8 ${isAiLoading || isChefLoading || isVoiceActive ? 'animate-pulse' : ''}`}>
          {config.appearance.customAvatar ? (
              <img src={config.appearance.customAvatar} alt="Butler Avatar" className="w-full h-full object-cover object-top" />
          ) : (
              <div className={`absolute w-full h-full flex items-center justify-center transition-colors duration-500 ${config.personality === 'strict' ? 'bg-slate-700' : config.personality === 'gentle' ? 'bg-pink-200' : 'bg-indigo-400'}`}>
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24`}>
                  
                  {/* Hair Back (Long) */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-36 h-36 bg-pink-400 rounded-full scale-100 -z-10" />

                  {/* Body (Blue Shirt) */}
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-20 h-16 bg-blue-400 rounded-t-3xl z-0 flex justify-center shadow-inner">
                    <div className="mt-1 w-6 h-6 bg-white rotate-45" /> {/* Collar */}
                  </div>

                  {/* Face (White) */}
                  <div className={`absolute inset-0 rounded-full bg-white overflow-hidden ${config.appearance.face === 'slim' ? 'scale-x-90' : ''} shadow-md`}>
                      {/* Continuous Bangs - No gap */}
                      <div className="absolute top-0 left-0 w-full h-12 z-10">
                          <div className="absolute top-0 w-full h-8 bg-pink-400 rounded-b-xl" />
                      </div>

                      {/* Eyes */}
                      <div className="absolute top-9 left-1/2 -translate-x-1/2 flex space-x-4 w-full justify-center z-10">
                        <div className="w-4 h-5 bg-stone-800 rounded-full relative">
                          <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-white rounded-full opacity-90" />
                        </div>
                        <div className="w-4 h-5 bg-stone-800 rounded-full relative">
                          <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-white rounded-full opacity-90" />
                        </div>
                      </div>

                      {/* Blush */}
                      <div className="absolute top-16 left-3 w-5 h-2 bg-pink-300 rounded-full blur-[3px] opacity-40 z-10" />
                      <div className="absolute top-16 right-3 w-5 h-2 bg-pink-300 rounded-full blur-[3px] opacity-40 z-10" />
                      
                      {/* Mouth */}
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-3 h-1 bg-pink-500 rounded-full opacity-60 z-10" />
                  </div>
                </div>
              </div>
          )}
        </div>

        {activeTab === 'chat' ? (
          <>
             {/* Show User's Last Message if exists */}
            {lastUserMessage && (
               <div className="w-full flex justify-end mb-2 px-2 animate-in slide-in-from-right duration-300">
                  <div className="bg-purple-600 text-white px-4 py-2 rounded-2xl rounded-tr-sm text-xs shadow-md max-w-[80%] font-medium">
                     {lastUserMessage}
                  </div>
               </div>
            )}

            <div className="relative w-full p-5 bg-white/90 backdrop-blur border-2 border-purple-200 rounded-3xl shadow-lg text-center mb-6 min-h-[80px] flex items-center justify-center">
              <p className="text-sm font-bold text-purple-800 leading-relaxed">
                 {isVoiceActive ? <span className="animate-pulse text-pink-500">Listening...</span> : (currentAiResponse || <span className="text-purple-300 italic text-xs">Waiting for input...</span>)}
              </p>
            </div>

            <div className="w-full mt-auto space-y-3">
              {/* Function Buttons Row */}
              <div className="flex space-x-2 w-full">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-3 bg-pink-500 text-white font-black rounded-2xl shadow-lg hover:bg-pink-600 active:scale-95 transition-all text-[10px] flex flex-col items-center justify-center gap-1"
                  disabled={isAiLoading || isChefLoading || isVoiceActive}
                >
                  <i className="fas fa-camera text-sm"></i>
                  <span>{t.scan}</span>
                </button>
                <input type="file" ref={fileInputRef} onChange={processUploadedImage} accept="image/*" className="hidden" />

                <button
                  onClick={handleGetRecipes}
                  className="flex-1 py-3 bg-orange-400 text-white font-black rounded-2xl shadow-lg hover:bg-orange-500 active:scale-95 transition-all text-[10px] flex flex-col items-center justify-center gap-1"
                  disabled={isAiLoading || isChefLoading || isVoiceActive}
                >
                  <i className="fas fa-utensils text-sm"></i>
                  <span>{t.chef}</span>
                </button>
              </div>
              
              <div className="w-full flex items-center bg-white rounded-full shadow-md border border-purple-100 p-1 space-x-1">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAiAction(inputMessage)}
                  placeholder={t.placeholder}
                  className="flex-1 px-4 py-2 text-xs text-purple-800 bg-transparent outline-none"
                  disabled={isVoiceActive}
                />
                <button
                  onClick={() => handleAiAction(inputMessage)}
                  className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-500 hover:bg-purple-200 transition-colors"
                  disabled={isVoiceActive}
                >
                  <i className="fas fa-paper-plane text-xs"></i>
                </button>
                <button
                  onClick={toggleVoice}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isVoiceActive ? 'bg-red-500 text-white animate-pulse shadow-red-200 shadow-lg' : 'bg-purple-100 text-purple-500 hover:bg-purple-200'}`}
                >
                  <i className={`fas ${isVoiceActive ? 'fa-stop' : 'fa-microphone'} text-xs`}></i>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="w-full space-y-6 animate-in slide-in-from-right duration-300 pb-10">
             {/* ... Settings Content (Name, Personality, etc) ... */}
             <div className="space-y-2">
               <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest ml-2">{t.name}</label>
               <input 
                 value={config.name} 
                 onChange={(e) => updateConfig('name', e.target.value)}
                 className="w-full p-4 bg-white rounded-2xl border border-purple-100 text-purple-800 font-bold outline-none focus:border-pink-300"
               />
             </div>

             <div className="space-y-2">
               <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest ml-2">{t.personality}</label>
               <div className="grid grid-cols-2 gap-2">
                 {(['strict', 'gentle', 'witty', 'robotic'] as Personality[]).map(p => (
                   <button
                     key={p}
                     onClick={() => updateConfig('personality', p)}
                     className={`py-3 rounded-xl text-xs font-bold capitalize transition-all border-2 ${config.personality === p ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-transparent bg-white text-purple-300'}`}
                   >
                     {p}
                   </button>
                 ))}
               </div>
             </div>

             <div className="space-y-2">
               <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest ml-2">System Instructions (Prompt)</label>
               <textarea
                 value={config.customPrompt || ''}
                 onChange={(e) => updateConfig('customPrompt', e.target.value)}
                 placeholder="Override Alice's personality and instructions..."
                 className="w-full p-3 bg-white rounded-2xl border border-purple-100 text-xs text-purple-800 font-medium outline-none focus:border-pink-300 min-h-[80px] resize-none"
               />
             </div>

             <div className="space-y-2">
               <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest ml-2">{t.appearance}</label>
               <div className="bg-white p-4 rounded-2xl border border-purple-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-purple-800">{t.customAvatar}</span>
                    <button onClick={() => avatarInputRef.current?.click()} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-pink-500 text-white shadow-md active:scale-95 transition-transform flex items-center gap-2">
                        <i className="fas fa-upload"></i> {t.uploadAvatar}
                    </button>
                    <input type="file" ref={avatarInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
                  </div>
                  
                  {/* Preset Avatars Section */}
                  <div className="space-y-2">
                      <label className="text-[9px] font-black text-purple-400 uppercase tracking-widest">{t.presets}</label>
                      <div className="grid grid-cols-4 gap-2">
                          <button 
                             onClick={() => updateAppearance('customAvatar', undefined)}
                             className={`aspect-square rounded-xl border-2 overflow-hidden relative group ${!config.appearance.customAvatar ? 'border-pink-500 ring-2 ring-pink-100' : 'border-purple-100'}`}
                             title={t.voxel}
                          >
                              <div className="absolute inset-0 bg-pink-100 flex items-center justify-center text-xl">👩‍🍳</div>
                              <div className="absolute bottom-0 w-full text-[6px] text-center bg-white/80 font-bold py-0.5">3D VOXEL</div>
                          </button>
                          
                          {PRESET_AVATARS.map(preset => (
                              <button
                                 key={preset.id}
                                 onClick={() => updateAppearance('customAvatar', preset.src)}
                                 className={`aspect-square rounded-xl border-2 overflow-hidden relative group ${config.appearance.customAvatar === preset.src ? 'border-pink-500 ring-2 ring-pink-100' : 'border-purple-100'}`}
                                 title={preset.name}
                              >
                                  <img src={preset.src} alt={preset.name} className="w-full h-full object-cover object-top" />
                              </button>
                          ))}
                      </div>
                  </div>

                  <div className="w-full h-px bg-purple-50 my-2"></div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest ml-2">{t.scale}: {(config.appearance.scale || 1).toFixed(2)}x</label>
                    <input 
                      type="range" 
                      min="0.1" 
                      max="2.0" 
                      step="0.05" 
                      value={config.appearance.scale || 1} 
                      onChange={(e) => updateAppearance('scale', parseFloat(e.target.value))}
                      className="w-full accent-pink-500"
                    />
                  </div>

                  <div className="w-full h-px bg-purple-50 my-2"></div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-purple-800">{t.eyes}</span>
                    <div className="flex space-x-2">
                       <button onClick={() => updateAppearance('eyes', 'large')} className={`px-3 py-1 rounded-lg text-[10px] font-bold ${config.appearance.eyes === 'large' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-400'}`}>Large</button>
                       <button onClick={() => updateAppearance('eyes', 'cool')} className={`px-3 py-1 rounded-lg text-[10px] font-bold ${config.appearance.eyes === 'cool' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-400'}`}>Cool</button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-purple-800">{t.face}</span>
                    <div className="flex space-x-2">
                       <button onClick={() => updateAppearance('face', 'round')} className={`px-3 py-1 rounded-lg text-[10px] font-bold ${config.appearance.face === 'round' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-400'}`}>Round</button>
                       <button onClick={() => updateAppearance('face', 'slim')} className={`px-3 py-1 rounded-lg text-[10px] font-bold ${config.appearance.face === 'slim' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-400'}`}>Slim</button>
                    </div>
                  </div>
               </div>
             </div>
          </div>
        )}
      </div>

      {/* OCR Review Modal */}
      {ocrReviewItems && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white p-6 rounded-[2rem] shadow-2xl border border-purple-200 w-full max-w-sm">
            <h3 className="text-lg font-black text-purple-800 mb-4">{t.review}</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar mb-6">
              {ocrReviewItems.map((item, index) => (
                <div key={index} className="flex flex-col p-3 bg-purple-50 rounded-xl border border-purple-100 space-y-2">
                  <div className="flex items-center">
                      <div className="text-3xl mr-3">{item.emoji}</div>
                      <div className="flex-1">
                        <div className="font-bold text-purple-800 text-xs">{item.translatedName}</div>
                      </div>
                  </div>
                  <div className="flex gap-2">
                      <div className="flex-1">
                          <label className="text-[8px] font-bold text-purple-400 uppercase">Qty</label>
                          <input
                            type="number"
                            value={item.quantity || ''}
                            onChange={(e) => handleReviewItemUpdate(index, 'quantity', parseFloat(e.target.value))}
                            className="w-full px-2 py-1 text-xs bg-white border border-purple-200 rounded-md focus:ring-pink-500 text-purple-700 outline-none"
                          />
                      </div>
                      <div className="flex-1">
                          <label className="text-[8px] font-bold text-purple-400 uppercase">Unit</label>
                          <input
                            type="text"
                            value={item.unit || ''}
                            onChange={(e) => handleReviewItemUpdate(index, 'unit', e.target.value)}
                            className="w-full px-2 py-1 text-xs bg-white border border-purple-200 rounded-md focus:ring-pink-500 text-purple-700 outline-none"
                          />
                      </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[9px] font-bold text-purple-400 uppercase">Price (¥)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={item.price || ''}
                      onChange={(e) => handleReviewItemUpdate(index, 'price', parseFloat(e.target.value))}
                      className="flex-1 px-2 py-1 text-xs bg-white border border-purple-200 rounded-md focus:ring-pink-500 text-purple-700 outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={handleConfirmAddToInventory}
              className="w-full py-4 bg-pink-500 text-white font-black rounded-xl shadow-lg shadow-pink-200 hover:bg-pink-600 active:scale-95 transition-all text-xs"
            >
              {t.confirm}
            </button>
          </div>
        </div>
      )}

      {/* Recipe Suggestion Modal */}
      {suggestedRecipes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border border-purple-200 w-full max-w-sm max-h-[80vh] flex flex-col">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-black text-purple-800">Alice's Menu</h3>
                <button onClick={() => setSuggestedRecipes(null)} className="w-8 h-8 flex items-center justify-center bg-purple-50 text-purple-400 rounded-full"><i className="fas fa-times"></i></button>
             </div>
             
             <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                {suggestedRecipes.map((recipe) => (
                   <div key={recipe.id} className="bg-purple-50 p-4 rounded-2xl border border-purple-100 flex flex-col gap-2">
                       <div className="flex items-start justify-between">
                           <div className="flex items-center gap-2">
                               <span className="text-2xl">{recipe.emoji || '🍽️'}</span>
                               <div>
                                   <div className="font-black text-purple-800 text-sm">{recipe.name}</div>
                                   <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${recipe.difficulty === 'Easy' ? 'bg-green-100 text-green-600' : recipe.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'}`}>
                                       {recipe.difficulty}
                                   </span>
                               </div>
                           </div>
                       </div>
                       
                       <p className="text-[10px] text-purple-600 italic leading-relaxed bg-white/50 p-2 rounded-lg">
                           "{recipe.description}"
                       </p>

                       {/* Instructions Section */}
                       <div className="mt-1">
                           <div className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-1">Method:</div>
                           <ol className="list-decimal list-inside space-y-1">
                               {recipe.instructions?.map((step, i) => (
                                   <li key={i} className="text-[9px] text-purple-800 font-medium leading-snug pl-1">
                                       {step}
                                   </li>
                               ))}
                           </ol>
                       </div>
                       
                       <div className="mt-1">
                           <div className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-1">Ingredients to Use:</div>
                           <div className="flex flex-col gap-1.5">
                               {recipe.ingredientsUsed.map((ing, i) => {
                                   const key = `${recipe.id}_${ing.inventoryItemId}`;
                                   const currentQty = ingredientAdjustments[key] !== undefined ? ingredientAdjustments[key] : ing.quantityToConsume;
                                   const itemInInv = inventory.find(inv => inv.id === ing.inventoryItemId);
                                   const unit = itemInInv?.unit || '';
                                   
                                   return (
                                     <div key={i} className="flex justify-between items-center bg-white border border-purple-100 px-3 py-2 rounded-lg">
                                         <span className="text-[9px] font-bold text-purple-700 flex-1 truncate mr-2">{ing.name}</span>
                                         <div className="flex items-center gap-2">
                                            <div className="flex items-center bg-purple-50 rounded-lg p-1 h-7">
                                                <button 
                                                  onClick={() => handleAdjustIngredient(recipe.id, ing.inventoryItemId, -1)}
                                                  className="w-5 h-full flex items-center justify-center text-purple-400 active:text-purple-600 transition-colors"
                                                >
                                                    <i className="fas fa-minus text-[8px]"></i>
                                                </button>
                                                <span className="text-xs font-black text-purple-800 w-6 text-center">{currentQty}</span>
                                                <button 
                                                  onClick={() => handleAdjustIngredient(recipe.id, ing.inventoryItemId, 1)}
                                                  className="w-5 h-full flex items-center justify-center text-purple-400 active:text-purple-600 transition-colors"
                                                >
                                                    <i className="fas fa-plus text-[8px]"></i>
                                                </button>
                                            </div>
                                            <span className="text-[10px] font-bold text-purple-400 w-8 text-center truncate">{unit}</span>
                                         </div>
                                     </div>
                                   );
                               })}
                           </div>
                       </div>
                       
                       <button 
                         onClick={() => handleCookRecipe(recipe)}
                         className="mt-3 w-full py-3 bg-orange-400 text-white font-black rounded-xl shadow-md active:scale-95 transition-all text-xs flex items-center justify-center gap-2"
                       >
                           <i className="fas fa-fire-burner"></i>
                           <span>Cook & Consume</span>
                       </button>
                   </div>
                ))}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};