/**
 * Centralized PixiJS texture loading and caching utility
 *
 * This module provides:
 * - Unified texture cache across all components
 * - Proper texture disposal to prevent VRAM leaks
 * - Single placeholder texture shared across the app
 * - Atlas data loading and caching
 *
 * Usage:
 *   import { getCardTexture, getUnitTexture, disposeAllTextures } from './pixiTextureLoader';
 *
 *   // Load a texture (cached automatically)
 *   const texture = await getCardTexture(cardId);
 *
 *   // Clean up on unmount
 *   disposeAllTextures();
 */

import { Texture, Rectangle, Assets } from "pixi.js";
import type { CardId, UnitId, TacticId } from "@mage-knight/shared";
import { getCardSpriteData, getUnitSpriteData, getTacticSpriteData, type SpriteData } from "./cardAtlas";

// ============================================================================
// Types
// ============================================================================

export type TextureType = "card" | "unit" | "spell" | "aa";

interface AtlasSheet {
  file: string;
  width: number;
  height: number;
}

interface AtlasSprite {
  sheet: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AtlasData {
  sheets: Record<string, AtlasSheet>;
  sprites: Record<string, AtlasSprite>;
}

// ============================================================================
// Module State
// ============================================================================

// Unified texture cache - shared across all components
const textureCache = new Map<string, Texture>();

// Track in-flight loading promises to avoid duplicate loads
const loadingTextures = new Map<string, Promise<Texture>>();

// Placeholder texture (created lazily, shared across all components)
let placeholderTexture: Texture | null = null;
let placeholderCanvas: HTMLCanvasElement | null = null;

// Atlas data cache (for PixiCardCanvas which uses atlas.json directly)
let atlasData: AtlasData | null = null;
let atlasLoadPromise: Promise<AtlasData> | null = null;

// ============================================================================
// Placeholder Texture
// ============================================================================

/**
 * Get or create the shared placeholder texture.
 * This texture is used when a card/unit texture fails to load.
 */
export function getPlaceholderTexture(): Texture {
  if (!placeholderTexture) {
    placeholderCanvas = document.createElement("canvas");
    placeholderCanvas.width = 200;
    placeholderCanvas.height = 300;
    const ctx = placeholderCanvas.getContext("2d");
    if (ctx) {
      // Dark background
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, 200, 300);
      // Border
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 2;
      ctx.strokeRect(4, 4, 192, 292);
      // Loading text
      ctx.fillStyle = "#444";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Loading...", 100, 150);
    }
    placeholderTexture = Texture.from(placeholderCanvas);
  }
  return placeholderTexture;
}

// ============================================================================
// Atlas Loading (for PixiCardCanvas)
// ============================================================================

/**
 * Load atlas.json data (used by PixiCardCanvas for direct atlas lookups).
 * Cached after first load.
 */
export async function loadAtlasData(): Promise<AtlasData> {
  if (atlasData) return atlasData;
  if (atlasLoadPromise) return atlasLoadPromise;

  atlasLoadPromise = fetch("/assets/atlas.json")
    .then((res) => res.json())
    .then((data: AtlasData) => {
      atlasData = data;
      return data;
    });

  return atlasLoadPromise;
}

// ============================================================================
// Texture Loading - Atlas Based (PixiCardCanvas style)
// ============================================================================

/**
 * Get a texture for a card using direct atlas.json lookup.
 * Used by PixiCardCanvas which stores sprite coordinates in atlas.json.
 */
