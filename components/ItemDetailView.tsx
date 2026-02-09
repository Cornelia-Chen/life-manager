
import React, { useState, useRef } from 'react';
import { ReceiptItem, generateSaleAd, AlertType, LanguageCode, ALL_ROOMS, RoomType, ROOM_CENTERS } from '../services/geminiService';

interface ItemDetailViewProps {
  item: ReceiptItem;
  targetLang: LanguageCode;
  onBack: () => void;
  onConsume: (quantity: number) => void;
  onUpdate: (item: ReceiptItem) => void;
  onChatRequest?: () => void;
  onPublishRequest?: (item: ReceiptItem, price: number, ad: string) => void;
  onMarkSold?: (item: ReceiptItem) => void;
  onCancelListing?: (item: ReceiptItem) => void;
  viewMode?: 'inventory' | 'market';
}

const TEXT: Record<LanguageCode, any> = {
  'zh-CN': { 
      acquired_on: '获取日期', 
      listing_price: '挂牌价', 
      selling: '您正在出售', 
      mark_sold: '标记为已售', 
      item_sold: '已售出', 
      pm_seller: '私信卖家', 
      my_listing: '我发布的', 
      flea_market: '跳蚤市场', 
      inventory: '我的库存', 
      show_map: '地图显示', 
      stored_in: '存放于', 
      in_stock: '库存:', 
      consume: '消耗 -1', 
      reminder: '提醒', 
      off: '关闭', 
      low_stock: '库存不足', 
      exp_date: '过期日', 
      alert_below: '低于此数提醒:', 
      expires_on: '过期日期:', 
      price_history: '价格走势', 
      ready_sell: '发布闲置', 
      photo_req: '有照片更容易卖出哦!', 
      price_lbl: '价格 (¥)', 
      ad_copy: '艾莉丝生成的文案 (可编辑)', 
      sell_plaza: '发布到广场', 
      export: '导出到其他APP', 
      copied: '已复制!',
      consumption: '智能消耗',
      use_every: '每',
      usage: '使用量',
      listed_on_plaza: '已上架到广场',
      cancel_sell: '取消出售'
  },
  'en': { 
      acquired_on: 'Acquired on', 
      listing_price: 'Listing Price', 
      selling: 'You are selling this', 
      mark_sold: 'Mark as Sold', 
      item_sold: 'Item Sold', 
      pm_seller: 'Private Message Seller', 
      my_listing: 'My Active Listing', 
      flea_market: 'Flea Market Find', 
      inventory: 'My Inventory', 
      show_map: 'Show on Map', 
      stored_in: 'Stored In', 
      in_stock: 'In Stock:', 
      consume: 'Consume -1', 
      reminder: 'Reminder', 
      off: 'Off', 
      low_stock: 'Low Stock', 
      exp_date: 'Exp. Date', 
      alert_below: 'Alert when below:', 
      expires_on: 'Expires on:', 
      price_history: 'Price History', 
      ready_sell: 'Ready to Sell', 
      photo_req: 'Photo required for better sales!', 
      price_lbl: 'Price (¥)', 
      ad_copy: "Alice's Copy (Editable)", 
      sell_plaza: 'Sell on Plaza (In-App)', 
      export: 'Export to Other Apps', 
      copied: 'Copied!',
      consumption: 'Smart Consumption',
      use_every: 'Every',
      usage: 'Usage',
      listed_on_plaza: 'Listed on Plaza',
      cancel_sell: 'Cancel Listing'
  },
  'fr': { 
      acquired_on: 'Acquis le', 
      listing_price: 'Prix affiché', 
      selling: 'Vous vendez ceci', 
      mark_sold: 'Marquer vendu', 
      item_sold: 'Vendu', 
      pm_seller: 'Message privé', 
      my_listing: 'Mon annonce', 
      flea_market: 'Trouvaille', 
      inventory: 'Mon inventaire', 
      show_map: 'Voir sur carte', 
      stored_in: 'Stocké à', 
      in_stock: 'Stock:', 
      consume: 'Consommer -1', 
      reminder: 'Rappel', 
      off: 'Non', 
      low_stock: 'Stock bas', 
      exp_date: 'Exp.', 
      alert_below: 'Alerte si <', 
      expires_on: 'Expire le:', 
      price_history: 'Historique Prix', 
      ready_sell: 'Mettre en vente', 
      photo_req: 'Photo requise!', 
      price_lbl: 'Prix (¥)', 
      ad_copy: 'Texte (Editable)', 
      sell_plaza: 'Vendre sur la Place', 
      export: 'Exporter', 
      copied: 'Copié!',
      consumption: 'Conso. Intelligente',
      use_every: 'Chaque',
      usage: 'Utilisation',
      listed_on_plaza: 'En vente sur la Place',
      cancel_sell: 'Annuler vente'
  },
  'ja': { 
      acquired_on: '取得日', 
      listing_price: '出品価格', 
      selling: '出品中', 
      mark_sold: '販売済みにする', 
      item_sold: '売り切れ', 
      pm_seller: '販売者に連絡', 
      my_listing: '出品リスト', 
      flea_market: 'フリマ', 
      inventory: '在庫', 
      show_map: 'マップに表示', 
      stored_in: '保管場所', 
      in_stock: '在庫:', 
      consume: '消費 -1', 
      reminder: 'リマインダー', 
      off: 'オフ', 
      low_stock: '在庫不足', 
      exp_date: '期限', 
      alert_below: '以下で通知:', 
      expires_on: '期限日:', 
      price_history: '価格履歴', 
      ready_sell: '出品する', 
      photo_req: '写真があると売れやすいよ！', 
      price_lbl: '価格 (¥)', 
      ad_copy: 'アリスの文案 (編集可)', 
      sell_plaza: '広場で売る', 
      export: '他アプリへ', 
      copied: 'コピー完了!',
      consumption: 'スマート消費',
      use_every: '毎',
      usage: '使用量',
      listed_on_plaza: '広場に出品中',
      cancel_sell: '出品キャンセル'
  },
  'es': { 
      acquired_on: 'Adquirido el', 
      listing_price: 'Precio de lista', 
      selling: 'Estás vendiendo esto', 
      mark_sold: 'Marcar vendido', 
      item_sold: 'Vendido', 
      pm_seller: 'Mensaje al vendedor', 
      my_listing: 'Mi listado', 
      flea_market: 'Mercado', 
      inventory: 'Mi inventario', 
      show_map: 'Ver en mapa', 
      stored_in: 'Guardado en', 
      in_stock: 'Stock:', 
      consume: 'Consumir -1', 
      reminder: 'Recordatorio', 
      off: 'No', 
      low_stock: 'Stock bajo', 
      exp_date: 'Expira', 
      alert_below: 'Alerta si <', 
      expires_on: 'Expira el:', 
      price_history: 'Historial', 
      ready_sell: 'Vender', 
      photo_req: '¡Foto requerida!', 
      price_lbl: 'Precio (¥)', 
      ad_copy: 'Copia de Alice (Editable)', 
      sell_plaza: 'Vender en Plaza', 
      export: 'Exportar', 
      copied: '¡Copiado!',
      consumption: 'Consumo Intel.',
      use_every: 'Cada',
      usage: 'Uso',
      listed_on_plaza: 'Listado en Plaza',
      cancel_sell: 'Cancelar'
  }
};

