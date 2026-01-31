import { VoxelModel } from '../voxelTypes';

export const openWardrobe: VoxelModel = {
  "name": "Open Concept Shelving Wardrobe",
  "gridSize": 30,
  "layerCount": 40,
  "palette": {
    "W": "#FFFFFF", // 白色框架
    "T": "#C19A6B", // 木紋色（隔板與抽屜）
    "S": "#C0C0C0", // 銀色掛衣桿
    "D": "#A52A2A", // 衣服/裝飾品點綴色
    "K": "#333333"  // 底部踢腳線
  },
  "layers": [
    // Layer 0: 底部踢腳線
    {"rows":[
      "..............................",
      "..KKKKKKKKKKKKKKKKKKKKKKKKKK..",
      "..KKKKKKKKKKKKKKKKKKKKKKKKKK..",
      "..KKKKKKKKKKKKKKKKKKKKKKKKKK..",
      ".............................."
    ]},
    // Layer 1-8: 底部抽屜與格子區
    ...Array(8).fill({
      "rows":[
        "..............................", // T 是木質抽屜
        "..W  TTTT  W  TTTT  W  TTTT  W..",
        "..W  TTTT  W  TTTT  W  TTTT  W..",
        "..WWWWWWWWWWWWWWWWWWWWWWWWWW..",
        ".............................."
      ]
    }),
    // Layer 9: 中間第一層大隔板
    {"rows":[
      "..............................",
      "..WWTTTTTTWWTTTTTTWWTTTTTTWW..",
      "..WWTTTTTTWWTTTTTTWWTTTTTTWW..",
      "..WWWWWWWWWWWWWWWWWWWWWWWWWW..",
      ".............................."
    ]},
    // Layer 10-28: 掛衣區 (包含掛衣桿 S)
    ...Array(19).fill({
      "rows":[
        "..............................",
        "..W      W      W      W    W..",
        "..W      W      W      W    W..",
        ".....SSSSSSSSSSSSSSSSSSSS.....", // S 是貫穿的掛衣桿
        ".............................."
      ]
    }),
    // Layer 29: 頂部儲物隔板
    {"rows":[
      "..............................",
      "..WWTTTTTTWWTTTTTTWWTTTTTTWW..",
      "..WWTTTTTTWWTTTTTTWWTTTTTTWW..",
      "..WWWWWWWWWWWWWWWWWWWWWWWWWW..",
      ".............................."
    ]},
    // Layer 30-38: 頂部格子區 (放被子或箱子)
    ...Array(9).fill({
      "rows":[
        "..............................",
        "..W  DD  W  DD  W  DD  W    W..", // D 模擬箱子或衣服
        "..W  DD  W  DD  W  DD  W    W..",
        "..WWWWWWWWWWWWWWWWWWWWWWWWWW..",
        ".............................."
      ]
    }),
    // Layer 39: 衣櫃封頂
    {"rows":[
      "..............................",
      "..WWWWWWWWWWWWWWWWWWWWWWWWWW..",
      "..WWWWWWWWWWWWWWWWWWWWWWWWWW..",
      "..WWWWWWWWWWWWWWWWWWWWWWWWWW..",
      ".............................."
    ]}
  ]
};