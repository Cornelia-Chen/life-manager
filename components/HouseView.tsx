import { RoomType, ReceiptItem, LanguageCode } from '../services/geminiService';
import { VoxelModel, VoxelLayer } from '../services/voxelTypes';
import { butlerModel } from '../services/blueprints/butlerModel';
import React, { useState, useRef, useEffect, useMemo } from 'react';

interface DoorConfig {
  side: 'north' | 'south' | 'east' | 'west';
  offset: number; 
  width: number;  
}

interface RoomConfig {
  id: RoomType;
  x: number;
  y: number; 
  w: number;
  h: number;
  centerX: number;
  centerY: number;
  wallColor?: string;
  floorColor?: string;
  doors?: DoorConfig[];
}

const DEFAULT_BLUEPRINTS: RoomConfig[] = [
  { 
    id: 'bedroom', x: 2, y: 2, w: 14, h: 18, centerX: 9, centerY: 11, 
    wallColor: '#ffffff', floorColor: '#fce7f3',
    doors: [{ side: 'east', offset: 12, width: 4 }, { side: 'south', offset: 2, width: 4 }]
  },
  { 
    id: 'cloakroom', x: 16, y: 2, w: 6, h: 18, centerX: 19, centerY: 11, 
    wallColor: '#ffffff', floorColor: '#f3e8ff',
    doors: [{ side: 'west', offset: 12, width: 4 }]
  },
  { 
    id: 'bathroom', x: 24, y: 2, w: 12, h: 16, centerX: 30, centerY: 10, 
    wallColor: '#ffffff', floorColor: '#e0f2fe',
    doors: [{ side: 'south', offset: 8, width: 4 }]
  },
  { 
    id: 'balcony', x: 38, y: 2, w: 8, h: 16, centerX: 42, centerY: 10, 
    wallColor: '#ffffff', floorColor: '#ecfccb',
    doors: [{ side: 'south', offset: 2, width: 4 }]
  },
  { 
    id: 'kitchen', x: 2, y: 22, w: 14, h: 14, centerX: 9, centerY: 29, 
    wallColor: '#ffffff', floorColor: '#fef3c7',
    doors: [{ side: 'east', offset: 4, width: 6 }]
  },
  { 
    id: 'storage', x: 2, y: 36, w: 14, h: 10, centerX: 9, centerY: 41, 
    wallColor: '#ffffff', floorColor: '#f1f5f9',
    doors: [{ side: 'east', offset: 4, width: 4 }]
  },
  { 
    id: 'living', x: 18, y: 20, w: 28, h: 28, centerX: 32, centerY: 34, 
    wallColor: '#ffffff', floorColor: '#ffe4e6',
    doors: [
        { side: 'north', offset: 14, width: 4 }, 
        { side: 'north', offset: 22, width: 4 }, 
        { side: 'west', offset: 6, width: 6 },   
        { side: 'west', offset: 20, width: 4 }   
    ]
  },
];

const ROOM_NAMES: Record<LanguageCode, Record<RoomType, string>> = {
  'zh-CN': { kitchen: '厨房', living: '客厅', bedroom: '卧室', bathroom: '浴室', balcony: '阳台', storage: '储藏室', cloakroom: '衣帽间' },
  'en': { kitchen: 'Kitchen', living: 'Living', bedroom: 'Bedroom', bathroom: 'Bath', balcony: 'Balcony', storage: 'Storage', cloakroom: 'Cloak' },
  'fr': { kitchen: 'Cuisine', living: 'Salon', bedroom: 'Chambre', bathroom: 'Bain', balcony: 'Balcon', storage: 'Stockage', cloakroom: 'Vestiaire' },
  'ja': { kitchen: 'キッチン', living: '居間', bedroom: '寝室', bathroom: '浴室', balcony: 'ベランダ', storage: '倉庫', cloakroom: 'クローク' },
  'es': { kitchen: 'Cocina', living: 'Sala', bedroom: 'Dormitorio', bathroom: 'Baño', balcony: 'Balcón', storage: 'Almacén', cloakroom: 'Vestidor' },
};

interface HouseViewProps {
  inventory: ReceiptItem[];
  onRoomClick?: (room: RoomType) => void;
  currentLang: LanguageCode;
  selectedRoom?: RoomType | null; 
  butlerMessage?: string | null;
  onDismissMessage?: () => void;
  onItemMove: (itemId: string, x: number, y: number, newRoomId?: RoomType) => void;
  onAvatarClick?: () => void;
  walkToRoom?: RoomType | null; 
  onOpenFurniture?: () => void; 
  onDoubleClick?: () => void;
  selectedItemId?: string | null;
  onSelectItem?: (id: string | null) => void;
  autoFit?: boolean;
  butlerImage?: string; 
  butlerScale?: number; 
}

interface VoxelCharacterProps {
  model: VoxelModel;
  x: number;
  y: number;
  gridUnit: number;
  baseGap: number;
  rotation: number;
  onClick?: (e: React.MouseEvent) => void;
  isMoving?: boolean;
  message?: string | null;
  onDismissMessage?: () => void;
  imageSrc?: string;
  scale?: number;
}