export const ItemDetailView: React.FC<ItemDetailViewProps> = ({ item, targetLang, onBack, onConsume, onUpdate, onChatRequest, onPublishRequest, onMarkSold, onCancelListing, viewMode = 'inventory' }) => {
  const [saleAd, setSaleAd] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [askingPrice, setAskingPrice] = useState<string>('');
  
  // Alert Settings States
  const [alertType, setAlertType] = useState<AlertType>(item.alertType || 'none');
  const [lowStockInput, setLowStockInput] = useState<string>(item.lowStockThreshold?.toString() || '');
  const [expDateInput, setExpDateInput] = useState<string>(
    item.expirationDate ? new Date(item.expirationDate).toISOString().split('T')[0] : ''
  );

  // Consumption State
  const [useConsumption, setUseConsumption] = useState(item.consumption?.isEnabled || false);
  const [consAmount, setConsAmount] = useState(item.consumption?.amount || 1);
  const [consFreq, setConsFreq] = useState<'day'|'week'|'month'|'year'>(item.consumption?.frequency || 'month');

  const [copyFeedback, setCopyFeedback] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = TEXT[targetLang] || TEXT['zh-CN'];

  const handleSell = async () => {
    setIsGenerating(true);
    const ad = await generateSaleAd(item, targetLang);
    setSaleAd(ad);
    setAskingPrice(item.history[0]?.unitPrice.toString() || '0');
    setIsGenerating(false);
  };

  const handleCopyAd = () => {
    if (saleAd) {
      const fullText = `【转卖】${item.translatedName}\n价格：¥${askingPrice}\n\n${saleAd}\n\n(Generated by Alice)`;
      navigator.clipboard.writeText(fullText);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => onUpdate({ ...item, photo: reader.result as string });
      reader.readAsDataURL(file);
    }
  };
  
  const updateAlertSettings = (type: AlertType, thresholdVal: string, dateVal: string) => {
    setAlertType(type);
    
    let newItem = { ...item, alertType: type };
    
    if (type === 'quantity') {
        const num = parseInt(thresholdVal);
        newItem.lowStockThreshold = !isNaN(num) ? num : 1;
        newItem.expirationDate = undefined;
    } else if (type === 'date') {
        const ts = dateVal ? new Date(dateVal).getTime() : undefined;
        newItem.expirationDate = ts;
        newItem.lowStockThreshold = undefined;
    } else {
        newItem.lowStockThreshold = undefined;
        newItem.expirationDate = undefined;
    }
    onUpdate(newItem);
  };

  const updateConsumption = (enabled: boolean, amt: number, freq: 'day'|'week'|'month'|'year') => {
      setUseConsumption(enabled);
      setConsAmount(amt);
      setConsFreq(freq);
      
      onUpdate({
          ...item,
          consumption: {
              isEnabled: enabled,
              amount: amt,
              frequency: freq,
              lastCalculated: Date.now() 
          }
      });
  };
  
  const daysLeft = item.currentQuantity > 0 && useConsumption ? (() => {
      let daily = 0;
      if (consFreq === 'day') daily = consAmount;
      if (consFreq === 'week') daily = consAmount/7;
      if (consFreq === 'month') daily = consAmount/30;
      if (consFreq === 'year') daily = consAmount/365;
      if (daily === 0) return 0;
      return Math.floor(item.currentQuantity / daily);
  })() : null;

  const handleToggleMap = () => {
    const nextState = !item.showOnMap;
    let nextPos = item.position;

    if (nextState && (!nextPos || (nextPos.x === undefined))) {
       const center = ROOM_CENTERS[item.assignedRoom] || {x: 24, y: 24};
       nextPos = { 
           x: center.x + (Math.random() - 0.5) * 2, 
           y: center.y + (Math.random() - 0.5) * 2 
       };
    }
    onUpdate({ ...item, showOnMap: nextState, position: nextPos });
  };

  const handleRoomChange = (newRoom: RoomType) => {
      const center = ROOM_CENTERS[newRoom] || {x: 24, y: 24};
      const nextPos = { 
          x: center.x + (Math.random() - 0.5) * 2, 
          y: center.y + (Math.random() - 0.5) * 2 
      };
      onUpdate({ ...item, assignedRoom: newRoom, position: nextPos });
  };

  // Logic to determine view mode
  const isPublicListing = item.isPublic || (!!item.sellerName && item.sellerName !== '');
  const isMyListing = isPublicListing && (item.sellerName === 'Me' || item.sellerName === '我' || item.sellerName === 'Me'); 
  const isMarketItem = isPublicListing && !isMyListing;
  const isSold = item.marketStatus === 'sold';

  // Key Change: Prioritize viewMode. If viewMode is market, or it's someone else's item, show market view.
  // If viewMode is inventory, show inventory view regardless of selling status.
  const showMarketView = viewMode === 'market' || (isPublicListing && !isMyListing);

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  };

  const renderHistory = () => {
    if (!item.history || item.history.length === 0) return null;

    return (
      <div className="mt-8 w-full">
        <div className="flex justify-between items-center mb-4 px-2">
          <h3 className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em]">{t.price_history}</h3>
          <span className="text-[8px] font-bold text-pink-400">{item.history.length} records</span>
        </div>

        {item.history.length > 1 && (
          <div className="w-full h-16 bg-purple-50/50 rounded-2xl mb-4 p-2 relative overflow-hidden border border-purple-100/50">
            <svg className="w-full h-full" viewBox="0 0 100 20" preserveAspectRatio="none">
              <path
                d={`M ${item.history.slice(0, 10).reverse().map((h, i) => {
                  const maxP = Math.max(...item.history.map(x => x.unitPrice)) || 1;
                  const x = (i / Math.max(1, item.history.slice(0, 10).length - 1)) * 100;
                  const y = 20 - (h.unitPrice / maxP) * 15 - 2;
                  return `${x},${y}`;
                }).join(' L ')}`}
                fill="none"
                stroke="#ec4899"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="drop-shadow-[0_2px_4px_rgba(236,72,153,0.3)]"
              />
            </svg>
          </div>
        )}

        <div className="space-y-2">
          {item.history.map((record, idx) => {
            const prevRecord = item.history[idx + 1];
            const diff = prevRecord ? ((record.unitPrice - prevRecord.unitPrice) / prevRecord.unitPrice) * 100 : 0;
            
            return (
              <div key={idx} className="bg-white/60 backdrop-blur-sm border border-purple-50 p-4 rounded-2xl flex items-center justify-between transition-all hover:bg-white/90">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-purple-800">{formatDate(record.timestamp)}</span>
                  <span className="text-[8px] text-purple-400 font-bold uppercase tracking-tighter">Qty: {record.quantity}{item.unit}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-purple-900">¥{record.unitPrice.toFixed(2)}<span className="text-[8px] text-purple-300 ml-1">/{item.unit}</span></div>
                  {prevRecord && (
                    <div className={`text-[8px] font-black flex items-center justify-end ${diff > 0 ? 'text-pink-500' : 'text-green-500'}`}>
                      <i className={`fas ${diff > 0 ? 'fa-arrow-up' : 'fa-arrow-down'} mr-0.5`}></i>
                      {Math.abs(diff).toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-in slide-in-from-right duration-500 flex flex-col flex-1 pb-20 relative">
      <div className="flex items-center justify-between mb-8 relative z-10">
        <button onClick={onBack} className="w-10 h-10 bg-purple-400 text-white rounded-2xl shadow-md"><i className="fas fa-chevron-left"></i></button>
        <div className="text-center">
          <h2 className="text-xl font-black text-purple-800 uppercase tracking-tight truncate max-w-[160px]">{item.translatedName}</h2>
          <p className="text-[8px] text-pink-500 font-bold uppercase tracking-widest mt-1">
             {isMyListing ? t.my_listing : isMarketItem ? t.flea_market : t.inventory}
          </p>
        </div>
        {/* Only show Sell button if it's NOT already listed in some form */}
        {!isPublicListing && (
          <button onClick={handleSell} disabled={isGenerating} className="w-10 h-10 bg-pink-500 text-white rounded-2xl shadow-lg active:scale-90 transition-all flex items-center justify-center">
            {isGenerating ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-hand-holding-dollar"></i>}
          </button>
        )}
        {isPublicListing && <div className="w-10"></div>}
      </div>

      <div className="bg-white rounded-[3.5rem] shadow-2xl border border-purple-50 overflow-hidden mb-8 p-10 flex flex-col items-center relative">
        
        {isSold && (
            <div className="absolute top-10 right-10 z-20 pointer-events-none opacity-80 rotate-12">
                <div className="border-4 border-red-500 text-red-500 font-black text-4xl px-4 py-1 rounded-xl uppercase tracking-widest opacity-80 mix-blend-multiply">
                    SOLD
                </div>
            </div>
        )}

        <div className={`w-56 h-56 bg-purple-50 rounded-[3rem] overflow-hidden shadow-xl border-8 border-white -rotate-1 mb-8 relative group ${isSold ? 'grayscale opacity-75' : ''}`}>
          {item.photo ? (
            <img src={item.photo} alt="product" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-8xl opacity-40">{item.emoji}</div>
          )}
          
          {!isMarketItem && !isSold && (
            <div onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] cursor-pointer font-black uppercase tracking-widest">
              <i className="fas fa-camera mb-2 text-lg"></i>
              Update Photo
            </div>
          )}
          <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
        </div>

        <div className="mb-6 flex flex-col items-center">
            <span className="text-[9px] font-black text-purple-300 uppercase tracking-widest mb-1">{t.acquired_on}</span>
            <div className="bg-purple-50 px-4 py-1.5 rounded-full border border-purple-100 text-xs font-black text-purple-800 flex items-center space-x-2">
                <i className="far fa-calendar-alt text-purple-400"></i>
                <span>{item.history && item.history.length > 0 ? formatDate(item.history[0].timestamp) : 'Unknown'}</span>
            </div>
        </div>

        {item.description && (
          <div className="bg-purple-50/70 p-6 rounded-[2rem] mb-8 text-[11px] text-purple-800 font-medium italic leading-relaxed border border-purple-100 shadow-inner w-full text-center">
             {item.description}
          </div>
        )}

        <div className="w-full space-y-5">
          {showMarketView ? (
            <div className="flex flex-col space-y-4">
              <div className="flex justify-between items-center px-4">
                 <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">{t.listing_price}</span>
                 <span className="text-3xl font-black text-pink-500 tracking-tighter">¥{item.priceTag}</span>
              </div>
              
              {isMyListing ? (
                 <div className="space-y-3">
                     <div className="w-full py-5 bg-purple-100 text-purple-400 font-black rounded-3xl text-xs uppercase tracking-[0.2em] text-center">
                        {t.selling}
                     </div>
                     {!isSold && onMarkSold && (
                         <div className="flex gap-2">
                             <button onClick={() => onCancelListing?.(item)} className="flex-1 py-3 bg-white border border-purple-100 text-purple-400 font-black rounded-3xl text-[10px] uppercase tracking-widest shadow-sm hover:bg-purple-50 transition-colors">
                                 {t.cancel_sell}
                             </button>
                             <button onClick={() => onMarkSold(item)} className="flex-[2] py-3 bg-pink-500 text-white font-black rounded-3xl text-[10px] uppercase tracking-widest shadow-lg shadow-pink-200 active:scale-95 transition-transform">
                                 {t.mark_sold}
                             </button>
                         </div>
                     )}
                 </div>
              ) : (
                 <button 
                    onClick={onChatRequest} 
                    disabled={isSold}
                    className={`w-full py-5 text-white font-black rounded-3xl shadow-xl transition-all text-xs uppercase tracking-[0.2em] flex items-center justify-center space-x-2 ${isSold ? 'bg-gray-300 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-purple-600 to-pink-500 shadow-pink-200 active:scale-95'}`}
                 >
                    <i className="fas fa-comment-dots text-lg"></i>
                    <span>{isSold ? t.item_sold : t.pm_seller}</span>
                 </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-6">
              
              {/* Selling Status Banner for Inventory View */}
              {isMyListing && !isSold && (
                  <div className="w-full bg-pink-50 border border-pink-100 p-2 rounded-xl text-center">
                      <span className="text-[9px] font-black text-pink-500 uppercase tracking-widest">{t.listed_on_plaza} ¥{item.priceTag}</span>
                  </div>
              )}

              {/* Map & Room Settings */}
              <div className="w-full grid grid-cols-2 gap-3">
                 <button 
                   onClick={handleToggleMap}
                   className={`p-3 rounded-2xl border flex flex-col items-center justify-center transition-all ${item.showOnMap ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-300 border-purple-100'}`}
                 >
                     <i className={`fas ${item.showOnMap ? 'fa-eye' : 'fa-eye-slash'} mb-1`}></i>
                     <span className="text-[8px] font-black uppercase tracking-wide">{t.show_map}</span>
                 </button>

                 <div className="p-3 bg-white rounded-2xl border border-purple-100 flex flex-col items-center justify-center relative overflow-hidden">
                     <span className="text-[8px] font-black uppercase text-purple-300 tracking-wide mb-1">{t.stored_in}</span>
                     <select 
                        value={item.assignedRoom}
                        onChange={(e) => handleRoomChange(e.target.value as RoomType)}
                        className="bg-transparent text-xs font-bold text-purple-800 outline-none text-center w-full appearance-none relative z-10"
                     >
                         {ALL_ROOMS.map(r => (
                             <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                         ))}
                     </select>
                     <i className="fas fa-caret-down absolute right-3 bottom-3 text-purple-200 pointer-events-none text-xs"></i>
                 </div>
              </div>


              <div className="flex items-center justify-center space-x-4">
                <div className="px-6 py-2.5 bg-purple-800 text-white rounded-full text-[10px] font-black uppercase tracking-widest">{t.in_stock} {item.currentQuantity.toFixed(1)}</div>
                <button onClick={() => onConsume(1)} className="px-6 py-2.5 bg-pink-100 text-pink-600 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-pink-500 hover:text-white transition-all">{t.consume}</button>
              </div>

               {/* CONSUMPTION SETTINGS */}
               <div className="w-full bg-blue-50/50 rounded-2xl p-4 flex flex-col space-y-3 border border-blue-100">
                   <div className="flex justify-between items-center">
                       <div className="flex items-center space-x-2">
                           <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-blue-400 shadow-sm"><i className="fas fa-stopwatch"></i></div>
                           <span className="text-[10px] font-black text-blue-800 uppercase tracking-wide">{t.consumption}</span>
                       </div>
                       <button 
                         onClick={() => updateConsumption(!useConsumption, consAmount, consFreq)}
                         className={`w-10 h-5 rounded-full relative transition-colors ${useConsumption ? 'bg-blue-500' : 'bg-gray-200'}`}
                       >
                           <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${useConsumption ? 'left-6' : 'left-1'}`}></div>
                       </button>
                   </div>
                   
                   {useConsumption && (
                       <div className="flex items-center justify-between animate-in slide-in-from-top-2">
                           <span className="text-[9px] font-bold text-blue-400 pl-2">{t.usage}</span>
                           <div className="flex items-center space-x-2">
                               <input 
                                 type="number"
                                 value={consAmount}
                                 onChange={(e) => updateConsumption(true, parseFloat(e.target.value) || 0, consFreq)}
                                 className="w-12 py-1 px-2 text-center rounded-lg border border-blue-200 text-xs font-bold text-blue-800 outline-none"
                               />
                               <span className="text-[9px] text-blue-400 font-bold">/</span>
                               <select 
                                 value={consFreq}
                                 onChange={(e) => updateConsumption(true, consAmount, e.target.value as any)}
                                 className="py-1 px-2 rounded-lg border border-blue-200 text-xs font-bold text-blue-800 outline-none bg-white"
                               >
                                   <option value="day">Day</option>
                                   <option value="week">Week</option>
                                   <option value="month">Month</option>
                                   <option value="year">Year</option>
                               </select>
                           </div>
                       </div>
                   )}
                   {useConsumption && daysLeft !== null && (
                       <div className="text-center text-[9px] font-bold text-blue-400">
                           Est. depletion in ~{daysLeft} days
                       </div>
                   )}
               </div>

               {/* Consumption Alert Setting */}
               <div className="w-full bg-purple-50 rounded-2xl p-4 flex flex-col space-y-3 border border-purple-100">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-purple-400 shadow-sm"><i className="fas fa-bell"></i></div>
                        <span className="text-[10px] font-black text-purple-800 uppercase tracking-wide">{t.reminder}</span>
                    </div>
                  </div>
                  
                  {/* Toggle Type */}
                  <div className="flex bg-white rounded-xl p-1 shadow-sm">
                      {(['none', 'quantity', 'date'] as AlertType[]).map(tKey => (
                          <button 
                            key={tKey}
                            onClick={() => updateAlertSettings(tKey, lowStockInput, expDateInput)}
                            className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${alertType === tKey ? 'bg-purple-600 text-white' : 'text-purple-300'}`}
                          >
                            {tKey === 'none' ? t.off : tKey === 'quantity' ? t.low_stock : t.exp_date}
                          </button>
                      ))}
                  </div>

                  {/* Dynamic Inputs */}
                  {alertType === 'quantity' && (
                     <div className="flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
                        <span className="text-[9px] font-bold text-purple-400 pl-2">{t.alert_below}</span>
                        <div className="flex items-center">
                            <input 
                                type="number" 
                                value={lowStockInput} 
                                onChange={(e) => {
                                    setLowStockInput(e.target.value);
                                    updateAlertSettings('quantity', e.target.value, expDateInput);
                                }}
                                className="w-12 py-1 px-2 text-center rounded-lg border border-purple-200 text-xs font-bold text-purple-800 outline-none focus:border-pink-500"
                            />
                            <span className="text-[9px] text-purple-400 ml-2 font-bold">{item.unit}</span>
                        </div>
                     </div>
                  )}

                  {alertType === 'date' && (
                     <div className="flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
                        <span className="text-[9px] font-bold text-purple-400 pl-2">{t.expires_on}</span>
                        <input 
                            type="date"
                            value={expDateInput}
                            onChange={(e) => {
                                setExpDateInput(e.target.value);
                                updateAlertSettings('date', lowStockInput, e.target.value);
                            }}
                            className="py-1 px-2 rounded-lg border border-purple-200 text-xs font-bold text-purple-800 outline-none focus:border-pink-500"
                        />
                     </div>
                  )}
               </div>
              
              {renderHistory()}
            </div>
          )}
        </div>
      </div>

      {saleAd && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white rounded-[3.5rem] w-full max-w-sm overflow-hidden flex flex-col shadow-2xl animate-in zoom-in duration-300">
             
             {/* Header Section with Photo */}
             <div className="bg-purple-50 p-8 flex flex-col items-center relative">
                 <h3 className="text-sm font-black text-purple-800 mb-6 uppercase tracking-widest">{t.ready_sell}</h3>
                 <button onClick={() => setSaleAd(null)} className="absolute top-6 right-6 text-purple-300 hover:text-purple-600"><i className="fas fa-times"></i></button>

                 <div className="w-32 h-32 bg-white rounded-3xl shadow-lg border-4 border-white overflow-hidden relative group cursor-pointer" onClick={() => !item.photo && fileInputRef.current?.click()}>
                    {item.photo ? (
                        <img src={item.photo} alt="Item" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-purple-200 bg-purple-100/50">
                            <i className="fas fa-camera text-2xl mb-1"></i>
                            <span className="text-[8px] font-black uppercase">Add Photo</span>
                        </div>
                    )}
                 </div>
                 {!item.photo && <p className="text-[9px] text-pink-500 font-bold mt-3 animate-pulse">{t.photo_req}</p>}
             </div>
             
             <div className="p-8 space-y-6">
               <div className="relative">
                 <label className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-2 block">{t.price_lbl}</label>
                 <input type="number" value={askingPrice} onChange={(e) => setAskingPrice(e.target.value)} className="w-full p-4 bg-purple-50 rounded-2xl font-black text-purple-800 outline-none border border-transparent focus:border-pink-300 transition-all text-center text-lg" />
               </div>
               
               <div className="relative">
                 <label className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-2 block">{t.ad_copy}</label>
                 <textarea value={saleAd} onChange={(e) => setSaleAd(e.target.value)} rows={4} className="w-full p-4 bg-purple-50 rounded-2xl text-xs font-medium text-purple-800 outline-none resize-none border border-transparent focus:border-pink-300 transition-all leading-relaxed" />
               </div>

               <div className="space-y-3 pt-2">
                  <button 
                        onClick={() => onPublishRequest?.(item, parseFloat(askingPrice), saleAd)} 
                        className="w-full py-4 bg-pink-500 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-pink-200 flex items-center justify-center space-x-2 active:scale-95 transition-all"
                    >
                        <i className="fas fa-store"></i>
                        <span>{t.sell_plaza}</span>
                    </button>

                    <button 
                        onClick={handleCopyAd} 
                        className={`w-full py-4 font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center space-x-2 active:scale-95 transition-all ${copyFeedback ? 'bg-green-500 text-white shadow-green-200' : 'bg-purple-100 text-purple-500'}`}
                    >
                        <i className={`fas ${copyFeedback ? 'fa-check' : 'fa-share-nodes'}`}></i>
                        <span>{copyFeedback ? t.copied : t.export}</span>
                    </button>
               </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};