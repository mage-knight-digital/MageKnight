/**
 * Asset path helpers for game sprites and images
 */

/** Default web path for static game assets (served as `/assets` in dev and production). */
const DEFAULT_ASSETS_BASE = "/assets";

/**
 * Returns an absolute URL path under the game asset root.
 * Leading slashes on `path` are ignored so `icons/x.png` and `/icons/x.png` resolve the same.
 * The implementation reserves a single place to swap in a CDN base or version prefix later.
 */
export function assetUrl(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return DEFAULT_ASSETS_BASE;
  const relative = trimmed.replace(/^\/+/, "");
  return `${DEFAULT_ASSETS_BASE}/${relative}`;
}

export function getEnemyImageUrl(enemyId: string): string {
  // Enemy IDs use underscores, file names use underscores too
  return assetUrl(`enemies/${enemyId}.jpg`);
}

export type EnemyTokenColor = "green" | "grey" | "brown" | "violet" | "red" | "white";

export function getEnemyTokenBackUrl(color: EnemyTokenColor): string {
  return assetUrl(`enemies/backs/${color}.png`);
}

/**
 * Extract the base enemy ID from a token ID.
 * Token IDs are formatted as "{enemyId}_{counter}" (e.g., "diggers_1" -> "diggers")
 */
export function tokenIdToEnemyId(tokenId: string): string {
  // Remove the trailing _N counter
  const match = tokenId.match(/^(.+)_\d+$/);
  return match?.[1] ?? tokenId;
}

export function getTileImageUrl(tileId: string): string {
  return assetUrl(`tiles/${tileId}.png`);
}

export function getCardSheetUrl(sheet: "basic_actions" | "advanced_actions" | "spells" | "artifacts"): string {
  return assetUrl(`cards/${sheet}.jpg`);
}

export function getCardBackUrl(): string {
  return assetUrl("cards/card_back.jpg");
}

export function getHeroTokenUrl(heroId: string): string {
  // Note: "_card" files are actually the octagonal portrait tokens for the board
  // "_token" files are smaller circular tokens (naming is backwards in assets)
  return assetUrl(`heroes/${heroId}_card.png`);
}

/**
 * Get the URL for a ruins token face image.
 * Used when the token is revealed (face-up).
 */
export function getRuinsTokenFaceUrl(tokenId: string): string {
  return assetUrl(`sites/ruins/${tokenId}.png`);
}

/**
 * Get the URL for the ruins token back image.
 * All unrevealed ruins tokens show the same yellow back.
 */
export function getRuinsTokenBackUrl(): string {
  return assetUrl("enemies/backs/yellow.png");
}
