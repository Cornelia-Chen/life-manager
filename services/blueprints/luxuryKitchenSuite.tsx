import { VoxelModel } from '../voxelTypes';

export const luxuryKitchenSuite: VoxelModel = {
  "name": "Luxury Integrated Kitchen Suite",
  "gridSize": 30, // 增加網格尺寸以容納更多設備
  "layerCount": 40,
  "palette": {
    "W": "#FFFFFF", // 白色櫃體/冰箱
    "M": "#F0F0F0", // 檯面色
    "S": "#333333", // 煤氣灶/深色細節
    "K": "#000000", // 爐架
    "P": "#C0C0C0", // 不鏽鋼水池
    "T": "#E0E0E0", // 水龍頭
    "H": "#808080", // 抽油煙機
    "G": "#ADD8E6", // 吊櫃玻璃
    "R": "#DCDCDC", // 冰箱門縫/手把
    "B": "#0099FF"  // 火焰藍
    "F": "#FF4500", // 火焰橙色
  },
  "layers": [
    // Layer 0-14: 底層地櫃與冰箱主體
    ...Array(15).fill({
      "rows":[
        "...............................",
        "...............................",
        "..MMMMMMMMMMMMMMMMMMMMWWWWWWWW.",
        "..M     M      M      MW  WWWW.", // 概念示意
        "..MMMMMMMMMMMMMMMMMMMMWWWWWWWW.",
        "..M     M      M      MW  WWWW.",
        "..M     M      M      MW  WWWW.",
        "..M     M      M      MW  WWWW.",
        "..M     M      M      MW  WWWW.",
        "..MMMMMMMMMMMMMMMMMMMMWWWWWWWW.",
        ".............................."
      ]
    }),
    // Layer 15: 檯面層 (左櫃檯 | 中爐灶 | 右水池 | 冰箱繼續向上)
    {"rows":[
      "...............................",
      "...............................",
      "..MMMMMMKKKKK PPPPP MMWWWWWWWW.", // P為水池位，末尾W是冰箱
      "..MMMMMMKFKFK P   P MMWWWWWWWW.",
      "..MMMMMMKKKKK P   P MMWWWWWW.",
      "..MMMMMMKFKFK P   P MMWWWWWWWW.",
      "..MMMMMMKKKKK PPPPP MMWWWWWWWW.",
      "..MMMMMMMMMMMMMMMMM MMWWWWWWWW.",
      "................... ..WWWWWWWW.",
      "................... ......RR..."
    ]},
    // Layer 16-30: 中段 (水龍頭高度與冰箱上半部)
    ...Array(10).fill({
      "rows":[
        "...............................",
        "...............................",
        "................T... WWWWWWWW.", // T是水龍頭，W是冰箱
        "................T... WWWWWWWW.",
        ".................... WWWWWWWW.", // RR 是冰箱門縫線
        ".................... WWWWWWWW.",
        ".................... WWWWWWWW.",
        ".................... WWWWWWWW.",
        ".................... WWWWWWWW.",
        "..................... ...RR..."
      ]
    }),
    // Layer 31-40: 頂部 (吊櫃 | 抽油煙機 | 吊櫃 | 冰箱頂部)
    ...Array(15).fill({
      "rows":[
        "..............................",
        "..............................",
        "...... HHHHH ....... WWWWWWWW.", // H為煙機
        "... HHHHHHHHHHH .... WWWWWWWW.", // G為玻璃吊櫃
        "... HHHHHHHHHHH .... WWWWWWWW.",
        "...... HHHHH ....... WWWWWWWW.",
        ".................... WWWWWWWW.",
        ".................... WWWWWWWW.",
        ".................... WWWWWWWW.",
        "..................... ...RR..."
      ]
    })
  ]
};