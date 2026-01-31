
import React, { useState, useEffect, useRef } from 'react';
import { VoxelModel } from '../../services/voxelTypes';

interface VoxelRendererProps {
  model: VoxelModel;
  size?: number; // Added optional size prop
}

const VoxelRenderer: React.FC<VoxelRendererProps> = ({ model, size = 320 }) => {
  const [rotation, setRotation] = useState({ x: 65, z: 45 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(size < 200 ? 1.0 : 1.5); // Default scale based on size
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  const containerSize = size; 
  const gridSize = model.gridSize;
  const voxelPixelSize = containerSize / gridSize;
  const layerGap = voxelPixelSize * 0.3; 

  useEffect(() => {
    canvasRefs.current = canvasRefs.current.slice(0, model.layers.length);
  }, [model.layers.length]);

  useEffect(() => {
    model.layers.forEach((layer, lIdx) => {
      const canvas = canvasRefs.current[lIdx];
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return;

      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, gridSize, gridSize);
      const layerAbove = model.layers[lIdx + 1];

      layer.rows.forEach((row, rIdx) => {
        for (let cIdx = 0; cIdx < row.length; cIdx++) {
          const char = row[cIdx];
          const color = model.palette[char];
          
          if (char !== '.' && color) {
            // Clean Studio Lighting
            const heightFactor = 0.9 + (lIdx / model.layerCount) * 0.1;
            ctx.fillStyle = applyShading(color, heightFactor);
            ctx.fillRect(cIdx, rIdx, 1, 1);

            // Shadowing from layer above
            if (layerAbove) {
                const aboveRow = layerAbove.rows[rIdx];
                if (aboveRow && aboveRow[cIdx] !== '.') {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'; 
                    ctx.fillRect(cIdx, rIdx, 1, 1);
                }
            }
          }
        }
      });
    });
  }, [model, gridSize]);

  const applyShading = (hex: string, factor: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; 
    setIsDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - lastMouse.x;
    const deltaY = e.clientY - lastMouse.y;
    setRotation(prev => ({
      x: Math.min(Math.max(prev.x - deltaY * 0.5, 5), 85),
      z: prev.z - deltaX * 0.5
    }));
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale(prev => Math.min(Math.max(prev - e.deltaY * 0.001, 0.4), 8));
    };
    const container = containerRef.current;
    if (container) container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container?.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Background Soft Glow */}
      <div className={`absolute ${size < 200 ? 'w-[200px] h-[200px]' : 'w-[600px] h-[600px]'} bg-indigo-100/30 rounded-full blur-[60px] pointer-events-none`}></div>

      <div 
        style={{
          transform: `scale(${scale}) rotateX(${rotation.x}deg) rotateZ(${rotation.z}deg)`,
          transformStyle: 'preserve-3d',
          transition: isDragging ? 'none' : 'transform 0.6s cubic-bezier(0.1, 0.8, 0.2, 1)',
          width: `${containerSize}px`,
          height: `${containerSize}px`,
        }}
        className="relative"
      >
        {/* Soft Drop Shadow Plane */}
        <div 
          className="absolute inset-[-10%] bg-[#cbd5e1]/30 blur-[40px] rounded-full pointer-events-none"
          style={{ transform: 'translateZ(-30px) translateY(20px)' }}
        ></div>

        {model.layers.map((_, lIdx) => (
          <canvas
            key={lIdx}
            ref={el => { canvasRefs.current[lIdx] = el; }}
            width={gridSize}
            height={gridSize}
            style={{
              position: 'absolute',
              top: 0, left: 0, width: '100%', height: '100%',
              imageRendering: 'pixelated', 
              transform: `translateZ(${lIdx * layerGap}px)`,
              backfaceVisibility: 'hidden',
              pointerEvents: 'none',
              opacity: 1
            }}
          />
        ))}
      </div>

      {/* Info Legend Overlay (Only for large mode) */}
      {size > 200 && (
        <div className="absolute bottom-6 left-8 text-[8px] font-black text-slate-400 uppercase tracking-[0.4em] flex gap-8 pointer-events-none">
            <span>ANG: {rotation.x.toFixed(0)}° / {rotation.z.toFixed(0)}°</span>
            <span>MAG: {scale.toFixed(1)}X</span>
        </div>
      )}
    </div>
  );
};

export default VoxelRenderer;
