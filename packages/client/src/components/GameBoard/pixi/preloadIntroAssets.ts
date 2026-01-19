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
async function preloadAndCache(url: string): Promise<void> {
  // Skip if already in PixiJS cache
  if (Assets.cache.has(url)) {
    return;
  }

  try {
    // Fetch the image as a blob
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    const blob = await response.blob();

    // Use createImageBitmap for off-main-thread decoding
    // This is more reliable than Image.decode() for various image sizes
    await createImageBitmap(blob);

    // Now load into PixiJS cache - should be instant since image is in browser cache
    await Assets.load(url);
  } catch (error) {
    console.warn(`[preloadIntroAssets] Failed to preload: ${url}`, error);
  }
}

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
  const startTime = performance.now();
  const urlsToPreload: string[] = [];

  // Collect tile image URLs
  for (const tile of state.map.tiles) {
    urlsToPreload.push(getTileImageUrl(tile.tileId));
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

  // Preload all URLs in parallel
  await Promise.all(urlsToPreload.map(preloadAndCache));

  const elapsed = performance.now() - startTime;
  console.log(
    `[preloadIntroAssets] Preloaded ${urlsToPreload.length} assets in ${elapsed.toFixed(0)}ms`
  );
}
