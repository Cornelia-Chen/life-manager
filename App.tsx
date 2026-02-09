
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, GenerateContentResponse, LiveServerMessage, Modality } from "@google/genai";
import { Layout } from './components/Layout';
import { Uploader, ScanMode } from './components/Uploader';

import { HouseView } from './components/HouseView';
import { HouseEditView } from './components/HouseEditView'; 
import { ButlerView } from './components/ButlerView'; 
import { ItemDetailView } from './components/ItemDetailView';
import { ManualEntryView } from './components/ManualEntryView';
import { CommunityView } from './components/CommunityView';
import { ChatView } from './components/ChatView';
import { VoxelForgeView } from './components/voxel/VoxelForgeView'; 
import { processImageWithAI, OCRResult, ReceiptItem, RoomType, PurchaseRecord, LanguageCode, ButlerConfig, Personality, ChatMessage, Recipe, ALL_ROOMS, findItemTool, setTravelModeTool, addItemTool, consumeItemTool, TravelConfig, ConsumptionConfig, ROOM_CENTERS, generateSaleAd } from './services/geminiService';
import { getAllBlueprints, initializeRepository } from './services/voxelRepository'; 
import { BlueprintRecord } from './services/voxelTypes';
import { INITIAL_INVENTORY } from './services/initialInventory';

// --- Onboarding Components ---
const PRESET_AVATARS = [
    { id: 'a1', src: "https://raw.githubusercontent.com/Cornelia-Chen/fox-ai-butler-model/ca95e7a85fcefb8c8e932d6afa4a0a35dcc38a25/Subject%20(2).png", name: 'Alice' },
    { id: 'a2', src: "https://raw.githubusercontent.com/Cornelia-Chen/fox-ai-butler-model/main/Subject.png", name: 'Fox' },
    { id: 'a3', src: "https://github.com/Cornelia-Chen/fox-ai-butler-model/blob/main/Subject%20(3).png?raw=true", name: 'Bean' }
];

const TOUR_STEPS = (t: any) => [
    { id: 'home', icon: 'fa-warehouse', text: t.tour_home, targetStep: 'home' },
    { id: 'inbox', icon: 'fa-comment-dots', text: t.tour_inbox, targetStep: 'inbox' },
    { id: 'upload', icon: 'fa-camera', text: t.tour_camera, targetStep: 'upload' },
    { id: 'plaza', icon: 'fa-shopping-bag', text: t.tour_plaza, targetStep: 'plaza' },
    { id: 'butler', icon: 'fa-user-astronaut', text: t.tour_butler, targetStep: 'butler' }
];

// --- Audio Helpers ---
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

type AppStep = 'home' | 'plaza' | 'inbox' | 'upload' | 'review' | 'inventory' | 'butler' | 'item_detail' | 'manual_entry' | 'chat' | 'voxel_forge' | 'house_edit' | 'text_result'; 

interface Conversation {
  id: string;
  otherUserName: string;
  itemName: string;
  itemPrice: number;
  messages: ChatMessage[];
  unread: boolean;
  avatar: string;
}

const DEFAULT_CUSTOM_AVATAR = "https://raw.githubusercontent.com/Cornelia-Chen/fox-ai-butler-model/ca95e7a85fcefb8c8e932d6afa4a0a35dcc38a25/Subject%20(2).png";

const ROOM_NAMES: Record<LanguageCode, Record<RoomType, string>> = {
  'zh-CN': { kitchen: '厨房', living: '客厅', bedroom: '卧室', bathroom: '浴室', balcony: '阳台', storage: '储藏室', cloakroom: '衣帽间' },
  'en': { kitchen: 'Kitchen', living: 'Living', bedroom: 'Bedroom', bathroom: 'Bath', balcony: 'Balcony', storage: 'Storage', cloakroom: 'Cloakroom' },
  'fr': { kitchen: 'Cuisine', living: 'Salon', bedroom: 'Chambre', bathroom: 'Bain', balcony: 'Balcon', storage: 'Stockage', cloakroom: 'Vestiaire' },
  'ja': { kitchen: 'キッチン', living: '居間', bedroom: '寝室', bathroom: '浴室', balcony: 'ベランダ', storage: '倉庫', cloakroom: 'クローク' },
  'es': { kitchen: 'Cocina', living: 'Sala', bedroom: 'Dormitorio', bathroom: 'Baño', balcony: 'Balcón', storage: 'Almacén', cloakroom: 'Vestidor' },
};

const NAV_TEXT: Record<LanguageCode, { home: string; inbox: string; scan: string; plaza: string; butler: string }> = {
  'zh-CN': { home: '我的家', inbox: '消息', scan: '扫描', plaza: '广场', butler: '管家' },
  'en': { home: 'Home', inbox: 'Inbox', scan: 'Scan', plaza: 'Plaza', butler: 'Butler' },
  'fr': { home: 'Maison', inbox: 'Boîte', scan: 'Scan', plaza: 'Place', butler: 'Majordome' },
  'ja': { home: 'ホーム', inbox: '受信箱', scan: 'スキャン', plaza: '広場', butler: '執事' },
  'es': { home: 'Inicio', inbox: 'Buzón', scan: 'Escanear', plaza: 'Plaza', butler: 'Mayordomo' }
};

const ONBOARDING_TEXT: Record<LanguageCode, any> = {
    'zh-CN': {
        choose_lang: '请选择您的语言',
        choose_butler: '给您的管家起个名字并选择形象',
        welcome: '欢迎回来，主人！',
        tour_home: '这是您的“家”，在这里可以3D可视化管理所有家具和资产。',
        tour_inbox: '这里处理邻里消息，您可以和他人沟通闲置物品交易。',
        tour_camera: '最核心的功能！支持AI图片识字、购物小票识别，自动整理入库。',
        tour_plaza: '社区广场，查看附近的人在卖什么，或者分享您的生活情报。',
        tour_butler: '我的大本营。在这里调教我的性格，或者让我为您推荐菜谱。',
        next: '下一步',
        start: '开始体验'
    },
    'en': {
        choose_lang: 'Choose Your Language',
        choose_butler: 'Name your butler and select an avatar',
        welcome: 'Welcome back, Master!',
        tour_home: 'This is your Home. Manage all furniture and assets in 3D.',
        tour_inbox: 'Check your messages here to trade pre-loved items.',
        tour_camera: 'The core! AI OCR for receipts and text extraction.',
        tour_plaza: 'Community Plaza. See what neighbors are selling.',
        tour_butler: 'My HQ. Customize my personality or get recipe ideas.',
        next: 'Next',
        start: 'Start'
    },
    'fr': {
        choose_lang: 'Choisissez votre langue',
        choose_butler: 'Nommez votre majordome et choisissez un avatar',
        welcome: 'Bon retour, Maître !',
        tour_home: 'C\'est votre maison. Gérez tous les meubles et actifs en 3D.',
        tour_inbox: 'Consultez vos messages ici pour échanger des articles.',
        tour_camera: 'Le cœur ! OCR AI pour les reçus et l\'extraction de texte.',
        tour_plaza: 'Place de la communauté. Voyez ce que les voisins vendent.',
        tour_butler: 'Mon QG. Personnalisez ma personnalité ou obtenez des idées de recettes.',
        next: 'Suivant',
        start: 'Commencer'
    },
    'ja': {
        choose_lang: '言語を選択してください',
        choose_butler: '執事の名前を決め、アバターを選択',
        welcome: 'おかえりなさい、ご主人様！',
        tour_home: 'ここはあなたの「家」です。3Dですべての家具と資産を管理できます。',
        tour_inbox: '近所のメッセージを確認し、不用品の取引ができます。',
        tour_camera: '核となる機能！AIによるレシートや文字の認識、自動整理。',
        tour_plaza: 'コミュニティ広場。近所の人が何を売っているか確認できます。',
        tour_butler: '私の本拠地。性格をカスタマイズしたり、レシピのアイデアを得たりできます。',
        next: '次へ',
        start: '開始'
    },
    'es': {
        choose_lang: 'Elige tu idioma',
        choose_butler: 'Nombra a tu mayordomo y selecciona un avatar',
        welcome: '¡Bienvenido de nuevo, Maestro!',
        tour_home: 'Este es tu Hogar. Gestiona todos los muebles y activos en 3D.',
        tour_inbox: 'Revisa tus messages aquí para intercambiar artículos.',
        tour_camera: '¡El núcleo! OCR de IA para recibos y extracción de texto.',
        tour_plaza: 'Plaza de la comunidad. Mira lo que venden los vecinos.',
        tour_butler: 'Mi cuartel general. Personaliza mi personalidad o busca recetas.',
        next: 'Siguiente',
        start: 'Comenzar'
    }
};