export async function getCardTextureFromAtlas(cardId: string): Promise<Texture | null> {
  const cacheKey = `atlas:${cardId}`;

  // Check cache first
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  // Check if already loading
  const loading = loadingTextures.get(cacheKey);
  if (loading) return loading;

  // Load atlas data
  const atlas = await loadAtlasData();

  // Find sprite in atlas
  const sprite = atlas.sprites[cardId];
  if (!sprite) {
    console.warn(`[pixiTextureLoader] Card not found in atlas: ${cardId}`);
    return null;
  }

  // Get sheet info
  const sheet = atlas.sheets[sprite.sheet];
  if (!sheet) {
    console.warn(`[pixiTextureLoader] Sheet not found: ${sprite.sheet}`);
    return null;
  }

  // Load or get base texture
  const sheetUrl = `/assets/${sheet.file}`;
  const loadPromise = (async () => {
    const baseTexture = await Assets.load(sheetUrl);

    // Create sub-texture with frame
    const frame = new Rectangle(sprite.x, sprite.y, sprite.width, sprite.height);
    const subTexture = new Texture({
      source: baseTexture.source,
      frame,
    });

    textureCache.set(cacheKey, subTexture);
    loadingTextures.delete(cacheKey);

    return subTexture;
  })();

  loadingTextures.set(cacheKey, loadPromise);
  return loadPromise;
}

// ============================================================================
// Texture Loading - SpriteData Based (PixiFloatingHand/PixiOfferCards style)
// ============================================================================

/**
 * Create a texture from SpriteData (cardAtlas.ts format).
 * Shared helper used by card and unit texture loading.
 */
async function createTextureFromSpriteData(
  cacheKey: string,
  spriteData: SpriteData
): Promise<Texture> {
  // Check cache first
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  // Check if already loading
  const existingPromise = loadingTextures.get(cacheKey);
  if (existingPromise) return existingPromise;

  const loadPromise = (async () => {
    try {
      const baseTexture = await Assets.load(spriteData.src);
      const x = spriteData.col * spriteData.spriteWidth;
      // Use rowHeight for Y position (important for even/odd layout sheets where row is physical)
      const y = spriteData.row * spriteData.rowHeight;
      const frame = new Rectangle(x, y, spriteData.spriteWidth, spriteData.spriteHeight);
      const subTexture = new Texture({
        source: baseTexture.source,
        frame,
      });
      textureCache.set(cacheKey, subTexture);
      loadingTextures.delete(cacheKey);
      return subTexture;
    } catch (error) {
      console.warn(`[pixiTextureLoader] Failed to load texture for ${cacheKey}:`, error);
      loadingTextures.delete(cacheKey);
      return getPlaceholderTexture();
    }
  })();

  loadingTextures.set(cacheKey, loadPromise);
  return loadPromise;
}

/**
 * Get a PixiJS texture for a card (spell, AA, basic/advanced action).
 * Uses cardAtlas.ts for sprite data lookup.
 */
export async function getCardTexture(cardId: CardId): Promise<Texture> {
  const cacheKey = `card:${cardId}`;

  // Check cache first
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  const spriteData = getCardSpriteData(cardId);

  if (!spriteData) {
    console.warn(`[pixiTextureLoader] No sprite data for card: ${cardId}`);
    return getPlaceholderTexture();
  }

  return createTextureFromSpriteData(cacheKey, spriteData);
}

/**
 * Get a PixiJS texture for a tactic card.
 * Uses cardAtlas.ts for sprite data lookup.
 */
export async function getTacticTexture(tacticId: TacticId): Promise<Texture> {
  const cacheKey = `tactic:${tacticId}`;

  // Check cache first
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  const spriteData = getTacticSpriteData(tacticId);

  if (!spriteData) {
    console.warn(`[pixiTextureLoader] No sprite data for tactic: ${tacticId}`);
    return getPlaceholderTexture();
  }

  return createTextureFromSpriteData(cacheKey, spriteData);
}

/**
 * Get a PixiJS texture for a unit.
 * Uses cardAtlas.ts for sprite data lookup.
 */
export async function getUnitTexture(unitId: UnitId): Promise<Texture> {
  const cacheKey = `unit:${unitId}`;

  // Check cache first
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  const spriteData = getUnitSpriteData(unitId);

  if (!spriteData) {
    console.warn(`[pixiTextureLoader] No sprite data for unit: ${unitId}`);
    return getPlaceholderTexture();
  }

  return createTextureFromSpriteData(cacheKey, spriteData);
}

