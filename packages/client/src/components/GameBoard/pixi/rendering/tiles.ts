/**
 * Tile rendering for PixiJS hex grid
 *
 * Handles static tile rendering and theatrical intro animations:
 * - Magic outline tracing with sparkles
 * - Drop shadow appearance
 * - Tile rising and falling with perspective
 * - Squash/stretch landing animation
 * - Dust burst particles on impact
 * - Screen shake effects
 */

import { Container, Sprite, Assets, Texture } from "pixi.js";
import type { ClientGameState, HexCoord } from "@mage-knight/shared";
import { getTileImageUrl } from "../../../../assets/assetPaths";
import { hexToPixel, MAP_ROTATION } from "../hexMath";
import type { WorldLayers, PixelPosition } from "../types";
import { TILE_WIDTH, TILE_HEIGHT, HEX_SIZE } from "../types";
import type { AnimationManager } from "../animations";
import { Easing } from "../animations";
import type { ParticleManager } from "../particles";
import {
  DropShadow,
  HEX_OUTLINE_DURATION_MS,
  TILE_RISE_DURATION_MS,
  TILE_SLAM_DURATION_MS,
  SCREEN_SHAKE_DURATION_MS,
  SCREEN_SHAKE_INTENSITY,
} from "../particles";
import { applyTileEffects } from "./tileEffects";

/**
 * Data for a tile that needs intro animation
 */
interface TileAnimData {
  sprite: Sprite;
  targetScaleX: number;
  targetScaleY: number;
  position: PixelPosition;
  tileId: string;
}

/**
 * Load a texture with caching
 */
async function loadTexture(url: string): Promise<Texture> {
  if (Assets.cache.has(url)) {
    return Assets.get(url);
  }
  return Assets.load(url);
}

/**
 * Apply screen shake effect to world container
 */
export function applyScreenShake(
  world: Container,
  intensity: number,
  duration: number
): void {
  const originalX = world.position.x;
  const originalY = world.position.y;
  const startTime = performance.now();

  const shake = () => {
    const elapsed = performance.now() - startTime;
    if (elapsed >= duration) {
      world.position.set(originalX, originalY);
      return;
    }

    const progress = elapsed / duration;
    const currentIntensity = intensity * (1 - progress); // Decay over time
    const offsetX = (Math.random() - 0.5) * 2 * currentIntensity;
    const offsetY = (Math.random() - 0.5) * 2 * currentIntensity;

    world.position.set(originalX + offsetX, originalY + offsetY);
    requestAnimationFrame(shake);
  };

  requestAnimationFrame(shake);
}

/**
 * Animate a single tile's intro sequence
 */
function animateTileIntro(
  data: TileAnimData,
  index: number,
  isLast: boolean,
  layers: WorldLayers,
  world: Container,
  animManager: AnimationManager,
  particleManager: ParticleManager,
  onIntroComplete?: () => void
): void {
  const { sprite, targetScaleX, targetScaleY, position, tileId } = data;
  const TILE_STAGGER = 200;
  const delay = index * TILE_STAGGER;

  setTimeout(() => {
    // Phase 1: Magic outline traces the TILE shape with sparkles
    const tracer = particleManager.traceTileOutline(
      layers.particles,
      position,
      HEX_OUTLINE_DURATION_MS,
      0x88ccff,
      () => {
        // Move tracer to shadows layer so it renders below the dropping tile
        tracer.moveToBackground(layers.shadows);

        // Phase 2: Tile drops from above in one continuous motion
        const shadow = new DropShadow(layers.particles, position, HEX_SIZE);
        shadow.alpha = 0;
        shadow.scale = 1.5;

        // Start high above and larger (perspective effect)
        const startY = position.y - 150;
        const startScale = 1.5;
        sprite.position.y = startY;
        sprite.scale.set(targetScaleX * startScale, targetScaleY * startScale);
        sprite.alpha = 0;

        // Single continuous drop with easeInQuad (accelerating fall)
        const totalDropTime = TILE_RISE_DURATION_MS + TILE_SLAM_DURATION_MS;

        animManager.animate(`tile-drop-${tileId}`, sprite, {
          endY: position.y,
          endAlpha: 1,
          duration: totalDropTime,
          easing: Easing.easeInQuad,
          onUpdate: (progress) => {
            // Scale down as tile falls (perspective)
            const currentScale = startScale - (startScale - 1) * progress;
            sprite.scale.x = targetScaleX * currentScale;
            sprite.scale.y = targetScaleY * currentScale;

            // Shadow shrinks from big to exactly tile size
            shadow.scale = 1.5 - 0.5 * progress;
            shadow.alpha = 0.3;

            // Squash in the final 10% of the drop
            if (progress > 0.9) {
              const squashProgress = (progress - 0.9) / 0.1;
              sprite.scale.x = targetScaleX * (1 + 0.12 * squashProgress);
              sprite.scale.y = targetScaleY * (1 - 0.08 * squashProgress);
            }
          },
          onComplete: () => {
            // Tile has landed - destroy shadow, start bounce
            shadow.destroy();
            sprite.scale.x = targetScaleX * 1.12;
            sprite.scale.y = targetScaleY * 0.92;

            // Dust puff on impact
            particleManager.dustBurst(layers.shadows, position);

            // Bounce-back animation
            let bounceProgress = 0;
            const bounceStep = () => {
              bounceProgress += 0.08;
              if (bounceProgress >= 1) {
                sprite.scale.set(targetScaleX, targetScaleY);
                sprite.position.set(position.x, position.y);
                return;
              }
              const ease = 1 - Math.pow(1 - bounceProgress, 3);
              sprite.scale.x = targetScaleX * (1.12 - 0.12 * ease);
              sprite.scale.y = targetScaleY * (0.92 + 0.08 * ease);
              requestAnimationFrame(bounceStep);
            };
            requestAnimationFrame(bounceStep);

            // Screen shake (only for first few tiles)
            if (index < 3) {
              applyScreenShake(world, SCREEN_SHAKE_INTENSITY, SCREEN_SHAKE_DURATION_MS);
            }

            if (isLast && onIntroComplete) {
              setTimeout(onIntroComplete, 200);
            }
          },
        });
      }
    );
  }, delay);
}

