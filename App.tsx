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

type AppStep = 'home' | 'plaza' | 'inbox' | 'upload' | 'review' | 'inventory' | 'butler' | 'item_detail' | 'manual_entry' | 'chat' | 'voxel_forge' | 'house_edit'; 

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
const NAV_TEXT: Record<LanguageCode, { home: string; inbox: string; scan: string; plaza: string; butler: string }> = {
  'zh-CN': { home: '我的家', inbox: '消息', scan: '扫描', plaza: '广场', butler: '管家' },
  'en': { home: 'Home', inbox: 'Inbox', scan: 'Scan', plaza: 'Plaza', butler: 'Butler' },
  'fr': { home: 'Maison', inbox: 'Boîte', scan: 'Scan', plaza: 'Place', butler: 'Majordome' },
  'ja': { home: 'ホーム', inbox: '受信箱', scan: 'スキャン', plaza: '広場', butler: '執事' },
  'es': { home: 'Inicio', inbox: 'Buzón', scan: 'Escanear', plaza: 'Plaza', butler: 'Mayordomo' }
};

const BUTLER_GREETINGS: Record<LanguageCode, string> = {
    'zh-CN': '主人，有什么吩咐吗？',
    'en': 'Yes, Master? How can I help?',
    'fr': 'Oui, Maître ?',
    'ja': 'はい、ご主人様？',
    'es': '¿Sí, Maestro?',
};

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>('home');
  const [lastStep, setLastStep] = useState<AppStep>('home'); 
  const [selectedRoom, setSelectedRoom] = useState<RoomType | null>(null);
  const [selectedItem, setSelectedItem] = useState<ReceiptItem | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [reviewDate, setReviewDate] = useState<string>(''); 
  
  // Sell Modal State for Review Step
  const [sellModalState, setSellModalState] = useState<{ index: number; ad: string; price: string; loading: boolean } | null>(null);

  const [inventory, setInventory] = useState<ReceiptItem[]>([]);
  const prevInventoryRef = useRef<ReceiptItem[]>([]);

  // Restock / Consumption Check Modal State
  const [restockCheck, setRestockCheck] = useState<{ 
      item: ReceiptItem; 
      newItem: Partial<ReceiptItem & { quantity: number; price: number }>; 
      pendingQueue: Partial<ReceiptItem & { quantity: number; price: number }>[];
  } | null>(null);

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
        (item.assignedRoom === 'kitchen' || item.assignedRoom === 'storage') && 
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
      setReviewDate(result.purchaseDate || new Date().toISOString().split('T')[0]);
      setStep('review'); 
    } catch (err: any) {
      setError(err.message || "识别失败");
    } finally {
      setIsLoading(false);
    }
  }, [targetLang, inventory]);

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
    let smartConsumptionMessage: string | null = null;
    let updatedInventory = [...inventory];
    const recordTimestamp = reviewDate ? new Date(reviewDate).getTime() : Date.now();
    const marketItemsToAdd: ReceiptItem[] = [];
    
    itemsToAdd.forEach((newItem, index) => {
      const name = (newItem.translatedName || newItem.name || "Unknown").trim();
      const rawName = (newItem.name || "").trim();
      const quantity = Number(newItem.quantity) || 1;
      const unit = (newItem.unit || "unit").trim();
      const price = Number(newItem.price) || 0;
      const unitPrice = quantity > 0 ? price / quantity : 0;
      const assignedRoom = newItem.isSelling ? 'living' : (newItem.assignedRoom || 'storage'); 

      const existingIndex = updatedInventory.findIndex(item => 
        (item.translatedName.toLowerCase() === name.toLowerCase() || (rawName && item.name.toLowerCase() === rawName.toLowerCase())) 
        && item.unit.toLowerCase() === unit.toLowerCase()
      );
      
      if (existingIndex !== -1 && !newItem.isSelling) {
        const target = updatedInventory[existingIndex];
        let updatedConsumption = target.consumption;
        
        if (target.consumption && !target.consumption.isEnabled && target.history.length > 0) {
            const lastRecord = target.history[0]; 
            const timeDiff = recordTimestamp - lastRecord.timestamp;
            const ONE_DAY_MS = 1000 * 60 * 60 * 24;
            const diffDays = timeDiff / ONE_DAY_MS;

            if (diffDays > 1) {
                const dailyRate = lastRecord.quantity / diffDays;
                let newFreq: 'day' | 'week' | 'month' | 'year' = 'month';
                let newAmount = 1;
                if (dailyRate >= 0.8) { newFreq = 'day'; newAmount = dailyRate; }
                else if (dailyRate * 7 >= 0.8) { newFreq = 'week'; newAmount = dailyRate * 7; }
                else { newFreq = 'month'; newAmount = dailyRate * 30; }
                
                newAmount = parseFloat(newAmount.toFixed(2));
                if (newAmount <= 0) newAmount = 0.01;
                updatedConsumption = { isEnabled: true, frequency: newFreq, amount: newAmount, lastCalculated: Date.now() };
            }
        }
        
        updatedInventory[existingIndex] = { ...target, currentQuantity: target.currentQuantity + quantity, history: [{ timestamp: recordTimestamp, quantity, unitPrice }, ...target.history], consumption: updatedConsumption };
      } else {
        let initConsumption: ConsumptionConfig;
        if (newItem.consumption) { initConsumption = { ...newItem.consumption, lastCalculated: Date.now() }; }
        else if (newItem.consumptionRate && newItem.consumptionFreq) { initConsumption = { isEnabled: true, amount: newItem.consumptionRate, frequency: newItem.consumptionFreq as 'day' | 'week' | 'month' | 'year', lastCalculated: Date.now() }; }
        else { initConsumption = { isEnabled: false, amount: 1, frequency: 'month', lastCalculated: Date.now() }; }

        const roomCenter = ROOM_CENTERS[assignedRoom as RoomType] || { x: 24, y: 24 };
        const randomOffsetX = (Math.random() - 0.5) * 4; 
        const randomOffsetY = (Math.random() - 0.5) * 4;
        const newId = Math.random().toString(36).substr(2, 9);

        const invItem: ReceiptItem = {
          id: newId,
          name: rawName || name,
          translatedName: name,
          emoji: newItem.emoji || "🧻",
          unit: unit,
          assignedRoom: assignedRoom as RoomType,
          history: [{ timestamp: recordTimestamp, quantity, unitPrice }],
          currentQuantity: quantity,
          photo: newItem.photo,
          alertType: 'none', 
          consumption: initConsumption,
          showOnMap: newItem.showOnMap !== undefined ? newItem.showOnMap : (index === 0 || newItem.isSelling), 
          position: { x: roomCenter.x + randomOffsetX, y: roomCenter.y + randomOffsetY },
          marketStatus: newItem.isSelling ? 'selling' : undefined,
          isPublic: newItem.isSelling,
          priceTag: newItem.askingPrice || 0,
          description: newItem.description,
          sellerName: newItem.isSelling ? 'Me' : undefined
        };

        updatedInventory.unshift(invItem);

        if (newItem.isSelling) {
            marketItemsToAdd.push({
                id: `market-${Date.now()}-${Math.random()}`,
                originalItemId: newId,
                name: invItem.name,
                translatedName: invItem.translatedName,
                emoji: invItem.emoji,
                unit: invItem.unit,
                assignedRoom: invItem.assignedRoom,
                history: [],
                currentQuantity: 1,
                photo: invItem.photo,
                isPublic: true,
                sellerName: 'Me',
                priceTag: newItem.askingPrice || 0,
                description: newItem.description,
                marketStatus: 'selling'
            });
        }
      }
    });
    
    if (marketItemsToAdd.length > 0) {
        setCommunityItems(prev => [...marketItemsToAdd, ...prev]);
    }

    ignoreNextAlerts.current = true;
    setInventory(updatedInventory);

    if (itemsToAdd.length > 0) {
        const targetRooms = Array.from(new Set(updatedInventory.filter(i => itemsToAdd.some(add => add.name === i.name || add.translatedName === i.translatedName)).map(i => i.assignedRoom || 'storage')));
        const itemNames = itemsToAdd.slice(0, 2).map(i => i.translatedName || i.name || 'Item').join(targetLang === 'zh-CN' ? '、' : ', ');
        const moreCount = itemsToAdd.length > 2 ? (targetLang === 'zh-CN' ? `等${itemsToAdd.length}件物品` : ` and ${itemsToAdd.length - 2} more`) : '';
        const roomMap: Record<string, string> = { 'kitchen': '厨房', 'living': '客厅', 'bedroom': '卧室', 'bathroom': '洗手间', 'balcony': '阳台', 'storage': '储藏室', 'cloakroom': '衣帽间' };
        let msg = '';
        if (targetLang === 'zh-CN') {
             const roomNames = targetRooms.map(r => roomMap[r] || r).join('和');
             msg = `已将 ${itemNames}${moreCount} 放入${roomNames}。点击房间可以查看物品列表哦！`;
        } else {
             const roomNames = targetRooms.join(' and ');
             msg = `I've put ${itemNames}${moreCount} in the ${roomNames}. You can click the rooms to view the item list!`;
        }
        if (smartConsumptionMessage) msg = `${msg} ${smartConsumptionMessage}`;
        setButlerMessage(msg);
        setWalkToRoom(targetRooms[0] as RoomType);
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
          const recordTimestamp = reviewDate ? new Date(reviewDate).getTime() : Date.now();
          
          let consumptionUpdate = target.consumption;
          let newCurrentQty = target.currentQuantity + newQ;

          if (didFinishPrevious) {
              if (target.history.length > 0) {
                  const lastPurchase = target.history[0];
                  const daysDiff = Math.max(1, (recordTimestamp - lastPurchase.timestamp) / (1000 * 3600 * 24));
                  const dailyRate = lastPurchase.quantity / daysDiff;
                  
                  let newFreq: 'day'|'week'|'month'|'year' = 'month';
                  let newAmount = dailyRate * 30;
                  
                  if (dailyRate >= 0.8) { newFreq = 'day'; newAmount = dailyRate; }
                  else if (dailyRate * 7 >= 0.8) { newFreq = 'week'; newAmount = dailyRate * 7; }
                  
                  newAmount = parseFloat(newAmount.toFixed(2));
                  if (newAmount <= 0) newAmount = 0.01;

                  const currentDaily = target.consumption?.isEnabled 
                        ? (target.consumption.frequency === 'day' ? target.consumption.amount 
                          : target.consumption.frequency === 'week' ? target.consumption.amount/7 
                          : target.consumption.frequency === 'month' ? target.consumption.amount : target.consumption.amount/30) 
                        : 0;
                  
                  const deviation = Math.abs(dailyRate - currentDaily) / (dailyRate || 1);
                  const isSignificant = deviation > 0.2 || !target.consumption?.isEnabled;

                  if (isSignificant) {
                      consumptionUpdate = { 
                          isEnabled: true, 
                          frequency: newFreq, 
                          amount: newAmount, 
                          lastCalculated: recordTimestamp 
                      };
                      
                      const fStr = newFreq === 'day' ? (targetLang === 'zh-CN' ? '天' : 'day') : newFreq === 'week' ? (targetLang === 'zh-CN' ? '周' : 'week') : (targetLang === 'zh-CN' ? '月' : 'month');
                      setButlerMessage(targetLang === 'zh-CN' 
                          ? `已按您习惯更新消耗：每${fStr} ${newAmount}${target.unit}`
                          : `Updated usage: ${newAmount}${target.unit}/${newFreq}`);
                  }
              }
              newCurrentQty = newQ;
          }

          updatedInventory[existingIndex] = {
              ...target,
              currentQuantity: newCurrentQty,
              history: [{ timestamp: recordTimestamp, quantity: newQ, unitPrice: newItem.price || 0 }, ...target.history],
              consumption: consumptionUpdate
          };
          setInventory(updatedInventory);
      } else {
          processBatch([newItem]);
      }

      if (pendingQueue.length > 0) {
          const nextExisting = inventory.find(i => i.translatedName === pendingQueue[0].translatedName || i.name === pendingQueue[0].name);
          if (nextExisting) {
              setRestockCheck({
                  item: nextExisting,
                  newItem: pendingQueue[0],
                  pendingQueue: pendingQueue.slice(1)
              });
          } else {
              processBatch(pendingQueue); 
              setRestockCheck(null);
              setStep('home');
              setOcrResult(null);
          }
      } else {
          setRestockCheck(null);
          setStep('home');
          setOcrResult(null);
      }
  };

  const handleConsumeItemRequest = (name: string): string => {
      const normalizedSearch = name.toLowerCase();
      const existingItemIndex = inventory.findIndex(item => 
          item.translatedName.toLowerCase().includes(normalizedSearch) || 
          item.name.toLowerCase().includes(normalizedSearch)
      );

      if (existingItemIndex === -1) return "I couldn't find that item in your inventory to consume.";
      const item = inventory[existingItemIndex];
      let consumptionMsg = "";
      let updatedConsumption = item.consumption;

      if (item.history && item.history.length > 0) {
          const lastPurchase = item.history[0];
          const now = Date.now();
          const timeDiff = now - lastPurchase.timestamp;
          const diffDays = timeDiff / (1000 * 60 * 60 * 24);

          if (diffDays >= 1) {
              const totalQuantityConsumed = lastPurchase.quantity; 
              const dailyRate = totalQuantityConsumed / diffDays;
              let newFreq: 'day' | 'week' | 'month' | 'year' = 'month';
              let newAmount = 1;
              if (dailyRate >= 0.8) { newFreq = 'day'; newAmount = parseFloat(dailyRate.toFixed(2)); }
              else if (dailyRate * 7 >= 0.8) { newFreq = 'week'; newAmount = parseFloat((dailyRate * 7).toFixed(2)); }
              else { newFreq = 'month'; newAmount = parseFloat((dailyRate * 30).toFixed(2)); }
              
              if (newAmount <= 0) newAmount = 0.01;
              updatedConsumption = { isEnabled: true, frequency: newFreq, amount: newAmount, lastCalculated: now };
              consumptionMsg = targetLang === 'zh-CN' 
                  ? `已自动计算消耗速度: 每${newFreq === 'day'?'天':newFreq==='week'?'周':'月'} ${newAmount}${item.unit}。`
                  : `Auto-calculated rate: ${newAmount} ${item.unit}/${newFreq}.`;
          }
      }

      const updatedInventory = [...inventory];
      updatedInventory[existingItemIndex] = { ...item, currentQuantity: 0, consumption: updatedConsumption };
      setInventory(updatedInventory);
      return targetLang === 'zh-CN' 
          ? `好的，${item.translatedName} 已标记为用完。${consumptionMsg}`
          : `Okay, marked ${item.translatedName} as finished. ${consumptionMsg}`;
  };

  const handleReviewItemChange = (index: number, changes: Partial<ReceiptItem & { price: number ; isSelling?: boolean; askingPrice?: number; description?: string}>) => {
    setOcrResult(prev => {
        if (!prev || !prev.items) return prev;
        const newItems = [...prev.items];
        newItems[index] = { ...newItems[index], ...changes };
        return { ...prev, items: newItems };
    });
  };

  const handleSellClickInReview = async (index: number, item: any) => {
    if (item.isSelling) {
        handleReviewItemChange(index, { isSelling: false, askingPrice: undefined, description: undefined });
        return;
    }
    setSellModalState({ index, ad: '', price: item.price?.toString() || '', loading: true });
    try {
        const tempItem: Partial<ReceiptItem> = {
            translatedName: item.translatedName || item.name,
            name: item.name,
        };
        const ad = await generateSaleAd(tempItem, targetLang);
        setSellModalState(prev => prev ? { ...prev, ad, loading: false } : null);
    } catch (e) {
        setSellModalState(prev => prev ? { ...prev, ad: 'Error generating ad.', loading: false } : null);
    }
  };

  const handleConfirmSellModal = () => {
    if (!sellModalState) return;
    const { index, ad, price } = sellModalState;
    handleReviewItemChange(index, { 
        isSelling: true, 
        askingPrice: parseFloat(price) || 0, 
        description: ad 
    });
    setSellModalState(null);
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
    const newItem: ReceiptItem = { 
        ...item, 
        id: `market-${Date.now()}`, 
        originalItemId: item.id,
        sellerName: 'Me', 
        priceTag: price, 
        description: ad, 
        isPublic: true, 
        marketStatus: 'selling',
        currentQuantity: 1
    };
    setCommunityItems(prev => [newItem, ...prev]);
    setInventory(prev => prev.map(i => i.id === item.id ? { 
        ...i, 
        marketStatus: 'selling',
        description: ad,
        priceTag: price,
        sellerName: 'Me',
        isPublic: true
    } : i));
    setInitialCommunityView('market');
    setStep('plaza');
    setButlerMessage(targetLang === 'zh-CN' ? '已成功上架到广场！' : 'Successfully listed on Plaza!');
  };

  const handleMarkAsSold = (item: ReceiptItem) => {
      const updatedItem = { ...item, marketStatus: 'sold' as 'sold', currentQuantity: 0, showOnMap: false };
      setCommunityItems(prev => prev.map(i => i.id === item.id ? updatedItem : i));
      setInventory(prev => prev.map(i => i.id === item.id ? updatedItem : i));
      if (item.originalItemId) {
          setInventory(prev => prev.map(i => {
              if (i.id === item.originalItemId) {
                  return { 
                      ...i, 
                      currentQuantity: Math.max(0, i.currentQuantity - 1),
                      marketStatus: i.currentQuantity - 1 > 0 ? i.marketStatus : 'sold'
                  };
              }
              return i;
          }));
      } else {
          setCommunityItems(prev => prev.map(i => {
              if (i.originalItemId === item.id) {
                  return { ...i, marketStatus: 'sold', currentQuantity: 0 };
              }
              return i;
          }));
      }
      setSelectedItem(updatedItem);
  };

  const handleCancelListing = (item: ReceiptItem) => {
      setCommunityItems(prev => prev.filter(i => i.originalItemId !== item.id && i.id !== item.id));
      const resetItem = { 
          ...item, 
          marketStatus: undefined, 
          isPublic: false, 
          sellerName: undefined, 
          priceTag: undefined 
      };
      setInventory(prev => prev.map(i => i.id === item.id ? resetItem : i));
      setSelectedItem(resetItem);
      setButlerMessage(targetLang === 'zh-CN' ? '已取消出售。' : 'Listing cancelled.');
  };

  const handleRoomItemClick = (item: ReceiptItem) => {
      setSelectedItem(item);
      setLastStep('inventory'); 
      setStep('item_detail');
  };

  const handleOpenConversation = (conv: Conversation) => {
      setSelectedConversationId(conv.id);
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread: false } : c));
      const linkedItem = communityItems.find(i => i.translatedName === conv.itemName) || inventory.find(i => i.translatedName === conv.itemName);
      if (linkedItem) setSelectedItem(linkedItem);
      else setSelectedItem({ id: 'chat-temp-' + conv.id, name: conv.itemName, translatedName: conv.itemName, emoji: '📦', unit: 'unit', assignedRoom: 'storage', history: [], currentQuantity: 1, priceTag: conv.itemPrice, sellerName: conv.otherUserName });
      setStep('chat');
  };

  const handleCommunityUserClick = (userName: string) => {
      const existing = conversations.find(c => c.otherUserName === userName);
      if (existing) handleOpenConversation(existing);
      else {
          const newId = Date.now().toString();
          const newConv: Conversation = { id: newId, otherUserName: userName, itemName: 'Community Chat', itemPrice: 0, unread: false, avatar: '👤', messages: [] };
          setConversations(prev => [newConv, ...prev]);
          setSelectedConversationId(newId);
          setSelectedItem({ id: 'chat-user-' + newId, name: 'Community Chat', translatedName: 'Chat with ' + userName, emoji: '💬', unit: '', assignedRoom: 'living', history: [], currentQuantity: 0, sellerName: userName, priceTag: 0 });
          setStep('chat');
      }
  };

  const handleMessageSent = (text: string) => {
     if (selectedConversationId) {
         setConversations(prev => prev.map(c => c.id === selectedConversationId ? { ...c, messages: [...c.messages, { id: Date.now().toString(), sender: 'me', text, timestamp: Date.now() }] } : c));
     } else if (selectedItem) {
         const newId = Date.now().toString();
         const newConv: Conversation = { id: newId, otherUserName: selectedItem.sellerName || 'Seller', itemName: selectedItem.translatedName, itemPrice: selectedItem.priceTag || 0, unread: false, avatar: '👤', messages: [{ id: Date.now().toString(), sender: 'me', text, timestamp: Date.now() }] };
         setConversations(prev => [newConv, ...prev]);
         setSelectedConversationId(newId);
     }
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
            5. If item consumed/empty, use 'consumeItem'. 
            6. Otherwise reply in ${targetLang} (max 20 words).` }] },
            config: { tools: [{ functionDeclarations: [findItemTool, setTravelModeTool, addItemTool, consumeItemTool] }] }
        });
        const call = response.functionCalls?.[0];
        if (call) {
             if (call.name === 'findItemInInventory') {
                const args = call.args as any;
                const found = handleFindItem(args.itemName);
                const notFoundMsg = targetLang === 'zh-CN' ? `我找不到 "${args.itemName}"。` : `I couldn't find "${args.itemName}".`;
                if (!found) setQuickChatResponse(notFoundMsg);
             } else if (call.name === 'consumeItem') {
                 const args = call.args as any;
                 const resultMsg = handleConsumeItemRequest(args.itemName);
                 setQuickChatResponse(resultMsg);
             } else if (call.name === 'addItemToInventory') {
                 const args = call.args as any;
                 setManualEntryInitialName(args.itemName || '');
                 setIsQuickChatOpen(false); 
                 setStep('manual_entry'); 
                 return;
             } else if (call.name === 'setTravelMode') {
                 const args = call.args as any;
                 const isActive = args.isActive;
                 const start = args.startDate === 'now' ? Date.now() : (args.startDate ? new Date(args.startDate).getTime() : undefined);
                 const end = args.endDate === 'unknown' ? undefined : (args.endDate ? new Date(args.endDate).getTime() : undefined);
                 setTravelConfig({ isTravelMode: isActive, startDate: start, endDate: end });
                 const travelResponses: Record<string, string> = {
                     on: targetLang === 'zh-CN' ? '旅行模式已开启。祝您旅途愉快！' : "Travel mode ON. Have fun!",
                     off: targetLang === 'zh-CN' ? '欢迎回家！旅行模式已关闭，消耗恢复。' : "Welcome back! Travel mode OFF."
                 };
                 setQuickChatResponse(isActive ? travelResponses.on : travelResponses.off);
             }
        } else setQuickChatResponse(response.text || "...");
    } catch (e) { setQuickChatResponse("I can't hear you right now..."); } finally { setIsQuickChatLoading(false); setQuickChatInput(''); }
  };

  if (step === 'voxel_forge') return <VoxelForgeView onBack={() => setStep('house_edit')} />;
  if (step === 'house_edit') return <HouseEditView inventory={inventory} onUpdateInventory={setInventory} onBack={goHome} currentLang={targetLang} onItemMove={handleItemMove} goToForge={() => setStep('voxel_forge')} butlerImage={butler.appearance.customAvatar} butlerScale={butler.appearance.scale} />;

  return (
    <Layout currentLang={targetLang} onLangChange={setTargetLang}>
      <div className="max-w-md mx-auto flex flex-col min-h-[85vh] bg-gradient-to-br from-purple-100 to-pink-100 p-4 rounded-[3.5rem] shadow-2xl relative overflow-hidden pb-32">
        {travelConfig.isTravelMode && <div className="absolute top-0 left-0 right-0 z-[60] bg-blue-500 text-white text-[10px] font-black uppercase text-center py-1 flex items-center justify-center space-x-2 shadow-md"><i className="fas fa-plane"></i><span>Travel Mode Active</span>{travelConfig.endDate && <span>Until {new Date(travelConfig.endDate).toLocaleDateString()}</span>}</div>}
        {error && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm bg-red-500 text-white px-4 py-3 rounded-2xl shadow-xl animate-in slide-in-from-top-5 flex items-center justify-between"><div className="flex items-center space-x-2"><i className="fas fa-exclamation-circle text-white/80"></i><div className="text-xs font-bold">{error}</div></div><button onClick={() => setError(null)} className="w-6 h-6 flex items-center justify-center bg-white/20 rounded-full hover:bg-white/30 transition-colors"><i className="fas fa-times text-xs"></i></button></div>}

        {step === 'home' && (
          <div className="animate-in fade-in duration-500 flex flex-col flex-1 relative">
            <div className="flex justify-between items-start mb-6 mt-4 px-2">
              <h2 className="text-4xl font-black text-purple-800 tracking-tight leading-none uppercase">{NAV_TEXT[targetLang].home}</h2>
              <button onClick={() => setStep('butler')} className="w-16 h-16 bg-purple-100 rounded-2xl shadow-xl border-2 border-white flex items-center justify-center overflow-hidden relative active:scale-90 transition-all group">{butler.appearance.customAvatar ? <img src={butler.appearance.customAvatar} alt="Butler" className="w-full h-full object-cover object-top scale-125 translate-y-2" /> : <><div className={`absolute inset-0 ${butler.personality === 'strict' ? 'bg-slate-700' : butler.personality === 'gentle' ? 'bg-pink-200' : 'bg-indigo-400'} transition-colors duration-500`}></div><div className="absolute top-2.5 w-10 h-10 flex justify-center shadow-sm transition-transform duration-300 group-hover:scale-110 z-10"><div className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-14 bg-pink-400 rounded-full -z-10" /><div className="absolute -bottom-5 w-10 h-8 bg-blue-400 rounded-t-xl z-0 flex justify-center shadow-inner"><div className="mt-0.5 w-3 h-3 bg-white rotate-45" /></div><div className="relative w-10 h-10 bg-white rounded-full overflow-hidden"><div className="absolute top-0 left-0 w-full h-4 z-10"><div className="absolute top-0 w-full h-3 bg-pink-400 rounded-b-md" /></div><div className="flex justify-center space-x-1.5 mt-4"><div className="w-2.5 h-3 bg-slate-800 rounded-full relative"><div className="absolute top-0.5 right-0.5 w-1 h-1 bg-white rounded-full" /></div><div className="w-2.5 h-3 bg-slate-800 rounded-full relative"><div className="absolute top-0.5 right-0.5 w-1 h-1 bg-white rounded-full" /></div></div><div className="absolute top-6 left-0.5 w-2 h-1 bg-pink-300 rounded-full blur-[1px] opacity-60" /><div className="absolute top-6 right-0.5 w-2 h-1 bg-pink-300 rounded-full blur-[1px] opacity-60" /><div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-0.5 bg-pink-500 rounded-full opacity-60" /></div></div></>}<div className="absolute bottom-0 right-0 bg-pink-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-tl-lg rounded-br-lg z-20">AI</div></button>
            </div>
            
            <div className="flex-1 flex flex-col items-center">
                <div className="relative w-full max-w-[320px] aspect-square mb-8 group"><div className="absolute -inset-1 bg-gradient-to-br from-purple-300 to-pink-300 rounded-[2.8rem] opacity-40 blur-md group-hover:opacity-60 transition-opacity"></div><div className="relative w-full h-full bg-[#05070a] rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-slate-900"><HouseView inventory={inventory} onRoomClick={(room) => { setSelectedRoom(room); setStep('inventory'); }} currentLang={targetLang} butlerMessage={butlerMessage} onDismissMessage={() => setButlerMessage(null)} onItemMove={handleItemMove} onAvatarClick={() => setIsQuickChatOpen(!isQuickChatOpen)} walkToRoom={walkToRoom} autoFit={true} butlerImage={butler.appearance.customAvatar} butlerScale={butler.appearance.scale} /></div><button onClick={() => setStep('house_edit')} className="absolute -right-2 -top-2 w-12 h-12 bg-slate-900 border-2 border-blue-500 rounded-2xl shadow-lg flex items-center justify-center text-blue-400 hover:text-white hover:scale-110 transition-all z-20" title="Warehouse"><i className="fas fa-warehouse text-lg"></i></button></div>

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

        {step === 'butler' && <ButlerView config={butler} onChange={setButler} onBack={goHome} inventory={inventory} addToInventory={addToInventory} targetLang={targetLang} onCook={handleRecipeCook} onFindItem={handleFindItem} onAddItemRequest={(name) => { setManualEntryInitialName(name || ''); setStep('manual_entry'); }} onConsumeItemRequest={handleConsumeItemRequest} travelConfig={travelConfig} onSetTravelConfig={setTravelConfig} />}
        {step === 'upload' && <div className="flex-1 flex flex-col pt-10"><div className="mb-10 text-center"><h2 className="text-3xl font-black text-purple-800 tracking-tight">{NAV_TEXT[targetLang].scan.toUpperCase()}</h2><p className="text-[10px] text-pink-500 font-black uppercase tracking-widest">{butler.name} is checking...</p></div><Uploader onImageSelect={processImage} isLoading={isLoading} currentLang={targetLang} /><button onClick={() => setStep('manual_entry')} className="mt-8 py-5 bg-white rounded-3xl text-xs font-black text-purple-800 uppercase border border-purple-100 shadow-sm">Manual Entry</button></div>}
        {step === 'manual_entry' && <ManualEntryView onBack={() => { setStep('upload'); setManualEntryInitialName(''); }} onSubmit={(items) => { addToInventory(items); setManualEntryInitialName(''); }} defaultRoom={selectedRoom} currentLang={targetLang} initialName={manualEntryInitialName} />}
        {step === 'inventory' && selectedRoom && <div className="flex-1 flex flex-col h-full animate-in slide-in-from-right duration-300"><div className="flex justify-between items-center mb-4"><button onClick={goHome} className="w-10 h-10 bg-white rounded-xl shadow-sm text-purple-400 flex items-center justify-center"><i className="fas fa-chevron-left"></i></button><h2 className="text-xl font-black text-purple-800 uppercase tracking-widest">{selectedRoom}</h2><div className="w-10"></div></div><div className="relative w-full aspect-square bg-purple-50/50 rounded-[3rem] border border-purple-100 overflow-hidden shadow-inner mb-6"><HouseView key={selectedRoom} inventory={inventory} onRoomClick={() => {}} currentLang={targetLang} selectedRoom={selectedRoom} autoFit={true} butlerMessage={butlerMessage} onDismissMessage={() => setButlerMessage(null)} onItemMove={handleItemMove} onAvatarClick={() => setIsQuickChatOpen(!isQuickChatOpen)} butlerImage={butler.appearance.customAvatar} butlerScale={butler.appearance.scale} /></div><div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pb-20"><h3 className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-2 px-2">Items stored here</h3>{effectiveInventory.filter(i => i.assignedRoom === selectedRoom && i.currentQuantity > 0).length === 0 ? <div className="text-center py-10 text-purple-300 text-xs">Empty Room (or items consumed)</div> : effectiveInventory.filter(i => i.assignedRoom === selectedRoom && i.currentQuantity > 0).map((item) => <div key={item.id} onClick={() => handleRoomItemClick(item)} className="bg-white p-4 rounded-2xl shadow-sm border border-purple-50 flex items-center justify-between cursor-pointer active:scale-95 transition-transform"><div className="flex items-center space-x-3"><div className="text-2xl">{item.voxelModel ? '🪑' : (item.photo ? <img src={item.photo} alt={item.name} className="w-8 h-8 object-cover rounded-lg border border-purple-100" /> : item.emoji)}</div><div><div className="text-xs font-black text-purple-800">{item.translatedName}</div><div className="flex items-center space-x-2"><div className="text-[9px] text-purple-400">Qty: {item.currentQuantity.toFixed(1)}</div>{item.consumption?.isEnabled && <div className="flex items-center space-x-1 px-1.5 py-0.5 bg-blue-50 rounded-full animate-pulse border border-blue-100"><i className="fas fa-arrow-down text-[6px] text-blue-500"></i><span className="text-[7px] font-bold text-blue-500 uppercase tracking-tight">Consuming</span></div>}</div></div></div><div className="flex flex-col items-end gap-1"><i className="fas fa-chevron-right text-purple-200 text-xs"></i>{item.marketStatus === 'selling' && <span className="text-[8px] font-bold text-pink-500 bg-pink-50 px-1.5 py-0.5 rounded-full uppercase">Selling</span>}{item.marketStatus === 'sold' && <span className="text-[8px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full uppercase">Sold</span>}</div></div>)}</div></div>}
        {step === 'item_detail' && selectedItem && <ItemDetailView item={selectedItem} targetLang={targetLang} viewMode={lastStep === 'plaza' ? 'market' : 'inventory'} onBack={() => setStep(lastStep === 'plaza' ? 'plaza' : (selectedRoom ? 'inventory' : 'home'))} onConsume={(q) => { setInventory(prev => prev.map(i => i.id === selectedItem.id ? {...i, currentQuantity: Math.max(0, i.currentQuantity - q)} : i)); setSelectedItem(prev => prev ? {...prev, currentQuantity: Math.max(0, prev.currentQuantity - q)} : null); }} onUpdate={(newItem) => { setInventory(prev => prev.map(i => i.id === newItem.id ? newItem : i)); setSelectedItem(prev => prev && prev.id === newItem.id ? newItem : prev); }} onPublishRequest={handlePublishToPlaza} onChatRequest={() => setStep('chat')} onMarkSold={handleMarkAsSold} onCancelListing={handleCancelListing} />}
        {step === 'chat' && selectedItem && <ChatView sellerName={selectedItem.sellerName || 'Seller'} itemName={selectedItem.translatedName} basePrice={selectedItem.priceTag || 0} targetLang={targetLang} onBack={() => { if (selectedConversationId) { setStep('inbox'); setSelectedConversationId(null); } else setStep('item_detail'); }} initialMessages={selectedConversationId ? conversations.find(c => c.id === selectedConversationId)?.messages : undefined} onMessageSent={handleMessageSent} />}
        {step === 'review' && ocrResult && (
            <div className="animate-in slide-in-from-bottom duration-500 flex flex-col flex-1 h-full relative">
                <div className="bg-white rounded-[2.5rem] shadow-xl border border-purple-200 overflow-hidden flex flex-col flex-1">
                    <div className="p-6 bg-purple-800 text-white flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-black text-sm uppercase">AI Review</h3>
                      </div>
                      <button onClick={() => setStep('upload')}><i className="fas fa-times"></i></button>
                    </div>

                    <div className="px-6 pt-4 bg-slate-50/50"><label className="text-[10px] font-black text-purple-400 uppercase tracking-widest block mb-2">Purchase Date</label><input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className="w-full bg-purple-50 border border-purple-100 rounded-xl p-3 text-sm font-bold text-purple-800 outline-none focus:border-pink-300" /></div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
                        {ocrResult.items?.map((item, i) => (
                            <div key={i} className="flex flex-col p-4 bg-white rounded-2xl border border-purple-100 space-y-3">
                                <div className="flex items-center space-x-4">
                                    {item.photo ? <img src={item.photo} alt={item.name} className="w-12 h-12 object-cover rounded-lg border border-purple-100" /> : <div className="text-3xl">{item.emoji}</div>}
                                    <div className="flex-1"><div className="font-black text-purple-800 text-sm">{item.translatedName}</div><div className="text-[9px] text-purple-400 uppercase font-black">{item.quantity} {item.unit}</div></div>
                                    <button onClick={() => handleSellClickInReview(i, item)} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm ${item.isSelling ? 'bg-pink-500 text-white shadow-pink-200' : 'bg-white text-purple-300 border border-purple-100 hover:border-pink-200'}`}><i className="fas fa-hand-holding-dollar text-lg"></i></button>
                                </div>
                                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-purple-50"><div><span className="text-[9px] font-bold text-purple-400 uppercase block mb-1">{item.isSelling ? "Original Price" : "Price (¥)"}</span><input type="number" placeholder="0.00" value={item.price || ''} onChange={(e) => handleReviewItemChange(i, { price: parseFloat(e.target.value) })} className="w-full py-1.5 px-3 rounded-lg border border-purple-100 bg-purple-50 text-xs font-bold text-purple-800 outline-none focus:border-pink-300" /></div>{item.isSelling && <div className="animate-in slide-in-from-right duration-300"><span className="text-[9px] font-bold text-pink-400 uppercase block mb-1">Sell Price (¥)</span><input type="number" placeholder="Asking..." value={item.askingPrice || ''} onChange={(e) => handleReviewItemChange(i, { askingPrice: parseFloat(e.target.value) })} className="flex-1 py-1.5 px-3 rounded-lg border border-purple-100 bg-purple-50 text-xs font-bold text-purple-800 outline-none focus:border-pink-300" /></div>}</div>{(item.consumptionRate || item.consumptionFreq) && !item.isSelling && <div className="flex items-center gap-2 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100"><i className="fas fa-magic text-blue-400 text-[10px]"></i><span className="text-[9px] font-bold text-blue-500">Auto-Use: {item.consumptionRate} / {item.consumptionFreq}</span></div>}<div className="flex items-center justify-between border-t border-purple-50 pt-2"><span className="text-[9px] font-bold text-purple-400">Store in:</span><select value={item.assignedRoom || 'storage'} onChange={(e) => handleReviewItemChange(i, { assignedRoom: e.target.value as RoomType })} className="text-[10px] font-bold text-purple-800 bg-purple-50 border border-purple-100 rounded-lg px-2 py-1 outline-none">{ALL_ROOMS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}</select></div>
                            </div>
                        ))}
                    </div>
                    <div className="p-8 bg-white border-t border-purple-50"><button onClick={() => addToInventory(ocrResult.items || [])} className="w-full py-5 bg-pink-500 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-xs">Confirm & Add ({butler.personality === 'strict' ? 'Hmph!' : 'Done ✨'})</button></div>
                </div>

                {sellModalState && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white w-full h-full max-h-full rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden relative">
                            <div className="bg-purple-50 p-6 flex flex-col items-center relative shrink-0">
                                <h3 className="text-sm font-black text-purple-800 mb-6 uppercase tracking-widest">Ready to Sell</h3>
                                <button onClick={() => setSellModalState(null)} className="absolute top-6 right-6 text-purple-300 hover:text-purple-600"><i className="fas fa-times"></i></button>
                                <div className="w-24 h-24 bg-white rounded-3xl shadow-lg border-4 border-white flex items-center justify-center text-4xl mb-2">
                                    {ocrResult.items && ocrResult.items[sellModalState.index]?.photo ? (
                                        <img src={ocrResult.items[sellModalState.index]!.photo} className="w-full h-full object-cover rounded-2xl" />
                                    ) : (
                                        ocrResult.items && ocrResult.items[sellModalState.index]?.emoji
                                    )}
                                </div>
                                <div className="text-xs font-black text-purple-800">
                                    {ocrResult.items && ocrResult.items[sellModalState.index]?.translatedName}
                                </div>
                            </div>
                            
                            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                                <div className="relative">
                                    <label className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-2 block">Sell Price (¥)</label>
                                    <input 
                                        type="number" 
                                        value={sellModalState.price} 
                                        onChange={(e) => setSellModalState(prev => prev ? { ...prev, price: e.target.value } : null)} 
                                        className="w-full p-4 bg-purple-50 rounded-2xl font-black text-purple-800 outline-none border border-transparent focus:border-pink-300 transition-all text-center text-lg" 
                                    />
                                </div>
                                
                                <div className="relative flex-1 flex flex-col">
                                    <label className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-2 block">AI Generated Ad</label>
                                    {sellModalState.loading ? (
                                        <div className="w-full h-32 bg-purple-50 rounded-2xl flex items-center justify-center">
                                            <span className="text-[10px] font-bold text-pink-500 animate-pulse flex items-center gap-2">
                                                <i className="fas fa-sparkles"></i> Butler is writing...
                                            </span>
                                        </div>
                                    ) : (
                                        <textarea 
                                            value={sellModalState.ad} 
                                            onChange={(e) => setSellModalState(prev => prev ? { ...prev, ad: e.target.value } : null)} 
                                            className="w-full flex-1 p-4 bg-purple-50 rounded-2xl text-xs font-medium text-purple-800 outline-none resize-none border border-transparent focus:border-pink-300 transition-all leading-relaxed min-h-[120px]" 
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="p-6 pt-0 shrink-0">
                                <button 
                                    onClick={handleConfirmSellModal} 
                                    disabled={sellModalState.loading}
                                    className="w-full py-4 bg-pink-500 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-pink-200 flex items-center justify-center space-x-2 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    <i className="fas fa-store"></i>
                                    <span>List on Plaza</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}
        {step === 'plaza' && <CommunityView items={communityItems} currentLang={targetLang} onItemClick={(item) => { setSelectedItem(item); setLastStep('plaza'); setStep('item_detail'); }} initialView={initialCommunityView} onUserClick={handleCommunityUserClick} onViewChange={setInitialCommunityView} />}
        {step === 'inbox' && <div className="flex-1 flex flex-col animate-in fade-in pb-20 pt-10 px-6"><h2 className="text-3xl font-black text-purple-800 uppercase tracking-tight mb-6">{NAV_TEXT[targetLang].inbox}</h2><div className="space-y-4 overflow-y-auto custom-scrollbar">{conversations.length === 0 ? <div className="text-center py-20 text-purple-300 text-xs font-bold">No messages yet.</div> : conversations.map(conv => <div key={conv.id} onClick={() => handleOpenConversation(conv)} className={`bg-white p-4 rounded-3xl border ${conv.unread ? 'border-pink-300 shadow-md' : 'border-purple-50 shadow-sm'} flex items-center cursor-pointer active:scale-95 transition-all`}><div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-2xl mr-4 relative shrink-0">{conv.avatar}{conv.unread && <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-pink-500 rounded-full border-2 border-white animate-pulse"></div>}</div><div className="flex-1 min-w-0"><div className="flex justify-between items-baseline mb-1"><span className="font-black text-purple-800 text-sm truncate">{conv.otherUserName}</span><span className="text-[9px] text-purple-300 font-bold shrink-0 ml-2">{conv.messages.length > 0 ? new Date(conv.messages[conv.messages.length-1].timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}</span></div><p className={`text-xs truncate ${conv.unread ? 'text-purple-600 font-bold' : 'text-purple-400 font-medium'}`}>{conv.messages.length > 0 ? conv.messages[conv.messages.length-1].text : 'Start chatting...'}</p><div className="mt-1 text-[9px] text-pink-400 font-bold uppercase tracking-wider truncate">{conv.itemName}</div></div></div>)}</div></div>}

        <div className="fixed bottom-10 inset-x-0 mx-auto max-w-[340px] h-18 bg-white/70 backdrop-blur-3xl border border-white/40 rounded-[2.5rem] shadow-2xl flex items-center justify-around px-2 z-50">
          <button onClick={() => { setStep('home'); setInitialCommunityView('map'); setWalkToRoom(null); setButlerMessage(null); }} className={`w-11 h-11 rounded-2xl transition-all flex items-center justify-center ${step === 'home' || step === 'inventory' ? 'bg-purple-800 text-white shadow-lg' : 'text-purple-300'}`}><i className="fas fa-warehouse text-sm"></i></button>
          <button onClick={() => setStep('inbox')} className={`w-11 h-11 rounded-2xl transition-all flex items-center justify-center relative ${step === 'inbox' ? 'bg-purple-800 text-white shadow-lg' : 'text-purple-300'}`}><i className="fas fa-comment-dots text-sm"></i>{getUnreadCount() > 0 && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-pink-500 rounded-full border border-white"></div>}</button>
          <button onClick={() => setStep('upload')} className={`w-11 h-11 rounded-full transition-all flex items-center justify-center ${step === 'upload' ? 'bg-purple-800 text-white shadow-lg' : 'text-purple-300'}`}><i className="fas fa-camera text-sm"></i></button>
          <button onClick={() => { setStep('plaza'); setInitialCommunityView('map'); }} className={`w-11 h-11 rounded-2xl transition-all flex items-center justify-center ${step === 'plaza' ? 'bg-purple-800 text-white shadow-lg' : 'text-purple-300'}`}><i className="fas fa-shopping-bag text-sm"></i></button>
          <button onClick={() => setStep('butler')} className={`w-11 h-11 rounded-2xl transition-all flex items-center justify-center ${step === 'butler' ? 'bg-purple-800 text-white shadow-lg' : 'text-purple-300'}`}><i className="fas fa-user-astronaut text-sm"></i></button>
        </div>
      </div>
      <style>{` .custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #d4b483; border-radius: 10px; } `}</style>
    </Layout>
  );
};
export default App;