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
import { Easing, ENEMY_FLIP_STAGGER_MS } from "../animations";
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
 */
export async function renderEnemies(
  layers: WorldLayers,
  hexes: Record<string, ClientHexState>,
  animManager: AnimationManager | null,
  particleManager: ParticleManager | null,
  playIntro: boolean,
  initialDelayMs: number = 0,
  onIntroComplete?: () => void,
  onlyAnimateHexKeys?: Set<string>
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

      let imageUrl: string;
      if (enemy.isRevealed && enemy.tokenId) {
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
