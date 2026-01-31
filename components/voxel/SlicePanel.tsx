
import React from 'react';
import { VoxelModel } from '../../services/voxelTypes';

interface SlicePanelProps {
  model: VoxelModel;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

const SlicePanel: React.FC<SlicePanelProps> = ({ model, selectedIndex, onSelect }) => {
  const reversedLayers = [...model.layers].reverse();

  return (
    <div className="flex flex-col gap-2 h-full overflow-y-auto pr-0.5 custom-scrollbar scroll-smooth">
      <div className="text-[7px] font-black text-slate-300 uppercase tracking-[0.4em] mb-4 sticky top-0 py-2 z-10 text-center">
        Stack
      </div>
      <div className="flex flex-col gap-2">
        {reversedLayers.map((layer, rIdx) => {
          const originalIdx = model.layers.length - 1 - rIdx;
          const isActive = selectedIndex === originalIdx;
          
          return (
            <button
              key={originalIdx}
              onClick={() => onSelect(originalIdx)}
              className={`relative aspect-square w-10 rounded-lg border transition-all shrink-0 overflow-hidden group ${
                isActive 
                  ? 'border-indigo-500 bg-indigo-50 shadow-md scale-110 z-10' 
                  : 'border-slate-100 bg-white hover:border-slate-200'
              }`}
            >
              <div 
                className="absolute inset-1 grid pointer-events-none opacity-40 group-hover:opacity-60"
                style={{ 
                  gridTemplateColumns: `repeat(${model.gridSize}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${model.gridSize}, minmax(0, 1fr))`
                }}
              >
                {layer.rows.map((row, rowIdx) => 
                  row.split('').map((char, colIdx) => (
                    <div 
                      key={`${rowIdx}-${colIdx}`} 
                      style={{ backgroundColor: model.palette[char] || 'transparent' }}
                    />
                  ))
                )}
              </div>
              
              <div className={`absolute top-0 left-0 px-1 py-0.5 text-[6px] font-black ${isActive ? 'text-indigo-600' : 'text-slate-300'}`}>
                {originalIdx}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SlicePanel;
