
import React, { useState, useEffect } from 'react';
import { generateVoxelModel, refineVoxelModel } from '../../services/geminiService';
import { VoxelModel, VoxelLayer, BlueprintRecord } from '../../services/voxelTypes';
import { saveBlueprint, getAllBlueprints, deleteBlueprint } from '../../services/voxelRepository';

import VoxelRenderer from './VoxelRenderer';
import Controls from './Controls';
import SlicePanel from './SlicePanel';
import LayerEditor from './LayerEditor';
import BlueprintGallery from './BlueprintGallery';

const DEFAULT_MODEL: VoxelModel = {
  name: "NEW_CONSTRUCT_01",
  gridSize: 20,
  layerCount: 20,
  palette: { "A": "#6366f1" }, 
  layers: [{ rows: Array(20).fill(".".repeat(20)) }]
};

interface VoxelForgeViewProps {
  onBack: () => void;
}

export const VoxelForgeView: React.FC<VoxelForgeViewProps> = ({ onBack }) => {
  const [model, setModel] = useState<VoxelModel>(DEFAULT_MODEL);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  
  const [activeLayerIndex, setActiveLayerIndex] = useState<number | null>(null);
  const [activeSymbol, setActiveSymbol] = useState<string>('A');
  const [clipboardLayer, setClipboardLayer] = useState<VoxelLayer | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [savedBlueprints, setSavedBlueprints] = useState<BlueprintRecord[]>([]);

  const [history, setHistory] = useState<VoxelModel[]>([DEFAULT_MODEL]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const addToHistory = (newModel: VoxelModel) => {
    if (!newModel || !newModel.layers) return;
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newModel);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setModel(newModel);
  };

  const undo = () => {
    if (historyIndex > 0 && history[historyIndex - 1]) {
      setHistoryIndex(historyIndex - 1);
      setModel(history[historyIndex - 1]);
    }
  };

  const handleGenerate = async (prompt: string, gridSize: number, layerCount: number | undefined, image?: string, symmetry?: boolean, axialSymmetry?: boolean) => {
    setLoading(true);
    setProgress('FORGING...');
    try {
      const newModel = await generateVoxelModel(prompt, gridSize, layerCount || 16, !!symmetry, !!axialSymmetry, image);
      if (newModel && newModel.layers) addToHistory(newModel);
    } catch (e) {
      setProgress('ERROR');
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(''), 2000);
    }
  };

  const handleRefine = async (feedback: string) => {
    setLoading(true);
    setProgress('REFining...');
    try {
      const refined = await refineVoxelModel(model, feedback);
      if (refined && refined.layers) addToHistory(refined);
    } catch (e) {} finally {
      setLoading(false);
      setProgress('');
    }
  };

  const handleUpdateCell = (layerIdx: number, rowIdx: number, colIdx: number, symbol: string) => {
    if (!model.layers || !model.layers[layerIdx]) return;
    const newLayers = [...model.layers];
    const newRows = [...newLayers[layerIdx].rows];
    const rowStr = newRows[rowIdx] || "";
    newRows[rowIdx] = rowStr.substring(0, colIdx) + symbol + rowStr.substring(colIdx + 1);
    newLayers[layerIdx] = { ...newLayers[layerIdx], rows: newRows };
    setModel({ ...model, layers: newLayers }); 
  };
  
  const handleLayerOps = {
    copy: () => activeLayerIndex !== null && model.layers?.[activeLayerIndex] && setClipboardLayer(model.layers[activeLayerIndex]),
    paste: () => {
      if (activeLayerIndex !== null && clipboardLayer && model.layers) {
        const newLayers = [...model.layers];
        newLayers[activeLayerIndex] = JSON.parse(JSON.stringify(clipboardLayer));
        addToHistory({ ...model, layers: newLayers });
      }
    },
    clear: () => {
      if (activeLayerIndex !== null && model.layers) {
        const newLayers = [...model.layers];
        newLayers[activeLayerIndex] = { rows: Array(model.gridSize).fill(".".repeat(model.gridSize)) };
        addToHistory({ ...model, layers: newLayers });
      }
    },
    add: () => {
      const newLayers = [...model.layers];
      const blank = { rows: Array(model.gridSize).fill(".".repeat(model.gridSize)) };
      newLayers.splice((activeLayerIndex ?? 0) + 1, 0, blank);
      addToHistory({ ...model, layers: newLayers, layerCount: model.layers.length + 1 });
    },
    duplicate: () => {
        if (activeLayerIndex !== null && model.layers?.[activeLayerIndex]) {
            const newLayers = [...model.layers];
            newLayers.splice(activeLayerIndex + 1, 0, JSON.parse(JSON.stringify(newLayers[activeLayerIndex])));
            addToHistory({ ...model, layers: newLayers, layerCount: model.layers.length + 1 });
        }
    },
    delete: () => {
        if (activeLayerIndex !== null && model.layers.length > 1) {
            const newLayers = [...model.layers];
            newLayers.splice(activeLayerIndex, 1);
            addToHistory({ ...model, layers: newLayers, layerCount: model.layers.length - 1 });
            setActiveLayerIndex(Math.max(0, activeLayerIndex - 1));
        }
    }
  };

  useEffect(() => {
    if (showGallery) getAllBlueprints().then(data => setSavedBlueprints(data || []));
  }, [showGallery]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#f8faff] text-[#334155] font-sans flex flex-col overflow-hidden">
      {/* Studio Grid Background */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40" 
           style={{ 
             backgroundImage: `linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)`, 
             backgroundSize: '40px 40px' 
           }}>
      </div>

      {/* Top Header */}
      <div className="h-14 border-b border-slate-200 flex items-center justify-between px-6 bg-white/80 backdrop-blur-md relative z-10">
          <div className="flex items-center gap-6">
              <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all">
                  <i className="fas fa-arrow-left text-xs"></i>
              </button>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black text-[#1e293b] uppercase tracking-wider flex items-center gap-2">
                    VOXEL FORGE
                    <span className="text-[9px] bg-pink-100 text-pink-500 px-2 py-0.5 rounded font-black tracking-widest border border-pink-200">STUDIO</span>
                </h1>
              </div>
          </div>
          <div className="flex items-center gap-4">
              <button onClick={undo} disabled={historyIndex <= 0} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 disabled:opacity-20 transition-all">
                  <i className="fas fa-undo-alt text-xs"></i>
              </button>
              <div className="flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full border border-green-100">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                  <span className="text-[9px] font-black text-green-600 tracking-wider uppercase">Engine Ready</span>
              </div>
          </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Left Side: Blueprint Controls */}
        <div className="w-72 border-r border-slate-200 bg-white shadow-xl shadow-slate-200/50 z-20 flex flex-col p-6">
             <Controls 
               onGenerate={handleGenerate}
               onRefine={handleRefine}
               onExport={() => {
                   const blob = new Blob([JSON.stringify(model)], {type: "application/json"});
                   const url = URL.createObjectURL(blob);
                   const a = document.createElement('a');
                   a.href = url;
                   a.download = `${model.name}.json`;
                   a.click();
               }}
               onImport={(file) => {
                   const reader = new FileReader();
                   reader.onload = (e) => {
                       try {
                           const json = JSON.parse(e.target?.result as string);
                           if (json && json.layers) addToHistory(json);
                       } catch(err) {}
                   };
                   reader.readAsText(file);
               }}
               onSaveToLibrary={async () => { await saveBlueprint(model, ''); }}
               onShowLibrary={() => setShowGallery(true)}
               loading={loading}
               progress={progress}
               hasModel={!!model?.layers?.length}
               currentGridSize={model.gridSize}
               currentLayerCount={model.layers.length}
             />
        </div>

        {/* Center: Large Viewport */}
        <div className="flex-1 relative overflow-hidden">
             {/* Studio Stream Info */}
             <div className="absolute top-8 left-8 z-10 pointer-events-none">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse"></div>
                    <span className="text-[10px] font-black text-indigo-400/70 tracking-[0.3em] uppercase">Studio Stream</span>
                </div>
                <h2 className="text-4xl font-black italic text-[#1e293b] tracking-tighter uppercase leading-none opacity-80">
                    {model.name}
                </h2>
             </div>

             {model?.layers ? <VoxelRenderer model={model} /> : null}
             
             {/* Bottom Navigation Legend */}
             <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-2 bg-white/90 backdrop-blur rounded-full border border-slate-200 text-[8px] font-black text-slate-400 flex gap-6 tracking-[0.2em] shadow-lg">
                 <span className="flex items-center gap-2"><strong className="text-indigo-600">LMB</strong> ORBIT</span>
                 <span className="flex items-center gap-2"><strong className="text-indigo-600">RMB</strong> PAN</span>
                 <span className="flex items-center gap-2"><strong className="text-indigo-600">SCROLL</strong> ZOOM</span>
             </div>
        </div>

        {/* Right Side: Stack Sidebar */}
        <div className="w-16 border-l border-slate-200 bg-white/50 backdrop-blur-sm p-1.5 flex flex-col items-center">
            <SlicePanel 
               model={model} 
               selectedIndex={activeLayerIndex} 
               onSelect={setActiveLayerIndex}
            />
        </div>
      </div>

      {activeLayerIndex !== null && model?.layers?.[activeLayerIndex] && (
          <LayerEditor 
              model={model}
              layerIndex={activeLayerIndex}
              activeSymbol={activeSymbol}
              clipboardHasData={!!clipboardLayer}
              onSelectSymbol={setActiveSymbol}
              onSelectLayer={setActiveLayerIndex}
              onUpdateCell={handleUpdateCell}
              onCopy={handleLayerOps.copy}
              onPaste={handleLayerOps.paste}
              onClear={handleLayerOps.clear}
              onAddLayer={handleLayerOps.add}
              onDuplicate={handleLayerOps.duplicate}
              onDelete={handleLayerOps.delete}
              onClose={() => setActiveLayerIndex(null)}
          />
      )}

      {showGallery && (
          <BlueprintGallery 
              blueprints={savedBlueprints || []}
              onLoad={(bp) => { if (bp?.model) { addToHistory(bp.model); setShowGallery(false); } }}
              onDelete={(id) => { deleteBlueprint(id).then(() => setSavedBlueprints(prev => prev.filter(p => p.id !== id))); }}
              onClose={() => setShowGallery(false)}
          />
      )}
    </div>
  );
};