interface FurnitureStackProps {
  item: ReceiptItem;
  isSelected: boolean;
  isDragging: boolean;
  isFollowing: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  gridUnit: number;
  baseGap: number;
  rotation: number;
}

export const HouseView: React.FC<HouseViewProps> = ({ 
  inventory, 
  onItemMove, 
  selectedItemId, 
  onSelectItem,
  selectedRoom,
  onRoomClick,
  onDoubleClick,
  onAvatarClick,
  walkToRoom,
  butlerMessage,
  onDismissMessage,
  autoFit = false,
  butlerImage,
  butlerScale = 1.0,
  currentLang
}) => {
  const [rotation, setRotation] = useState({ x: 60, z: 45 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 }); 
  const [isViewDragging, setIsViewDragging] = useState(false);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [followingItemId, setFollowingItemId] = useState<string | null>(null);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  
  const [viewScale, setViewScale] = useState(0.75);
  const [containerSize, setContainerSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  
  const [butlerPos, setButlerPos] = useState(() => {
      if (selectedRoom) {
          const room = DEFAULT_BLUEPRINTS.find(r => r.id === selectedRoom);
          if (room) return { x: room.centerX, y: room.centerY };
      }
      return { x: 32, y: 34 }; 
  }); 
  const butlerTarget = useRef({ x: butlerPos.x, y: butlerPos.y });
  const keysPressed = useRef<Set<string>>(new Set());
  
  const dragAccumulator = useRef({ x: 0, y: 0 });
  const dragDistance = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const BASE_GAP = 0.75;
  const GRID_UNIT = 12; 
  const FLOOR_SIZE = 48; 
  const WALL_HEIGHT = 40; 
  const WALL_THICKNESS = 8; 

  useEffect(() => {
    const updateSize = () => {
        if (containerRef.current) {
            setContainerSize({ 
                width: containerRef.current.clientWidth, 
                height: containerRef.current.clientHeight 
            });
        }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) {
        observer.observe(containerRef.current);
    }
    window.addEventListener('resize', updateSize);
    return () => {
        observer.disconnect();
        window.removeEventListener('resize', updateSize);
    };
  }, []);

  useEffect(() => {
    if (selectedRoom) {
        setRotation(prev => ({ ...prev, x: 45 }));
    } else {
        setRotation(prev => ({ ...prev, x: 60 }));
    }
  }, [selectedRoom]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(key)) keysPressed.current.add(key);
    };
    const handleKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    let animationFrameId: number;
    const animate = () => {
      const keys = keysPressed.current;
      if (keys.size > 0) {
          const moveSpeed = 1.5;
          let dx = 0, dy = 0;
          if (keys.has('w')) dy -= moveSpeed;
          if (keys.has('s')) dy += moveSpeed;
          if (keys.has('a')) dx -= moveSpeed;
          if (keys.has('d')) dx += moveSpeed;
          if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }
          setButlerPos(prev => {
              const nextX = Math.max(0, Math.min(FLOOR_SIZE, prev.x + dx * 0.2));
              const nextY = Math.max(0, Math.min(FLOOR_SIZE, prev.y + dy * 0.2));
              butlerTarget.current = { x: nextX, y: nextY };
              return { x: nextX, y: nextY };
          });
      } else {
          setButlerPos(prev => {
             const dx = butlerTarget.current.x - prev.x;
             const dy = butlerTarget.current.y - prev.y;
             const dist = Math.sqrt(dx*dx + dy*dy);
             if (dist < 0.05) return prev; 
             const speed = 0.4;
             return { x: prev.x + dx * (speed / dist), y: prev.y + dy * (speed / dist) };
          });
      }
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  useEffect(() => {
    let targetRoom: RoomConfig | undefined;
    if (walkToRoom) {
        targetRoom = DEFAULT_BLUEPRINTS.find(r => r.id === walkToRoom);
    } else if (selectedRoom) {
        targetRoom = DEFAULT_BLUEPRINTS.find(r => r.id === selectedRoom);
    }
    if (targetRoom) {
        butlerTarget.current = { x: targetRoom.centerX, y: targetRoom.centerY };
    }
  }, [walkToRoom, selectedRoom]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // If we are currently following an item, clicking anywhere (floor or item) places it.
    if (followingItemId) {
      setFollowingItemId(null);
      return;
    }
    setIsViewDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
    dragDistance.current = 0;
    if (onSelectItem) onSelectItem(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const deltaX = e.clientX - lastMouse.x;
    const deltaY = e.clientY - lastMouse.y;
    setLastMouse({ x: e.clientX, y: e.clientY });

    const activeId = draggingItemId || followingItemId;

    if (isViewDragging && !activeId) {
      dragDistance.current += Math.abs(deltaX) + Math.abs(deltaY);
      if (selectedRoom) {
          setPanOffset(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      } else {
          setRotation(prev => ({ x: Math.min(Math.max(prev.x - deltaY * 0.5, 30), 85), z: prev.z - deltaX * 0.5 }));
      }
      return;
    }

    if (activeId) {
        const item = inventory.find(i => i.id === activeId);
        if (!item) return;
        
        const currentScale = autoFit ? (selectedRoom ? 2.0 : viewScale) : viewScale;
        const scaleFactor = 1 / currentScale; 
        
        const rad = -rotation.z * (Math.PI / 180);
        const screenDx = deltaX * scaleFactor;
        const screenDy = deltaY * scaleFactor;
        const gridDxPixel = screenDx * Math.cos(rad) - screenDy * Math.sin(rad);
        const gridDyPixel = screenDx * Math.sin(rad) + screenDy * Math.cos(rad);
        
        dragAccumulator.current.x += gridDxPixel;
        dragAccumulator.current.y += gridDyPixel;
        
        let moveX = 0, moveY = 0;
        if (Math.abs(dragAccumulator.current.x) >= GRID_UNIT) {
            moveX = Math.sign(dragAccumulator.current.x);
            dragAccumulator.current.x -= moveX * GRID_UNIT;
        }
        if (Math.abs(dragAccumulator.current.y) >= GRID_UNIT) {
            moveY = Math.sign(dragAccumulator.current.y);
            dragAccumulator.current.y -= moveY * GRID_UNIT;
        }
        
        if (moveX !== 0 || moveY !== 0) {
            const currentX = item.position?.x || 24;
            const currentY = item.position?.y || 24;
            const newX = Math.round(currentX + moveX);
            const newY = Math.round(currentY + moveY);
            const newRoom = DEFAULT_BLUEPRINTS.find(r => newX >= r.x && newX < r.x + r.w && newY >= r.y && newY < r.y + r.h);
            onItemMove(activeId, newX, newY, newRoom?.id);
        }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
          setIsViewDragging(true);
          setLastMouse({ x: e.touches[0].clientX, y: e.touches[0].clientY });
          dragDistance.current = 0;
      }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (isViewDragging && e.touches.length === 1) {
          const deltaX = e.touches[0].clientX - lastMouse.x;
          const deltaY = e.touches[0].clientY - lastMouse.y;
          setLastMouse({ x: e.touches[0].clientX, y: e.touches[0].clientY });
          dragDistance.current += Math.abs(deltaX) + Math.abs(deltaY);
          
          if (selectedRoom) {
              setPanOffset(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
          } else {
              setRotation(prev => ({ x: Math.min(Math.max(prev.x - deltaY * 0.5, 30), 85), z: prev.z - deltaX * 0.5 }));
          }
      }
  };

  const handleWheel = (e: React.WheelEvent) => {
      setViewScale(prev => Math.min(Math.max(prev - e.deltaY * 0.001, 0.2), 3.0));
  };

  const adjustZoom = (delta: number) => setViewScale(prev => Math.min(Math.max(prev + delta, 0.2), 3.0));

  const handleRoomWalk = (room: RoomConfig, e: React.MouseEvent) => {
      e.stopPropagation();
      if (dragDistance.current > 5) return;
      if (followingItemId) {
          setFollowingItemId(null);
          return;
      }

      const gridX = e.nativeEvent.offsetX / GRID_UNIT;
      const gridY = e.nativeEvent.offsetY / GRID_UNIT;
      butlerTarget.current = { x: room.x + gridX, y: room.y + gridY };
      if (onRoomClick) onRoomClick(room.id);
  };

  const isButlerMoving = keysPressed.current.size > 0 || Math.abs(butlerPos.x - butlerTarget.current.x) > 0.1 || Math.abs(butlerPos.y - butlerTarget.current.y) > 0.1;
  const isFollowingButler = autoFit && !selectedRoom;
  const shouldSnap = isViewDragging || draggingItemId || followingItemId || (isFollowingButler && isButlerMoving);

  const getTargetTransform = () => {
      if (!autoFit) return { x: 0, y: 0, scale: viewScale };
      const floorCenterPixel = (FLOOR_SIZE * GRID_UNIT) / 2;
      if (selectedRoom) {
          const room = DEFAULT_BLUEPRINTS.find(r => r.id === selectedRoom);
          if (room && containerSize.width > 0 && containerSize.height > 0) {
              const roomCenterXPixel = room.centerX * GRID_UNIT;
              const roomCenterYPixel = room.centerY * GRID_UNIT;
              const targetX = -(roomCenterXPixel - floorCenterPixel);
              const targetY = -(roomCenterYPixel - floorCenterPixel);
              const minContainerDim = Math.min(containerSize.width, containerSize.height);
              const roomMaxDim = Math.max(room.w, room.h) * GRID_UNIT;
              const fitScale = (minContainerDim * 0.7) / roomMaxDim;
              return { 
                  x: targetX, 
                  y: targetY, 
                  scale: Math.max(0.8, Math.min(fitScale, 6.0))
              };
          }
      } 
      const butlerXPixel = butlerPos.x * GRID_UNIT;
      const butlerYPixel = butlerPos.y * GRID_UNIT;
      const centerOffsetY = 4 * GRID_UNIT; 
      const targetX = -(butlerXPixel - floorCenterPixel);
      const targetY = -(butlerYPixel - centerOffsetY - floorCenterPixel);
      return { x: targetX, y: targetY, scale: viewScale };
  };

  const currentTransform = getTargetTransform();
  const handlePadStart = (key: string) => { keysPressed.current.add(key); };
  const handlePadEnd = (key: string) => { keysPressed.current.delete(key); };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full flex items-center justify-center overflow-hidden bg-[#f5f3ff] select-none group/view ${isViewDragging ? 'cursor-grabbing' : (draggingItemId || followingItemId) ? 'cursor-move' : 'cursor-grab'}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={() => { setIsViewDragging(false); setDraggingItemId(null); }}
      onMouseLeave={() => { setIsViewDragging(false); setDraggingItemId(null); }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => setIsViewDragging(false)}
      onWheel={handleWheel}
    >
      <div 
        style={{
          transformOrigin: 'center center',
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${currentTransform.scale}) translateY(${selectedRoom ? 30 : 0}px) rotateX(${rotation.x}deg) rotateZ(${rotation.z}deg) translateX(${currentTransform.x}px) translateY(${currentTransform.y}px)`,
          transformStyle: 'preserve-3d',
          transition: shouldSnap ? 'none' : 'transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)',
          width: `${FLOOR_SIZE * GRID_UNIT}px`,
          height: `${FLOOR_SIZE * GRID_UNIT}px`,
        }}
        className="relative flex-shrink-0"
      >
        {!selectedRoom && (
            <div className="absolute inset-[-10px] bg-slate-200 border-4 border-slate-300 rounded-xl" style={{ transform: 'translateZ(-10px)', boxShadow: '0 40px 80px rgba(0,0,0,0.2)' }} />
        )}
        
        {!selectedRoom && (
            <div 
                className="absolute inset-[-600px] bg-[#fdf4ff] transform -translate-z-[12px] -z-10 pointer-events-none" 
                style={{ 
                    backgroundImage: `linear-gradient(#e9d5ff 1px, transparent 1px), linear-gradient(90deg, #e9d5ff 1px, transparent 1px)`, 
                    backgroundSize: `${GRID_UNIT * 2}px ${GRID_UNIT * 2}px`,
                    opacity: 0.7
                }} 
            />
        )}

        {DEFAULT_BLUEPRINTS.map(room => {
            if (selectedRoom && room.id !== selectedRoom) return null;
            return (
                <Room3D 
                  key={room.id} 
                  room={room} 
                  isSelected={selectedRoom === room.id} 
                  onRoomClick={onRoomClick} 
                  onFloorClick={(e) => handleRoomWalk(room, e)} 
                  gridUnit={GRID_UNIT} 
                  wallHeight={WALL_HEIGHT} 
                  wallThickness={WALL_THICKNESS}
                  currentLang={currentLang} 
                  butlerPos={butlerPos}
                  showWalls={true} 
                />
            );
        })}

        <VoxelCharacter 
            model={butlerModel} 
            x={butlerPos.x} 
            y={butlerPos.y} 
            gridUnit={GRID_UNIT} 
            baseGap={BASE_GAP} 
            rotation={rotation.z} 
            onClick={(e) => { e.stopPropagation(); if (dragDistance.current < 5) onAvatarClick?.(); }} 
            isMoving={Math.abs(butlerPos.x - butlerTarget.current.x) > 0.5 || Math.abs(butlerPos.y - butlerTarget.current.y) > 0.5} 
            message={butlerMessage} 
            onDismissMessage={onDismissMessage} 
            imageSrc={butlerImage} 
            scale={butlerScale} 
        />

        {inventory.map((item) => {
            if (!item.showOnMap) return null;
            if (item.currentQuantity <= 0) return null;
            if (selectedRoom && item.assignedRoom !== selectedRoom) return null; 
            return (
              <FurnitureStack 
                key={item.id} 
                item={item} 
                isSelected={selectedItemId === item.id} 
                isDragging={draggingItemId === item.id} 
                isFollowing={followingItemId === item.id}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setFollowingItemId(item.id);
                  if (onSelectItem) onSelectItem(item.id);
                }}
                onMouseDown={(e) => { 
                  if (followingItemId) return; // Handled by container's MouseDown (placement)
                  e.stopPropagation(); 
                  e.preventDefault(); 
                  if (onSelectItem) onSelectItem(item.id); 
                  setDraggingItemId(item.id); 
                  setLastMouse({ x: e.clientX, y: e.clientY }); 
                  dragAccumulator.current = { x: 0, y: 0 }; 
                }} 
                gridUnit={GRID_UNIT} 
                baseGap={BASE_GAP} 
                rotation={rotation.z} 
              />
            );
        })}
      </div>
      
      {(!autoFit || !selectedRoom) && (
        <>
            <div className="absolute bottom-6 left-6 flex items-center gap-2 z-50">
                <div className="bg-white/80 backdrop-blur-md rounded-full shadow-lg border border-white/50 flex flex-col p-0.5 gap-0.5">
                    <button onClick={(e) => { e.stopPropagation(); adjustZoom(0.2); }} className="w-6 h-6 flex items-center justify-center bg-white rounded-full hover:bg-slate-100 text-slate-600 shadow-sm"><i className="fas fa-plus text-[8px]"></i></button>
                    <button onClick={(e) => { e.stopPropagation(); setViewScale(0.8); }} className="w-6 h-6 flex items-center justify-center bg-white rounded-full hover:bg-slate-100 text-slate-400 text-[6px] font-black uppercase tracking-tighter shadow-sm">RST</button>
                    <button onClick={(e) => { e.stopPropagation(); adjustZoom(-0.2); }} className="w-6 h-6 flex items-center justify-center bg-white rounded-full hover:bg-slate-100 text-slate-600 shadow-sm"><i className="fas fa-minus text-[8px]"></i></button>
                </div>
            </div>

            <div className="absolute bottom-6 right-6 z-50 transform scale-75 origin-bottom-right">
                <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/50 p-1.5 grid grid-cols-3 gap-1">
                    <div />
                    <button 
                        onMouseDown={() => handlePadStart('w')} onMouseUp={() => handlePadEnd('w')} onMouseLeave={() => handlePadEnd('w')}
                        onTouchStart={(e) => { e.preventDefault(); handlePadStart('w'); }} onTouchEnd={(e) => { e.preventDefault(); handlePadEnd('w'); }}
                        className="w-7 h-7 flex items-center justify-center bg-white rounded-lg hover:bg-slate-100 text-slate-600 shadow-sm active:bg-blue-50 active:text-blue-500"
                    >
                        <i className="fas fa-chevron-up text-[10px]"></i>
                    </button>
                    <div />
                    <button 
                        onMouseDown={() => handlePadStart('a')} onMouseUp={() => handlePadEnd('a')} onMouseLeave={() => handlePadEnd('a')}
                        onTouchStart={(e) => { e.preventDefault(); handlePadStart('a'); }} onTouchEnd={(e) => { e.preventDefault(); handlePadEnd('a'); }}
                        className="w-7 h-7 flex items-center justify-center bg-white rounded-lg hover:bg-slate-100 text-slate-600 shadow-sm active:bg-blue-50 active:text-blue-500"
                    >
                        <i className="fas fa-chevron-left text-[10px]"></i>
                    </button>
                    <div className="w-7 h-7 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-slate-300 rounded-full"></div>
                    </div>
                    <button 
                        onMouseDown={() => handlePadStart('d')} onMouseUp={() => handlePadEnd('d')} onMouseLeave={() => handlePadEnd('d')}
                        onTouchStart={(e) => { e.preventDefault(); handlePadStart('d'); }} onTouchEnd={(e) => { e.preventDefault(); handlePadEnd('d'); }}
                        className="w-7 h-7 flex items-center justify-center bg-white rounded-lg hover:bg-slate-100 text-slate-600 shadow-sm active:bg-blue-50 active:text-blue-500"
                    >
                        <i className="fas fa-chevron-right text-[10px]"></i>
                    </button>
                    <div />
                    <button 
                        onMouseDown={() => handlePadStart('s')} onMouseUp={() => handlePadEnd('s')} onMouseLeave={() => handlePadEnd('s')}
                        onTouchStart={(e) => { e.preventDefault(); handlePadStart('s'); }} onTouchEnd={(e) => { e.preventDefault(); handlePadEnd('s'); }}
                        className="w-7 h-7 flex items-center justify-center bg-white rounded-lg hover:bg-slate-100 text-slate-600 shadow-sm active:bg-blue-50 active:text-blue-500"
                    >
                        <i className="fas fa-chevron-down text-[10px]"></i>
                    </button>
                    <div />
                </div>
            </div>
        </>
      )}
    </div>
  );
};

