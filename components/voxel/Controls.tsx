
import React, { useState, useRef } from 'react';

interface ControlsProps {
  onGenerate: (prompt: string, gridSize: number, layerCount: number | undefined, image?: string, symmetry?: boolean, axialSymmetry?: boolean) => void;
  onRefine: (feedback: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onSaveToLibrary: () => void;
  onShowLibrary: () => void;
  loading: boolean;
  progress: string;
  hasModel: boolean;
  currentGridSize: number;
  currentLayerCount: number;
}

const Controls: React.FC<ControlsProps> = ({ 
  onGenerate, onRefine, onExport, onImport, onSaveToLibrary, onShowLibrary, loading, progress, hasModel,
  currentGridSize, currentLayerCount
}) => {
  const [prompt, setPrompt] = useState('A luxury sofa');
  const [feedback, setFeedback] = useState('');
  const [gridSize, setGridSize] = useState(20);
  const [layerCountInput, setLayerCountInput] = useState<string>('20');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [enforceSymmetry, setEnforceSymmetry] = useState(true);
  const [axialSymmetry, setAxialSymmetry] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      const layers = layerCountInput === '' ? undefined : parseInt(layerCountInput);
      onGenerate(prompt, gridSize, layers, imagePreview?.split(',')[1], enforceSymmetry, axialSymmetry);
    }
  };

  const suggestions = ["Chic Lamp", "Modern Sofa", "Gaming Desk", "Vanity Mirror"];

  return (
    <div className="flex flex-col gap-8 h-full">
      {/* Title Section */}
      <div className="flex items-center gap-3">
        <div className="w-1 h-6 bg-pink-500 rounded-full"></div>
        <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">Blueprint</h2>
      </div>

      {/* Global Toolbar */}
      <div className="grid grid-cols-4 gap-2">
        <button onClick={() => {}} className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:text-red-500 transition-colors"><i className="fas fa-trash-alt text-[10px]"></i></button>
        <button onClick={onSaveToLibrary} disabled={!hasModel} className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:text-pink-500 transition-colors"><i className="fas fa-save text-[10px]"></i></button>
        <button onClick={onExport} className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-500 transition-colors"><i className="fas fa-download text-[10px]"></i></button>
        <button onClick={() => importFileRef.current?.click()} className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-500 transition-colors"><i className="fas fa-upload text-[10px]"></i></button>
        <input type="file" ref={importFileRef} onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} className="hidden" accept=".json" />
      </div>

      {/* Grid Params */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Grid Size</label>
            <input type="number" value={gridSize} onChange={e => setGridSize(parseInt(e.target.value)||8)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-indigo-600 outline-none focus:border-indigo-400 transition-colors" />
        </div>
        <div className="space-y-2">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Layers</label>
            <input type="number" value={layerCountInput} onChange={e => setLayerCountInput(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-indigo-600 outline-none focus:border-indigo-400 transition-colors" />
        </div>
      </div>

      {/* Main Prompt Form */}
      <form onSubmit={handleGenerateSubmit} className="space-y-6">
        <div className="space-y-3">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Creation Prompt</label>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden focus-within:border-indigo-400 transition-colors shadow-inner">
                <textarea 
                  value={prompt} 
                  onChange={e => setPrompt(e.target.value)} 
                  disabled={loading} 
                  className="w-full h-28 bg-transparent p-4 text-[11px] font-medium text-slate-600 outline-none resize-none" 
                  placeholder="Describe your furniture..."
                />
            </div>
            <div className="flex flex-wrap gap-2">
                {suggestions.map(s => (
                    <button key={s} type="button" onClick={() => setPrompt(s)} className="text-[8px] font-black border border-slate-200 hover:border-indigo-400 px-3 py-1.5 rounded-full text-slate-400 hover:text-indigo-600 transition-all bg-white">{s}</button>
                ))}
            </div>
        </div>

        <div className="flex items-center justify-between bg-slate-50 border border-slate-100 p-3 rounded-2xl">
            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-2">Symmetry Lock</span>
            <button 
                type="button" 
                onClick={() => setEnforceSymmetry(!enforceSymmetry)}
                className={`w-10 h-5 rounded-full relative transition-all duration-300 ${enforceSymmetry ? 'bg-pink-500' : 'bg-slate-300'}`}
            >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${enforceSymmetry ? 'left-6' : 'left-1'}`}></div>
            </button>
        </div>

        {/* Action Button */}
        <button 
            type="submit" 
            disabled={loading} 
            className="w-full py-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-black uppercase tracking-[0.2em] text-[11px] rounded-2xl shadow-xl shadow-indigo-100 active:scale-95 transition-all disabled:opacity-50"
        >
            {loading ? <i className="fas fa-circle-notch fa-spin mr-2"></i> : null}
            {loading ? "PROFILING..." : "FORGE ARTIFACT"}
        </button>
      </form>

      {/* Refine Section */}
      {hasModel && !loading && (
          <div className="pt-6 border-t border-slate-100 animate-in slide-in-from-bottom-2">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3 block">Iterative Tweaks</label>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:border-indigo-400 transition-colors">
                  <textarea value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Make it taller, change color..." className="w-full h-20 bg-transparent p-2 text-[10px] text-slate-500 outline-none resize-none" />
                  <button onClick={() => { onRefine(feedback); setFeedback(''); }} disabled={!feedback.trim()} className="w-full py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">Apply</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default Controls;
