/**
 * Asset path helpers for game sprites and images
 */

import {
  MANA_BLACK,
  MANA_BLUE,
  MANA_GOLD,
  MANA_GREEN,
  MANA_RED,
  MANA_WHITE,
  type ManaColor,
} from "@mage-knight/shared";

/** Default web path for static game assets (served as `/assets` in dev and production). */
const DEFAULT_ASSETS_BASE = "/assets";

type ManaIconVariant = "flat" | "glossy";

const MANA_ICON_FILES: Record<ManaColor, string> = {
  [MANA_RED]: "red",
  [MANA_BLUE]: "blue",
  [MANA_GREEN]: "green",
  [MANA_WHITE]: "white",
  [MANA_GOLD]: "gold",
  [MANA_BLACK]: "black",
};

type RuntimeImportMeta = ImportMeta & {
  env?: {
    DEV?: boolean;
    VITE_ASSETS_BASE_URL?: string;
  };
};

let sessionAssetsBaseUrl: string | undefined;
let lastLoggedAssetsBaseUrl: string | null = null;

function normalizeAssetsBaseUrl(baseUrl: string | null | undefined): string | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "") || "/";
}

function logAssetsBaseUrlForDevelopment(baseUrl: string): void {
  const env = (import.meta as RuntimeImportMeta).env;
  if (!env?.DEV || lastLoggedAssetsBaseUrl === baseUrl) return;
  lastLoggedAssetsBaseUrl = baseUrl;
  console.info(`[assets] Using asset base: ${baseUrl}`);
}

/**
 * Override the asset base URL for the current session. Pass null to reset to
 * the build-time default. Useful for testing CDN deploys without a rebuild:
 * call from app init code or the browser console.
 */
export function setAssetsBaseUrlForSession(baseUrl: string | null): void {
  sessionAssetsBaseUrl = normalizeAssetsBaseUrl(baseUrl) ?? undefined;
  lastLoggedAssetsBaseUrl = null;
}

export function getAssetsBaseUrl(): string {
  const url =
    sessionAssetsBaseUrl ??
    normalizeAssetsBaseUrl((import.meta as RuntimeImportMeta).env?.VITE_ASSETS_BASE_URL) ??
    DEFAULT_ASSETS_BASE;
  logAssetsBaseUrlForDevelopment(url);
  return url;
}

/**
 * Returns an absolute URL path under the game asset root.
 * Leading slashes on `path` are ignored so `icons/x.png` and `/icons/x.png` resolve the same.
 * The implementation reserves a single place to swap in a CDN base or version prefix later.
 */
export function assetUrl(path: string): string {
  const assetsBaseUrl = getAssetsBaseUrl();
  const trimmed = path.trim();
  if (!trimmed) return assetsBaseUrl;
  const relative = trimmed.replace(/^\/+/, "");
  return `${assetsBaseUrl}/${relative}`;
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

export function getManaIconUrl(color: ManaColor, variant: ManaIconVariant = "flat"): string {
  return assetUrl(`mana_icons/${variant}/${MANA_ICON_FILES[color]}.png`);
}

export function getHeroTokenUrl(heroId: string): string {
  // Octagonal agon portrait tokens used on the board and setup splash (not circular chips).
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
