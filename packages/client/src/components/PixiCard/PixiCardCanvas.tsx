/**
 * PixiCardCanvas - Renders cards using PixiJS for proper GPU texture management
 *
 * This component creates a PixiJS Application and renders card sprites.
 * Unlike DOM/CSS background-image, PixiJS properly handles GPU texture upload
 * during Assets.load(), eliminating jank when cards first appear.
 */

import { useEffect, useRef, useState } from "react";
import { Application, Sprite } from "pixi.js";
import {
  getCardTexture,
  getPlaceholderTexture,
  preloadCardTextures as sharedPreloadCardTextures,
  preloadAllSpriteSheets as sharedPreloadAllSpriteSheets,
} from "../../utils/pixiTextureLoader";
import type { CardId } from "@mage-knight/shared";

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

    let cancelled = false;

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
          // Load texture using the SpriteData-based loader (works with actual atlas format)
          const texture = await getCardTexture(card.id as CardId);

          // Check if effect was cleaned up during async texture load
          if (cancelled) return;

          sprite = new Sprite(texture ?? getPlaceholderTexture());
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

    return () => {
      cancelled = true;
    };
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
  return sharedPreloadCardTextures(cardIds);
}

/**
 * Preload all sprite sheets (loads entire sheets to GPU)
 */
export async function preloadAllSpriteSheets(): Promise<void> {
  return sharedPreloadAllSpriteSheets();
}