/**
 * Animate tile reveal during exploration
 *
 * Similar to intro animation but with gold tracer effect and callback
 * for sequencing enemies after tile lands.
 */
function animateTileReveal(
  data: TileAnimData,
  index: number,
  layers: WorldLayers,
  world: Container,
  animManager: AnimationManager,
  particleManager: ParticleManager,
  onTileRevealed?: () => void
): void {
  const { sprite, targetScaleX, targetScaleY, position, tileId } = data;
  const TILE_STAGGER = 200;
  const delay = index * TILE_STAGGER;

  setTimeout(() => {
    // Phase 1: Magic outline traces the tile shape with gold sparkles
    const tracer = particleManager.traceTileOutline(
      layers.particles,
      position,
      HEX_OUTLINE_DURATION_MS,
      0xd4a84b, // Warm gold color to match explore ghost
      () => {
        // Move tracer to shadows layer so it renders below the dropping tile
        tracer.moveToBackground(layers.shadows);

        // Phase 2: Tile drops from above
        const shadow = new DropShadow(layers.particles, position, HEX_SIZE);
        shadow.alpha = 0;
        shadow.scale = 1.5;

        const startY = position.y - 150;
        const startScale = 1.5;
        sprite.position.y = startY;
        sprite.scale.set(targetScaleX * startScale, targetScaleY * startScale);
        sprite.alpha = 0;

        const totalDropTime = TILE_RISE_DURATION_MS + TILE_SLAM_DURATION_MS;

        animManager.animate(`tile-reveal-${tileId}`, sprite, {
          endY: position.y,
          endAlpha: 1,
          duration: totalDropTime,
          easing: Easing.easeInQuad,
          onUpdate: (progress) => {
            const currentScale = startScale - (startScale - 1) * progress;
            sprite.scale.x = targetScaleX * currentScale;
            sprite.scale.y = targetScaleY * currentScale;

            shadow.scale = 1.5 - 0.5 * progress;
            shadow.alpha = 0.3;

            if (progress > 0.9) {
              const squashProgress = (progress - 0.9) / 0.1;
              sprite.scale.x = targetScaleX * (1 + 0.12 * squashProgress);
              sprite.scale.y = targetScaleY * (1 - 0.08 * squashProgress);
            }
          },
          onComplete: () => {
            shadow.destroy();
            sprite.scale.x = targetScaleX * 1.12;
            sprite.scale.y = targetScaleY * 0.92;

            particleManager.dustBurst(layers.shadows, position);

            let bounceProgress = 0;
            const bounceStep = () => {
              bounceProgress += 0.08;
              if (bounceProgress >= 1) {
                sprite.scale.set(targetScaleX, targetScaleY);
                sprite.position.set(position.x, position.y);

                // Tile is fully landed - notify caller
                if (onTileRevealed) {
                  onTileRevealed();
                }
                return;
              }
              const ease = 1 - Math.pow(1 - bounceProgress, 3);
              sprite.scale.x = targetScaleX * (1.12 - 0.12 * ease);
              sprite.scale.y = targetScaleY * (0.92 + 0.08 * ease);
              requestAnimationFrame(bounceStep);
            };
            requestAnimationFrame(bounceStep);

            applyScreenShake(world, SCREEN_SHAKE_INTENSITY, SCREEN_SHAKE_DURATION_MS);
          },
        });
      }
    );
  }, delay);
}

