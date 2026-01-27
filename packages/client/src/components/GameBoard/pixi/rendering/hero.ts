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
 * @param onRightClick - Optional callback when hero token is right-clicked
 */
export async function renderHeroIntoContainer(
  container: Container,
  position: HexCoord | null,
  heroId: string | null,
  onRightClick?: () => void
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

    // Make container interactive for right-click to open site panel
    // Add hit area LAST so it's on top and captures events
    if (onRightClick) {
      container.eventMode = "static";
      container.cursor = "pointer";
      // Create a hit area that covers the hero token (on top of all visuals)
      const hitArea = new Graphics();
      hitArea.circle(0, 0, maskRadius).fill({ color: 0xffffff, alpha: 0.001 });
      hitArea.eventMode = "static";
      hitArea.cursor = "pointer";
      hitArea.on("rightclick", (e) => {
        e.preventDefault?.();
        onRightClick();
      });
      container.addChild(hitArea);
    }
  } catch (error) {
    // Fallback to simple circle if sprite fails to load
    console.error(`Failed to load hero token for ${heroId}:`, error);
    const heroGraphics = new Graphics();
    heroGraphics.label = "hero-token";
    heroGraphics
      .circle(0, 0, HERO_TOKEN_RADIUS)
      .fill({ color: 0xff4444 })
      .stroke({ color: 0xffffff, width: 2 });

    // Make fallback token also interactive for right-click
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
    // Enable event passthrough on the hero layer so children can receive events
    layers.hero.eventMode = "passive";
    layers.hero.addChild(container);
    heroContainerRef.current = container;
  }
  return heroContainerRef.current;
}
