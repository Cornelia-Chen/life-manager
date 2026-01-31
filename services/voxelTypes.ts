
export interface VoxelLayer {
  rows: string[]; // Array of strings representing rows, e.g. "..."
}

export interface VoxelModel {
  name: string;
  gridSize: number;
  layerCount: number;
  palette: Record<string, string>; // char -> hex color
  layers: VoxelLayer[];
}

export interface BlueprintRecord {
  id: string;
  name: string;
  timestamp: number;
  thumbnail: string;
  model: VoxelModel;
}
