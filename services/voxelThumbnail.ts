
import { VoxelModel } from './voxelTypes';

export const generateVoxelThumbnail = (model: VoxelModel): Promise<string> => {
  return new Promise((resolve) => {
    // Basic validation
    if (!model || !model.layers) {
        resolve('');
        return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      resolve('');
      return;
    }

    const size = 300; 
    const padding = 40; // Pixels padding
    canvas.width = size;
    canvas.height = size;

    const gridSize = model.gridSize || 20;
    
    // Abstract units for projection calculation
    // These define the aspect ratio of the voxels
    const UNIT_W = 14; 
    const UNIT_H = 8;
    const UNIT_Z = 12; // Height of one voxel layer in pixels

    // --- STEP 1: Calculate Bounding Box ---
    // We simulate the projection of every single active voxel to find the min/max limits
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let hasVoxels = false;

    model.layers.forEach((layer, z) => {
        if (!layer || !layer.rows) return;
        for (let r = 0; r < gridSize; r++) { 
            const rowStr = layer.rows[r];
            if (!rowStr) continue;
            for (let c = 0; c < gridSize; c++) { 
                if (rowStr[c] !== '.') {
                    hasVoxels = true;
                    // Project center of this voxel (relative to 0,0)
                    // Isometric formula: x = (col - row), y = (col + row)
                    const px = (c - r) * UNIT_W;
                    const py = (c + r) * UNIT_H - (z * UNIT_Z);

                    // Determine extent of this voxel's drawing
                    // Based on the drawing paths below:
                    // Leftmost point: px - UNIT_W
                    // Rightmost point: px + UNIT_W
                    // Topmost point: py - UNIT_H * 2 (Top face tip)
                    // Bottommost point: py + UNIT_Z (Bottom of side faces) -- actually slightly more due to perspective
                    
                    if (px - UNIT_W < minX) minX = px - UNIT_W;
                    if (px + UNIT_W > maxX) maxX = px + UNIT_W;
                    if (py - UNIT_H * 2 < minY) minY = py - UNIT_H * 2;
                    if (py + UNIT_Z > maxY) maxY = py + UNIT_Z;
                }
            }
        }
    });

    // Handle empty models
    if (!hasVoxels) {
        resolve('');
        return;
    }

    // --- STEP 2: Calculate Auto-Scale and Center Offset ---
    
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    // Available space
    const availW = size - padding * 2;
    const availH = size - padding * 2;

    // Scale to fit
    const scaleX = availW / contentWidth;
    const scaleY = availH / contentHeight;
    const scale = Math.min(scaleX, scaleY); // Keep aspect ratio, fit within bounds

    // Calculate centering offsets
    // We want (minX * scale) + offsetX = padding + (availW - contentWidth * scale) / 2
    // Simplified: Center the bounding box in the canvas
    const offsetX = (size - contentWidth * scale) / 2 - minX * scale;
    const offsetY = (size - contentHeight * scale) / 2 - minY * scale;

    // --- STEP 3: Draw ---

    // Helper for color shading
    const shade = (hex: string, percent: number) => {
        if (!hex) return "#000000";
        const f = parseInt(hex.slice(1), 16),
              t = percent < 0 ? 0 : 255,
              p = percent < 0 ? percent * -1 : percent,
              R = f >> 16,
              G = f >> 8 & 0x00FF,
              B = f & 0x0000FF;
        return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
    };

    ctx.clearRect(0, 0, size, size);

    // Apply scaling and centering transform globally or per-coordinate
    // Doing per-coordinate allows for crisp lines if we Math.round, but global is easier
    
    // Draw order: Bottom-up, Back-to-Front
    model.layers.forEach((layer, z) => {
        if (!layer || !layer.rows) return;

        for (let r = 0; r < gridSize; r++) { 
            const rowStr = layer.rows[r];
            if (!rowStr) continue;

            for (let c = 0; c < gridSize; c++) { 
                const char = rowStr[c];
                const color = model.palette[char];
                
                if (char !== '.' && color) {
                    // Raw coordinates
                    const rawX = (c - r) * UNIT_W;
                    const rawY = (c + r) * UNIT_H - (z * UNIT_Z);

                    // Transformed coordinates
                    const posX = rawX * scale + offsetX;
                    const posY = rawY * scale + offsetY;
                    
                    // Scaled dimensions
                    const sTW = UNIT_W * scale;
                    const sTH = UNIT_H * scale;
                    const sLZ = UNIT_Z * scale;

                    // Draw Cube Faces
                    
                    // Top Face (Main Color) - Brightest
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.moveTo(posX, posY - sTH * 2); 
                    ctx.lineTo(posX + sTW, posY - sTH);
                    ctx.lineTo(posX, posY);
                    ctx.lineTo(posX - sTW, posY - sTH);
                    ctx.closePath();
                    ctx.fill();
                    
                    // Right Face (Darker) - Side
                    ctx.fillStyle = shade(color, -0.15);
                    ctx.beginPath();
                    ctx.moveTo(posX + sTW, posY - sTH);
                    ctx.lineTo(posX + sTW, posY - sTH + sLZ); 
                    ctx.lineTo(posX, posY + sLZ);
                    ctx.lineTo(posX, posY);
                    ctx.closePath();
                    ctx.fill();
                    
                    // Left Face (Darkest) - Front/Side
                    ctx.fillStyle = shade(color, -0.3);
                    ctx.beginPath();
                    ctx.moveTo(posX - sTW, posY - sTH);
                    ctx.lineTo(posX - sTW, posY - sTH + sLZ); 
                    ctx.lineTo(posX, posY + sLZ);
                    ctx.lineTo(posX, posY);
                    ctx.closePath();
                    ctx.fill();
                    
                    // Edge Highlight (Subtle)
                    ctx.fillStyle = "rgba(255,255,255,0.1)";
                    ctx.beginPath();
                    ctx.moveTo(posX - sTW, posY - sTH);
                    ctx.lineTo(posX, posY - sTH * 2);
                    ctx.lineTo(posX + sTW, posY - sTH);
                    ctx.lineTo(posX, posY - sTH); 
                    ctx.closePath();
                    ctx.fill();
                }
            }
        }
    });

    resolve(canvas.toDataURL('image/png'));
  });
};
