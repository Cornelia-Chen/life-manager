
import React from 'react';
import { BlueprintRecord } from '../../services/voxelTypes';

interface BlueprintGalleryProps {
  blueprints: BlueprintRecord[];
  onLoad: (record: BlueprintRecord) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const BlueprintGallery: React.FC<BlueprintGalleryProps> = ({ blueprints, onLoad, onDelete, onClose }) => {
  return (
    <div className="absolute inset-0 bg-slate-950/98 backdrop-blur-3xl z-[60] flex flex-col p-10 animate-in fade-in slide-in-from-bottom-8 duration-500">
      <div className="flex items-center justify-between mb-10">
        <div className="flex flex-col">
          <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
            Structural Archive
          </h2>
          <span className="text-[10px] text-blue-500 font-black tracking-[0.4em] uppercase mt-2">
            Local Matrix Repository
          </span>
        </div>
        <button 
          onClick={onClose}
          className="w-12 h-12 flex items-center justify-center bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-full text-slate-400 transition-all"
        >
          <i className="fas fa-times text-lg"></i>
        </button>
      </div>

      {blueprints.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
          <i className="fas fa-box-open text-6xl mb-4 opacity-20"></i>
          <p className="text-sm font-bold tracking-widest uppercase">Archive Empty</p>
          <p className="text-[10px] uppercase mt-2 tracking-widest opacity-50">Save your first blueprint to start the collection</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 content-start pb-10">
          {blueprints.sort((a,b) => b.timestamp - a.timestamp).map((bp) => (
            <div 
              key={bp.id} 
              className="group relative bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden hover:border-blue-500/50 transition-all hover:shadow-[0_0_30px_rgba(59,130,246,0.1)]"
            >
              {/* Thumbnail Container */}
              <div className="aspect-square bg-[#05070a] p-8 flex items-center justify-center relative">
                {bp.thumbnail && (
                  <img 
                    src={bp.thumbnail} 
                    alt={bp.name} 
                    className="w-full h-full object-contain image-rendering-pixelated opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
              </div>

              {/* Info Bar */}
              <div className="p-5 flex flex-col gap-1">
                <h3 className="text-sm font-black text-white uppercase tracking-wider truncate">{bp.name}</h3>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-slate-500 font-mono uppercase">
                    {bp.model.gridSize}x{bp.model.gridSize}x{bp.model.layerCount}
                  </span>
                  <span className="text-[9px] text-slate-600 uppercase font-bold">
                    {new Date(bp.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Action Overlay */}
              <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-[2px]">
                <button 
                  onClick={() => onLoad(bp)}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-all duration-300"
                >
                  Deploy Matrix
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(bp.id); }}
                  className="p-2 text-red-500/50 hover:text-red-500 transition-colors transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 delay-75"
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto pt-6 border-t border-slate-800 flex justify-between items-center text-[9px] text-slate-500 font-black uppercase tracking-[0.4em]">
        <span>Storage: IndexedDB Matrix Store</span>
        <span>Total Blueprints: {blueprints.length}</span>
      </div>
    </div>
  );
};

export default BlueprintGallery;
