/**
 * Preload intro assets for smooth animation
 *
 * Preloads tile images, enemy tokens, and hero token BEFORE the intro
 * animation starts. Uses Image.decode() for off-main-thread decoding,
 * then loads into PixiJS Assets cache so they're ready instantly.
 *
 * This prevents jank during tile drop animation where textures were
 * previously loaded on-demand, blocking the main thread.
 */

import { Assets } from "pixi.js";
import type { ClientGameState } from "@mage-knight/shared";
import {
  getTileImageUrl,
  getEnemyTokenBackUrl,
  getHeroTokenUrl,
  type EnemyTokenColor,
} from "../../../assets/assetPaths";

/**
 * Preload and decode an image off the main thread, then add to PixiJS cache.
 * Uses createImageBitmap() for reliable off-main-thread decoding.
 * Returns immediately if already cached.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap
 */

/**
 * Preload all assets needed for the intro animation.
 * Call this BEFORE starting the intro sequence.
 *
 * @param state - Current game state with tiles, hexes, and player info
 * @param heroId - Hero ID for the current player
 * @returns Promise that resolves when all assets are preloaded
 */
export async function preloadIntroAssets(
  state: ClientGameState,
  heroId: string | null
): Promise<void> {
  const urlsToPreload: string[] = [];

  // Collect tile image URLs (only for revealed tiles that have tileId)
  for (const tile of state.map.tiles) {
    if (tile.tileId) {
      urlsToPreload.push(getTileImageUrl(tile.tileId));
    }
  }

  // Collect enemy token back URLs (we only need the back colors for unrevealed enemies)
  const enemyColors = new Set<EnemyTokenColor>();
  for (const hex of Object.values(state.map.hexes)) {
    for (const enemy of hex.enemies) {
      const color = (enemy.color === "gray" ? "grey" : enemy.color) as EnemyTokenColor;
      enemyColors.add(color);
    }
  }
  for (const color of enemyColors) {
    urlsToPreload.push(getEnemyTokenBackUrl(color));
  }

  // Collect hero token URL
  if (heroId) {
    urlsToPreload.push(getHeroTokenUrl(heroId));
  }

  // GPU texture upload is unavoidably blocking in JavaScript.
  // To minimize perceived jank, we load textures ONE AT A TIME with yields
  // between each upload, allowing animations (dust particles) to run.
  // See: https://pixijs.com/8.x/guides/components/textures
  for (const url of urlsToPreload) {
    if (!Assets.cache.has(url)) {
      await Assets.load(url);
      // Yield to event loop after each texture upload so animations can run
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
}
