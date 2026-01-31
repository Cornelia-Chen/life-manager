import { VoxelModel } from '../voxelTypes';

export const angelLabubu: VoxelModel = {
  "name": "Angel Labubu",
  "gridSize": 20,
  "layerCount": 20,
  "palette": {
    "B": "#8B4513", // 棕色毛髮
    "W": "#FFFFFF", // 白色翅膀/牙齒
    "E": "#000000", // 眼睛
    "P": "#FFC0CB", // 粉色臉部細節
    "Y": "#FFD700"  // 天使光環
  },
  "layers": [
    // Layer 0-5: 身體與底部毛髮
    ...Array(6).fill({
      "rows":[
        "....................",
        "....................",
        ".......BBBBBB.......",
        "......BBBBBBBB......",
        "...WWWBBBBBBBBWWW...", // WW 是翅膀底部
        "....WWBBBBBBBBWW....",
        "......BBBBBBBB......",
        "...................."
      ]
    }),
    // Layer 6-15: 頭部、招牌尖牙與翅膀
    ...Array(5).fill({
      "rows":[
        "....................",
        ".....BBBBBBBBBB.....",
        "....BBBBBBBBBBBB....",
        "...BBWWBBEBBWWBB...", // E 眼睛, W 牙齒/翅膀
        "...BBWWBBEBBWWBB...",
        "....BBBBBBBBBBBB....",
        ".....BWBEBBEWBB.....",
        "...................."
      ]
    }),
    ...Array(3).fill({
      "rows":[
        "....................",
        ".....BBBBBBBBBB.....",
        "....BBBBBBBBBBBB....",
        "...BBBBBBBBBBBBBB...", // E 眼睛, W 牙齒/翅膀
        "...BBBBBBBBBBBBBB...",
        "....BBBBBBBBBBBB....",
        ".....BBEEBBEEBB.....",
        "...................."
      ]
    }),
    // Layer 16-19: 長耳朵
    ...Array(4).fill({
      "rows":[
        "....................",
        "....BB......BB......",
        "....BB......BB......",
        "....................",
        "...................."
      ]
    }),
    // Layer 20: 天使光環
    {
      "rows":[
        "....................",
        ".....YYYYYYYYYY.....",
        ".....Y........Y.....",
        ".....YYYYYYYYYY.....",
        "...................."
      ]
    }
  ]
};