const VolumetricWall: React.FC<{ 
    width: number, 
    height: number, 
    thickness: number,
    color?: string, 
    transform: string, 
    transformOrigin?: string, 
    opacity?: number, 
    doors?: DoorConfig[], 
    side: 'north' | 'south' | 'east' | 'west', 
    gridUnit: number
}> = ({ width, height, thickness, color = '#ffffff', transform, transformOrigin, opacity = 1, doors, side, gridUnit }) => {
    let clipPath = 'none';
    const wallDoors = doors?.filter(d => d.side === side);
    if (wallDoors && wallDoors.length > 0) {
        const doorHeightPct = 75; 
        let poly = 'polygon(0% 0%, 100% 0%, 100% 100%';
        const sortedDoors = [...wallDoors].sort((a, b) => b.offset - a.offset);
        const totalGridLen = width / gridUnit;
        sortedDoors.forEach(door => {
            const startPct = (door.offset / totalGridLen) * 100;
            const endPct = ((door.offset + door.width) / totalGridLen) * 100;
            poly += `, ${endPct}% 100%, ${endPct}% ${100-doorHeightPct}%, ${startPct}% ${100-doorHeightPct}%, ${startPct}% 100%`;
        });
        poly += ', 0% 100%)';
        clipPath = poly;
    }
    const topColor = color; 
    const faceColor = darkenColor(color, 10); 
    const sideColor = darkenColor(color, 20); 
    return (
        <div 
            className="absolute transform-style-3d transition-opacity duration-500"
            style={{ 
                width, 
                height, 
                transform, 
                transformOrigin: transformOrigin || 'bottom left', 
                opacity,
                pointerEvents: 'none'
            }}
        >
            <div className="absolute inset-0 backface-visible border border-black/5" style={{ backgroundColor: faceColor, clipPath }}></div>
            <div className="absolute top-0 left-0 origin-top" style={{ width: width, height: thickness, backgroundColor: topColor, transform: `rotateX(-90deg)` }}></div>
            <div className="absolute top-0 left-0 origin-left" style={{ width: thickness, height: height, backgroundColor: sideColor, transform: `rotateY(90deg) translateX(-${thickness}px)` }}></div>
            <div className="absolute top-0 right-0 origin-right" style={{ width: thickness, height: height, backgroundColor: sideColor, transform: `rotateY(-90deg) translateX(${thickness}px)` }}></div>
        </div>
    );
};