/**
 * Get a PixiJS texture for offer cards (units, spells, or AAs).
 * The type parameter determines which sprite lookup to use.
 */
export async function getOfferCardTexture(
  cardId: string,
  type: "unit" | "spell" | "aa"
): Promise<Texture> {
  const cacheKey = `${type}:${cardId}`;

  // Check cache first
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  // Get sprite data from cardAtlas
  let spriteData: SpriteData | null = null;

  if (type === "unit") {
    spriteData = getUnitSpriteData(cardId as UnitId);
  } else {
    // Spells and AAs are both cards
    spriteData = getCardSpriteData(cardId as CardId);
  }

  if (!spriteData) {
    console.warn(`[pixiTextureLoader] No sprite data for ${type}: ${cardId}`);
    return getPlaceholderTexture();
  }

  return createTextureFromSpriteData(cacheKey, spriteData);
}

// ============================================================================
// Preloading
// ============================================================================

/**
 * Preload all card textures for a list of card IDs.
 * Call this during app initialization to warm the GPU cache.
 */
export async function preloadCardTextures(cardIds: string[]): Promise<void> {
  await Promise.all(cardIds.map((id) => getCardTextureFromAtlas(id)));
}

/**
 * Preload all sprite sheets (loads entire sheets to GPU).
 */
export async function preloadAllSpriteSheets(): Promise<void> {
  const atlas = await loadAtlasData();
  const sheetUrls = Object.values(atlas.sheets).map((s) => `/assets/${s.file}`);
  const uniqueUrls = [...new Set(sheetUrls)];

  // Load all sheets via PixiJS Assets (this uploads to GPU)
  await Promise.all(uniqueUrls.map((url) => Assets.load(url)));
}

// ============================================================================
// Cleanup / Disposal
// ============================================================================

/**
 * Dispose all cached textures.
 * Call this when unmounting components that use PixiJS textures
 * to prevent VRAM leaks.
 *
 * Note: This destroys sub-textures but not base textures (sprite sheets).
 * Base textures are managed by PixiJS Assets and should be cleaned up
 * when the Application is destroyed.
 */
export function disposeAllTextures(): void {
  // Dispose all cached sub-textures
  for (const texture of textureCache.values()) {
    // Don't destroy the texture source (base texture) as it's shared
    // Just destroy the sub-texture frame reference
    texture.destroy(false);
  }
  textureCache.clear();

  // Clear loading promises
  loadingTextures.clear();

  // Dispose placeholder texture and canvas
  if (placeholderTexture) {
    placeholderTexture.destroy(true); // true = destroy source too
    placeholderTexture = null;
  }
  if (placeholderCanvas) {
    // Remove canvas from memory
    placeholderCanvas.width = 0;
    placeholderCanvas.height = 0;
    placeholderCanvas = null;
  }

  // Clear atlas data
  atlasData = null;
  atlasLoadPromise = null;
}

/**
 * Dispose a specific texture by cache key.
 * Useful for selective cleanup without clearing the entire cache.
 */
export function disposeTexture(cacheKey: string): void {
  const texture = textureCache.get(cacheKey);
  if (texture) {
    texture.destroy(false);
    textureCache.delete(cacheKey);
  }
}

/**
 * Get the current cache size (for debugging/monitoring).
 */
export function getTextureCacheSize(): number {
  return textureCache.size;
}

/**
 * Check if a texture is cached.
 */
export function isTextureCached(cacheKey: string): boolean {
  return textureCache.has(cacheKey);
}

// ============================================================================
// HMR Support
// ============================================================================

// Accept self-updates to prevent full page reloads
if (import.meta.hot) {
  import.meta.hot.accept();

  // Debug log for HMR acceptance
  console.log("[HMR] pixiTextureLoader module accepted update");
}
