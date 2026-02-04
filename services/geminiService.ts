import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { VoxelModel } from "./voxelTypes";

export type LanguageCode = 'zh-CN' | 'en' | 'fr' | 'ja' | 'es';
export type RoomType = 'kitchen' | 'living' | 'bedroom' | 'bathroom' | 'balcony' | 'storage' | 'cloakroom';
export const ALL_ROOMS: RoomType[] = ['kitchen', 'living', 'bedroom', 'bathroom', 'balcony', 'storage', 'cloakroom'];

export const ROOM_CENTERS: Record<RoomType, { x: number; y: number }> = {
  bedroom: { x: 9, y: 11 },
  cloakroom: { x: 19, y: 11 },
  bathroom: { x: 30, y: 10 },
  balcony: { x: 42, y: 10 },
  kitchen: { x: 9, y: 29 },
  storage: { x: 9, y: 41 },
  living: { x: 32, y: 34 }
};

export type AlertType = 'none' | 'quantity' | 'date';
export type Personality = 'strict' | 'gentle' | 'witty' | 'robotic';

// Config constants
const PRIMARY_MODEL = "gemini-3-flash-preview"; 
const BACKUP_MODEL = "gemini-flash-lite-latest"; 

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * Core request wrapper with auto-retry and model fallback
 */
async function safeGenAIRequest(
  promptParts: any[], 
  config: any = {}, 
  systemInstruction?: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelsToTry = [PRIMARY_MODEL, BACKUP_MODEL];
  
  for (const modelName of modelsToTry) {
    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: { role: 'user', parts: promptParts },
          config: {
            ...config,
            systemInstruction: systemInstruction
          }
        });

        const text = response.text || "";
        // Clean up potential markdown blocks
        return text.replace(/```json/g, "").replace(/```/g, "").trim();
      } catch (error: any) {
        const isQuotaError = error.message?.includes('429') || error.message?.includes('quota');
        if (isQuotaError && retries < maxRetries) {
          retries++;
          await sleep(Math.pow(2, retries) * 1000);
          continue;
        }
        break; 
      }
    }
  }
  throw new Error("AI services currently at capacity.");
}

export interface ConsumptionConfig { isEnabled: boolean; amount: number; frequency: 'day' | 'week' | 'month' | 'year'; lastCalculated: number; }
export interface PurchaseRecord { timestamp: number; quantity: number; unitPrice: number; }
export interface ReceiptItem { id: string; originalItemId?: string; name: string; translatedName: string; emoji: string; unit: string; assignedRoom: RoomType; history: PurchaseRecord[]; currentQuantity: number; photo?: string; voxelModel?: VoxelModel; alertType?: AlertType; lowStockThreshold?: number; expirationDate?: number; consumption?: ConsumptionConfig; showOnMap?: boolean; position?: { x: number; y: number }; rotation?: number; scale?: number; heightScale?: number; elevation?: number; sellerName?: string; priceTag?: number; description?: string; isPublic?: boolean; marketStatus?: 'selling' | 'sold'; category?: string; }
export interface OCRResult { items: Partial<ReceiptItem & { price: number; quantity: number; consumptionRate?: number; consumptionFreq?: string; isSelling?: boolean; askingPrice?: number }>[]; purchaseDate?: string; rawText?: string; fullText?: string; }
export interface TravelConfig { isTravelMode: boolean; startDate?: number; endDate?: number; }
export interface ButlerConfig { name: string; personality: Personality; appearance: { face: string; eyes: string; body: string; outfit: string; customAvatar?: string; scale?: number; }; customPrompt?: string; }
export interface ChatMessage { id: string; sender: 'me' | 'other'; text: string; timestamp: number; aliceHint?: string; }
export interface Recipe { id: string; name: string; emoji?: string; difficulty: 'Easy' | 'Medium' | 'Hard'; description: string; instructions: string[]; ingredientsUsed: { inventoryItemId: string; name: string; quantityToConsume: number; }[]; }
export interface Comment { id: string; author: string; text: string; timestamp: number; likes: number; }
export interface MoodPost { id: string; author: string; avatar: string; content: string; timestamp: number; likes: number; comments: Comment[]; }

