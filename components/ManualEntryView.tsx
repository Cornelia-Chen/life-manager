
import React, { useState, useEffect, useRef } from 'react';
import { RoomType, predictEmoji, LanguageCode, ConsumptionConfig } from '../services/geminiService';

interface ManualEntryViewProps {
  onBack: () => void;
  onSubmit: (item: any) => void;
  defaultRoom?: RoomType | null;
  currentLang: LanguageCode;
  initialName?: string;
}

const ROOM_ICONS: Record<RoomType, { icon: string; defaultEmoji: string }> = {
  kitchen: { icon: 'fa-utensils', defaultEmoji: '🍳' },
  living: { icon: 'fa-couch', defaultEmoji: '🛋️' },
  bedroom: { icon: 'fa-bed', defaultEmoji: '🛌' },
  bathroom: { icon: 'fa-bath', defaultEmoji: '🧼' },
  balcony: { icon: 'fa-sun', defaultEmoji: '🪴' },
  storage: { icon: 'fa-box-archive', defaultEmoji: '📦' },
  cloakroom: { icon: 'fa-shirt', defaultEmoji: '👔' },
};

const TEXT: Record<LanguageCode, any> = {
  'zh-CN': { title: '添加新资产', name: '物品全称', qty: '数量', unit: '单位', price: '预估总价', room: '存放至房间', save: '保存并留证 (哼)', smart: '智能图标', photo: '实物留证', clickPhoto: '点击拍摄', consTitle: '消耗设置', consAmount: '用量', consFreq: '频率', consEnable: '开启自动消耗' },
  'en': { title: 'Add New Item', name: 'Item Name', qty: 'Quantity', unit: 'Unit', price: 'Est. Price', room: 'Assigned Room', save: 'Save (Hmph)', smart: 'Smart Icon', photo: 'Photo Proof', clickPhoto: 'Tap to Snap', consTitle: 'Consumption', consAmount: 'Amount', consFreq: 'Freq', consEnable: 'Auto-Consume' },
  'fr': { title: 'Ajouter', name: 'Nom', qty: 'Qté', unit: 'Unité', price: 'Prix Est.', room: 'Pièce', save: 'Enregistrer (Hmph)', smart: 'Icône', photo: 'Preuve Photo', clickPhoto: 'Prendre Photo', consTitle: 'Consommation', consAmount: 'Qté', consFreq: 'Fréq', consEnable: 'Auto-Conso' },
  'ja': { title: 'アイテム追加', name: '名前', qty: '数量', unit: '単位', price: '推定価格', room: '部屋', save: '保存 (ふん)', smart: 'アイコン', photo: '写真', clickPhoto: '撮影', consTitle: '消費設定', consAmount: '使用量', consFreq: '頻度', consEnable: '自動消費' },
  'es': { title: 'Añadir Ítem', name: 'Nombre', qty: 'Cant.', unit: 'Unidad', price: 'Precio Est.', room: 'Habitación', save: 'Guardar (Jum)', smart: 'Icono', photo: 'Foto', clickPhoto: 'Tomar Foto', consTitle: 'Consumo', consAmount: 'Cant.', consFreq: 'Frec.', consEnable: 'Auto-Consumo' }
};

const ROOM_NAMES: Record<LanguageCode, Record<RoomType, string>> = {
  'zh-CN': { kitchen: '厨房', living: '客厅', bedroom: '卧室', bathroom: '洗手间', balcony: '阳台', storage: '储藏室', cloakroom: '衣帽间' },
  'en': { kitchen: 'Kitchen', living: 'Living', bedroom: 'Bedroom', bathroom: 'Bath', balcony: 'Balcony', storage: 'Storage', cloakroom: 'Cloakroom' },
  'fr': { kitchen: 'Cuisine', living: 'Salon', bedroom: 'Chambre', bathroom: 'Bain', balcony: 'Balcon', storage: 'Stockage', cloakroom: 'Vestiaire' },
  'ja': { kitchen: 'キッチン', living: '居間', bedroom: '寝室', bathroom: '浴室', balcony: 'ベランダ', storage: '倉庫', cloakroom: 'クローク' },
  'es': { kitchen: 'Cocina', living: 'Sala', bedroom: 'Dormitorio', bathroom: 'Baño', balcony: 'Balcón', storage: 'Almacén', cloakroom: 'Vestidor' },
};

