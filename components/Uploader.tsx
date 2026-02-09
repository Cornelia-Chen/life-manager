import React, { useRef, useState } from 'react';
import { LanguageCode } from '../services/geminiService';

export type ScanMode = 'single' | 'receipt' | 'text';

interface UploaderProps {
  onImageSelect: (file: File, mode: ScanMode) => void;
  isLoading: boolean;
  currentLang: LanguageCode;
}

export const Uploader: React.FC<UploaderProps> = ({ onImageSelect, isLoading, currentLang }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanMode, setScanMode] = useState<ScanMode>('receipt');

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      onImageSelect(event.target.files[0], scanMode);
    }
  };

  const TEXT: Record<LanguageCode, { loading: string; idle: string; sub: string; format: string; modeSingle: string; modeReceipt: string; modeText: string }> = {
    'zh-CN': {
      loading: '正在解析... (别催我)',
      idle: '点击拍照或选择照片',
      sub: '艾莉丝将不情愿地为您识别物品、数量、单位并自动合并同类项',
      format: '支持 JPG / PNG / WEBP',
      modeSingle: '单品实物',
      modeReceipt: '购物小票',
      modeText: '通用识字'
    },
    'en': {
      loading: 'Analyzing... (Don\'t rush me)',
      idle: 'Snap or Select Photo',
      sub: 'Alice will reluctantly identify items, quantities, and units for you.',
      format: 'Supports JPG / PNG / WEBP',
      modeSingle: 'Single Item',
      modeReceipt: 'Receipt',
      modeText: 'Extract Text'
    },
    'fr': {
      loading: 'Analyse en cours...',
      idle: 'Prendre ou choisir une photo',
      sub: 'Alice identifiera à contrecœur les articles et les quantités.',
      format: 'Supporte JPG / PNG / WEBP',
      modeSingle: 'Objet Unique',
      modeReceipt: 'Ticket',
      modeText: 'OCR Texte'
    },
    'ja': {
      loading: '解析中... (急かさないで)',
      idle: '写真を撮るか選択',
      sub: 'アリスが不本意ながらアイテム、数量、単位を特定します。',
      format: 'JPG / PNG / WEBP 対応',
      modeSingle: '単品',
      modeReceipt: 'レシート',
      modeText: '文字認識'
    },
    'es': {
      loading: 'Analizando...',
      idle: 'Toma o selecciona una foto',
      sub: 'Alice identificará a regañadientes los artículos y cantidades.',
      format: 'Soporta JPG / PNG / WEBP',
      modeSingle: 'Objeto Único',
      modeReceipt: 'Recibo',
      modeText: 'OCR Texto'
    }
  };

  const t = TEXT[currentLang] || TEXT['zh-CN'];

  return (
    <div className="flex flex-col gap-4">
      {/* Mode Switcher */}
      <div className="bg-purple-100 p-1 rounded-2xl flex relative h-12">
        <div 
            className={`absolute top-1 bottom-1 w-[32%] bg-white rounded-xl shadow-sm transition-all duration-300 ease-out ${scanMode === 'receipt' ? 'left-1' : scanMode === 'single' ? 'left-[34%]' : 'left-[67%]'}`}
        ></div>
        <button 
            onClick={() => setScanMode('receipt')}
            className={`flex-1 relative z-10 py-2 text-[10px] font-black uppercase tracking-tight text-center transition-colors ${scanMode === 'receipt' ? 'text-purple-800' : 'text-purple-400'}`}
        >
            <i className="fas fa-receipt mr-1"></i>{t.modeReceipt}
        </button>
        <button 
            onClick={() => setScanMode('single')}
            className={`flex-1 relative z-10 py-2 text-[10px] font-black uppercase tracking-tight text-center transition-colors ${scanMode === 'single' ? 'text-purple-800' : 'text-purple-400'}`}
        >
            <i className="fas fa-cube mr-1"></i>{t.modeSingle}
        </button>
        <button 
            onClick={() => setScanMode('text')}
            className={`flex-1 relative z-10 py-2 text-[10px] font-black uppercase tracking-tight text-center transition-colors ${scanMode === 'text' ? 'text-purple-800' : 'text-purple-400'}`}
        >
            <i className="fas fa-font mr-1"></i>{t.modeText}
        </button>
      </div>

      <div 
        className={`relative group border-[3px] border-dashed rounded-[3rem] p-10 flex flex-col items-center justify-center transition-all duration-500 ${
          isLoading 
            ? 'border-purple-100 bg-purple-50/30' 
            : 'border-purple-200 hover:border-pink-400 hover:bg-white/50 hover:shadow-xl hover:shadow-pink-100/50 cursor-pointer'
        }`}
        onClick={!isLoading ? triggerUpload : undefined}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
          disabled={isLoading}
        />
        
        <div className={`w-28 h-28 mb-8 rounded-[2.5rem] flex items-center justify-center transition-all duration-500 shadow-xl ${
          isLoading 
            ? 'bg-pink-500 text-white animate-pulse' 
            : 'bg-white text-pink-500 group-hover:bg-pink-500 group-hover:text-white group-hover:rotate-6'
        }`}>
          <i className={`fas ${isLoading ? 'fa-sync fa-spin' : (scanMode === 'text' ? 'fa-font' : 'fa-camera')} text-4xl`}></i>
        </div>

        <div className="text-center space-y-3">
          <h3 className="text-xl font-extrabold text-purple-800">
            {isLoading ? t.loading : t.idle}
          </h3>
          <p className="text-purple-400 text-sm max-w-[200px] mx-auto leading-relaxed">
            {scanMode === 'single' 
                ? (currentLang === 'zh-CN' ? '拍摄单个物品，将直接使用照片作为图标。' : 'Snap a single item. The photo will be used as its icon.') 
                : scanMode === 'text'
                ? (currentLang === 'zh-CN' ? '提取图片中的所有文字，支持多国语言。' : 'Extract all visible text from the image.')
                : t.sub}
          </p>
          
          {!isLoading && (
            <div className="pt-4">
              <div className="inline-flex items-center px-4 py-2 bg-purple-100 rounded-full text-[10px] font-extrabold text-purple-600 uppercase tracking-tighter">
                  {t.format}
              </div>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="absolute inset-x-0 -bottom-1 px-10">
            <div className="h-1.5 w-full bg-purple-100 rounded-full overflow-hidden">
              <div className="h-full bg-pink-500 animate-[loading_2s_ease-in-out_infinite] origin-left"></div>
            </div>
          </div>
        )}

        <style>{`
          @keyframes loading {
            0% { transform: translateX(-100%) scaleX(0.2); }
            50% { transform: translateX(0) scaleX(0.5); }
            100% { transform: translateX(100%) scaleX(0.2); }
          }
        `}</style>
      </div>
    </div>
  );
};