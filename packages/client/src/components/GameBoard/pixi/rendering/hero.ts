/**
 * Hero token rendering for PixiJS hex grid
 *
 * Handles hero token display and portal emergence animation:
 * - Hero sprite with circular mask
 * - Portal particle effect during intro
 * - Shimmer/materialize animation
 */

import { Container, Sprite, Graphics, Assets } from "pixi.js";
import type { HexCoord } from "@mage-knight/shared";
import { getHeroTokenUrl } from "../../../../assets/assetPaths";
import type { WorldLayers } from "../types";
import { HEX_SIZE, HERO_TOKEN_RADIUS } from "../types";

/**
 * Render the hero token into a container
 * Uses the actual hero sprite from assets with circular mask
 *
 * @param container - Container to render hero into
 * @param position - Hero's hex position (null to clear)
 * @param heroId - Hero identifier for sprite lookup
 */
export async function renderHeroIntoContainer(
  container: Container,
  position: HexCoord | null,
  heroId: string | null
): Promise<void> {
  container.removeChildren();

  if (!position || !heroId) return;

  try {
    const tokenUrl = getHeroTokenUrl(heroId);
    const texture = await Assets.load(tokenUrl);
    const sprite = new Sprite(texture);
    sprite.label = "hero-token";

    // Center the sprite and scale to appropriate size
    sprite.anchor.set(0.5);

    // Scale to fit nicely on the hex (hero tokens are larger images)
    const targetSize = HEX_SIZE * 1.4;
    const scale = targetSize / Math.max(sprite.width, sprite.height);
    sprite.scale.set(scale);

    // Create circular mask to clip the octagonal asset to a circle
    const maskRadius = (targetSize / 2) * 0.95;
    const mask = new Graphics();
    mask.circle(0, 0, maskRadius).fill({ color: 0xffffff });
    sprite.mask = mask;

    // Add border ring around the hero
    const border = new Graphics();
    border.circle(0, 0, maskRadius).stroke({ color: 0xffffff, width: 2, alpha: 0.8 });

    container.addChild(mask);
    container.addChild(sprite);
    container.addChild(border);
  } catch (error) {
    // Fallback to simple circle if sprite fails to load
    console.error(`Failed to load hero token for ${heroId}:`, error);
    const heroGraphics = new Graphics();
    heroGraphics.label = "hero-token";
    heroGraphics
      .circle(0, 0, HERO_TOKEN_RADIUS)
      .fill({ color: 0xff4444 })
      .stroke({ color: 0xffffff, width: 2 });
    container.addChild(heroGraphics);
  }
}

/**
 * Get or create the hero container for animation
 * Ensures only one hero container exists in the hero layer
 *
 * @param layers - World layer containers
 * @param heroContainerRef - Mutable ref to store container reference
 * @returns The hero container
 */
export function getOrCreateHeroContainer(
  layers: WorldLayers,
  heroContainerRef: React.MutableRefObject<Container | null>
): Container {
  if (!heroContainerRef.current) {
    const container = new Container();
    container.label = "hero-container";
    layers.hero.addChild(container);
    heroContainerRef.current = container;
  }
  return heroContainerRef.current;
}
