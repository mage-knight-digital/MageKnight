/**
 * Ruins token rendering for PixiJS hex grid
 *
 * Renders Ancient Ruins yellow tokens on hexes:
 * - Face-up (revealed): shows the actual token content (altar or enemies)
 * - Face-down (unrevealed): shows the yellow back
 *
 * Supports theatrical intro animation matching enemy token drops.
 */

import { Container, Sprite, Graphics, Assets, Texture } from "pixi.js";
import type { ClientHexState } from "@mage-knight/shared";
import { hexKey } from "@mage-knight/shared";
import { getRuinsTokenFaceUrl, getRuinsTokenBackUrl } from "../../../../assets/assetPaths";
import { hexToPixel } from "../hexMath";
import type { WorldLayers, PixelPosition } from "../types";
import { ENEMY_TOKEN_SIZE } from "../types";
import type { AnimationManager } from "../animations";
import { animateFlip, ENEMY_FLIP_DURATION_MS, ENEMY_FLIP_STAGGER_MS, Easing } from "../animations";
import type { ParticleManager } from "../particles";
import { CircleShadow } from "../particles";

// Use same size as enemy tokens for visual consistency
const RUINS_TOKEN_SIZE = ENEMY_TOKEN_SIZE;

/**
 * Data for a ruins token that needs intro animation
 */
interface RuinsAnimData {
  container: Container;
  position: PixelPosition;
}

/**
 * Animation constants for ruins intro (match enemy tokens)
 */
const RUINS_DROP_DURATION = 250;
const RUINS_DROP_HEIGHT = 120;
const RUINS_BOUNCE_DURATION = 100;

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
 * Animate a single ruins token's drop intro (matches enemy drop animation)
 */
