/**
 * Hero token rendering for PixiJS hex grid
 *
 * Handles hero token display for all players:
 * - Hero sprite with circular mask
 * - Local player glow indicator
 * - Non-local player name labels
 * - Same-hex offset stacking for multiple heroes
 * - Portal emergence animation (intro)
 */

import { Container, Sprite, Graphics, Assets, Text, TextStyle } from "pixi.js";
import type { HexCoord } from "@mage-knight/shared";
import { getHeroTokenUrl } from "../../../../assets/assetPaths";
import type { WorldLayers } from "../types";
import { HEX_SIZE, HERO_TOKEN_RADIUS } from "../types";

/** Offset radius when multiple heroes share a hex */
const SAME_HEX_OFFSET = HEX_SIZE * 0.35;

/**
 * Calculate pixel offsets for heroes sharing the same hex.
 * Heroes are evenly spaced in a circle around the hex center.
 */
function getHeroOffset(indexInHex: number, totalInHex: number): { x: number; y: number } {
  if (totalInHex <= 1) return { x: 0, y: 0 };

  const angle = (2 * Math.PI * indexInHex) / totalInHex - Math.PI / 2;
  return {
    x: Math.cos(angle) * SAME_HEX_OFFSET,
    y: Math.sin(angle) * SAME_HEX_OFFSET,
  };
}

export interface HeroRenderOptions {
  /** Whether this is the local player's hero */
  isLocal: boolean;
  /** Hero display name for tooltip (non-local players) */
  heroName?: string;
  /** Index of this hero among heroes on the same hex (for offset) */
  indexInHex: number;
  /** Total heroes on the same hex */
  totalInHex: number;
}

/**
 * Render the hero token into a container
 * Uses the actual hero sprite from assets with circular mask
 *
 * @param container - Container to render hero into
 * @param position - Hero's hex position (null to clear)
 * @param heroId - Hero identifier for sprite lookup
 * @param options - Rendering options (local indicator, stacking)
 * @param onRightClick - Optional callback when hero token is right-clicked (local only)
 */
export async function renderHeroIntoContainer(
  container: Container,
  position: HexCoord | null,
  heroId: string | null,
  options: HeroRenderOptions,
  onRightClick?: () => void
): Promise<void> {
  container.removeChildren();

  if (!position || !heroId) return;

  const { isLocal, heroName, indexInHex, totalInHex } = options;
  const offset = getHeroOffset(indexInHex, totalInHex);

  try {
    const tokenUrl = getHeroTokenUrl(heroId);
    const texture = await Assets.load(tokenUrl);
    const sprite = new Sprite(texture);
    sprite.label = "hero-token";

    // Center the sprite and scale to appropriate size
    sprite.anchor.set(0.5);

    // Non-local heroes are slightly smaller
    const sizeMultiplier = isLocal ? 1.4 : 1.15;
    const targetSize = HEX_SIZE * sizeMultiplier;
    const scale = targetSize / Math.max(sprite.width, sprite.height);
    sprite.scale.set(scale);

    // Create circular mask to clip the octagonal asset to a circle
    const maskRadius = (targetSize / 2) * 0.95;
    const mask = new Graphics();
    mask.circle(offset.x, offset.y, maskRadius).fill({ color: 0xffffff });
    sprite.mask = mask;
    sprite.position.set(offset.x, offset.y);

    // Add border ring around the hero
    const borderColor = isLocal ? 0xffd700 : 0xffffff;
    const borderWidth = isLocal ? 3 : 2;
    const borderAlpha = isLocal ? 1.0 : 0.6;
    const border = new Graphics();
    border.circle(offset.x, offset.y, maskRadius).stroke({
      color: borderColor,
      width: borderWidth,
      alpha: borderAlpha,
    });

    container.addChild(mask);
    container.addChild(sprite);
    container.addChild(border);

    // Local player: add glow effect
    if (isLocal) {
      const glow = new Graphics();
      glow.circle(offset.x, offset.y, maskRadius + 4).stroke({
        color: 0xffd700,
        width: 2,
        alpha: 0.4,
      });
      container.addChild(glow);
    }

    // Non-local players: add name label
    if (!isLocal && heroName) {
      const style = new TextStyle({
        fontFamily: "serif",
        fontSize: 11,
        fill: 0xffffff,
        stroke: { color: 0x000000, width: 3 },
        align: "center",
      });
      const label = new Text({ text: heroName, style });
      label.anchor.set(0.5, 0);
      label.position.set(offset.x, offset.y + maskRadius + 4);
      container.addChild(label);
    }

    // Make container interactive for right-click (local hero only)
    if (onRightClick) {
      container.eventMode = "static";
      container.cursor = "pointer";
      const hitArea = new Graphics();
      hitArea.circle(offset.x, offset.y, maskRadius).fill({ color: 0xffffff, alpha: 0.001 });
      hitArea.eventMode = "static";
      hitArea.cursor = "pointer";
      hitArea.on("rightclick", (e) => {
        e.preventDefault?.();
        onRightClick();
      });
      container.addChild(hitArea);
    } else {
      // Non-local heroes: no interaction
      container.eventMode = "none";
    }
  } catch (error) {
    // Fallback to simple circle if sprite fails to load
    console.error(`Failed to load hero token for ${heroId}:`, error);
    const heroGraphics = new Graphics();
    heroGraphics.label = "hero-token";
    const fallbackColor = isLocal ? 0xff4444 : 0x4488ff;
    heroGraphics
      .circle(offset.x, offset.y, HERO_TOKEN_RADIUS)
      .fill({ color: fallbackColor })
      .stroke({ color: 0xffffff, width: 2 });

    if (onRightClick) {
      container.eventMode = "static";
      container.cursor = "pointer";
      heroGraphics.eventMode = "static";
      heroGraphics.on("rightclick", (e) => {
        e.preventDefault?.();
        onRightClick();
      });
    }

    container.addChild(heroGraphics);
  }
}

/**
 * Get or create a hero container for a specific player.
 * Each player gets their own container in the hero layer.
 *
 * @param layers - World layer containers
 * @param heroContainersRef - Map of playerId -> Container
 * @param playerId - The player's ID
 * @returns The hero container for this player
 */
export function getOrCreateHeroContainer(
  layers: WorldLayers,
  heroContainersRef: React.MutableRefObject<Map<string, Container>>,
  playerId: string
): Container {
  const existing = heroContainersRef.current.get(playerId);
  if (existing) return existing;

  const container = new Container();
  container.label = `hero-container-${playerId}`;
  layers.hero.eventMode = "passive";
  layers.hero.addChild(container);
  heroContainersRef.current.set(playerId, container);
  return container;
}

/**
 * Remove hero containers for players that are no longer in the game.
 *
 * @param heroContainersRef - Map of playerId -> Container
 * @param activePlayerIds - Set of currently active player IDs
 */
export function cleanupStaleHeroContainers(
  heroContainersRef: React.MutableRefObject<Map<string, Container>>,
  activePlayerIds: Set<string>
): void {
  for (const [playerId, container] of heroContainersRef.current) {
    if (!activePlayerIds.has(playerId)) {
      container.destroy({ children: true });
      heroContainersRef.current.delete(playerId);
    }
  }
}
