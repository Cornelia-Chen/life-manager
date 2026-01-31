
import React from 'react';
import { VoxelModel } from '../../services/voxelTypes';
import VoxelRenderer from './VoxelRenderer';

interface LayerEditorProps {
  model: VoxelModel;
  layerIndex: number;
  activeSymbol: string;
  clipboardHasData: boolean;
  onSelectSymbol: (symbol: string) => void;
  onSelectLayer: (index: number) => void;
  onUpdateCell: (layerIdx: number, rowIdx: number, colIdx: number, symbol: string) => void;
  onCopy: () => void;
  onPaste: () => void;
  onClear: () => void;
  onAddLayer: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const LayerEditor: React.FC<LayerEditorProps> = ({ 
  model, layerIndex, activeSymbol, clipboardHasData,
  onSelectSymbol, onSelectLayer, onUpdateCell, 
  onCopy, onPaste, onClear, onAddLayer, onDuplicate, onDelete, onClose 
}) => {
  const layer = model.layers[layerIndex];
  
  // Onion skin: Get the layer below
  const prevLayer = layerIndex > 0 ? model.layers[layerIndex - 1] : null;

  return (
    <div className="absolute inset-0 bg-slate-50/95 backdrop-blur-2xl z-[100] flex flex-col p-8 animate-in fade-in zoom-in-95 duration-300">
      {/* Grid Background Pattern for the whole modal */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]" 
           style={{ 
             backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`, 
             backgroundSize: '20px 20px' 
           }}>
      </div>

      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
                <div className="w-1 h-4 bg-pink-500 rounded-full"></div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest italic">
                  Layer Processor
                </h3>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-wider">
                  Active ID: {layerIndex}
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  Manual Matrix Override
                </span>
            </div>
          </div>
          
          {/* Layer Navigation Control */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
             <button 
               onClick={() => layerIndex > 0 && onSelectLayer(layerIndex - 1)}
               disabled={layerIndex === 0}
               className="w-9 h-9 flex items-center justify-center hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg disabled:opacity-20 transition-all"
               title="Move Down"
             >
               <i className="fas fa-arrow-down text-xs"></i>
             </button>
             <div className="w-px h-4 bg-slate-100 mx-1"></div>
             <button 
               onClick={() => layerIndex < model.layers.length - 1 && onSelectLayer(layerIndex + 1)}
               disabled={layerIndex === model.layers.length - 1}
               className="w-9 h-9 flex items-center justify-center hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg disabled:opacity-20 transition-all"
               title="Move Up"
             >
               <i className="fas fa-arrow-up text-xs"></i>
             </button>
          </div>
        </div>

        {/* Global Layer Actions */}
        <div className="flex items-center gap-4">
           <div className="flex bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm">
             <button onClick={onCopy} className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 text-slate-400 hover:text-indigo-500 rounded-xl transition-colors" title="Copy">
                <i className="fas fa-copy text-xs"></i>
             </button>
             <button onClick={onPaste} disabled={!clipboardHasData} className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 text-slate-400 hover:text-green-500 rounded-xl disabled:opacity-20 transition-colors" title="Paste">
                <i className="fas fa-paste text-xs"></i>
             </button>
             <button onClick={onDuplicate} className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 text-slate-400 hover:text-purple-500 rounded-xl transition-colors" title="Extrude Up">
                <i className="fas fa-clone text-xs"></i>
             </button>
             <div className="w-px h-6 bg-slate-100 self-center mx-1"></div>
             <button onClick={onClear} className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 text-slate-400 hover:text-orange-500 rounded-xl transition-colors" title="Wipe">
                <i className="fas fa-eraser text-xs"></i>
             </button>
             <button onClick={onAddLayer} className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 text-slate-400 hover:text-blue-500 rounded-xl transition-colors" title="Insert">
                <i className="fas fa-plus text-xs"></i>
             </button>
             <button onClick={onDelete} disabled={model.layers.length <= 1} className="w-10 h-10 flex items-center justify-center hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl disabled:opacity-20 transition-colors" title="Drop Layer">
                <i className="fas fa-trash-alt text-xs"></i>
             </button>
           </div>
        
           <button 
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center bg-slate-800 hover:bg-black rounded-2xl text-white shadow-xl shadow-slate-200 transition-all active:scale-95"
           >
            <i className="fas fa-check"></i>
           </button>
        </div>
      </div>

      <div className="flex-1 flex gap-12 items-center justify-center overflow-hidden relative z-10">
        {/* Main Interaction Matrix */}
        <div className="relative group/matrix">
           {/* Onion Skin Rendering */}
           {prevLayer && (
             <div 
               className="absolute inset-0 grid p-1 opacity-20 pointer-events-none scale-95 blur-[1px]"
               style={{ 
                 gridTemplateColumns: `repeat(${model.gridSize}, minmax(0, 1fr))`,
                 gridTemplateRows: `repeat(${model.gridSize}, minmax(0, 1fr))`
               }}
             >
               {prevLayer.rows.flatMap((row, rIdx) => 
                 row.split('').map((char, cIdx) => (
                   <div
                     key={`onion-${rIdx}-${cIdx}`}
                     style={{ backgroundColor: model.palette[char] || 'transparent' }}
                     className="w-full h-full"
                   />
                 ))
               )}
             </div>
           )}

           <div 
            className="aspect-square h-[65vh] max-h-[65vh] grid bg-white p-1 rounded-3xl overflow-hidden shadow-2xl shadow-indigo-100 border-[6px] border-white"
            style={{ 
              gridTemplateColumns: `repeat(${model.gridSize}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${model.gridSize}, minmax(0, 1fr))`
            }}
          >
            {layer.rows.flatMap((row, rIdx) => 
              row.split('').map((char, cIdx) => (
                <button
                  key={`${rIdx}-${cIdx}`}
                  onMouseDown={() => onUpdateCell(layerIndex, rIdx, cIdx, activeSymbol)}
                  onMouseEnter={(e) => {
                    if (e.buttons === 1) onUpdateCell(layerIndex, rIdx, cIdx, activeSymbol);
                  }}
                  style={{ backgroundColor: model.palette[char] || 'transparent' }}
                  className={`w-full h-full transition-all relative border-[0.5px] border-slate-100 ${char === '.' ? 'bg-slate-50 hover:bg-indigo-50/50' : 'shadow-inner'}`}
                >
                  <div className="absolute inset-0 hover:bg-white/20 opacity-0 hover:opacity-100 transition-opacity" />
                </button>
              ))
            )}
          </div>

          <div className="absolute -bottom-8 left-0 right-0 text-center">
              <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.5em]">Interaction Space / 1:1 Scale</span>
          </div>
        </div>

        {/* Emitter / Palette Panel & 3D Preview */}
        <div className="w-72 flex flex-col gap-6 h-full max-h-[70vh]">
           {/* Live 3D Projection Thumbnail */}
           <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-lg flex flex-col shrink-0">
               <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                   <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">Live Projection</span>
                   <div className="flex gap-1">
                       <div className="w-1 h-1 rounded-full bg-indigo-200 animate-ping"></div>
                       <div className="w-1 h-1 rounded-full bg-indigo-300"></div>
                   </div>
               </div>
               <div className="aspect-video bg-[#f8faff] relative overflow-hidden h-40">
                   <VoxelRenderer model={model} size={140} />
                   <div className="absolute bottom-2 left-3 pointer-events-none">
                       <span className="text-[7px] font-mono text-slate-300 uppercase tracking-[0.2em]">PERSPECTIVE_MATRIX</span>
                   </div>
               </div>
           </div>

           {/* Symbols Scroll Area */}
           <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Symbol Emitters</label>
             <div className="flex flex-col gap-2">
               {Object.entries(model.palette).map(([symbol, color]) => (
                 <button
                   key={symbol}
                   onClick={() => onSelectSymbol(symbol)}
                   className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all w-full text-left group ${
                     activeSymbol === symbol ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-100 scale-[1.02]' : 'bg-white border-slate-100 hover:border-slate-200'
                   }`}
                 >
                   <div className={`w-6 h-6 rounded-lg shadow-sm border ${activeSymbol === symbol ? 'border-white/40' : 'border-slate-100'}`} style={{ backgroundColor: color }} />
                   <div className="flex flex-col flex-1">
                     <span className={`text-[10px] font-black uppercase ${activeSymbol === symbol ? 'text-white' : 'text-slate-800'}`}>Unit {symbol}</span>
                     <span className={`text-[8px] font-mono ${activeSymbol === symbol ? 'text-indigo-200' : 'text-slate-400'}`}>{color}</span>
                   </div>
                   {activeSymbol === symbol && <i className="fas fa-terminal text-[8px] text-indigo-300 animate-pulse"></i>}
                 </button>
               ))}
               
