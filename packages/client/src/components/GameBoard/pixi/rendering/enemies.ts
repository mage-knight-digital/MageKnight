/**
 * Enemy token rendering for PixiJS hex grid
 *
 * Handles enemy token display and theatrical intro animations:
 * - Drop from sky with perspective scaling
 * - Circular shadow animation
 * - Mini dust burst on landing
 * - Bounce effect
 */

import { Container, Sprite, Graphics, Assets, Texture } from "pixi.js";
import type { ClientHexState } from "@mage-knight/shared";
import { hexKey } from "@mage-knight/shared";
import {
  getEnemyImageUrl,
  getEnemyTokenBackUrl,
  tokenIdToEnemyId,
  type EnemyTokenColor,
} from "../../../../assets/assetPaths";
import { hexToPixel, getEnemyOffset } from "../hexMath";
import type { WorldLayers, PixelPosition } from "../types";
import { ENEMY_TOKEN_SIZE } from "../types";
import type { AnimationManager } from "../animations";
import { Easing, ENEMY_FLIP_STAGGER_MS, ENEMY_FLIP_DURATION_MS } from "../animations";
import type { ParticleManager } from "../particles";
import { CircleShadow } from "../particles";

/**
 * Data for an enemy that needs intro animation
 */
interface EnemyAnimData {
  container: Container;
  position: PixelPosition;
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
 * Animation constants for enemy intro
 */
const ENEMY_DROP_DURATION = 250;
const ENEMY_DROP_HEIGHT = 120;
const ENEMY_BOUNCE_DURATION = 100;

/**
 * Animate a single enemy's drop intro
 */
function animateEnemyDrop(
  container: Container,
  position: PixelPosition,
  index: number,
  isLast: boolean,
  layers: WorldLayers,
  animManager: AnimationManager,
  particleManager: ParticleManager,
  initialDelayMs: number,
  onIntroComplete?: () => void
): void {
  const ENEMY_TOKEN_RADIUS = ENEMY_TOKEN_SIZE / 2;

  // Add slight jitter for organic feel
  const jitter = (Math.random() - 0.5) * 80;
  const delay = initialDelayMs + index * ENEMY_FLIP_STAGGER_MS + jitter;

  setTimeout(() => {
    // Create circular drop shadow
    const shadow = new CircleShadow(layers.particles, position, ENEMY_TOKEN_RADIUS);
    shadow.alpha = 0.08;
    shadow.scale = 2.5;

    // Start above and larger (perspective)
    const startY = position.y - ENEMY_DROP_HEIGHT;
    const startScale = 1.5;
    container.position.y = startY;
    container.scale.set(startScale);
    container.alpha = 0;

    // Drop animation
    animManager.animate(`enemy-drop-${index}`, container, {
      endY: position.y,
      endAlpha: 1,
      duration: ENEMY_DROP_DURATION,
      easing: Easing.easeInQuad,
      onUpdate: (progress) => {
        const currentScale = startScale - (startScale - 1) * progress;
        container.scale.set(currentScale);

        shadow.scale = 2.5 - 1.5 * progress;
        shadow.alpha = 0.08 + 0.27 * progress;
      },
      onComplete: () => {
        shadow.destroy();
        container.scale.set(1);

        // Mini dust puff on landing
        particleManager.miniDustBurst(layers.particles, position, ENEMY_TOKEN_RADIUS);

        // Small bounce on landing
        animManager.animate(`enemy-bounce-${index}`, container, {
          endScale: 1,
          duration: ENEMY_BOUNCE_DURATION,
          easing: Easing.easeOutQuad,
          onUpdate: (p) => {
            const squash = p < 0.5 ? 1 + 0.08 * (p * 2) : 1 + 0.08 * (2 - p * 2);
            const stretch = p < 0.5 ? 1 - 0.06 * (p * 2) : 1 - 0.06 * (2 - p * 2);
            container.scale.set(squash, stretch);
          },
          onComplete: isLast ? onIntroComplete : undefined,
        });
      },
    });
  }, delay);
}

/**
 * Render enemy tokens on hexes with optional theatrical intro
 *
 * @param layers - World layer containers
 * @param hexes - Hex data from game state
 * @param animManager - Animation manager (null to skip animations)
 * @param particleManager - Particle manager (null to skip particles)
 * @param playIntro - Whether to play intro animation
 * @param initialDelayMs - Delay before starting animations (for sequencing after tiles)
 * @param onIntroComplete - Callback when intro animation finishes
 * @param onlyAnimateHexKeys - If provided, only animate enemies on these hexes (others render static)
 * @param pendingFlipTokenIds - Token IDs that should render as unrevealed (back) even if state says revealed
 */
export async function renderEnemies(
  layers: WorldLayers,
  hexes: Record<string, ClientHexState>,
  animManager: AnimationManager | null,
  particleManager: ParticleManager | null,
  playIntro: boolean,
  initialDelayMs: number = 0,
  onIntroComplete?: () => void,
  onlyAnimateHexKeys?: Set<string>,
  pendingFlipTokenIds?: Set<string>
): Promise<void> {
  layers.enemies.removeChildren();

  const enemyData: EnemyAnimData[] = [];

  for (const hex of Object.values(hexes)) {
    if (hex.enemies.length === 0) continue;

    const hexCenter = hexToPixel(hex.coord);
    const thisHexKey = hexKey(hex.coord);
    // If filtering is enabled, check if this hex should be animated
    const shouldAnimateThisHex = !onlyAnimateHexKeys || onlyAnimateHexKeys.has(thisHexKey);

    for (let i = 0; i < hex.enemies.length; i++) {
      const enemy = hex.enemies[i];
      if (!enemy) continue;

      const offset = getEnemyOffset(i, hex.enemies.length, ENEMY_TOKEN_SIZE);
      const enemyPos = { x: hexCenter.x + offset.x, y: hexCenter.y + offset.y };

      // Check if this enemy should show as unrevealed (for pending flip animation)
      const isPendingFlip = pendingFlipTokenIds?.has(enemy.tokenId ?? "");
      const shouldShowRevealed = enemy.isRevealed && enemy.tokenId && !isPendingFlip;

      let imageUrl: string;
      if (shouldShowRevealed && enemy.tokenId) {
        const enemyId = tokenIdToEnemyId(enemy.tokenId);
        imageUrl = getEnemyImageUrl(enemyId);
      } else {
        const tokenColor = (enemy.color === "gray" ? "grey" : enemy.color) as EnemyTokenColor;
        imageUrl = getEnemyTokenBackUrl(tokenColor);
      }

      try {
        const texture = await loadTexture(imageUrl);
        const sprite = new Sprite(texture);

        sprite.anchor.set(0.5, 0.5);
        sprite.position.set(0, 0);
        sprite.width = ENEMY_TOKEN_SIZE;
        sprite.height = ENEMY_TOKEN_SIZE;

        const mask = new Graphics();
        mask.circle(0, 0, ENEMY_TOKEN_SIZE / 2);
        mask.fill({ color: 0xffffff });
        sprite.mask = mask;

        const enemyContainer = new Container();
        enemyContainer.label = `enemy-${hexKey(hex.coord)}-${i}`;
        enemyContainer.position.set(enemyPos.x, enemyPos.y);
        enemyContainer.addChild(mask);
        enemyContainer.addChild(sprite);

        const border = new Graphics();
        border.circle(0, 0, ENEMY_TOKEN_SIZE / 2);
        border.stroke({ color: 0x000000, width: 1, alpha: 0.5 });
        enemyContainer.addChild(border);

        // Only set up for animation if this hex should be animated
        if (playIntro && animManager && shouldAnimateThisHex) {
          enemyContainer.alpha = 0;
          enemyContainer.scale.set(0);
          enemyData.push({ container: enemyContainer, position: enemyPos });
        }

        layers.enemies.addChild(enemyContainer);
      } catch (error) {
        console.error(`Failed to load enemy texture: ${imageUrl}`, error);
      }
    }
  }

  // Play intro animations only for enemies that should be animated
  if (playIntro && animManager && particleManager && enemyData.length > 0) {
    enemyData.forEach(({ container, position }, index) => {
      const isLast = index === enemyData.length - 1;
      animateEnemyDrop(
        container,
        position,
        index,
        isLast,
        layers,
        animManager,
        particleManager,
        initialDelayMs,
        onIntroComplete
      );
    });
  } else if (playIntro && enemyData.length === 0 && onIntroComplete) {
    // No enemies to animate but intro was requested - call complete after initial delay
    setTimeout(onIntroComplete, initialDelayMs);
  }
}

/**
 * Data needed to flip an enemy token from unrevealed to revealed
 */
export interface EnemyFlipTarget {
  /** The token ID (e.g., "orc_1") */
  tokenId: string;
  /** The hex coordinate where the enemy is located */
  hexCoord: { q: number; r: number };
  /** The enemy's color for finding the back texture */
  color: string;
  /** Index of the enemy within the hex (for positioning) */
  indexInHex: number;
  /** Total enemies in the hex (for positioning) */
  totalInHex: number;
}

/**
 * Animate enemy tokens flipping from unrevealed (back) to revealed (front).
 *
 * Creates a card-flip effect by scaling X from 1 → 0 → 1 while swapping
 * the texture at the midpoint.
 *
 * @param layers - World layer containers
 * @param targets - Enemy flip targets with position and texture info
 * @param animManager - Animation manager for tweening
 * @param particleManager - Particle manager for effects
 * @param initialDelayMs - Delay before starting (for sequencing after hero move)
 * @param onComplete - Callback when all flips finish
 */
export async function animateEnemyFlips(
  layers: WorldLayers,
  targets: EnemyFlipTarget[],
  animManager: AnimationManager,
  particleManager: ParticleManager,
  initialDelayMs: number = 0,
  onComplete?: () => void
): Promise<void> {
  if (targets.length === 0) {
    onComplete?.();
    return;
  }

  // Find existing enemy containers by label and animate them
  let completedCount = 0;
  const totalToAnimate = targets.length;

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    if (!target) continue;

    const containerLabel = `enemy-${hexKey(target.hexCoord)}-${target.indexInHex}`;
    const container = layers.enemies.children.find(
      (child) => child.label === containerLabel
    ) as Container | undefined;

    if (!container) {
      console.warn(`[animateEnemyFlips] Could not find container: ${containerLabel}`);
      completedCount++;
      if (completedCount === totalToAnimate) {
        onComplete?.();
      }
      continue;
    }

    // Get the sprite (second child after mask)
    const sprite = container.children[1] as Sprite | undefined;
    if (!sprite) {
      console.warn(`[animateEnemyFlips] No sprite in container: ${containerLabel}`);
      completedCount++;
      if (completedCount === totalToAnimate) {
        onComplete?.();
      }
      continue;
    }

    // Load the revealed texture
    const enemyId = tokenIdToEnemyId(target.tokenId);
    const revealedUrl = getEnemyImageUrl(enemyId);

    // Stagger the flips
    const jitter = (Math.random() - 0.5) * 50;
    const delay = initialDelayMs + i * ENEMY_FLIP_STAGGER_MS + jitter;
    const isLast = i === targets.length - 1;

    setTimeout(async () => {
      try {
        console.log(`[animateEnemyFlips] Loading texture for ${target.tokenId}: ${revealedUrl}`);
        const revealedTexture = await loadTexture(revealedUrl);
        console.log(`[animateEnemyFlips] Texture loaded, width=${revealedTexture.width}, height=${revealedTexture.height}`);
        const halfDuration = ENEMY_FLIP_DURATION_MS / 2;

        // First half: scale X from 1 to 0 (flip away)
        animManager.animate(`enemy-flip-out-${i}`, container, {
          duration: halfDuration,
          easing: Easing.easeInQuad,
          onUpdate: (progress) => {
            container.scale.x = 1 - progress;
          },
          onComplete: () => {
            // Swap texture at midpoint
            console.log(`[animateEnemyFlips] Swapping texture for ${target.tokenId}, sprite exists=${!!sprite}, sprite.parent=${sprite.parent?.label}, container.parent=${container.parent?.label}`);

            // Guard: if container was destroyed/removed, abort
            if (!container.parent) {
              console.warn(`[animateEnemyFlips] Container was destroyed before texture swap for ${target.tokenId}`);
              completedCount++;
              if (completedCount === totalToAnimate) {
                onComplete?.();
              }
              return;
            }

            sprite.texture = revealedTexture;
            // Reset sprite dimensions after texture swap (texture change can affect size)
            sprite.width = ENEMY_TOKEN_SIZE;
            sprite.height = ENEMY_TOKEN_SIZE;
            console.log(`[animateEnemyFlips] Texture swapped, sprite: width=${sprite.width}, height=${sprite.height}, visible=${sprite.visible}, alpha=${sprite.alpha}, scale=(${sprite.scale.x}, ${sprite.scale.y}), container.scale=(${container.scale.x}, ${container.scale.y}), container.alpha=${container.alpha}`);

            // Second half: scale X from 0 to 1 (flip back)
            console.log(`[animateEnemyFlips] Starting flip-in animation for ${target.tokenId}, duration=${halfDuration}`);
            animManager.animate(`enemy-flip-in-${i}`, container, {
              duration: halfDuration,
              easing: Easing.easeOutQuad,
              onUpdate: (progress) => {
                container.scale.x = progress;
              },
              onComplete: () => {
                console.log(`[animateEnemyFlips] Flip-in complete for ${target.tokenId}, container.scale.x=${container.scale.x}, children=${container.children.length}, sprite.texture.width=${sprite.texture.width}`);
                container.scale.x = 1;
                // Debug: log all children
                container.children.forEach((child, idx) => {
                  console.log(`  child[${idx}]: label=${child.label}, visible=${child.visible}, alpha=${child.alpha}`);
                });

                // Small dust puff on reveal
                const hexCenter = hexToPixel(target.hexCoord);
                const offset = getEnemyOffset(target.indexInHex, target.totalInHex, ENEMY_TOKEN_SIZE);
                const enemyPos = { x: hexCenter.x + offset.x, y: hexCenter.y + offset.y };
                particleManager.miniDustBurst(layers.particles, enemyPos, ENEMY_TOKEN_SIZE / 2);

                completedCount++;
                if (completedCount === totalToAnimate && isLast) {
                  onComplete?.();
                }
              },
            });
          },
        });
      } catch (error) {
        console.error(`[animateEnemyFlips] Failed to load texture: ${revealedUrl}`, error);
        completedCount++;
        if (completedCount === totalToAnimate) {
          onComplete?.();
        }
      }
    }, delay);
  }
}