/**
 * Result from renderTiles indicating which tiles are being revealed
 */
export interface RenderTilesResult {
  /** Tile IDs that are being revealed with animation */
  revealingTileIds: string[];
  /** Center coords of tiles being revealed */
  revealingTileCoords: HexCoord[];
}

/**
 * Render all tiles with optional theatrical intro sequence
 *
 * @param layers - World layer containers
 * @param tiles - Tile data from game state
 * @param animManager - Animation manager (null to skip animations)
 * @param particleManager - Particle manager (null to skip particles)
 * @param world - World container for screen shake
 * @param playIntro - Whether to play intro animation
 * @param knownTileIds - Set of already-known tile IDs (mutated to track new tiles)
 * @param onIntroComplete - Callback when intro animation finishes
 * @param onRevealComplete - Callback when exploration reveal animation finishes (tiles landed)
 */
export async function renderTiles(
  layers: WorldLayers,
  tiles: ClientGameState["map"]["tiles"],
  animManager: AnimationManager | null,
  particleManager: ParticleManager | null,
  world: Container | null,
  playIntro: boolean,
  knownTileIds: Set<string>,
  onIntroComplete?: () => void,
  onRevealComplete?: () => void
): Promise<RenderTilesResult> {
  layers.tiles.removeChildren();
  layers.shadows.removeChildren();

  const introTiles: TileAnimData[] = [];
  const revealTiles: TileAnimData[] = [];
  const revealingTileIds: string[] = [];
  const revealingTileCoords: HexCoord[] = [];

  for (const tile of tiles) {
    const position = hexToPixel(tile.centerCoord);
    const imageUrl = getTileImageUrl(tile.tileId);
    const isNewTile = !knownTileIds.has(tile.tileId);

    try {
      const texture = await loadTexture(imageUrl);
      const sprite = new Sprite(texture);

      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(position.x, position.y);
      sprite.width = TILE_WIDTH;
      sprite.height = TILE_HEIGHT;
      sprite.rotation = MAP_ROTATION; // Rotate to match map orientation
      sprite.label = `tile-${tile.tileId}`;

      // Apply visual effects (shadow, border, warm tint) to blend with parchment
      applyTileEffects(sprite, layers.shadows, position, HEX_SIZE, {
        enableShadow: true,
        enableBorder: true,
        enableWarmTint: true,
        shadowAlpha: 0.1,    // Very subtle shadow
        borderAlpha: 0.45,   // Dark border around tile
        tintIntensity: 0.06, // Subtle warm tint
      });

      const targetScaleX = sprite.scale.x;
      const targetScaleY = sprite.scale.y;

      if (playIntro && animManager && particleManager) {
        sprite.alpha = 0;
        sprite.scale.set(targetScaleX * 0.8, targetScaleY * 0.8);
        introTiles.push({ sprite, targetScaleX, targetScaleY, position, tileId: tile.tileId });
      } else if (isNewTile && animManager && particleManager && !playIntro) {
        sprite.alpha = 0;
        sprite.scale.set(targetScaleX * 0.8, targetScaleY * 0.8);
        revealTiles.push({ sprite, targetScaleX, targetScaleY, position, tileId: tile.tileId });
        revealingTileIds.push(tile.tileId);
        revealingTileCoords.push(tile.centerCoord);
      }

      knownTileIds.add(tile.tileId);
      layers.tiles.addChild(sprite);
    } catch (error) {
      console.error(`Failed to load tile texture: ${imageUrl}`, error);
    }
  }

  // Play intro animations
  if (playIntro && animManager && particleManager && world && introTiles.length > 0) {
    introTiles.forEach((data, index) => {
      const isLast = index === introTiles.length - 1;
      animateTileIntro(data, index, isLast, layers, world, animManager, particleManager, onIntroComplete);
    });
  }

  // Play exploration reveal animations
  if (!playIntro && animManager && particleManager && world && revealTiles.length > 0) {
    let completedCount = 0;
    revealTiles.forEach((data, index) => {
      animateTileReveal(data, index, layers, world, animManager, particleManager, () => {
        completedCount++;
        // Call onRevealComplete when all tiles have landed
        if (completedCount === revealTiles.length && onRevealComplete) {
          onRevealComplete();
        }
      });
    });
    console.log("[renderTiles] Animating", revealTiles.length, "new tile(s) with reveal effect");
  }

  return { revealingTileIds, revealingTileCoords };
}