export const ManualEntryView: React.FC<ManualEntryViewProps> = ({ onBack, onSubmit, defaultRoom, currentLang, initialName }) => {
  const [name, setName] = useState(initialName || '');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState('');
  const [room, setRoom] = useState<RoomType>(defaultRoom || 'storage');
  const [emoji, setEmoji] = useState('📦');
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [isAiSearching, setIsAiSearching] = useState(false);
  
  // Consumption State
  const [consEnabled, setConsEnabled] = useState(false);
  const [consAmount, setConsAmount] = useState('1');
  const [consFreq, setConsFreq] = useState<'day'|'week'|'month'|'year'>('month');

  const debounceTimer = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = TEXT[currentLang] || TEXT['zh-CN'];
  const roomLabels = ROOM_NAMES[currentLang] || ROOM_NAMES['zh-CN'];

  useEffect(() => {
    const savedCustomMap = localStorage.getItem('user_emoji_map');
    if (!savedCustomMap) {
      localStorage.setItem('user_emoji_map', JSON.stringify({}));
    }
  }, []);

  useEffect(() => {
    const roomConfig = ROOM_ICONS[room];
    const defaultIcon = roomConfig?.defaultEmoji || '📦';

    if (!name.trim()) {
      setEmoji(defaultIcon);
      return;
    }

    const customMap = JSON.parse(localStorage.getItem('user_emoji_map') || '{}');
    if (customMap[name]) {
      setEmoji(customMap[name]);
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setIsAiSearching(true);
    
    debounceTimer.current = window.setTimeout(async () => {
      const predicted = await predictEmoji(name);
      setEmoji(predicted);
      setIsAiSearching(false);
      
      const updatedMap = JSON.parse(localStorage.getItem('user_emoji_map') || '{}');
      updatedMap[name] = predicted;
      localStorage.setItem('user_emoji_map', JSON.stringify(updatedMap));
    }, 800);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [name, room]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !quantity) return;
    
    const consumption: ConsumptionConfig = {
        isEnabled: consEnabled,
        amount: parseFloat(consAmount) || 1,
        frequency: consFreq,
        lastCalculated: Date.now()
    };

    onSubmit([{
      translatedName: name,
      emoji: emoji,
      quantity: parseFloat(quantity),
      unit: unit || 'unit',
      price: parseFloat(price) || 0,
      assignedRoom: room,
      photo: photo,
      consumption: consumption
    }]);
  };

  return (
    <div className="animate-in slide-in-from-bottom duration-500 flex flex-col flex-1 pb-10">
      <div className="flex items-center mb-6">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-purple-400 text-white rounded-lg shadow-md mr-4 hover:bg-purple-500 transition-colors ripple">
          <i className="fas fa-chevron-left text-sm"></i>
        </button>
        <h2 className="text-xl font-black text-purple-800 uppercase tracking-wide">{t.title}</h2>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] shadow-xl border border-purple-100 p-8 space-y-6">
        <div className="flex justify-around items-center mb-4">
          <div className="flex flex-col items-center">
            <div 
              className={`relative text-5xl bg-gradient-to-br from-white to-purple-50 w-24 h-24 flex items-center justify-center rounded-[2rem] shadow-inner border border-purple-100 transition-all ${isAiSearching ? 'animate-pulse scale-105' : ''}`}
            >
              <span className="drop-shadow-sm">{emoji}</span>
              <div className="absolute -top-1 -right-1 bg-pink-500 text-white w-6 h-6 rounded-lg flex items-center justify-center text-[8px] shadow-lg">
                <i className={`fas ${isAiSearching ? 'fa-wand-magic-sparkles' : 'fa-tag'}`}></i>
              </div>
            </div>
            <p className="text-[8px] text-purple-300 font-black uppercase tracking-widest mt-2">{t.smart}</p>
          </div>

          <div className="flex flex-col items-center">
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative w-24 h-24 rounded-[2rem] border-2 border-dashed border-purple-200 bg-purple-50 flex items-center justify-center overflow-hidden hover:border-pink-300 transition-all group"
            >
              {photo ? (
                <img src={photo} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <i className="fas fa-camera text-2xl text-purple-200 group-hover:text-pink-300"></i>
              )}
              <div className="absolute bottom-0 inset-x-0 bg-black/40 text-white text-[8px] py-1 opacity-0 group-hover:opacity-100 transition-opacity">{t.clickPhoto}</div>
            </button>
            <p className="text-[8px] text-purple-300 font-black uppercase tracking-widest mt-2">{t.photo}</p>
            <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest ml-4 mb-1 block">{t.name}</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-6 py-4 bg-purple-50 border-2 border-transparent focus:border-pink-300 rounded-2xl outline-none text-purple-800 font-bold transition-all placeholder:text-purple-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest ml-4 mb-1 block">{t.qty}</label>
              <input
                required
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-6 py-4 bg-purple-50 border-2 border-transparent focus:border-pink-300 rounded-2xl outline-none text-purple-800 font-bold transition-all"
              />
            </div>
            <div className="relative">
              <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest ml-4 mb-1 block">{t.unit}</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-6 py-4 bg-purple-50 border-2 border-transparent focus:border-pink-300 rounded-2xl outline-none text-purple-800 font-bold transition-all placeholder:text-purple-200"
              />
            </div>
          </div>

          <div className="relative">
            <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest ml-4 mb-1 block">{t.price}</label>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-purple-300 font-bold">¥</span>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full pl-10 pr-6 py-4 bg-purple-50 border-2 border-transparent focus:border-pink-300 rounded-2xl outline-none text-purple-800 font-bold transition-all placeholder:text-purple-200"
              />
            </div>
          </div>

          {/* Consumption Settings */}
          <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
              <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center space-x-2">
                      <i className="fas fa-stopwatch text-blue-400 text-xs"></i>
                      <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">{t.consTitle}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                      <span className="text-[9px] font-bold text-blue-300">{t.consEnable}</span>
                      <button 
                        type="button"
                        onClick={() => setConsEnabled(!consEnabled)}
                        className={`w-8 h-4 rounded-full relative transition-colors ${consEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}
                      >
                          <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${consEnabled ? 'left-4.5' : 'left-0.5'}`}></div>
                      </button>
                  </div>
              </div>
              
              {consEnabled && (
                  <div className="flex space-x-2 animate-in slide-in-from-top-2">
                      <div className="flex-1">
                          <label className="text-[9px] font-bold text-blue-400 block mb-1">{t.consAmount}</label>
                          <input 
                            type="number"
                            value={consAmount}
                            onChange={(e) => setConsAmount(e.target.value)}
                            className="w-full p-2 rounded-lg border border-blue-200 text-xs font-bold text-blue-800 outline-none"
                          />
                      </div>
                      <div className="flex-1">
                          <label className="text-[9px] font-bold text-blue-400 block mb-1">{t.consFreq}</label>
                          <select 
                            value={consFreq}
                            onChange={(e) => setConsFreq(e.target.value as any)}
                            className="w-full p-2 rounded-lg border border-blue-200 text-xs font-bold text-blue-800 outline-none bg-white"
                          >
                              <option value="day">/ Day</option>
                              <option value="week">/ Week</option>
                              <option value="month">/ Month</option>
                              <option value="year">/ Year</option>
                          </select>
                      </div>
                  </div>
              )}
          </div>

          <div>
            <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest ml-4 mb-2 block">{t.room}</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ROOM_ICONS) as RoomType[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoom(r)}
                  className={`py-3 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
                    room === r 
                      ? 'border-pink-500 bg-pink-50 text-pink-600' 
                      : 'border-purple-50 bg-white text-purple-300 hover:border-purple-100'
                  }`}
                >
                  <i className={`fas ${ROOM_ICONS[r].icon} mb-1 text-xs`}></i>
                  <span className="text-[9px] font-black">{roomLabels[r]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-5 bg-pink-500 text-white font-black rounded-2xl shadow-xl shadow-pink-200 hover:bg-pink-600 active:scale-95 transition-all uppercase tracking-widest text-xs ripple"
        >
          {t.save}
        </button>
      </form>
    </div>
  );
};