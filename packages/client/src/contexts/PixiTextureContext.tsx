/**
 * PixiTextureContext - Shared PixiJS texture management
 *
 * Preloads all card/unit sprite sheets via PixiJS Assets system during app init.
 * PixiJS Assets.load() properly handles GPU texture upload, unlike DOM/CSS approaches.
 *
 * This context provides:
 * 1. Preloaded textures ready for instant rendering
 * 2. Helper functions to get sub-textures from sprite sheets
 * 3. Loading state for components to wait on
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { Assets, Texture, Rectangle } from "pixi.js";

// Sprite sheet definitions matching atlas.json
const SPRITE_SHEETS = {
  basic_actions: {
    url: "/assets/atlas/cards/basic_actions.jpg",
    spriteWidth: 1000,
    spriteHeight: 1400,
    cols: 7,
    rows: 4,
  },
  advanced_actions: {
    url: "/assets/atlas/cards/advanced_actions.jpg",
    spriteWidth: 1000,
    spriteHeight: 1400,
    cols: 8,
    rows: 6,
  },
  spells: {
    url: "/assets/atlas/cards/spells.jpg",
    spriteWidth: 1000,
    spriteHeight: 1400,
    cols: 6,
    rows: 4,
  },
  artifacts: {
    url: "/assets/atlas/cards/artifacts.jpg",
    spriteWidth: 1000,
    spriteHeight: 1400,
    cols: 5,
    rows: 5,
  },
  wound: {
    url: "/assets/atlas/cards/wound.jpg",
    spriteWidth: 1000,
    spriteHeight: 1400,
    cols: 1,
    rows: 1,
  },
  units_regular: {
    url: "/assets/atlas/units/units_regular.jpg",
    spriteWidth: 1000,
    spriteHeight: 1400,
    cols: 4,
    rows: 4,
  },
  units_elite: {
    url: "/assets/atlas/units/units_elite.jpg",
    spriteWidth: 1000,
    spriteHeight: 1400,
    cols: 4,
    rows: 4,
  },
  tactics: {
    url: "/assets/atlas/tactics/tactics_spritesheet.png",
    spriteWidth: 1000,
    spriteHeight: 1400,
    cols: 6,
    rows: 2,
  },
} as const;

type SheetName = keyof typeof SPRITE_SHEETS;

interface PixiTextureContextValue {
  /** Whether all textures have been loaded */
  isLoaded: boolean;
  /** Get a texture for a specific sprite position */
  getTexture: (sheet: SheetName, col: number, row: number) => Texture | null;
  /** Get the base texture for a sheet (for custom frame creation) */
  getSheetTexture: (sheet: SheetName) => Texture | null;
}

const PixiTextureContext = createContext<PixiTextureContextValue | null>(null);

// Cache of sub-textures to avoid recreating them
const textureCache = new Map<string, Texture>();

// Loaded base textures
const loadedTextures = new Map<SheetName, Texture>();

/**
 * Load all sprite sheet textures via PixiJS Assets
 */
async function loadAllTextures(): Promise<void> {
  const startTime = performance.now();

  // Load all sheets in parallel
  const entries = Object.entries(SPRITE_SHEETS) as [SheetName, typeof SPRITE_SHEETS[SheetName]][];

  await Promise.all(
    entries.map(async ([name, sheet]) => {
      try {
        const texture = await Assets.load(sheet.url);
        loadedTextures.set(name, texture);
      } catch (error) {
        console.warn(`Failed to load sprite sheet: ${name}`, error);
      }
    })
  );

  const elapsed = performance.now() - startTime;
  console.log(`[PixiTextureContext] Loaded ${loadedTextures.size} sprite sheets in ${elapsed.toFixed(0)}ms`);
}

/**
 * Get or create a sub-texture for a specific sprite position
 */
function getTexture(sheet: SheetName, col: number, row: number): Texture | null {
  const cacheKey = `${sheet}:${col}:${row}`;

  // Return cached texture if available
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  // Get base texture
  const baseTexture = loadedTextures.get(sheet);
  if (!baseTexture) return null;

  // Get sheet dimensions
  const sheetDef = SPRITE_SHEETS[sheet];

  // Create sub-texture with frame
  const frame = new Rectangle(
    col * sheetDef.spriteWidth,
    row * sheetDef.spriteHeight,
    sheetDef.spriteWidth,
    sheetDef.spriteHeight
  );

  const subTexture = new Texture({
    source: baseTexture.source,
    frame,
  });

  // Cache it
  textureCache.set(cacheKey, subTexture);

  return subTexture;
}

function getSheetTexture(sheet: SheetName): Texture | null {
  return loadedTextures.get(sheet) ?? null;
}

interface PixiTextureProviderProps {
  children: ReactNode;
}

export function PixiTextureProvider({ children }: PixiTextureProviderProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadAllTextures().then(() => setIsLoaded(true));
  }, []);

  const value: PixiTextureContextValue = {
    isLoaded,
    getTexture,
    getSheetTexture,
  };

  return (
    <PixiTextureContext.Provider value={value}>
      {children}
    </PixiTextureContext.Provider>
  );
}

export function usePixiTextures(): PixiTextureContextValue {
  const context = useContext(PixiTextureContext);
  if (!context) {
    throw new Error("usePixiTextures must be used within PixiTextureProvider");
  }
  return context;
}
