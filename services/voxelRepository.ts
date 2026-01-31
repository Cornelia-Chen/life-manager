
import { BlueprintRecord, VoxelModel } from './voxelTypes';
import { DEFAULT_BLUEPRINTS } from './defaultBlueprints';
import { generateVoxelThumbnail } from './voxelThumbnail';

const DB_NAME = 'VoxelForgeDB';
const STORE_NAME = 'blueprints';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveBlueprint = async (model: VoxelModel, thumbnail: string): Promise<void> => {
  const db = await openDB();
  
  // If thumbnail is missing, generate it on the fly
  const finalThumbnail = thumbnail || await generateVoxelThumbnail(model);

  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  
  const record: BlueprintRecord = {
    id: Date.now().toString() + Math.random().toString().slice(2, 5),
    name: model.name,
    timestamp: Date.now(),
    thumbnail: finalThumbnail,
    model
  };
  
  store.put(record);
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve();
  });
};

export const getAllBlueprints = async (): Promise<BlueprintRecord[]> => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();
  
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deleteBlueprint = async (id: string): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.delete(id);
  
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve();
  });
};

// Module-level flag
let isInitializing = false;

export const initializeRepository = async (): Promise<void> => {
  if (isInitializing) return;
  isInitializing = true;

  try {
    const existing = await getAllBlueprints();
    
    // 1. Deduplicate (Clean up previous runs)
    const nameMap = new Map<string, string[]>();
    const duplicatesToDelete: string[] = [];

    existing.forEach(bp => {
        if (!nameMap.has(bp.name)) {
            nameMap.set(bp.name, [bp.id]);
        } else {
            nameMap.get(bp.name)?.push(bp.id);
        }
    });

    nameMap.forEach((ids) => {
        if (ids.length > 1) {
            for (let i = 1; i < ids.length; i++) {
                duplicatesToDelete.push(ids[i]);
            }
        }
    });

    if (duplicatesToDelete.length > 0) {
        for (const id of duplicatesToDelete) {
            await deleteBlueprint(id);
        }
    }

    // 2. Fix/Update Defaults (Force regeneration to apply new thumbnail logic)
    const validExisting = existing.filter(e => !duplicatesToDelete.includes(e.id));
    
    for (const record of validExisting) {
        const isDefault = DEFAULT_BLUEPRINTS.some(d => d.name === record.name);
        
        // Force update if it is a default item, to ensure they get the new scaled thumbnails
        if (isDefault) {
             console.log(`🎨 Updating thumbnail for: ${record.name}`);
             const thumb = await generateVoxelThumbnail(record.model);
             
             // Update in DB
             const db = await openDB();
             const tx = db.transaction(STORE_NAME, 'readwrite');
             const store = tx.objectStore(STORE_NAME);
             store.put({ ...record, thumbnail: thumb });
             await new Promise(r => { tx.oncomplete = () => r(null); });
        }
    }

    // 3. Seed missing defaults
    const finalNames = new Set(validExisting.map(e => e.name));

    for (const model of DEFAULT_BLUEPRINTS) {
      if (!finalNames.has(model.name)) {
        console.log(`📦 Seeding blueprint: ${model.name}`);
        // Let saveBlueprint handle thumbnail generation
        await saveBlueprint(model, ''); 
      }
    }
    
  } catch (error) {
    console.error('Failed to seed blueprints:', error);
  } finally {
      setTimeout(() => { isInitializing = false; }, 2000); 
  }
};