               <div className="h-px bg-slate-100 my-2" />

               <button 
                 onClick={() => onSelectSymbol('.')}
                 className={`flex items-center gap-4 p-4 rounded-2xl border-2 w-full text-left transition-all ${
                     activeSymbol === '.' ? 'bg-pink-500 border-pink-500 shadow-lg shadow-pink-100 scale-[1.02]' : 'bg-white border-slate-100 hover:border-slate-200'
                 }`}
               >
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 border-dashed ${activeSymbol === '.' ? 'border-white/50 bg-pink-600' : 'border-slate-200 bg-slate-50'}`}>
                      <i className={`fas fa-eraser text-[10px] ${activeSymbol === '.' ? 'text-white' : 'text-slate-300'}`}></i>
                  </div>
                  <span className={`text-[10px] font-black uppercase ${activeSymbol === '.' ? 'text-white' : 'text-slate-800'}`}>Eraser Tool</span>
               </button>
             </div>
           </div>

           <div className="p-5 bg-white border border-slate-200 rounded-[2rem] shadow-sm shrink-0">
             <div className="flex items-center gap-2 mb-2">
                 <i className="fas fa-info-circle text-indigo-400 text-xs"></i>
                 <p className="text-[10px] text-slate-800 font-black uppercase tracking-widest">Guide</p>
             </div>
             <p className="text-[9px] text-slate-400 leading-relaxed font-medium">
               Hold click to spray paint cells. <br/>
               The <b>Onion Skin</b> represents spatial alignment from the layer below.
             </p>
           </div>
        </div>
      </div>

      <div className="absolute bottom-6 right-8 text-[8px] font-black text-slate-300 uppercase tracking-[0.8em] pointer-events-none">
          Blueprinting Matrix System v1.0
      </div>
    </div>
  );
};

export default LayerEditor;