function animateRuinsDrop(
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
  const RUINS_TOKEN_RADIUS = RUINS_TOKEN_SIZE / 2;

  // Add slight jitter for organic feel
  const jitter = (Math.random() - 0.5) * 80;
  const delay = initialDelayMs + index * ENEMY_FLIP_STAGGER_MS + jitter;

  setTimeout(() => {
    // Create circular drop shadow
    const shadow = new CircleShadow(layers.particles, position, RUINS_TOKEN_RADIUS);
    shadow.alpha = 0.08;
    shadow.scale = 2.5;

    // Start above and larger (perspective)
    const startY = position.y - RUINS_DROP_HEIGHT;
    const startScale = 1.5;
    container.position.y = startY;
    container.scale.set(startScale);
    container.alpha = 0;

    // Drop animation
    animManager.animate(`ruins-drop-${index}`, container, {
      endY: position.y,
      endAlpha: 1,
      duration: RUINS_DROP_DURATION,
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
        particleManager.miniDustBurst(layers.particles, position, RUINS_TOKEN_RADIUS);

        // Small bounce on landing
        animManager.animate(`ruins-bounce-${index}`, container, {
          endScale: 1,
          duration: RUINS_BOUNCE_DURATION,
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
 * Render ruins tokens on hexes with optional theatrical intro.
 *
 * Unlike enemies which can have multiple tokens per hex, ruins tokens are
 * always one per hex and centered on the hex (slightly offset from center
 * to avoid overlapping with the site icon).
 *
 * @param layers - World layer containers
 * @param hexes - Hex data from game state
 * @param animManager - Animation manager (null to skip animations)
 * @param particleManager - Particle manager (null to skip particles)
 * @param playIntro - Whether to play intro animation
 * @param initialDelayMs - Delay before starting animations (for sequencing)
 * @param onIntroComplete - Callback when intro animation finishes
 * @param pendingFlipTokenIds - Token IDs that should render as unrevealed (for pending flip animation)
 */
export async function renderRuinsTokens(
  layers: WorldLayers,
  hexes: Record<string, ClientHexState>,
  animManager: AnimationManager | null = null,
  particleManager: ParticleManager | null = null,
  playIntro: boolean = false,
  initialDelayMs: number = 0,
  onIntroComplete?: () => void,
  pendingFlipTokenIds?: Set<string>
): Promise<void> {
  // Clear ALL existing ruins tokens first (synchronously before any async work)
  // This prevents race conditions when render is called multiple times
  const toRemove: Container[] = [];
  for (const child of layers.enemies.children) {
    if (child.label?.startsWith("ruins-")) {
      toRemove.push(child as Container);
    }
  }
  for (const token of toRemove) {
    layers.enemies.removeChild(token);
    token.destroy({ children: true });
  }

  // Collect all hexes that need ruins tokens
  const hexesWithRuins: Array<{ hex: ClientHexState; key: string }> = [];
  for (const hex of Object.values(hexes)) {
    if (hex.ruinsToken) {
      hexesWithRuins.push({ hex, key: hexKey(hex.coord) });
    }
  }

  // Collect animation data for intro
  const ruinsData: RuinsAnimData[] = [];

  // Render each ruins token
  for (const { hex, key } of hexesWithRuins) {
    if (!hex.ruinsToken) continue;

    const hexCenter = hexToPixel(hex.coord);
    // Center on hex (same as single enemy token)
    const tokenPos = { x: hexCenter.x, y: hexCenter.y };

    // Check if this token should show as unrevealed (for pending flip animation)
    const isPendingFlip = hex.ruinsToken.tokenId
      ? pendingFlipTokenIds?.has(hex.ruinsToken.tokenId)
      : false;
    const shouldShowRevealed = hex.ruinsToken.isRevealed && hex.ruinsToken.tokenId && !isPendingFlip;

    let imageUrl: string;
    if (shouldShowRevealed && hex.ruinsToken.tokenId) {
      imageUrl = getRuinsTokenFaceUrl(hex.ruinsToken.tokenId);
    } else {
      imageUrl = getRuinsTokenBackUrl();
    }

    try {
      const texture = await loadTexture(imageUrl);

      // Check if a token was already added for this hex (race condition protection)
      const existingToken = layers.enemies.children.find(
        (child) => child.label === `ruins-${key}`
      );
      if (existingToken) {
        console.warn(`[renderRuinsTokens] Token already exists for ${key}, skipping`);
        continue;
      }

      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(0, 0);
      sprite.width = RUINS_TOKEN_SIZE;
      sprite.height = RUINS_TOKEN_SIZE;

      // Circular mask - assign to sprite BEFORE adding to container (matches enemies.ts pattern)
      const mask = new Graphics();
      mask.circle(0, 0, RUINS_TOKEN_SIZE / 2);
      mask.fill({ color: 0xffffff });
      sprite.mask = mask;

      // Create container and add children
      const tokenContainer = new Container();
      tokenContainer.label = `ruins-${key}`;
      tokenContainer.eventMode = "none";
      tokenContainer.position.set(tokenPos.x, tokenPos.y);
      tokenContainer.addChild(mask);
      tokenContainer.addChild(sprite);

      // Add border
      const border = new Graphics();
      border.circle(0, 0, RUINS_TOKEN_SIZE / 2);
      border.stroke({ color: 0x000000, width: 1, alpha: 0.5 });
      tokenContainer.addChild(border);

      // Set up for animation if playing intro
      if (playIntro && animManager) {
        tokenContainer.alpha = 0;
        tokenContainer.scale.set(0);
        ruinsData.push({ container: tokenContainer, position: tokenPos });
      }

      layers.enemies.addChild(tokenContainer);
    } catch (error) {
      console.error(`Failed to load ruins token texture: ${imageUrl}`, error);
    }
  }

  // Play intro animations for ruins tokens
  if (playIntro && animManager && particleManager && ruinsData.length > 0) {
    ruinsData.forEach(({ container, position }, index) => {
      const isLast = index === ruinsData.length - 1;
      animateRuinsDrop(
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
  } else if (playIntro && ruinsData.length === 0 && onIntroComplete) {
    // No ruins tokens to animate but intro was requested - call complete after initial delay
    setTimeout(onIntroComplete, initialDelayMs);
  }
}

/**
 * Data needed to flip a ruins token from unrevealed to revealed
 */
export interface RuinsFlipTarget {
  /** The token ID (e.g., "altar_blue") */
  tokenId: string;
  /** The hex coordinate where the token is located */
  hexCoord: { q: number; r: number };
}

/**
 * Animate ruins tokens flipping from unrevealed (back) to revealed (front).
 *
 * Creates a card-flip effect by scaling X from 1 → 0 → 1 while swapping
 * the texture at the midpoint.
 *
 * @param layers - World layer containers
 * @param targets - Ruins flip targets with position and texture info
 * @param animManager - Animation manager for tweening
 * @param particleManager - Particle manager for effects
 * @param initialDelayMs - Delay before starting (for sequencing)
 * @param onComplete - Callback when all flips finish
 */
export async function animateRuinsFlips(
  layers: WorldLayers,
  targets: RuinsFlipTarget[],
  animManager: AnimationManager,
  particleManager: ParticleManager,
  initialDelayMs: number = 0,
  onComplete?: () => void
): Promise<void> {
  if (targets.length === 0) {
    onComplete?.();
    return;
  }

  let completedCount = 0;
  const totalToAnimate = targets.length;

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    if (!target) continue;

    const containerLabel = `ruins-${hexKey(target.hexCoord)}`;
    const container = layers.enemies.children.find(
      (child) => child.label === containerLabel
    ) as Container | undefined;

    if (!container) {
      console.warn(`[animateRuinsFlips] Could not find container: ${containerLabel}`);
      completedCount++;
      if (completedCount === totalToAnimate) {
        onComplete?.();
      }
      continue;
    }

    // Get the sprite (second child after mask)
    const sprite = container.children[1] as Sprite | undefined;
    if (!sprite) {
      console.warn(`[animateRuinsFlips] No sprite in container: ${containerLabel}`);
      completedCount++;
      if (completedCount === totalToAnimate) {
        onComplete?.();
      }
      continue;
    }

    // Load the revealed texture
    const revealedUrl = getRuinsTokenFaceUrl(target.tokenId);

    // Stagger the flips slightly
    const jitter = (Math.random() - 0.5) * 50;
    const delay = initialDelayMs + i * 100 + jitter;

    setTimeout(async () => {
      try {
        const revealedTexture = await loadTexture(revealedUrl);

        // Get the mask and border for X scaling
        const mask = container.children[0] as Graphics | undefined;
        const border = container.children[2] as Graphics | undefined;

        const additionalScaleTargets: { scale: { x: number } }[] = [];
        if (mask) additionalScaleTargets.push(mask);
        if (border) additionalScaleTargets.push(border);

        animateFlip(animManager, `ruins-flip-${i}`, container, {
          duration: ENEMY_FLIP_DURATION_MS,
          additionalScaleTargets,
          onMidpoint: () => {
            // Swap texture at midpoint
            sprite.texture = revealedTexture;
            sprite.width = RUINS_TOKEN_SIZE;
            sprite.height = RUINS_TOKEN_SIZE;
          },
          onComplete: () => {
            // Small dust puff on reveal
            const hexCenter = hexToPixel(target.hexCoord);
            particleManager.miniDustBurst(layers.particles, hexCenter, RUINS_TOKEN_SIZE / 2);

            completedCount++;
            if (completedCount === totalToAnimate) {
              onComplete?.();
            }
          },
        });
      } catch (error) {
        console.error(`[animateRuinsFlips] Failed to load texture: ${revealedUrl}`, error);
        completedCount++;
        if (completedCount === totalToAnimate) {
          onComplete?.();
        }
      }
    }, delay);
  }
}