function darkenColor(hex: string, percent: number): string {
    let num = parseInt(hex.replace("#", ""), 16),
    amt = Math.round(2.55 * percent),
    R = (num >> 16) - amt,
    G = (num >> 8 & 0x00FF) - amt,
    B = (num & 0x0000FF) - amt;
    return "#" + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (G<255?G<1?0:G:255)*0x100 + (B<255?B<1?0:B:255)).toString(16).slice(1);
}

const Room3D: React.FC<{ 
  room: RoomConfig, 
  isSelected: boolean, 
  onRoomClick?: (room: RoomType) => void, 
  onFloorClick: (e: React.MouseEvent) => void, 
  gridUnit: number, 
  wallHeight: number, 
  wallThickness: number,
  currentLang: LanguageCode,
  butlerPos: { x: number, y: number },
  showWalls?: boolean 
}> = ({ room, isSelected, onFloorClick, gridUnit, wallHeight, wallThickness, currentLang, butlerPos, showWalls = true }) => {
    const roomW = room.w * gridUnit;
    const roomH = room.h * gridUnit;
    const roomName = ROOM_NAMES[currentLang]?.[room.id] || room.id;
    const getWallOpacity = (side: 'north' | 'south' | 'east' | 'west') => {
        if (!showWalls) return 0; 
        if (isSelected) {
            if (side === 'south' || side === 'east') return 0; 
            return 1.0; 
        }
        let opacity = 0.9; 
        const isButlerInRoom = butlerPos.x >= room.x && butlerPos.x <= room.x + room.w && butlerPos.y >= room.y && butlerPos.y <= room.y + room.h;
        if (room.id === 'kitchen') {
            if (side === 'east' && isButlerInRoom) return 0.15;
            if (side === 'south' && isButlerInRoom && butlerPos.y > 30) return 0.15;
        }
        if (room.id === 'storage') {
            const butlerNearStorageBoundary = (butlerPos.x >= 2 && butlerPos.x <= 16 && butlerPos.y > 30);
            if (side === 'north' && (isButlerInRoom || butlerNearStorageBoundary)) return 0.15;
            if (side === 'east' && isButlerInRoom) return 0.15;
        }
        if (isButlerInRoom) {
            if (side === 'south' || side === 'east') return 0.2;
        }
        return opacity;
    };
    return (
        <div className={`absolute transition-all duration-500 transform-style-3d group ${isSelected ? 'shadow-2xl z-10' : ''}`} style={{ left: `${room.x * gridUnit}px`, top: `${room.y * gridUnit}px`, width: `${roomW}px`, height: `${roomH}px`, transformStyle: 'preserve-3d' }} onClick={onFloorClick}>
            <div className="absolute inset-0 transition-colors duration-300 cursor-pointer" style={{ backgroundColor: room.floorColor, opacity: 1, border: `1px solid ${isSelected ? '#3b82f6' : 'rgba(0,0,0,0.05)'}`, boxShadow: isSelected ? '0 20px 50px rgba(0,0,0,0.1)' : 'none' }}>
                <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${isSelected ? 'opacity-10' : 'opacity-40'}`} style={{ backgroundImage: `linear-gradient(#ffffff 2px, transparent 2px), linear-gradient(90deg, #ffffff 2px, transparent 2px)`, backgroundSize: `${gridUnit}px ${gridUnit}px` }} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded transition-all transform ${isSelected ? 'bg-blue-600 text-white scale-110 -translate-y-4 shadow-lg' : 'text-slate-400/50 mix-blend-multiply'}`}>{roomName}</span>
                </div>
            </div>
            <div className="pointer-events-none" style={{ visibility: showWalls ? 'visible' : 'hidden' }}>
                <VolumetricWall width={roomW} height={wallHeight} thickness={wallThickness} transform="rotateX(-90deg) translateY(-100%)" transformOrigin="top center" color={room.wallColor} side="north" doors={room.doors} gridUnit={gridUnit} opacity={getWallOpacity('north')} />
                <VolumetricWall width={roomH} height={wallHeight} thickness={wallThickness} transform="rotateY(90deg) translateX(-100%)" transformOrigin="center left" color={room.wallColor} side="west" doors={room.doors} gridUnit={gridUnit} opacity={getWallOpacity('west')} />
                <VolumetricWall width={roomW} height={wallHeight} thickness={wallThickness} transform="rotateX(-90deg) translateY(-100%) translateZ(0)" transformOrigin="bottom center" color={room.wallColor} side="south" doors={room.doors} gridUnit={gridUnit} opacity={getWallOpacity('south')} />
                <VolumetricWall width={roomH} height={wallHeight} thickness={wallThickness} transform="rotateY(90deg) translateX(-100%)" transformOrigin="center right" color={room.wallColor} side="east" doors={room.doors} gridUnit={gridUnit} opacity={getWallOpacity('east')} />
            </div>
        </div>
    );
};

const VoxelCharacter: React.FC<VoxelCharacterProps> = ({ model, x, y, gridUnit, baseGap, rotation, onClick, isMoving, message, onDismissMessage, imageSrc, scale = 1 }) => {
    const [bounce, setBounce] = useState(0);
    useEffect(() => {
        if (isMoving || imageSrc) {
            const interval = setInterval(() => setBounce(prev => (prev === 0 ? -2 : 0)), 150);
            return () => clearInterval(interval);
        } else setBounce(0);
    }, [isMoving, imageSrc]);
    const displaySize = model.gridSize * (gridUnit / 4) * (imageSrc ? 1 : scale);
    const characterHeight = model.layerCount * baseGap * scale;
    const bubbleZ = imageSrc ? (160 * scale + 40) : (characterHeight + 100);
    return (
        <div className="absolute z-20 transition-transform duration-100 ease-linear cursor-pointer group" onClick={onClick} style={{ left: `${x * gridUnit}px`, top: `${y * gridUnit}px`, width: `${displaySize}px`, height: `${displaySize}px`, marginLeft: `-${displaySize/2}px`, marginTop: `-${displaySize/2}px`, transform: `translateZ(${bounce}px)`, transformStyle: 'preserve-3d' }}>
            <div className="absolute inset-0 bg-black/40 blur-md rounded-full transform translate-z-[-2px] scale-75" />
            {imageSrc ? (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-20 origin-bottom" style={{ transform: `rotateZ(${-rotation}deg) rotateX(-60deg) scale(${2 * scale})`, backfaceVisibility: 'hidden', transformStyle: 'preserve-3d' }}><img src={imageSrc} alt="Butler" className="w-full h-full object-contain filter drop-shadow-xl" /></div>
            ) : model.layers.map((layer, lIdx) => <LayerCanvas key={lIdx} layer={layer} layerAbove={model.layers[lIdx + 1]} model={model} z={lIdx * baseGap * scale} isSelected={false} />)}
            {message && (
                <div 
                    className="absolute left-1/2 -translate-x-1/2 z-[100] pointer-events-auto" 
                    onClick={(e) => { e.stopPropagation(); onDismissMessage?.(); }} 
                    style={{ 
                        transform: `translateZ(${bubbleZ}px) rotateZ(${-rotation}deg) rotateX(-60deg)`, 
                        transformOrigin: 'bottom center',
                        bottom: '0', 
                        width: 'auto',
                        minWidth: '180px',
                        maxWidth: '240px'
                    }}
                >
                    <div className="bg-white/95 backdrop-blur text-purple-800 p-3 rounded-2xl rounded-bl-none shadow-2xl border-2 border-pink-100 text-[10px] font-bold leading-tight animate-bounce-custom relative">
                        {message}
                        <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-white rotate-45 border-r border-b border-pink-100"></div>
                        <button onClick={(e) => { e.stopPropagation(); onDismissMessage?.(); }} className="absolute -top-2 -right-2 bg-pink-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow-md hover:scale-110 transition-transform"><i className="fas fa-times"></i></button>
                    </div>
                </div>
            )}
            <style>{`
                @keyframes bounce-custom {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                .animate-bounce-custom {
                    animation: bounce-custom 2s infinite ease-in-out;
                }
            `}</style>
        </div>
    );
};

const FurnitureStack: React.FC<FurnitureStackProps> = ({ item, isSelected, isDragging, isFollowing, onMouseDown, onDoubleClick, gridUnit, baseGap, rotation }) => {
  const model = item.voxelModel;
  const posX = item.position?.x || 24;
  const posY = item.position?.y || 24;
  const itemScale = item.scale || 1.0;
  const itemRot = item.rotation || 0;
  const heightScale = item.heightScale || 1.0;
  const elevation = item.elevation || 0;
  const itemLayerGap = baseGap * itemScale * heightScale;
  
  // Calculate bounding box for tight interaction area
  const bounds = useMemo(() => {
    if (!model) return null;
    let minC = model.gridSize, maxC = 0, minR = model.gridSize, maxR = 0;
    let hasContent = false;
    model.layers.forEach(layer => {
      layer.rows.forEach((row, rIdx) => {
        for (let cIdx = 0; cIdx < row.length; cIdx++) {
          if (row[cIdx] !== '.') {
            minC = Math.min(minC, cIdx);
            maxC = Math.max(maxC, cIdx);
            minR = Math.min(minR, rIdx);
            maxR = Math.max(maxR, rIdx);
            hasContent = true;
          }
        }
      });
    });
    return hasContent ? { minC, maxC, minR, maxR } : null;
  }, [model]);

  const pixelScale = gridUnit / 4;
  const fullSize = model ? model.gridSize * pixelScale * itemScale : 4 * gridUnit * itemScale;
  
  // Hitbox is only as big as the used cells
  const hitboxWidth = bounds ? (bounds.maxC - bounds.minC + 1) * pixelScale * itemScale : fullSize;
  const hitboxHeight = bounds ? (bounds.maxR - bounds.minR + 1) * pixelScale * itemScale : fullSize;
  
  const isActive = isSelected || isDragging || isFollowing;

  // Visual offsets to center the content within the coordinate-aligned hitbox
  // We offset the LayerCanvas grid so the content appears centered on the coordinate
  const contentCenterX = bounds ? (bounds.minC + bounds.maxC + 1) / 2 : (model?.gridSize || 0) / 2;
  const contentCenterY = bounds ? (bounds.minR + bounds.maxR + 1) / 2 : (model?.gridSize || 0) / 2;
  const gridOffsetUnitsX = (model ? model.gridSize / 2 : 0) - contentCenterX;
  const gridOffsetUnitsY = (model ? model.gridSize / 2 : 0) - contentCenterY;
  const pixelOffsetX = gridOffsetUnitsX * pixelScale * itemScale;
  const pixelOffsetY = gridOffsetUnitsY * pixelScale * itemScale;

  return (
    <div 
      className={`furniture-item absolute transition-shadow ${isActive ? 'z-50' : 'z-10'}`}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      style={{
        left: `${posX * gridUnit}px`, 
        top: `${posY * gridUnit}px`,
        width: `${hitboxWidth}px`,
        height: `${hitboxHeight}px`,
        marginLeft: `-${hitboxWidth/2}px`, 
        marginTop: `-${hitboxHeight/2}px`,
        transform: `translateZ(${elevation}px) rotateZ(${itemRot}deg)`,
        transformStyle: 'preserve-3d',
        pointerEvents: 'auto',
        cursor: (isDragging || isFollowing) ? 'move' : 'grab'
      }}
    >
      {isActive && (
        <div className={`absolute inset-[-4px] border-2 rounded-lg transition-all ${isDragging || isFollowing ? 'border-green-400 shadow-[0_0_30px_rgba(74,222,128,0.4)] bg-green-400/10' : 'border-blue-50 shadow-[0_0_20px_rgba(59,130,246,0.5)] animate-pulse'}`} />
      )}
      {item.currentQuantity > 1 && (
        <div className="absolute -top-3 -right-3 bg-red-500 text-white text-[8px] font-black rounded-full w-5 h-5 flex items-center justify-center border-2 border-white z-20 shadow-sm animate-in zoom-in duration-300">
            {Math.floor(item.currentQuantity)}
        </div>
      )}
      {model ? (
          <div className="relative" style={{ width: hitboxWidth, height: hitboxHeight, transformStyle: 'preserve-3d' }}>
            <div className="absolute inset-1 bg-black/60 blur-md transform translate-z-[-2px] rounded-full opacity-60" />
            {model.layers.map((layer, lIdx) => (
                <div 
                  key={lIdx} 
                  className="absolute pointer-events-none" 
                  style={{ 
                    width: fullSize, 
                    height: fullSize, 
                    left: '50%', top: '50%', 
                    // Centering calculation: Center the 20x20 grid on the hitbox div, 
                    // then apply pixelOffsetX/Y to align the actual model content with the center point.
                    transform: `translate(-50%, -50%) translate(${pixelOffsetX}px, ${pixelOffsetY}px) translateZ(${lIdx * itemLayerGap}px)`,
                    transformStyle: 'preserve-3d' 
                  }}
                >
                  <LayerCanvas layer={layer} layerAbove={model.layers[lIdx + 1]} model={model} z={0} isSelected={isSelected} />
                </div>
            ))}
          </div>
      ) : (
          <div className="w-full h-full flex items-center justify-center relative" style={{ transformStyle: 'preserve-3d' }}>
              <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `rotateZ(${-rotation - itemRot}deg) rotateX(-60deg) translateY(-50%)`, transformOrigin: 'bottom center', backfaceVisibility: 'hidden' }}>
                  {item.photo ? (
                      <div className="p-1 bg-white rounded-xl shadow-lg border border-slate-700"><img src={item.photo} alt={item.name} className="w-16 h-16 object-cover rounded-lg" /></div>
                  ) : (
                      <div className="text-4xl filter drop-shadow-xl select-none">{item.emoji}</div>
                  )}
              </div>
              <div className="absolute inset-2 bg-black/40 blur-md rounded-full transform translate-z-[-1px]" />
          </div>
      )}
    </div>
  );
};

const LayerCanvas: React.FC<{ layer: VoxelLayer, layerAbove?: VoxelLayer, model: VoxelModel, z: number, isSelected: boolean }> = ({ layer, layerAbove, model, z }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, model.gridSize, model.gridSize);
    layer.rows.forEach((row: string, rIdx: number) => {
      for (let cIdx = 0; cIdx < row.length; cIdx++) {
        const char = row[cIdx];
        const color = model.palette[char];
        if (char !== '.' && color) {
          ctx.fillStyle = color;
          ctx.fillRect(cIdx, rIdx, 1, 1);
          if (layerAbove) {
              const aboveRow = layerAbove.rows[rIdx - 1];
              if (aboveRow) {
                  const charAbove = aboveRow[cIdx - 1];
                  if (charAbove && charAbove !== '.') { ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.fillRect(cIdx, rIdx, 1, 1); }
              }
          }
        }
      }
    });
  }, [layer, layerAbove, model]);
  return <canvas ref={canvasRef} width={model.gridSize} height={model.gridSize} className="absolute inset-0 w-full h-full image-rendering-pixelated" style={{ transform: `translateZ(${z}px)`, backfaceVisibility: 'hidden' }} />;
};