export const setTravelModeTool: FunctionDeclaration = { name: 'setTravelMode', description: 'Enable travel mode...', parameters: { type: Type.OBJECT, properties: { startDate: { type: Type.STRING }, endDate: { type: Type.STRING }, isActive: { type: Type.BOOLEAN } }, required: ['isActive'] } };
export const addItemTool: FunctionDeclaration = { name: 'addItemToInventory', description: 'Add item...', parameters: { type: Type.OBJECT, properties: { itemName: { type: Type.STRING } } } };
export const findItemTool: FunctionDeclaration = { name: 'findItemInInventory', description: 'Find item...', parameters: { type: Type.OBJECT, properties: { itemName: { type: Type.STRING } }, required: ['itemName'] } };
export const consumeItemTool: FunctionDeclaration = { name: 'consumeItem', description: 'Mark an item as finished/consumed and auto-calculate consumption speed.', parameters: { type: Type.OBJECT, properties: { itemName: { type: Type.STRING } }, required: ['itemName'] } };

export async function processImageWithAI(base64Data: string, mimeType: string, lang: LanguageCode, currentInventory: ReceiptItem[], mode: 'single' | 'receipt' = 'receipt'): Promise<OCRResult> {
  const isSingle = mode === 'single';
  
  const prompt = isSingle 
    ? `TASK: 
       Identify object. Categorize strictly:
       - "food": Edible raw ingredients or cooked food.
       - "appliance": Fridge, microwave, stove, etc.
       - "household": Bags, cleaning tools, furniture.
       - "medicine": Lozenges, pills, medical supplies.
       - "other": Misc.
       Return JSON:
       {
         "items": [{"name": string, "emoji": string, "quantity": number, "price": number, "unit": string, "assignedRoom": string, "category": string}],
         "purchaseDate": "YYYY-MM-DD"
       }
       Translate names to ${lang}.`
    : `TASK:
       Receipt OCR. Extract ALL items and categorize them:
       - "food": ONLY edible ingredients/food items.
       - "household": Paper towels, plastic bags, soap, etc.
       - "appliance": Kitchen electronics/hardware.
       - "medicine": Medical supplies, throat lozenges.
       - "other": Meta-items or misc.
       IMPORTANT: If an item is a multipack, extract unit count.
       JSON FORMAT:
       {
         "items": [{"name": string, "emoji": string, "quantity": number, "price": number, "unit": string, "category": string}],
         "purchaseDate": "YYYY-MM-DD"
       }
       Translate names to ${lang}.`;

  try {
    const text = await safeGenAIRequest(
      [{ inlineData: { mimeType, data: base64Data } }, { text: prompt }],
      { responseMimeType: 'application/json' }
    );
    const json = JSON.parse(text || "{}");
    const items = (json.items || []).map((i: any) => ({ 
      ...i, 
      translatedName: i.name, 
      emoji: i.emoji || '📦',
      elevation: 0,
      photo: isSingle ? `data:${mimeType};base64,${base64Data}` : undefined
    }));

    return { 
      items, 
      purchaseDate: json.purchaseDate, 
      rawText: text,
      fullText: "" 
    };
  } catch (e: any) { return { items: [], rawText: e.toString() }; }
}

export async function predictEmoji(name: string): Promise<string> {
    try {
        const text = await safeGenAIRequest([{ text: `Return a single emoji for: ${name}` }], { maxOutputTokens: 5 });
        return text?.trim() || '📦';
    } catch { return '📦'; }
}

export async function generateRecipes(inventory: ReceiptItem[], lang: LanguageCode, personality: Personality): Promise<Recipe[]> {
    // Strictly filter for food items and exclude common non-edibles
    const NON_FOOD_KEYWORDS = /冰箱|洗衣机|微波炉|塑料袋|垃圾袋|润喉糖|感冒药|药|柜|架|机/i;
    
    const availableItems = inventory
        .filter(i => {
            const isFoodCategory = i.category === 'food';
            const isNotHardware = !NON_FOOD_KEYWORDS.test(i.translatedName) && !NON_FOOD_KEYWORDS.test(i.name);
            return i.currentQuantity > 0 && isFoodCategory && isNotHardware;
        })
        .map(i => `${i.translatedName} (ID: ${i.id}, Unit: ${i.unit})`)
        .join(', ');
        
    if (!availableItems) return [];

    const prompt = `Task: Suggest 3 creative recipes using ONLY the edible ingredients provided.
    Ingredients available: ${availableItems}
    
    STRICT RULES:
    1. ONLY use items from the list above. 
    2. ABSOLUTELY DO NOT use appliances (fridge, microwave), medicine, or packaging as ingredients.
    3. The 'quantityToConsume' MUST use the EXACT SAME 'Unit' as listed for that ingredient. 
    4. Language: ${lang}.
    5. Personality: ${personality}.
    
    Return JSON: [{ "id": string, "name": string, "emoji": string, "difficulty": "Easy"|"Medium"|"Hard", "description": string, "instructions": string[], "ingredientsUsed": [{ "inventoryItemId": string, "name": string, "quantityToConsume": number }] }]`;
    
    try {
        const text = await safeGenAIRequest([{ text: prompt }], { responseMimeType: 'application/json' });
        return JSON.parse(text || '[]');
    } catch { return []; }
}

