/**
 * PixiCardCanvas - Renders cards using PixiJS for proper GPU texture management
 *
 * This component creates a PixiJS Application and renders card sprites.
 * Unlike DOM/CSS background-image, PixiJS properly handles GPU texture upload
 * during Assets.load(), eliminating jank when cards first appear.
 */

import { useEffect, useRef, useState } from "react";
import { Application, Sprite, Texture, Rectangle, Assets, Container } from "pixi.js";
import type { CardId, UnitId } from "@mage-knight/shared";

// Atlas data for looking up card positions
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

// Cached atlas data
let atlasData: AtlasData | null = null;
let atlasLoadPromise: Promise<AtlasData> | null = null;

async function loadAtlasData(): Promise<AtlasData> {
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

// Texture cache - shared across all PixiCardCanvas instances
const textureCache = new Map<string, Texture>();
const loadingTextures = new Map<string, Promise<Texture>>();

async function getCardTexture(cardId: string): Promise<Texture | null> {
  // Check cache first
  const cached = textureCache.get(cardId);
  if (cached) return cached;

  // Check if already loading
  const loading = loadingTextures.get(cardId);
  if (loading) return loading;

  // Load atlas data
  const atlas = await loadAtlasData();

  // Find sprite in atlas
  const sprite = atlas.sprites[cardId];
  if (!sprite) {
    console.warn(`Card not found in atlas: ${cardId}`);
    return null;
  }

  // Get sheet info
  const sheet = atlas.sheets[sprite.sheet];
  if (!sheet) {
    console.warn(`Sheet not found: ${sprite.sheet}`);
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

    textureCache.set(cardId, subTexture);
    loadingTextures.delete(cardId);

    return subTexture;
  })();

  loadingTextures.set(cardId, loadPromise);
  return loadPromise;
}

export interface CardRenderInfo {
  id: string; // CardId or UnitId
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PixiCardCanvasProps {
  /** Cards to render */
  cards: CardRenderInfo[];
  /** Canvas width */
  width: number;
  /** Canvas height */
  height: number;
  /** Background color (hex number, e.g., 0x1a1a2e) */
  backgroundColor?: number;
  /** Called when a card is clicked */
  onCardClick?: (cardId: string, index: number) => void;
  /** Additional CSS class */
  className?: string;
}

export function PixiCardCanvas({
  cards,
  width,
  height,
  backgroundColor = 0x1a1a2e,
  onCardClick,
  className = "",
}: PixiCardCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const spritesRef = useRef<Map<string, Sprite>>(new Map());
  const [isReady, setIsReady] = useState(false);

  // Initialize PixiJS app
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;

    const initApp = async () => {
      const app = new Application();
      await app.init({
        width,
        height,
        backgroundColor,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (destroyed) {
        app.destroy(true);
        return;
      }

      container.appendChild(app.canvas);
      appRef.current = app;
      setIsReady(true);
    };

    initApp();

    return () => {
      destroyed = true;
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
      setIsReady(false);
    };
  }, [width, height, backgroundColor]);

  // Update sprites when cards change
  useEffect(() => {
    const app = appRef.current;
    if (!app || !isReady) return;

    const updateSprites = async () => {
      const currentSprites = spritesRef.current;
      const newSpriteKeys = new Set(cards.map((c, i) => `${c.id}:${i}`));

      // Remove sprites that are no longer needed
      for (const [key, sprite] of currentSprites) {
        if (!newSpriteKeys.has(key)) {
          app.stage.removeChild(sprite);
          sprite.destroy();
          currentSprites.delete(key);
        }
      }

      // Add/update sprites
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        if (!card) continue;

        const key = `${card.id}:${i}`;

        let sprite = currentSprites.get(key);

        if (!sprite) {
          // Create new sprite
          const texture = await getCardTexture(card.id);
          if (!texture) continue;

          sprite = new Sprite(texture);
          sprite.eventMode = "static";
          sprite.cursor = "pointer";
          sprite.on("pointerdown", () => {
            onCardClick?.(card.id, i);
          });

          app.stage.addChild(sprite);
          currentSprites.set(key, sprite);
        }

        // Update position and size
        sprite.x = card.x;
        sprite.y = card.y;
        sprite.width = card.width;
        sprite.height = card.height;
      }
    };

    updateSprites();
  }, [cards, isReady, onCardClick]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width, height, overflow: "hidden" }}
    />
  );
}

/**
 * Preload all card textures for a list of card IDs
 * Call this during app initialization to warm the GPU cache
 */
export async function preloadCardTextures(cardIds: string[]): Promise<void> {
  const startTime = performance.now();

  await Promise.all(cardIds.map((id) => getCardTexture(id)));

  const elapsed = performance.now() - startTime;
  console.log(`[PixiCardCanvas] Preloaded ${cardIds.length} card textures in ${elapsed.toFixed(0)}ms`);
}

/**
 * Preload all sprite sheets (loads entire sheets to GPU)
 */
export async function preloadAllSpriteSheets(): Promise<void> {
  const startTime = performance.now();

  const atlas = await loadAtlasData();
  const sheetUrls = Object.values(atlas.sheets).map((s) => `/assets/${s.file}`);
  const uniqueUrls = [...new Set(sheetUrls)];

  // Load all sheets via PixiJS Assets (this uploads to GPU)
  await Promise.all(uniqueUrls.map((url) => Assets.load(url)));

  const elapsed = performance.now() - startTime;
  console.log(`[PixiCardCanvas] Preloaded ${uniqueUrls.length} sprite sheets in ${elapsed.toFixed(0)}ms`);
}
