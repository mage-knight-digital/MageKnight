/**
 * Asset path helpers for game sprites and images
 */

// Base path for all assets
const ASSETS_BASE = "/assets";

export function getEnemyImageUrl(enemyId: string): string {
  // Enemy IDs use underscores, file names use underscores too
  return `${ASSETS_BASE}/enemies/${enemyId}.jpg`;
}

export type EnemyTokenColor = "green" | "grey" | "brown" | "violet" | "red" | "white";

export function getEnemyTokenBackUrl(color: EnemyTokenColor): string {
  return `${ASSETS_BASE}/enemies/backs/${color}.png`;
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
  return `${ASSETS_BASE}/tiles/${tileId}.png`;
}

export function getCardSheetUrl(sheet: "basic_actions" | "advanced_actions" | "spells" | "artifacts"): string {
  return `${ASSETS_BASE}/cards/${sheet}.jpg`;
}

export function getCardBackUrl(): string {
  return `${ASSETS_BASE}/cards/card_back.jpg`;
}

export function getHeroTokenUrl(heroId: string): string {
  // Note: "_card" files are actually the octagonal portrait tokens for the board
  // "_token" files are smaller circular tokens (naming is backwards in assets)
  return `${ASSETS_BASE}/heroes/${heroId}_card.png`;
}

/**
 * Get the URL for a ruins token face image.
 * Used when the token is revealed (face-up).
 */
export function getRuinsTokenFaceUrl(tokenId: string): string {
  return `${ASSETS_BASE}/sites/ruins/${tokenId}.png`;
}

/**
 * Get the URL for the ruins token back image.
 * All unrevealed ruins tokens show the same yellow back.
 */
export function getRuinsTokenBackUrl(): string {
  return `${ASSETS_BASE}/enemies/backs/yellow.png`;
}
