
import React, { useState, useEffect, useRef } from 'react';
import { HouseView } from './HouseView';
import { ReceiptItem, LanguageCode, RoomType } from '../services/geminiService';
import { getAllBlueprints } from '../services/voxelRepository';
import { BlueprintRecord } from '../services/voxelTypes';

interface HouseEditViewProps {
  inventory: ReceiptItem[];
  onUpdateInventory: (items: ReceiptItem[]) => void;
  onBack: () => void;
  currentLang: LanguageCode;
  onItemMove: (itemId: string, x: number, y: number, newRoomId?: RoomType) => void;
  goToForge: () => void;
  butlerImage?: string;
  butlerScale?: number;
}

type EditorTab = 'warehouse' | 'transform';

export const HouseEditView: React.FC<HouseEditViewProps> = ({ 
  inventory, 
  onUpdateInventory, 
  onBack, 
  currentLang,
  onItemMove,
  goToForge,
  butlerImage,
  butlerScale
}) => {
  const [activeTab, setActiveTab] = useState<EditorTab>('warehouse');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [blueprints, setBlueprints] = useState<BlueprintRecord[]>([]);
  const [isLoadingBps, setIsLoadingBps] = useState(true);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  const viewContainerRef = useRef<HTMLDivElement>(null);

  const selectedItem = inventory.find(i => i.id === selectedItemId);

  useEffect(() => {
    let isSubscribed = true;
    const fetchBps = async () => {
        setIsLoadingBps(true);
        try {
            const data = await getAllBlueprints();
            if (isSubscribed) {
              setBlueprints(data || []);
            }
        } catch (e) {
            console.error("Failed to load blueprints", e);
        } finally {
            if (isSubscribed) {
              setIsLoadingBps(false);
            }
        }
    };
    fetchBps();
    return () => { isSubscribed = false; };
  }, []);

  useEffect(() => {
    if (selectedItemId && activeTab === 'warehouse') {
      setActiveTab('transform');
    }
  }, [selectedItemId]);

  const handleAddBlueprintToRoom = (bp: BlueprintRecord, x: number = 24, y: number = 24) => {
    const newItem: ReceiptItem = {
        id: `furniture-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: bp.name,
        translatedName: bp.name,
        emoji: '🪑',
        unit: 'unit',
        assignedRoom: 'living', 
        history: [{ timestamp: Date.now(), quantity: 1, unitPrice: 0 }],
        currentQuantity: 1,
        showOnMap: true,
        voxelModel: bp.model,
        alertType: 'none',
        position: { x, y }, 
        rotation: 0,
        scale: 1.0,
        heightScale: 1.0,
        elevation: 0
    };
    
    onUpdateInventory([newItem, ...inventory]);
    setSelectedItemId(newItem.id);
    setActiveTab('transform');
  };

  const onDragStart = (e: React.DragEvent, bp: BlueprintRecord) => {
    e.dataTransfer.setData("application/voxel-blueprint", JSON.stringify(bp));
    e.dataTransfer.effectAllowed = "copy";
    
    const dragIcon = document.createElement('div');
    dragIcon.className = "w-16 h-16 bg-pink-500/40 backdrop-blur-md rounded-2xl border-2 border-white flex items-center justify-center text-white";
    dragIcon.innerHTML = `<i class="fas fa-cube scale-150"></i>`;
    document.body.appendChild(dragIcon);
    e.dataTransfer.setDragImage(dragIcon, 32, 32);
    setTimeout(() => document.body.removeChild(dragIcon), 0);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDraggingOver(true);
  };

  const onDragLeave = () => {
    setIsDraggingOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const data = e.dataTransfer.getData("application/voxel-blueprint");
    if (!data) return;

    try {
        const bp = JSON.parse(data) as BlueprintRecord;
        const rect = viewContainerRef.current?.getBoundingClientRect();
        let dropX = 24;
        let dropY = 24;
        
        if (rect) {
            dropX = Math.round(((e.clientX - rect.left) / rect.width) * 48);
            dropY = Math.round(((e.clientY - rect.top) / rect.height) * 48);
            dropX = Math.max(2, Math.min(46, dropX));
            dropY = Math.max(2, Math.min(46, dropY));
        }

        handleAddBlueprintToRoom(bp, dropX, dropY);
    } catch (err) {
        console.error("Drop failed", err);
    }
  };

  const handleUpdateItem = (id: string, updates: Partial<ReceiptItem>) => {
      handleUpdateInventoryState(inventory.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const handleUpdateInventoryState = (newInv: ReceiptItem[]) => {
      onUpdateInventory(newInv);
  };

  const handleRemoveFromMap = (id: string) => {
      handleUpdateInventoryState(inventory.filter(i => i.id !== id));
      setSelectedItemId(null);
      setActiveTab('warehouse');
  };

  const TEXT = {
    'zh-CN': { warehouse: '家具库', transform: '调节器', empty: '尚未收藏蓝图', add: '前往工坊', onMap: '部署中', catalog: '拖拽蓝图到空间', dragHint: '释放以构建' },
    'en': { warehouse: 'Warehouse', transform: 'Inspector', empty: 'No blueprints yet', add: 'Go to Forge', onMap: 'Deploying', catalog: 'Drag items to workspace', dragHint: 'Drop to Construct' }
  }[currentLang] || { warehouse: 'Warehouse', transform: 'Inspector', empty: 'Empty', add: 'Forge', onMap: 'Add', catalog: 'Drag to place', dragHint: 'Drop' };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col animate-in fade-in duration-700 overflow-hidden">
      {/* Decorative Atmosphere - Fresh Studio Light */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]" 
           style={{ 
             backgroundImage: `linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)`, 
             backgroundSize: '30px 30px' 
           }}>
      </div>
      <div className="absolute top-[-10%] right-[-5%] w-[40vw] h-[40vw] bg-pink-100/40 blur-[150px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[30vw] h-[30vw] bg-indigo-100/40 blur-[120px] rounded-full pointer-events-none"></div>

      {/* High-Transparency Glass Header */}
      <div className="h-20 bg-white/40 backdrop-blur-2xl border-b border-white/60 flex items-center justify-between px-10 shadow-sm z-50">
         <div className="flex items-center gap-6">
             <button 
                onClick={onBack} 
                className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 text-slate-500 rounded-2xl hover:text-pink-500 hover:border-pink-300 transition-all active:scale-95 shadow-sm"
              >
                <i className="fas fa-arrow-left"></i>
             </button>
             <div>
               <h2 className="text-xl font-black text-slate-900 uppercase tracking-[0.3em] italic leading-none mb-1">Aether Workspace</h2>
               <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse"></div>
                 <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Environment: Edit_Mode_Active</span>
               </div>
             </div>
         </div>

         {/* Studio Capsule Switcher */}
         <div className="flex bg-slate-100/80 p-1.5 rounded-[2rem] border border-white shadow-inner">
            <button 
                onClick={() => setActiveTab('warehouse')} 
                className={`px-8 py-2.5 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all duration-500 ${activeTab === 'warehouse' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
            >
                {TEXT.warehouse}
            </button>
            <button 
                onClick={() => setActiveTab('transform')} 
                className={`px-8 py-2.5 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all duration-500 ${activeTab === 'transform' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
            >
                {TEXT.transform}
            </button>
         </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
          {/* Main 3D View (Drop Target) */}
          <div 
            ref={viewContainerRef}
            className={`flex-1 relative transition-all duration-500 ${isDraggingOver ? 'bg-pink-500/5' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
             <HouseView 
                inventory={inventory} 
                currentLang={currentLang} 
                onItemMove={onItemMove} 
                selectedItemId={selectedItemId} 
                onSelectItem={setSelectedItemId} 
                butlerImage={butlerImage} 
                butlerScale={butlerScale} 
             />

             {/* Drag Over Hint */}
             {isDraggingOver && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-[60] bg-pink-600/5 backdrop-blur-[2px] animate-in fade-in duration-300">
                    <div className="bg-white border-2 border-pink-400 text-pink-600 px-12 py-6 rounded-[3rem] font-black uppercase tracking-[0.4em] text-sm shadow-[0_0_60px_rgba(236,72,153,0.2)] animate-pulse">
                        {TEXT.dragHint}
                    </div>
                </div>
             )}

             {/* Workspace Info Overlay */}
             <div className="absolute top-10 left-10 pointer-events-none z-10">
                <div className="bg-white/80 backdrop-blur-2xl border border-white px-6 py-4 rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 animate-in slide-in-from-left duration-500">
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] mb-2">{TEXT.catalog}</p>
                    <div className="flex items-center gap-6">
                        <span className="flex items-center gap-2 text-[9px] font-bold text-slate-400"><i className="fas fa-mouse-pointer text-pink-500"></i> SELECT</span>
                        <span className="flex items-center gap-2 text-[9px] font-bold text-slate-400"><i className="fas fa-arrows-alt text-pink-500"></i> MOVE</span>
                        <span className="flex items-center gap-2 text-[9px] font-bold text-slate-400"><i className="fas fa-hand-rock text-pink-500"></i> DRAG</span>
                    </div>
                </div>
             </div>
          </div>

          {/* Fresh Studio Side Panel */}
          <div className="w-80 bg-white/60 backdrop-blur-3xl border-l border-white/40 flex flex-col overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.05)] z-20">
               
               {activeTab === 'warehouse' ? (
                 <div className="flex-1 flex flex-col overflow-hidden p-8 animate-in slide-in-from-right-8 duration-500">
                    <div className="flex justify-between items-center mb-10">
                        <div className="flex flex-col">
                            <h2 className="text-2xl font-black italic text-slate-900 uppercase tracking-tighter">Vault</h2>
                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.5em] mt-1">Matrix_Library</span>
                        </div>
                        <button 
                            onClick={goToForge} 
                            className="w-12 h-12 bg-pink-500 text-white rounded-2xl flex items-center justify-center hover:bg-pink-600 hover:scale-105 transition-all shadow-[0_10px_20px_rgba(236,72,153,0.3)] active:scale-95"
                        >
                            <i className="fas fa-wand-magic-sparkles"></i>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-3">
                        {isLoadingBps ? (
                            <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-50">
                                <div className="w-10 h-10 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-[10px] font-black text-pink-500 uppercase tracking-[0.4em] animate-pulse">Scanning Archive...</p>
                            </div>
                        ) : blueprints.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center px-6">
                                <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center mb-6 border border-white">
                                    <i className="fas fa-cube text-3xl text-slate-300"></i>
                                </div>
                                <p className="text-xs text-slate-400 font-black uppercase tracking-widest leading-relaxed mb-8">{TEXT.empty}</p>
                                <button onClick={goToForge} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-indigo-100">{TEXT.add}</button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-5 pb-20">
                                {blueprints.map((bp) => (
                                    <div 
                                        key={bp.id} 
                                        draggable="true"
                                        onDragStart={(e) => onDragStart(e, bp)}
                                        onClick={() => handleAddBlueprintToRoom(bp)}
                                        className="group relative bg-white border border-slate-100 rounded-[2rem] overflow-hidden hover:border-pink-300 hover:shadow-2xl hover:shadow-pink-100/50 transition-all flex flex-col cursor-grab active:cursor-grabbing active:scale-[0.98]"
                                    >
                                        <div className="aspect-video w-full bg-slate-50/50 p-6 flex items-center justify-center relative overflow-hidden">
                                            {/* Glow Overlay */}
                                            <div className="absolute inset-0 bg-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-2xl"></div>
                                            
                                            {bp.thumbnail ? (
                                                <img src={bp.thumbnail} className="w-full h-full object-contain image-rendering-pixelated group-hover:scale-110 transition-all duration-700" />
                                            ) : (
                                                <span className="text-4xl filter drop-shadow-xl">🪑</span>
                                            )}
                                            
                                            <div className="absolute top-4 right-4 w-8 h-8 bg-white/90 backdrop-blur-md rounded-xl flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 border border-slate-100">
                                                <i className="fas fa-plus text-pink-500 text-[10px]"></i>
                                            </div>
                                        </div>
                                        <div className="p-5 flex flex-col gap-1 border-t border-slate-50">
                                            <div className="text-[11px] font-black text-slate-800 uppercase tracking-wider truncate leading-none group-hover:text-pink-600 transition-colors">{bp.name}</div>
                                            <div className="flex items-center justify-between mt-1">
                                                <span className="text-[8px] text-slate-400 font-black uppercase tracking-[0.2em]">Instance Mesh</span>
                                                <span className="text-[8px] font-black bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded">{bp.model.gridSize}PX</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                 </div>
               ) : (
                 <div className="flex-1 flex flex-col p-8 animate-in slide-in-from-right-8 duration-500 overflow-y-auto custom-scrollbar">
                    {selectedItem ? (
                        <div className="space-y-10">
                            {/* Inspector Header */}
                            <div className="flex items-center gap-6 mb-4">
                                <div className="w-16 h-16 bg-white rounded-[1.5rem] flex items-center justify-center border border-slate-100 shadow-xl overflow-hidden relative group">
                                    <div className="absolute inset-0 bg-pink-500/5 blur-xl"></div>
                                    {selectedItem.photo ? <img src={selectedItem.photo} className="w-full h-full object-cover relative z-10" /> : <span className="text-3xl relative z-10">{selectedItem.emoji}</span>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider truncate mb-1">{selectedItem.translatedName}</h3>
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.3em]">Module Inspector</p>
                                    </div>
                                </div>
                            </div>

                            {/* Property Deck */}
                            <div className="bg-white rounded-[2.5rem] border border-slate-100 p-6 space-y-8 shadow-xl shadow-slate-100/50">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] ml-2 block">Spatial Grid</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="relative group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[9px] text-pink-400 font-black">X</div>
                                            <input type="number" value={selectedItem.position?.x || 0} onChange={e => handleUpdateItem(selectedItem.id, { position: { ...selectedItem.position!, x: parseInt(e.target.value) } })} className="w-full bg-slate-50 border border-transparent focus:border-pink-200 rounded-xl py-3 pl-10 pr-4 text-xs font-black text-slate-800 outline-none transition-all" />
                                        </div>
                                        <div className="relative group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[9px] text-pink-400 font-black">Y</div>
                                            <input type="number" value={selectedItem.position?.y || 0} onChange={e => handleUpdateItem(selectedItem.id, { position: { ...selectedItem.position!, y: parseInt(e.target.value) } })} className="w-full bg-slate-50 border border-transparent focus:border-pink-200 rounded-xl py-3 pl-10 pr-4 text-xs font-black text-slate-800 outline-none transition-all" />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-3">
                                    <div className="flex justify-between items-baseline px-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Rotation</label>
                                        <span className="text-[10px] text-pink-500 font-black">{selectedItem.rotation || 0}°</span>
                                    </div>
                                    <input type="range" min="0" max="360" step="15" value={selectedItem.rotation || 0} onChange={e => handleUpdateItem(selectedItem.id, { rotation: parseInt(e.target.value) })} className="w-full accent-pink-500 h-1 bg-slate-100 rounded-full cursor-pointer" />
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-baseline px-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Scaling</label>
                                        <span className="text-[10px] text-indigo-500 font-black">{(selectedItem.scale || 1.0).toFixed(2)}X</span>
                                    </div>
                                    <input type="range" min="0.2" max="2.5" step="0.05" value={selectedItem.scale || 1.0} onChange={e => handleUpdateItem(selectedItem.id, { scale: parseFloat(e.target.value) })} className="w-full accent-indigo-500 h-1 bg-slate-100 rounded-full cursor-pointer" />
                                </div>

                                <div className="pt-6 border-t border-slate-50 space-y-4">
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-baseline px-2">
                                            <label className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Elevation</label>
                                            <span className="text-[10px] text-slate-500 font-black">{selectedItem.elevation || 0}PX</span>
                                        </div>
                                        <input type="range" min="0" max="150" step="1" value={selectedItem.elevation || 0} onChange={e => handleUpdateItem(selectedItem.id, { elevation: parseInt(e.target.value) })} className="w-full accent-slate-400 h-1 bg-slate-100 rounded-full cursor-pointer" />
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex justify-between items-baseline px-2">
                                            <label className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Verticality</label>
                                            <span className="text-[10px] text-slate-500 font-black">{(selectedItem.heightScale || 1.0).toFixed(2)}X</span>
                                        </div>
                                        <input type="range" min="0.1" max="4.0" step="0.05" value={selectedItem.heightScale || 1.0} onChange={e => handleUpdateItem(selectedItem.id, { heightScale: parseFloat(e.target.value) })} className="w-full accent-slate-400 h-1 bg-slate-100 rounded-full cursor-pointer" />
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={() => handleRemoveFromMap(selectedItem.id)} 
                                className="w-full py-4 bg-red-50 hover:bg-red-100 text-red-500 font-black border border-red-100 rounded-2xl text-[10px] uppercase tracking-[0.4em] transition-all active:scale-95"
                            >
                                <i className="fas fa-trash-alt mr-2"></i> Deconstruct
                            </button>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-200 gap-6 h-full">
                            <div className="w-20 h-20 rounded-[2.5rem] bg-white border border-slate-100 flex items-center justify-center animate-bounce shadow-xl">
                                <i className="fas fa-crosshairs text-3xl text-indigo-100"></i>
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-center px-10 leading-relaxed italic text-slate-300">Select a construct to initialize parameters.</p>
                        </div>
                    )}
                 </div>
               )}
          </div>
      </div>

      {/* Interface Version Trace */}
      <div className="absolute bottom-6 left-10 text-[8px] font-black text-slate-300 uppercase tracking-[1.5em] pointer-events-none flex items-center gap-6">
          <div className="w-16 h-px bg-slate-200"></div>
          Studio Proto-X : Active
          <div className="w-16 h-px bg-slate-200"></div>
      </div>
    </div>
  );
};