export async function generateSaleAd(item: Partial<ReceiptItem>, lang: LanguageCode): Promise<string> {
    try {
        const prompt = `Task: Write a VIVID, COMPLETE and COMPELLING sales ad for "${item.translatedName}".
        Role: A charismatic influencer/professional salesperson.
        Requirements:
        1. Catchy headline with emojis.
        2. Emotional hook.
        3. Tone: Energetic and trustworthy.
        4. Language: ${lang}.
        5. Format: Clean text, NO markdown.`;
        
        return await safeGenAIRequest([{ text: prompt }], { maxOutputTokens: 600, temperature: 0.9 });
    } catch { return "Grab this amazing deal! ✨"; }
}

export async function analyzeHaggling(message: string, basePrice: number, lang: LanguageCode = 'zh-CN'): Promise<string> {
    try {
        return await safeGenAIRequest([{ text: `Analyze buyer message: "${message}". Base: ${basePrice}. Lang: ${lang}. Max 15 words.` }], { maxOutputTokens: 50 });
    } catch { return ""; }
}

const VOXEL_SYSTEM_INSTRUCTION = `You are a precision 3D Voxel Sculptor. 
Your goal is to create objects with accurate silhouettes, meaningful negative space (gaps), and valid structure.

JSON SCHEMA REQUIREMENT:
{
  "name": string,
  "gridSize": number (e.g. 20),
  "layerCount": number,
  "palette": { "CHARACTER": "HEX_COLOR" },
  "layers": [{"rows": [string]}]
}

Rules:
1. "rows" array length must equal "gridSize".
2. Each string in "rows" must have exactly "gridSize" characters.
3. Use "." for empty cells.
4. Layers index 0 is the BASE (bottom).`;

export async function generateVoxelModel(prompt: string, gridSize: number, layerCount: number, symmetry: boolean, axialSymmetry: boolean, imageBase64?: string): Promise<VoxelModel> {
  const userPrompt = `Task: Create a 3D voxel model for "${prompt}". 
  Configuration:
  - Grid Size: ${gridSize}x${gridSize}
  - Target Layers: ${layerCount}
  - Symmetry: ${symmetry ? 'Bilateral' : 'None'}
  
  Furniture must have hollow spaces and accurate legs. Do not fill everything.`;

  const parts: any[] = [{ text: userPrompt }];
  if (imageBase64) parts.unshift({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });

  try {
    const text = await safeGenAIRequest(
      parts, 
      { 
        responseMimeType: 'application/json', 
        maxOutputTokens: 65536,
        thinkingConfig: { thinkingBudget: 8192 } 
      }, 
      VOXEL_SYSTEM_INSTRUCTION
    );
    const model = JSON.parse(text) as VoxelModel;
    if (!model.layers || !Array.isArray(model.layers)) throw new Error("Missing layers");
    return model;
  } catch (e) {
    console.error("Voxel Parsing Failed", e);
    return { 
      name: "Fallback Object", 
      gridSize, 
      layerCount: 1, 
      palette: { "E": "#cccccc" }, 
      layers: [{ rows: Array(gridSize).fill(".".repeat(gridSize)) }] 
    };
  }
}

export async function refineVoxelModel(currentModel: VoxelModel, feedback: string): Promise<VoxelModel> {
    const userPrompt = `Refine this voxel model: "${feedback}".
    Data: ${JSON.stringify(currentModel)}`;
    try {
        const text = await safeGenAIRequest(
          [{ text: userPrompt }], 
          { 
            responseMimeType: 'application/json', 
            maxOutputTokens: 65536,
            thinkingConfig: { thinkingBudget: 4096 }
          }, 
          VOXEL_SYSTEM_INSTRUCTION
    );
        return JSON.parse(text) as VoxelModel;
    } catch {
        return currentModel;
    }
}
