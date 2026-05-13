/**
 * Asset path helpers for game sprites and images
 */

/** Default web path for static game assets (served as `/assets` in dev and production). */
const DEFAULT_ASSETS_BASE = "/assets";
const ASSETS_BASE_QUERY_PARAM = "assetsBase";
const ASSETS_BASE_STORAGE_KEY = "mk.assetsBaseUrl";

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

  const withoutTrailingSlashes = trimmed.replace(/\/+$/, "");
  return withoutTrailingSlashes || "/";
}

/**
 * Returns true only for safe asset base URLs: absolute https/http origins or
 * same-origin paths starting with "/". Rejects javascript:, data:, and other
 * protocols that could be used to load content from untrusted sources.
 */
function isSafeAssetBaseUrl(url: string): boolean {
  if (url.startsWith("/")) return true;
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

function getConfiguredAssetsBaseUrl(): string {
  return (
    sessionAssetsBaseUrl ??
    normalizeAssetsBaseUrl((import.meta as RuntimeImportMeta).env?.VITE_ASSETS_BASE_URL) ??
    DEFAULT_ASSETS_BASE
  );
}

function getBrowserWindow(): Window | undefined {
  return typeof window === "undefined" ? undefined : window;
}

function getStoredAssetsBaseUrl(): string | null {
  try {
    const stored = normalizeAssetsBaseUrl(getBrowserWindow()?.localStorage.getItem(ASSETS_BASE_STORAGE_KEY));
    return stored !== null && isSafeAssetBaseUrl(stored) ? stored : null;
  } catch {
    return null;
  }
}

function setStoredAssetsBaseUrl(baseUrl: string | null): void {
  try {
    const storage = getBrowserWindow()?.localStorage;
    if (!storage) return;

    if (baseUrl === null) {
      storage.removeItem(ASSETS_BASE_STORAGE_KEY);
    } else {
      storage.setItem(ASSETS_BASE_STORAGE_KEY, baseUrl);
    }
  } catch {
    // Ignore storage errors. Asset loading should still fall back to configured defaults.
  }
}

function getQueryAssetsBaseUrl(): string | null | undefined {
  const search = getBrowserWindow()?.location.search;
  if (!search) return undefined;

  const queryValue = new URLSearchParams(search).get(ASSETS_BASE_QUERY_PARAM);
  if (queryValue === null) return undefined;

  if (queryValue.trim().toLowerCase() === "default") {
    setStoredAssetsBaseUrl(null);
    return null;
  }

  const normalized = normalizeAssetsBaseUrl(queryValue);
  if (normalized && isSafeAssetBaseUrl(normalized)) {
    setStoredAssetsBaseUrl(normalized);
    return normalized;
  }
  setStoredAssetsBaseUrl(null);
  return null;
}

function logAssetsBaseUrlForDevelopment(baseUrl: string): void {
  const env = (import.meta as RuntimeImportMeta).env;
  if (!env?.DEV || lastLoggedAssetsBaseUrl === baseUrl) return;

  lastLoggedAssetsBaseUrl = baseUrl;
  console.info(`[assets] Using asset base: ${baseUrl}`);
}

export function setAssetsBaseUrlForSession(baseUrl: string | null): void {
  sessionAssetsBaseUrl = normalizeAssetsBaseUrl(baseUrl) ?? undefined;
  lastLoggedAssetsBaseUrl = null;
}

export function getAssetsBaseUrl(): string {
  const queryAssetsBaseUrl = getQueryAssetsBaseUrl();
  const assetsBaseUrl =
    queryAssetsBaseUrl !== undefined
      ? queryAssetsBaseUrl ?? getConfiguredAssetsBaseUrl()
      : getStoredAssetsBaseUrl() ?? getConfiguredAssetsBaseUrl();

  logAssetsBaseUrlForDevelopment(assetsBaseUrl);
  return assetsBaseUrl;
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