const BUTLER_GREETINGS: Record<LanguageCode, string> = {
    'zh-CN': '主人，有什么吩咐吗？',
    'en': 'Yes, Master? How can I help?',
    'fr': 'Oui, Maître ?',
    'ja': 'はい、ご主人様？',
    'es': '¿Sí, Maestro?',
};

const App: React.FC = () => {
  const [onboarding, setOnboarding] = useState<'lang' | 'avatar' | 'tour' | 'done'>('done');
  const [tourIndex, setTourIndex] = useState(0);
  const [step, setStep] = useState<AppStep>('home');
  const [lastStep, setLastStep] = useState<AppStep>('home'); 
  const [selectedRoom, setSelectedRoom] = useState<RoomType | null>(null);
  const [selectedItem, setSelectedItem] = useState<ReceiptItem | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [reviewDate, setReviewDate] = useState<string>(''); 
  
  const [inventory, setInventory] = useState<ReceiptItem[]>([]);
  const prevInventoryRef = useRef<ReceiptItem[]>([]);
  const [restockCheck, setRestockCheck] = useState<{ item: ReceiptItem; newItem: Partial<ReceiptItem & { quantity: number; price: number }>; pendingQueue: Partial<ReceiptItem & { quantity: number; price: number }>[]; } | null>(null);

  const [communityItems, setCommunityItems] = useState<ReceiptItem[]>([]);
  const [initialCommunityView, setInitialCommunityView] = useState<'map' | 'market' | 'square'>('map');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState<LanguageCode>('zh-CN');
  
  const [walkToRoom, setWalkToRoom] = useState<RoomType | null>(null);
  const [travelConfig, setTravelConfig] = useState<TravelConfig>({ isTravelMode: false });
  const [manualEntryInitialName, setManualEntryInitialName] = useState<string>('');

  const [isQuickChatOpen, setIsQuickChatOpen] = useState(false);
  const [quickChatInput, setQuickChatInput] = useState('');
  const [quickChatResponse, setQuickChatResponse] = useState<string | null>(null);
  const [isQuickChatLoading, setIsQuickChatLoading] = useState(false);

  // Map Voice State
  const [isMapVoiceActive, setIsMapVoiceActive] = useState(false);
  const mapLiveSessionRef = useRef<any>(null);
  const mapInputCtxRef = useRef<AudioContext | null>(null);
  const mapOutputCtxRef = useRef<AudioContext | null>(null);
  const mapStreamRef = useRef<MediaStream | null>(null);
  const mapSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const mapNextStartTimeRef = useRef<number>(0);

  const ignoreNextAlerts = useRef(false);

  const [conversations, setConversations] = useState<Conversation[]>([
    {
       id: 'c1',
       otherUserName: 'RetroGamer',
       itemName: 'Vintage Camera',
       itemPrice: 450,
       unread: true,
       avatar: '🕹️',
       messages: [
           { id: 'm1', sender: 'other', text: 'Hi! Is the price negotiable for the camera?', timestamp: Date.now() - 3600000 },
       ]
    },
    {
       id: 'c2',
       otherUserName: 'SwitchFan',
       itemName: 'Nintendo Switch',
       itemPrice: 1299,
       unread: false,
       avatar: '🎮',
       messages: [
           { id: 'm1', sender: 'me', text: 'Yes, it comes with 2 games.', timestamp: Date.now() - 7200000 },
           { id: 'm2', sender: 'other', text: 'Great! Can you ship tomorrow?', timestamp: Date.now() - 7000000 }
       ]
    }
  ]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [butler, setButler] = useState<ButlerConfig>({
    name: '艾莉丝',
    personality: 'gentle',
    appearance: { 
        face: 'round', 
        eyes: 'large', 
        body: 'chibi', 
        outfit: 'casual',
        customAvatar: DEFAULT_CUSTOM_AVATAR || undefined,
        scale: 0.8 
    }
  });

  const [butlerMessage, setButlerMessage] = useState<string | null>(null);

  const effectiveInventory = useMemo(() => inventory.filter(item => {
      if (item.marketStatus === 'sold') return false;
      if (item.currentQuantity <= 0) return false;
      const isDefault = item.id.startsWith('default');
      const price = item.history[0]?.unitPrice || 0;
      return !(isDefault && price === 0);
  }), [inventory]);

  // --- Onboarding Logic ---
  useEffect(() => {
      const isFirstRun = !localStorage.getItem('onboarding_complete_v3');
      if (isFirstRun) {
          setOnboarding('lang');
      }
  }, []);

  const finishOnboarding = () => {
      localStorage.setItem('onboarding_complete_v3', 'true');
      setOnboarding('done');
      setStep('home');
  };

  // Sync Tour Progress with App Step
  useEffect(() => {
      if (onboarding === 'tour') {
          const ot = ONBOARDING_TEXT[targetLang] || ONBOARDING_TEXT['zh-CN'];
          const tourSteps = TOUR_STEPS(ot);
          const currentStep = tourSteps[tourIndex].targetStep as AppStep;
          if (currentStep) {
              setStep(currentStep);
          }
      }
  }, [tourIndex, onboarding, targetLang]);

  // --- Map Voice Logic ---
  const cleanupMapVoice = () => {
      if (mapLiveSessionRef.current) {
          mapLiveSessionRef.current.close();
          mapLiveSessionRef.current = null;
      }
      if (mapStreamRef.current) {
          mapStreamRef.current.getTracks().forEach(t => t.stop());
          mapStreamRef.current = null;
      }
      if (mapInputCtxRef.current) {
          mapInputCtxRef.current.close();
          mapInputCtxRef.current = null;
      }
      if (mapOutputCtxRef.current) {
          mapOutputCtxRef.current.close();
          mapOutputCtxRef.current = null;
      }
      mapSourcesRef.current.forEach(s => s.stop());
      mapSourcesRef.current.clear();
      setIsMapVoiceActive(false);
  };

  const toggleMapVoice = async () => {
      if (isMapVoiceActive) {
          cleanupMapVoice();
          return;
      }
      if (!process.env.API_KEY) return;

      try {
          setIsMapVoiceActive(true);
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
          const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          mapInputCtxRef.current = inputCtx;
          mapOutputCtxRef.current = outputCtx;
          const outputNode = outputCtx.createGain();
          outputNode.connect(outputCtx.destination);

          const langMap: Record<LanguageCode, string> = { 'zh-CN': 'Chinese', 'en': 'English', 'fr': 'French', 'ja': 'Japanese', 'es': 'Spanish' };
          const sysInstr = `You are ${butler.name}. Personality: ${butler.personality}. Speak in ${langMap[targetLang]}. concise.`;

          const sessionPromise = ai.live.connect({
              model: 'gemini-2.5-flash-native-audio-preview-12-2025',
              config: { responseModalities: [Modality.AUDIO], systemInstruction: sysInstr, speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } } },
              callbacks: {
                  onopen: async () => {
                      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                      mapStreamRef.current = stream;
                      const source = inputCtx.createMediaStreamSource(stream);
                      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                      processor.onaudioprocess = (e) => {
                          const blob = createBlob(e.inputBuffer.getChannelData(0));
                          sessionPromise.then(s => s.sendRealtimeInput({ media: blob }));
                      };
                      source.connect(processor);
                      processor.connect(inputCtx.destination);
                  },
                  onmessage: async (msg: LiveServerMessage) => {
                      const audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                      if (audio && mapOutputCtxRef.current) {
                          const buf = await decodeAudioData(decode(audio), mapOutputCtxRef.current, 24000, 1);
                          const src = mapOutputCtxRef.current.createBufferSource();
                          src.buffer = buf;
                          src.connect(outputNode);
                          let st = mapNextStartTimeRef.current;
                          if (st < mapOutputCtxRef.current.currentTime) st = mapOutputCtxRef.current.currentTime;
                          src.start(st);
                          mapNextStartTimeRef.current = st + buf.duration;
                          mapSourcesRef.current.add(src);
                          src.onended = () => mapSourcesRef.current.delete(src);
                      }
                  },
                  onclose: () => setIsMapVoiceActive(false),
                  onerror: () => cleanupMapVoice()
              }
          });
          mapLiveSessionRef.current = await sessionPromise;
      } catch (e) {
          cleanupMapVoice();
      }
  };

  useEffect(() => {
    return () => cleanupMapVoice();
  }, []);

  useEffect(() => {
    initializeRepository();
    if (inventory.length > 0) {
        const now = Date.now();
        const isPaused = travelConfig.isTravelMode && 
                         (!travelConfig.startDate || now >= travelConfig.startDate) && 
                         (!travelConfig.endDate || now <= travelConfig.endDate);

        if (!isPaused) {
            let hasUpdates = false;
            const updatedInventory = inventory.map(item => {
                if (item.consumption && item.consumption.isEnabled && item.currentQuantity > 0) {
                    const lastCalc = item.consumption.lastCalculated || now;
                    const diffMs = now - lastCalc;
                    const diffDays = diffMs / (1000 * 60 * 60 * 24);
                    
                    if (diffDays >= 1) { 
                        let dailyRate = 0;
                        switch (item.consumption.frequency) {
                            case 'day': dailyRate = item.consumption.amount; break;
                            case 'week': dailyRate = item.consumption.amount / 7; break;
                            case 'month': dailyRate = item.consumption.amount / 30; break;
                            case 'year': dailyRate = item.consumption.amount / 365; break;
                        }

                        const consumedAmount = dailyRate * diffDays;
                        const newQty = Math.max(0, item.currentQuantity - consumedAmount);
                        
                        if (consumedAmount > 0.001) {
                            hasUpdates = true;
                            return {
                                ...item,
                                currentQuantity: newQty,
                                consumption: {
                                    ...item.consumption!,
                                    lastCalculated: now
                                }
                            };
                        }
                    }
                }
                return item;
            });

            if (hasUpdates) {
                setInventory(updatedInventory);
            }
        }
    }
    
    const prevInventory = prevInventoryRef.current;
    if (prevInventory.length > 0) {
        const justDepleted = inventory.filter(item => {
            const prevItem = prevInventory.find(p => p.id === item.id);
            return item.currentQuantity <= 0 && prevItem && prevItem.currentQuantity > 0;
        });

        if (justDepleted.length > 0) {
            const names = justDepleted.map(i => i.translatedName).join(', ');
            const msg = targetLang === 'zh-CN' 
                ? `${names} 用完了，需要补货哦！` 
                : `${names} ran out! Need restocking.`;
            setButlerMessage(`${butler.name}: ${msg}`);
            ignoreNextAlerts.current = false; 
        }
    }
    
    prevInventoryRef.current = inventory;

    if (ignoreNextAlerts.current) {
      ignoreNextAlerts.current = false;
      return;
    }

    const alerts: string[] = [];
    const hasIngredients = inventory.some(item => 
        (item.assignedRoom === 'kitchen' || item.assignedRoom === 'storage' || item.category === 'food') && 
        item.currentQuantity > 0
    );
    
    if (!hasIngredients && inventory.length > 0) {
        alerts.push(targetLang === 'zh-CN' ? "厨房没食材了，该买菜了！🥗" : "No ingredients found! Time for groceries! 🥗");
    }

    const lowStockItems = inventory.filter(item => 
      item.alertType === 'quantity' && 
      item.currentQuantity <= (item.lowStockThreshold || 1) && 
      item.currentQuantity > 0
    );
    
    const today = Date.now();
    const expiringItems = inventory.filter(item => 
      item.alertType === 'date' && 
      item.expirationDate && 
      item.expirationDate <= today + (3 * 24 * 60 * 60 * 1000) 
    );

    if (lowStockItems.length > 0) {
       const names = lowStockItems.slice(0, 2).map(i => i.translatedName).join(', ');
       alerts.push(targetLang === 'zh-CN' ? `${names} 库存不足` : `${names} low stock`);
    }

    if (expiringItems.length > 0) {
       const names = expiringItems.slice(0, 2).map(i => i.translatedName).join(', ');
       alerts.push(targetLang === 'zh-CN' ? `${names} 即将过期` : `${names} expiring soon`);
    }

    if (alerts.length > 0 && !butlerMessage) {
      const msg = `${butler.name}: ${alerts.join('; ')}!`;
      setButlerMessage(msg);
    }
  }, [inventory, butler.name, targetLang, travelConfig]);

  useEffect(() => {
    const timer = setInterval(() => {
        setInventory(currentInventory => {
            const now = Date.now();
            const isPaused = travelConfig.isTravelMode && 
                             (!travelConfig.startDate || now >= travelConfig.startDate) && 
                             (!travelConfig.endDate || now <= travelConfig.endDate);

            if (isPaused) return currentInventory;

            let hasUpdates = false;
            const updatedInventory = currentInventory.map(item => {
                if (item.consumption && item.consumption.isEnabled && item.currentQuantity > 0) {
                    const lastCalc = item.consumption.lastCalculated || now;
                    const diffMs = now - lastCalc;
                    
                    if (diffMs > 0) {
                        let periodMs = 0;
                        switch (item.consumption.frequency) {
                            case 'day': periodMs = 24 * 3600 * 1000; break;
                            case 'week': periodMs = 7 * 24 * 3600 * 1000; break;
                            case 'month': periodMs = 30 * 24 * 3600 * 1000; break;
                            case 'year': periodMs = 365 * 24 * 3600 * 1000; break;
                        }

                        if (periodMs > 0) {
                            const consumedAmount = (item.consumption.amount / periodMs) * diffMs;
                            if (consumedAmount > 0.001) {
                                hasUpdates = true;
                                return {
                                    ...item,
                                    currentQuantity: Math.max(0, item.currentQuantity - consumedAmount),
                                    consumption: {
                                        ...item.consumption!,
                                        lastCalculated: now
                                    }
                                };
                            }
                        }
                    }
                }
                
                if (item.consumption && item.consumption.isEnabled && !item.consumption.lastCalculated) {
                    hasUpdates = true;
                    return {
                        ...item,
                        consumption: { ...item.consumption, lastCalculated: now }
                    };
                }

                return item;
            });

            return hasUpdates ? updatedInventory : currentInventory;
        });
    }, 10000); 

    return () => clearInterval(timer);
  }, [travelConfig]);

  useEffect(() => {
    const savedInv = localStorage.getItem('my_smart_inventory');
    const savedButler = localStorage.getItem('my_butler_config');
    const savedTravel = localStorage.getItem('my_travel_config');
    
    if (savedInv) {
        setInventory(JSON.parse(savedInv));
    } else {
        setInventory(INITIAL_INVENTORY);
    }

    if (savedButler) {
        const parsed = JSON.parse(savedButler);
        if (!parsed.appearance.customAvatar && DEFAULT_CUSTOM_AVATAR) {
            parsed.appearance.customAvatar = DEFAULT_CUSTOM_AVATAR;
        }
        setButler(parsed);
    }
    if (savedTravel) setTravelConfig(JSON.parse(savedTravel));

    setCommunityItems([
      { id: 'ext1', name: 'Switch', translatedName: 'Nintendo Switch', emoji: '🎮', unit: 'unit', assignedRoom: 'living', history: [], currentQuantity: 1, photo: 'https://images.unsplash.com/photo-1578303372704-14a089cfd73a?w=400', isPublic: true, sellerName: '元气少女', priceTag: 1299, description: '主人说这叫理财产品，但我看他已经三个月没动过了，哼。', marketStatus: 'selling' },
      { id: 'ext2', name: 'Camera', translatedName: 'Vintage Camera', emoji: '📷', unit: 'unit', assignedRoom: 'storage', history: [], currentQuantity: 1, photo: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400', isPublic: true, sellerName: '不吃香菜', priceTag: 450, description: '九成新，情怀产品。管家温馨提醒：买了也不一定拍出好照片。', marketStatus: 'selling' }
    ]);
  }, []);

  useEffect(() => {
    localStorage.setItem('my_smart_inventory', JSON.stringify(inventory));
    localStorage.setItem('my_butler_config', JSON.stringify(butler));
    localStorage.setItem('my_travel_config', JSON.stringify(travelConfig));
  }, [inventory, butler, travelConfig]);

  const processImage = useCallback(async (file: File, mode: ScanMode) => {
    setIsLoading(true);
    setError(null);
    try {
      const base64Promise = new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve((r.result as string).split(',')[1]);
        r.readAsDataURL(file);
      });
      const base64Data = await base64Promise;
      const result = await processImageWithAI(base64Data, file.type, targetLang, inventory, mode); 
      setOcrResult(result);
      if (mode === 'text') {
        setStep('text_result');
      } else {
        setReviewDate(result.purchaseDate || new Date().toISOString().split('T')[0]);
        setStep('review'); 
      }
    } catch (err: any) {
      setError(err.message || "识别失败");
    } finally {
      setIsLoading(false);
    }
  }, [targetLang, inventory]);

  const handleDirectSell = async (ocrItem: any) => {
    setIsLoading(true);
    try {
        const newId = 'inv-' + Math.random().toString(36).substr(2, 9);
        const recordTimestamp = reviewDate ? new Date(reviewDate).getTime() : Date.now();
        const roomCenter = ROOM_CENTERS['storage'] || { x: 24, y: 24 };
        
        const invItem: ReceiptItem = {
          id: newId,
          name: ocrItem.name || ocrItem.translatedName || "Unknown",
          translatedName: ocrItem.translatedName || ocrItem.name || "Unknown",
          emoji: ocrItem.emoji || "📦",
          unit: ocrItem.unit || "unit",
          assignedRoom: 'storage',
          history: [{ timestamp: recordTimestamp, quantity: ocrItem.quantity || 1, unitPrice: ocrItem.price || 0 }],
          currentQuantity: ocrItem.quantity || 1,
          photo: ocrItem.photo,
          alertType: 'none', 
          showOnMap: true,
          position: { x: roomCenter.x + (Math.random()-0.5)*2, y: roomCenter.y + (Math.random()-0.5)*2 },
          category: ocrItem.category
        };

        setInventory(prev => [invItem, ...prev]);

        // Trigger AI Ad Generation and navigate to market
        const ad = await generateSaleAd(invItem, targetLang);
        const price = ocrItem.price || 0;
        const marketItem: ReceiptItem = { 
            ...invItem, 
            id: `market-${Date.now()}`, 
            originalItemId: invItem.id, 
            sellerName: 'Me', 
            priceTag: price, 
            description: ad, 
            isPublic: true, 
            marketStatus: 'selling', 
            currentQuantity: 1 
        };
        
        setCommunityItems(prev => [marketItem, ...prev]);
        setInitialCommunityView('market');
        setStep('plaza');
        setOcrResult(null);

        // Butler message and movement
        const roomLabel = ROOM_NAMES[targetLang]['storage'];
        const tip = targetLang === 'zh-CN' 
            ? `物品已自动入库到${roomLabel}并上架广场。点击房间可以详细查看哦！` 
            : `Item stored in ${roomLabel} and listed on plaza. Tap the room to take a closer look!`;
        setButlerMessage(`${butler.name}: ${tip}`);
        setWalkToRoom('storage');

    } catch (e) {
        setError("Direct sell failed");
    } finally {
        setIsLoading(false);
    }
  };

  const addToInventory = (ocrItems: Partial<ReceiptItem & { price: number; quantity: number }>[]) => {
    const restockCandidates: Partial<ReceiptItem & { quantity: number; price: number }>[] = [];
    const directAddItems: typeof ocrItems = [];
    const tempInventory = [...inventory];

    ocrItems.forEach(newItem => {
        const name = (newItem.translatedName || newItem.name || "Unknown").trim();
        const rawName = (newItem.name || "").trim();
        const unit = (newItem.unit || "unit").trim();
        
        const existingItem = tempInventory.find(item => 
            (item.translatedName.toLowerCase() === name.toLowerCase() || (rawName && item.name.toLowerCase() === rawName.toLowerCase())) 
            && item.unit.toLowerCase() === unit.toLowerCase()
        );

        if (existingItem && existingItem.currentQuantity > 0 && !(newItem as any).isSelling) {
            restockCandidates.push(newItem as any);
        } else {
            directAddItems.push(newItem);
        }
    });

    if (directAddItems.length > 0) {
        processBatch(directAddItems);
    }

    if (restockCandidates.length > 0) {
        const existing = inventory.find(i => i.translatedName === restockCandidates[0].translatedName || i.name === restockCandidates[0].name);
        if (existing) {
            setRestockCheck({
                item: existing,
                newItem: restockCandidates[0],
                pendingQueue: restockCandidates.slice(1)
            });
        }
    } else {
        setStep('home');
        setOcrResult(null);
    }
  };

  const processBatch = (itemsToAdd: Partial<ReceiptItem & { price: number; quantity: number; consumptionRate?: number; consumptionFreq?: string; isSelling?: boolean; askingPrice?: number } & { consumption?: ConsumptionConfig }>[]) => {
    let updatedInventory = [...inventory];
    const recordTimestamp = reviewDate ? new Date(reviewDate).getTime() : Date.now();
    
    itemsToAdd.forEach((newItem, index) => {
      const name = (newItem.translatedName || newItem.name || "Unknown").trim();
      const rawName = (newItem.name || "").trim();
      const quantity = Number(newItem.quantity) || 1;
      const unit = (newItem.unit || "unit").trim();
      const price = Number(newItem.price) || 0;
      const category = newItem.category || 'other';
      const unitPrice = quantity > 0 ? price / quantity : 0;
      const defaultRoom = category === 'food' ? 'kitchen' : (category === 'appliance' ? 'kitchen' : (category === 'medicine' ? 'bathroom' : 'storage'));
      const assignedRoom = newItem.isSelling ? 'living' : (newItem.assignedRoom || defaultRoom); 

      const existingIndex = updatedInventory.findIndex(item => 
        (item.translatedName.toLowerCase() === name.toLowerCase() || (rawName && item.name.toLowerCase() === rawName.toLowerCase())) 
        && item.unit.toLowerCase() === unit.toLowerCase()
      );
      
      if (existingIndex !== -1 && !newItem.isSelling) {
        const target = updatedInventory[existingIndex];
        updatedInventory[existingIndex] = { ...target, currentQuantity: target.currentQuantity + quantity, history: [{ timestamp: recordTimestamp, quantity, unitPrice }, ...target.history] };
      } else {
        const roomCenter = ROOM_CENTERS[assignedRoom as RoomType] || { x: 24, y: 24 };
        const randomOffsetX = (Math.random() - 0.5) * 4; 
        const randomOffsetY = (Math.random() - 0.5) * 4;
        const newId = 'inv-' + Math.random().toString(36).substr(2, 9);
        const invItem: ReceiptItem = {
          id: newId,
          name: rawName || name,
          translatedName: name,
          emoji: newItem.emoji || (category === 'food' ? "🍎" : "📦"),
          unit: unit,
          assignedRoom: assignedRoom as RoomType,
          history: [{ timestamp: recordTimestamp, quantity, unitPrice }],
          currentQuantity: quantity,
          photo: newItem.photo,
          alertType: 'none', 
          consumption: { isEnabled: false, amount: 1, frequency: 'month', lastCalculated: Date.now() },
          showOnMap: newItem.showOnMap !== undefined ? newItem.showOnMap : (index === 0 || newItem.isSelling), 
          position: { x: roomCenter.x + randomOffsetX, y: roomCenter.y + randomOffsetY },
          marketStatus: newItem.isSelling ? 'selling' : undefined,
          isPublic: newItem.isSelling,
          priceTag: newItem.askingPrice || 0,
          description: newItem.description,
          sellerName: newItem.isSelling ? 'Me' : undefined,
          category: category
        };
        updatedInventory.unshift(invItem);
      }
    });
    setInventory(updatedInventory);
    setStep('home');

    // Butler notification for rooms and trigger movement
    const uniqueRooms = Array.from(new Set(itemsToAdd.map(i => {
        const cat = i.category || 'other';
        return i.assignedRoom || (cat === 'food' ? 'kitchen' : (cat === 'appliance' ? 'kitchen' : (cat === 'medicine' ? 'bathroom' : 'storage')));
    })));
    const roomNames = uniqueRooms.map(r => ROOM_NAMES[targetLang][r as RoomType]).join('、');
    const tip = targetLang === 'zh-CN' 
        ? `物品已分别存入${roomNames}。点击房间可以进入内部查看哦！` 
        : `Items stored in ${roomNames}. Tap a room to explore!`;
    setButlerMessage(`${butler.name}: ${tip}`);
    if (uniqueRooms.length > 0) {
        setWalkToRoom(uniqueRooms[0] as RoomType);
    }
  };

  const handleRestockConfirm = (didFinishPrevious: boolean) => {
      if (!restockCheck) return;
      const { item, newItem, pendingQueue } = restockCheck;
      const updatedInventory = [...inventory];
      const existingIndex = updatedInventory.findIndex(i => i.id === item.id);
      if (existingIndex !== -1) {
          const target = updatedInventory[existingIndex];
          const newQ = newItem.quantity || 1;
          const finalReviewDateTs = reviewDate ? new Date(reviewDate).getTime() : Date.now();
          updatedInventory[existingIndex] = {
              ...target,
              currentQuantity: didFinishPrevious ? newQ : target.currentQuantity + newQ,
              history: [{ timestamp: finalReviewDateTs, quantity: newQ, unitPrice: newItem.price || 0 }, ...target.history]
          };
          setInventory(updatedInventory);
      }
      const roomOfItem = restockCheck.item.assignedRoom;
      setRestockCheck(null);
      setStep('home');
      
      const tip = targetLang === 'zh-CN' 
          ? `补货已完成！您可以点击房间查看实时库存。` 
          : `Restock complete! Tap a room to check current stock.`;
      setButlerMessage(`${butler.name}: ${tip}`);
      setWalkToRoom(roomOfItem);
  };

  const goHome = () => { 
    setStep('home'); 
    setLastStep('home');
    setSelectedRoom(null); 
    setSelectedItem(null); 
    setIsQuickChatOpen(false); 
    setWalkToRoom(null); 
    setButlerMessage(null);
  };

  const handleRecipeCook = useCallback((recipe: Recipe) => {
    setInventory(prevInventory => 
      prevInventory.map(item => {
        const ingredient = recipe.ingredientsUsed.find(ing => ing.inventoryItemId === item.id);
        if (ingredient) return { ...item, currentQuantity: Math.max(0, item.currentQuantity - ingredient.quantityToConsume) };
        return item;
      })
    ); 
    const msg = targetLang === 'zh-CN' ? `已烹饪 ${recipe.name}` : `Cooked ${recipe.name}`;
    setButlerMessage(msg);
  }, [targetLang]); 

  const handleFindItem = useCallback((searchName: string) => {
    const normalizedSearch = searchName.toLowerCase();
    const foundItem = inventory.find(item => 
        item.translatedName.toLowerCase().includes(normalizedSearch) || 
        item.name.toLowerCase().includes(normalizedSearch)
      );
    if (foundItem) {
        setStep('home'); 
        setSelectedRoom(foundItem.assignedRoom); 
        setIsQuickChatOpen(false); 
        setWalkToRoom(foundItem.assignedRoom); 
        const msg = targetLang === 'zh-CN' 
            ? `找到了！你的${foundItem.translatedName}在${foundItem.assignedRoom}。` 
            : `Found it! Your ${foundItem.translatedName} is here in the ${foundItem.assignedRoom}.`;
        setButlerMessage(msg);
        return true;
      }
      return false;
  }, [inventory, targetLang]); 

  const handleItemMove = (itemId: string, x: number, y: number, newRoomId?: RoomType) => {
    setInventory(prev => prev.map(item => 
      item.id === itemId ? { ...item, position: { x, y }, assignedRoom: newRoomId || item.assignedRoom } : item
    ));
  };

  const handlePublishToPlaza = (item: ReceiptItem, price: number, ad: string) => {
    const newItem: ReceiptItem = { ...item, id: `market-${Date.now()}`, originalItemId: item.id, sellerName: 'Me', priceTag: price, description: ad, isPublic: true, marketStatus: 'selling', currentQuantity: 1 };
    setCommunityItems(prev => [newItem, ...prev]);
    setInitialCommunityView('market');
    setStep('plaza');
  };

  const handleMarkAsSold = (item: ReceiptItem) => {
      const originalId = item.originalItemId || item.id;
      
      setInventory(prev => prev.map(i => {
          if (i.id === originalId) {
              const newQty = Math.max(0, i.currentQuantity - 1);
              return { 
                  ...i, 
                  currentQuantity: newQty,
                  showOnMap: newQty > 0
              };
          }
          return i;
      }));

      setCommunityItems(prev => prev.map(i => {
          if (i.id === item.id) {
              return { ...i, marketStatus: 'sold' };
          }
          return i;
      }));

      if (selectedItem?.id === item.id) {
          setSelectedItem({ ...item, marketStatus: 'sold' });
      }
  };

  const handleOpenConversation = (conv: Conversation) => {
      setSelectedConversationId(conv.id);
      setStep('chat');
  };

  const getUnreadCount = () => conversations.filter(c => c.unread).length;

  const handleQuickChatSubmit = async () => {
    if (!quickChatInput.trim() || !process.env.API_KEY) return;
    if (handleFindItem(quickChatInput)) return;
    const userInput = quickChatInput;
    setQuickChatInput('');  
    setIsQuickChatLoading(true);
    setQuickChatResponse(null); 

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const persona = butler.customPrompt || butler.personality;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [{ text: `User says to Butler Alice (${persona}): "${userInput}". 
            1. If asking location, use 'findItemInInventory'. 
            2. If mentioning travelling/going away use 'setTravelMode' (isActive=true).
            3. If mentioning returning/back home, use 'setTravelMode' (isActive=false).
            4. If adding items, use 'addItemToInventory'. 
            5. Otherwise reply in ${targetLang} (max 20 words).` }] },
            config: { tools: [{ functionDeclarations: [findItemTool, setTravelModeTool, addItemTool, consumeItemTool] }] }
        });
        const call = response.functionCalls?.[0];
        if (call) {
             if (call.name === 'findItemInInventory') {
                handleFindItem((call.args as any).itemName);
             } else if (call.name === 'addItemToInventory') {
                 setManualEntryInitialName((call.args as any).itemName || '');
                 setIsQuickChatOpen(false); 
                 setStep('manual_entry'); 
             } else if (call.name === 'setTravelMode') {
                 const args = call.args as any;
                 setTravelConfig({ isTravelMode: args.isActive, startDate: args.startDate === 'now' ? Date.now() : undefined });
                 setQuickChatResponse(args.isActive ? "Travel mode ON." : "Welcome back!");
             }
        } else setQuickChatResponse(response.text || "...");
    } catch (e) { setQuickChatResponse("I can't hear you right now..."); } finally { setIsQuickChatLoading(false); }
  };

  if (step === 'voxel_forge') return <VoxelForgeView onBack={() => setStep('house_edit')} />;
  if (step === 'house_edit') return <HouseEditView inventory={inventory} onUpdateInventory={setInventory} onBack={goHome} currentLang={targetLang} onItemMove={handleItemMove} goToForge={() => setStep('voxel_forge')} butlerImage={butler.appearance.customAvatar} butlerScale={butler.appearance.scale} />;

  const ot = ONBOARDING_TEXT[targetLang] || ONBOARDING_TEXT['zh-CN'];
  const tourSteps = TOUR_STEPS(ot);

  return (
    <Layout currentLang={targetLang} onLangChange={setTargetLang}>
      {/* --- Onboarding System Overlay --- */}
      {onboarding !== 'done' && (
          <div className={`fixed inset-0 z-[1000] flex items-center justify-center p-6 animate-in fade-in duration-500 ${onboarding === 'tour' ? 'bg-slate-900/10 backdrop-blur-[2px]' : 'bg-slate-900/40 backdrop-blur-xl'}`}>
              {onboarding === 'lang' && (
                  <div className="bg-white/90 p-8 rounded-[3rem] shadow-2xl w-full max-w-sm border border-white text-center flex flex-col items-center">
                      <div className="w-20 h-20 bg-pink-500 rounded-3xl flex items-center justify-center text-white text-3xl mb-6 shadow-xl shadow-pink-200">
                          <i className="fas fa-language"></i>
                      </div>
                      <h3 className="text-xl font-black text-purple-900 mb-8">{ONBOARDING_TEXT['zh-CN'].choose_lang} / {ONBOARDING_TEXT['en'].choose_lang}</h3>
                      <div className="grid grid-cols-2 gap-4 w-full">
                          {[
                              { code: 'zh-CN', label: '中文', flag: '🇨🇳' },
                              { code: 'en', label: 'English', flag: '🇺🇸' },
                              { code: 'ja', label: '日本語', flag: '🇯🇵' },
                              { code: 'fr', label: 'Français', flag: '🇫🇷' }
                          ].map(l => (
                              <button key={l.code} onClick={() => { setTargetLang(l.code as LanguageCode); setOnboarding('avatar'); }} className="p-4 bg-white border border-purple-100 rounded-2xl flex flex-col items-center gap-2 hover:border-pink-500 hover:shadow-lg transition-all active:scale-95 group">
                                  <span className="text-3xl">{l.flag}</span>
                                  <span className="text-xs font-black text-purple-800 group-hover:text-pink-500">{l.label}</span>
                              </button>
                          ))}
                      </div>
                  </div>
              )}

              {onboarding === 'avatar' && (
                  <div className="bg-white/90 p-8 rounded-[3rem] shadow-2xl w-full max-w-sm border border-white text-center flex flex-col items-center relative overflow-hidden">
                      <div className="absolute -top-10 -right-10 w-40 h-40 bg-pink-100 rounded-full blur-3xl opacity-50"></div>
                      <h3 className="text-xl font-black text-purple-900 mb-2 relative z-10">{ot.welcome}</h3>
                      <p className="text-sm font-bold text-purple-400 mb-6 relative z-10">{ot.choose_butler}</p>
                      
                      {/* Name Input */}
                      <div className="w-full mb-6 relative z-10">
                          <input 
                              type="text" 
                              value={butler.name} 
                              onChange={(e) => setButler({ ...butler, name: e.target.value })}
                              className="w-full px-6 py-4 bg-purple-50 border-2 border-transparent focus:border-pink-300 rounded-2xl outline-none text-purple-800 font-bold transition-all text-center text-lg"
                              placeholder="Butler Name"
                          />
                      </div>

                      {/* Full Butler Preview */}
                      <div className="w-full aspect-[4/5] bg-purple-50 rounded-3xl overflow-hidden mb-6 border-2 border-white shadow-inner relative group">
                          <img 
                            src={butler.appearance.customAvatar || PRESET_AVATARS[0].src} 
                            className="w-full h-full object-contain drop-shadow-2xl transition-all duration-700 group-hover:scale-105" 
                            alt="Butler Preview" 
                          />
                      </div>

                      <div className="grid grid-cols-3 gap-3 w-full mb-8 relative z-10">
                          {PRESET_AVATARS.map(a => (
                              <button key={a.id} onClick={() => setButler({ ...butler, appearance: { ...butler.appearance, customAvatar: a.src } })} className={`aspect-square rounded-2xl overflow-hidden border-4 transition-all ${butler.appearance.customAvatar === a.src ? 'border-pink-500 scale-105 shadow-xl shadow-pink-100' : 'border-white'}`}>
                                  <img src={a.src} className="w-full h-full object-cover object-top scale-[1.3] origin-top" alt={a.name} />
                              </button>
                          ))}
                      </div>
                      <button onClick={() => setOnboarding('tour')} className="w-full py-4 bg-purple-800 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-transform uppercase tracking-widest text-xs relative z-10">
                          {ot.next}
                      </button>
                  </div>
              )}

              {onboarding === 'tour' && (
                  <div className="absolute inset-0 flex flex-col items-center pointer-events-none">
                      {/* Low Opacity Overlay */}
                      <div className="absolute inset-0 bg-black/20"></div>
                      
                      {/* Character + Tooltip Bubble */}
                      <div className="absolute bottom-36 left-1/2 -translate-x-1/2 w-full max-w-[320px] flex flex-col items-center pointer-events-auto">
                           
                           {/* Standing Full Character */}
                           <div className="relative w-48 h-64 -mb-12 animate-in slide-in-from-bottom-8 duration-700">
                               <img 
                                 src={butler.appearance.customAvatar} 
                                 className="w-full h-full object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.4)] filter brightness-105" 
                                 alt="Tour Butler" 
                               />
                               <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-black/30 rounded-full blur-md"></div>
                           </div>

                           <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border border-white relative z-10 animate-in zoom-in duration-300">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-purple-800 text-white rounded-xl flex items-center justify-center text-lg">
                                        <i className={`fas ${tourSteps[tourIndex].icon}`}></i>
                                    </div>
                                    <span className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em]">{butler.name} 指引中</span>
                                </div>
                                <p className="text-xs font-bold text-purple-900 leading-relaxed mb-6">
                                    {tourSteps[tourIndex].text}
                                </p>
                                <button 
                                  onClick={() => {
                                      if (tourIndex < tourSteps.length - 1) setTourIndex(tourIndex + 1);
                                      else finishOnboarding();
                                  }}
                                  className="w-full py-3 bg-pink-500 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-pink-100 active:scale-95 transition-all"
                                >
                                    {tourIndex < tourSteps.length - 1 ? ot.next : ot.start}
                                </button>
                           </div>
                      </div>

                      {/* Nav Indicator */}
                      <div className="absolute bottom-10 inset-x-0 mx-auto max-w-[340px] flex justify-around px-2">
                          {tourSteps.map((s, i) => (
                              <div key={s.id} className={`w-11 h-11 flex items-center justify-center transition-all duration-500 ${tourIndex === i ? 'opacity-100' : 'opacity-0 scale-50'}`}>
                                  <div className="w-14 h-14 border-4 border-pink-500 rounded-full animate-ping"></div>
                                  <div className="absolute w-3 h-3 bg-pink-500 rounded-full shadow-lg"></div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>
      )}

      <div className="max-w-md mx-auto flex flex-col min-h-[85vh] bg-gradient-to-br from-purple-100 to-pink-100 p-4 rounded-[3.5rem] shadow-2xl relative overflow-hidden pb-32">
        {travelConfig.isTravelMode && <div className="absolute top-0 left-0 right-0 z-[60] bg-blue-500 text-white text-[10px] font-black uppercase text-center py-1 flex items-center justify-center space-x-2 shadow-md"><i className="fas fa-plane"></i><span>Travel Mode Active</span></div>}

        {step === 'home' && (
          <div className="animate-in fade-in duration-500 flex flex-col flex-1 relative">
            <div className="flex justify-between items-start mb-6 mt-4 px-2">
              <h2 className="text-4xl font-black text-purple-800 tracking-tight leading-none uppercase">{NAV_TEXT[targetLang].home}</h2>
              <button onClick={() => setStep('butler')} className="w-16 h-16 bg-purple-100 rounded-2xl shadow-xl border-2 border-white flex items-center justify-center overflow-hidden relative active:scale-90 transition-all group">{butler.appearance.customAvatar ? <img src={butler.appearance.customAvatar} alt="Butler" className="w-full h-full object-cover object-top scale-125 translate-y-2" /> : <div className="text-2xl">👩‍🍳</div>}</button>
            </div>
            
            <div className="flex-1 flex flex-col items-center">
                <div className="relative w-full max-w-[320px] aspect-square mb-8 group"><div className="absolute -inset-1 bg-gradient-to-br from-purple-300 to-pink-300 rounded-[2.8rem] opacity-40 blur-md group-hover:opacity-60 transition-opacity"></div><div className="relative w-full h-full bg-[#05070a] rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-slate-900"><HouseView inventory={inventory} onRoomClick={(room) => { setSelectedRoom(room); setStep('inventory'); }} currentLang={targetLang} butlerMessage={butlerMessage} onDismissMessage={() => setButlerMessage(null)} onItemMove={handleItemMove} onAvatarClick={() => setIsQuickChatOpen(!isQuickChatOpen)} walkToRoom={walkToRoom} autoFit={true} butlerImage={butler.appearance.customAvatar} butlerScale={butler.appearance.scale} /></div><button onClick={() => setStep('house_edit')} className="absolute -right-2 -top-2 w-12 h-12 bg-slate-900 border-2 border-blue-500 rounded-2xl shadow-lg flex items-center justify-center text-blue-400 hover:text-white hover:scale-110 transition-all z-20"><i className="fas fa-warehouse text-lg"></i></button></div>

                {isQuickChatOpen && (
                    <div className="w-full px-4 mb-4 z-50 animate-in slide-in-from-bottom duration-300">
                        <div className="bg-white/95 backdrop-blur-xl border-2 border-pink-200 p-4 rounded-3xl shadow-2xl relative"><button onClick={() => setIsQuickChatOpen(false)} className="absolute -top-3 -right-3 w-8 h-8 bg-white border border-pink-100 rounded-full flex items-center justify-center text-pink-400 shadow-md z-10 hover:scale-110 transition-transform"><i className="fas fa-times"></i></button><div className="flex items-start gap-3 mb-3"><div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center border-2 border-white shadow-sm shrink-0 overflow-hidden">{butler.appearance.customAvatar ? <img src={butler.appearance.customAvatar} className="w-full h-full object-cover" alt="Avatar" /> : <div className="text-xl">👩‍🍳</div>}</div><div className="flex-1"><div className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">{butler.name}</div><div className="text-xs text-purple-800 font-medium leading-snug">{isQuickChatLoading ? <span className="animate-pulse">Thinking...</span> : (quickChatResponse || BUTLER_GREETINGS[targetLang])}</div></div></div><div className="flex items-center bg-purple-50 rounded-2xl p-1 pr-2 border border-purple-100"><input value={quickChatInput} onChange={(e) => setQuickChatInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleQuickChatSubmit()} placeholder="Ask about items or travel..." className="flex-1 bg-transparent px-3 py-2 text-xs font-bold text-purple-800 outline-none placeholder:text-purple-300" /><button onClick={toggleMapVoice} className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all mr-1 ${isMapVoiceActive ? 'bg-red-500 text-white animate-pulse' : 'bg-purple-100 text-purple-400 hover:bg-purple-200'}`}><i className={`fas ${isMapVoiceActive ? 'fa-stop' : 'fa-microphone'} text-[10px]`}></i></button><button onClick={handleQuickChatSubmit} className="w-8 h-8 bg-pink-500 rounded-xl text-white flex items-center justify-center shadow-lg shadow-pink-200 active:scale-95 transition-transform"><i className="fas fa-paper-plane text-[10px]"></i></button></div></div>
                    </div>
                )}
               {!isQuickChatOpen && <div className="w-full px-4 mb-8"><div className="bg-white/80 p-6 rounded-[2.5rem] shadow-md border border-purple-100 flex justify-around"><div className="text-center"><div className="text-2xl font-black text-purple-800">{effectiveInventory.length}</div><div className="text-[9px] text-purple-400 font-black uppercase tracking-widest mt-1">Total Items</div></div><div className="w-px h-full bg-purple-100"></div><div className="text-center"><div className="text-2xl font-black text-purple-800">¥{effectiveInventory.reduce((acc, curr) => acc + (curr.history[0]?.unitPrice || 0) * curr.currentQuantity, 0).toFixed(0)}</div><div className="text-[9px] text-purple-400 font-black uppercase tracking-widest mt-1">Est. Value</div></div></div></div>}
            </div>
          </div>
        )}

        {/* Restock Confirmation Modal */}
        {restockCheck && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-white rounded-[2.5rem] p-6 shadow-2xl max-w-sm w-full border border-purple-100 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-400 to-pink-400"></div>
                    <h3 className="text-lg font-black text-purple-800 mb-2 mt-2">{targetLang === 'zh-CN' ? '补货确认' : 'Restock Check'}</h3>
                    <p className="text-xs text-slate-500 font-bold mb-6 leading-relaxed">
                        {targetLang === 'zh-CN' 
                            ? `检测到您购买了新的 ${restockCheck.item.translatedName}，之前的库存用完了吗？` 
                            : `I see new ${restockCheck.item.translatedName}. Did you finish the previous stock?`}
                    </p>
                    <div className="flex space-x-3">
                        <button onClick={() => handleRestockConfirm(true)} className="flex-1 py-3 bg-pink-500 text-white rounded-xl font-black text-xs shadow-lg shadow-pink-200 active:scale-95 transition-transform">
                            {targetLang === 'zh-CN' ? '是，已用完' : 'Yes, Finished'}
                        </button>
                        <button onClick={() => handleRestockConfirm(false)} className="flex-1 py-3 bg-purple-50 text-purple-500 rounded-xl font-black text-xs hover:bg-purple-100 transition-colors">
                            {targetLang === 'zh-CN' ? '否，只是囤货' : 'No, Just Stocking'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {step === 'butler' && <ButlerView config={butler} onChange={setButler} onBack={goHome} inventory={inventory} addToInventory={addToInventory} targetLang={targetLang} onCook={handleRecipeCook} onFindItem={handleFindItem} onAddItemRequest={(name) => { setManualEntryInitialName(name || ''); setStep('manual_entry'); }} travelConfig={travelConfig} onSetTravelConfig={setTravelConfig} />}
        {step === 'upload' && <div className="flex-1 flex flex-col pt-10"><div className="mb-10 text-center"><h2 className="text-3xl font-black text-purple-800 tracking-tight">{NAV_TEXT[targetLang].scan.toUpperCase()}</h2><p className="text-[10px] text-pink-500 font-black uppercase tracking-widest">{butler.name} is checking...</p></div><Uploader onImageSelect={processImage} isLoading={isLoading} currentLang={targetLang} /><button onClick={() => setStep('manual_entry')} className="mt-8 py-5 bg-white rounded-3xl text-xs font-black text-purple-800 uppercase border border-purple-100 shadow-sm">Manual Entry</button></div>}
        {step === 'manual_entry' && <ManualEntryView onBack={() => { setStep('upload'); setManualEntryInitialName(''); }} onSubmit={(items) => { addToInventory(items); setManualEntryInitialName(''); }} defaultRoom={selectedRoom} currentLang={targetLang} initialName={manualEntryInitialName} />}
        {step === 'inventory' && selectedRoom && <div className="flex-1 flex flex-col h-full animate-in slide-in-from-right duration-300"><div className="flex justify-between items-center mb-4"><button onClick={goHome} className="w-10 h-10 bg-white rounded-xl shadow-sm text-purple-400 flex items-center justify-center"><i className="fas fa-chevron-left"></i></button><h2 className="text-xl font-black text-purple-800 uppercase tracking-widest">{selectedRoom}</h2><div className="w-10"></div></div><div className="relative w-full aspect-square bg-purple-50/50 rounded-[3rem] border border-purple-100 overflow-hidden shadow-inner mb-6"><HouseView key={selectedRoom} inventory={inventory} onRoomClick={() => {}} currentLang={targetLang} selectedRoom={selectedRoom} autoFit={true} butlerMessage={butlerMessage} onDismissMessage={() => setButlerMessage(null)} onItemMove={handleItemMove} onAvatarClick={() => setIsQuickChatOpen(!isQuickChatOpen)} butlerImage={butler.appearance.customAvatar} butlerScale={butler.appearance.scale} /></div><div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pb-20"><h3 className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-2 px-2">Items stored here</h3>{effectiveInventory.filter(i => i.assignedRoom === selectedRoom && i.currentQuantity > 0).length === 0 ? <div className="text-center py-10 text-purple-300 text-xs">Empty Room (or items consumed)</div> : effectiveInventory.filter(i => i.assignedRoom === selectedRoom && i.currentQuantity > 0).map((item) => <div key={item.id} onClick={() => { setSelectedItem(item); setLastStep('inventory'); setStep('item_detail'); }} className="bg-white p-4 rounded-2xl shadow-sm border border-purple-50 flex items-center justify-between cursor-pointer active:scale-95 transition-transform"><div className="flex items-center space-x-3"><div className="text-2xl">{item.voxelModel ? '🪑' : (item.photo ? <img src={item.photo} alt={item.name} className="w-8 h-8 object-cover rounded-lg border border-purple-100" /> : item.emoji)}</div><div><div className="text-xs font-black text-purple-800">{item.translatedName}</div><div className="flex items-center space-x-2"><div className="text-[9px] text-purple-400">Qty: {item.currentQuantity.toFixed(1)}</div></div></div></div><div className="flex flex-col items-end gap-1"><i className="fas fa-chevron-right text-purple-200 text-xs"></i></div></div>)}</div></div>}
        {step === 'item_detail' && selectedItem && <ItemDetailView item={selectedItem} targetLang={targetLang} viewMode={lastStep === 'plaza' ? 'market' : 'inventory'} onBack={() => setStep(lastStep === 'plaza' ? 'plaza' : (selectedRoom ? 'inventory' : 'home'))} onConsume={(q) => { setInventory(prev => prev.map(i => i.id === selectedItem.id ? {...i, currentQuantity: Math.max(0, i.currentQuantity - q)} : i)); setSelectedItem(prev => prev ? {...prev, currentQuantity: Math.max(0, prev.currentQuantity - q)} : null); }} onUpdate={(newItem) => { setInventory(prev => prev.map(i => i.id === newItem.id ? newItem : i)); setSelectedItem(prev => prev && prev.id === newItem.id ? newItem : prev); }} onPublishRequest={handlePublishToPlaza} onChatRequest={() => setStep('chat')} onMarkSold={handleMarkAsSold} />}
        {step === 'chat' && selectedItem && <ChatView sellerName={selectedItem.sellerName || 'Seller'} itemName={selectedItem.translatedName} basePrice={selectedItem.priceTag || 0} targetLang={targetLang} onBack={() => { if (selectedConversationId) { setStep('inbox'); setSelectedConversationId(null); } else setStep('item_detail'); }} initialMessages={selectedConversationId ? conversations.find(c => c.id === selectedConversationId)?.messages : undefined} onMessageSent={(text) => { if (selectedConversationId) { setConversations(prev => prev.map(c => c.id === selectedConversationId ? { ...c, messages: [...c.messages, { id: Date.now().toString(), sender: 'me', text, timestamp: Date.now() }] } : c)); } }} />}
        
        {step === 'text_result' && ocrResult && (
           <div className="flex-1 flex flex-col animate-in fade-in py-10 px-4">
              <div className="flex items-center justify-between mb-6">
                <button onClick={() => setStep('upload')} className="w-10 h-10 flex items-center justify-center bg-white rounded-xl text-purple-400 shadow-sm"><i className="fas fa-chevron-left"></i></button>
                <h2 className="text-xl font-black text-purple-800 uppercase tracking-widest">{targetLang === 'zh-CN' ? '识字结果' : 'Extracted Text'}</h2>
                <div className="w-10"></div>
              </div>
              <div className="bg-white/80 backdrop-blur rounded-[2.5rem] p-8 border border-purple-100 shadow-xl flex-1 flex flex-col">
                  <div className="flex-1 overflow-y-auto custom-scrollbar mb-6">
                      <p className="text-sm font-medium text-purple-900 leading-relaxed whitespace-pre-wrap">{ocrResult.fullText}</p>
                  </div>
                  <button onClick={() => { if (ocrResult.fullText) { navigator.clipboard.writeText(ocrResult.fullText); setButlerMessage(targetLang === 'zh-CN' ? '已复制' : 'Copied'); } }} className="w-full py-4 bg-pink-500 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-transform uppercase tracking-widest text-xs">Copy All</button>
              </div>
           </div>
        )}

        {step === 'review' && ocrResult && (
            <div className="animate-in slide-in-from-bottom duration-500 flex flex-col flex-1 h-full relative">
                <div className="bg-white rounded-[2.5rem] shadow-xl border border-purple-200 overflow-hidden flex flex-col flex-1">
                    <div className="p-6 bg-purple-800 text-white flex justify-between items-center"><h3 className="font-black text-sm uppercase">AI Review</h3><button onClick={() => setStep('upload')}><i className="fas fa-times"></i></button></div>
                    <div className="px-6 pt-4 bg-slate-50/50"><label className="text-[10px] font-black text-purple-400 uppercase tracking-widest block mb-2">Purchase Date</label><input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className="w-full bg-purple-50 border border-purple-100 rounded-xl p-3 text-sm font-bold text-purple-800 outline-none focus:border-pink-300" /></div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
                        {ocrResult.items?.map((item, i) => (
                            <div key={i} className="flex flex-col p-4 bg-white rounded-2xl border border-purple-100 space-y-3 relative">
                                <button 
                                    onClick={() => handleDirectSell(item)}
                                    className="absolute top-4 right-4 w-8 h-8 bg-pink-500 text-white rounded-xl shadow-lg flex items-center justify-center active:scale-90 transition-all z-10"
                                    title="Sell Direct"
                                >
                                    <i className="fas fa-hand-holding-dollar text-xs"></i>
                                </button>
                                <div className="flex items-center space-x-4">
                                    {item.photo ? <img src={item.photo} alt={item.name} className="w-12 h-12 object-cover rounded-lg border border-purple-100" /> : <div className="text-3xl">{item.emoji}</div>}
                                    <div className="flex-1"><div className="font-black text-purple-800 text-sm">{item.translatedName}</div><div className="text-[9px] text-purple-400 uppercase font-black">{item.quantity} {item.unit}</div></div>
                                </div>
                                <div className="grid grid-cols-1 gap-3 pt-2 border-t border-purple-50"><div><span className="text-[9px] font-bold text-purple-400 uppercase block mb-1">Price (¥)</span><input type="number" placeholder="0.00" value={item.price || ''} onChange={(e) => setOcrResult(prev => { if (!prev) return prev; const items = [...prev.items]; items[i].price = parseFloat(e.target.value); return { ...prev, items }; })} className="w-full py-1.5 px-3 rounded-lg border border-purple-100 bg-purple-50 text-xs font-bold text-purple-800 outline-none focus:border-pink-300" /></div></div>
                            </div>
                        ))}
                    </div>
                    <div className="p-8 bg-white border-t border-purple-50"><button onClick={() => addToInventory(ocrResult.items || [])} className="w-full py-5 bg-pink-500 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-xs">Confirm & Add</button></div>
                </div>
            </div>
        )}
        {step === 'plaza' && <CommunityView items={communityItems} currentLang={targetLang} onItemClick={(item) => { setSelectedItem(item); setLastStep('plaza'); setStep('item_detail'); }} initialView={initialCommunityView} onUserClick={() => {}} onViewChange={setInitialCommunityView} />}
        {step === 'inbox' && <div className="flex-1 flex flex-col animate-in fade-in pb-20 pt-10 px-6"><h2 className="text-3xl font-black text-purple-800 uppercase tracking-tight mb-6">{NAV_TEXT[targetLang].inbox}</h2><div className="space-y-4 overflow-y-auto custom-scrollbar">{conversations.map(conv => <div key={conv.id} onClick={() => handleOpenConversation(conv)} className={`bg-white p-4 rounded-3xl border ${conv.unread ? 'border-pink-300 shadow-md' : 'border-purple-50 shadow-sm'} flex items-center cursor-pointer active:scale-95 transition-all`}><div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-2xl mr-4 relative shrink-0">{conv.avatar}</div><div className="flex-1 min-w-0"><div className="flex justify-between items-baseline mb-1"><span className="font-black text-purple-800 text-sm truncate">{conv.otherUserName}</span></div><p className="text-xs truncate text-purple-400 font-medium">{conv.messages.length > 0 ? conv.messages[conv.messages.length-1].text : 'Start chatting...'}</p></div></div>)}</div></div>}

        <div className="fixed bottom-10 inset-x-0 mx-auto max-w-[340px] h-18 bg-white/70 backdrop-blur-3xl border border-white/40 rounded-[2.5rem] shadow-2xl flex items-center justify-around px-2 z-50">
          <button onClick={() => { setStep('home'); setInitialCommunityView('map'); setWalkToRoom(null); setButlerMessage(null); }} className={`w-11 h-11 rounded-2xl transition-all flex items-center justify-center ${step === 'home' || step === 'inventory' ? 'bg-purple-800 text-white shadow-lg' : 'text-purple-300'}`}><i className="fas fa-warehouse text-sm"></i></button>
          <button onClick={() => setStep('inbox')} className={`w-11 h-11 rounded-2xl transition-all flex items-center justify-center relative ${step === 'inbox' ? 'bg-purple-800 text-white shadow-lg' : 'text-purple-300'}`}><i className="fas fa-comment-dots text-sm"></i>{getUnreadCount() > 0 && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-pink-500 rounded-full border border-white"></div>}</button>
          <button onClick={() => setStep('upload')} className={`w-11 h-11 rounded-full transition-all flex items-center justify-center ${step === 'upload' || step === 'text_result' ? 'bg-purple-800 text-white shadow-lg' : 'text-purple-300'}`}><i className="fas fa-camera text-sm"></i></button>
          <button onClick={() => { setStep('plaza'); setInitialCommunityView('map'); }} className={`w-11 h-11 rounded-2xl transition-all flex items-center justify-center ${step === 'plaza' ? 'bg-purple-800 text-white shadow-lg' : 'text-purple-300'}`}><i className="fas fa-shopping-bag text-sm"></i></button>
          <button onClick={() => setStep('butler')} className={`w-11 h-11 rounded-2xl transition-all flex items-center justify-center ${step === 'butler' ? 'bg-purple-800 text-white shadow-lg' : 'text-purple-300'}`}><i className="fas fa-user-astronaut text-sm"></i></button>
        </div>
      </div>
    </Layout>
  );
};
export default App;
