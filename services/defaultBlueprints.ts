
import { VoxelModel } from './voxelTypes';
import { sofa } from './blueprints/sofa';
import { classicalLamp } from './blueprints/classicalLamp';
import { standardBed } from './blueprints/standardBed';
import { bedsideTable } from './blueprints/bedsideTable';
import { studyDesk } from './blueprints/studyDesk';
import { showerBathtub } from './blueprints/showerBathtub';
import { simpleToilet } from './blueprints/simpleToilet'; 
import { chair } from './blueprints/chair'; 
import { openWardrobe } from './blueprints/openWardrobe';
import { luxuryKitchenSuite } from './blueprints/luxuryKitchenSuite';
import { modernRefrigerator } from './blueprints/modernRefrigerator';
import { bathroomVanity } from './blueprints/bathroomVanity';
import { minimalistFourDoorWardrobe } from './blueprints/minimalistFourDoorWardrobe';
import { modernTVStand } from './blueprints/modernTVStand';
import { minimalistTV } from './blueprints/minimalistTV';
import { angelLabubu } from './blueprints/angelLabubu';

export const DEFAULT_BLUEPRINTS: VoxelModel[] = 
[
  sofa as unknown as VoxelModel,
  classicalLamp as unknown as VoxelModel,
  standardBed as unknown as VoxelModel,
  bedsideTable as unknown as VoxelModel,
  studyDesk as unknown as VoxelModel,
  showerBathtub as unknown as VoxelModel,
  simpleToilet as unknown as VoxelModel,
  chair as unknown as VoxelModel,
  openWardrobe as unknown as VoxelModel,
  luxuryKitchenSuite as unknown as VoxelModel,
  modernRefrigerator as unknown as VoxelModel,
  minimalistFourDoorWardrobe as unknown as VoxelModel,
  modernTVStand as unknown as VoxelModel,
  minimalistTV as unknown as VoxelModel,
  angelLabubu as unknown as VoxelModel,
  bathroomVanity as unknown as VoxelModel
];
