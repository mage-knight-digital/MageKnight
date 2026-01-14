import type { CardId } from "@mage-knight/shared";

// Atlas data - matches public/assets/atlas.json
interface SheetInfo {
  file: string;
  width: number;
  height: number;
  cols: number;
  rows: number;
  cardWidth: number;
  cardHeight: number;
  hasEvenOddLayout?: boolean;
}

interface CardPosition {
  col: number;
  row: number;
  color: string;
}

interface AtlasData {
  sheets: Record<string, SheetInfo>;
  cards: {
    basic_actions: Record<string, CardPosition>;
    advanced_actions: Record<string, CardPosition>;
    spells: Record<string, CardPosition>;
    artifacts: Record<string, CardPosition>;
    wound: Record<string, CardPosition>;
  };
}

export interface CardSpriteStyle {
  backgroundImage: string;
  backgroundPosition: string;
  backgroundSize: string;
  width: string;
  height: string;
}

export type CardCategory = "basic_actions" | "advanced_actions" | "spells" | "artifacts" | "wound";

// Precomputed caches - populated once at load time
// Using Maps for fast, consistent O(1) lookup during renders
const spriteStyleCache = new Map<string, CardSpriteStyle>();
const cardColorCache = new Map<string, string>();

// Track if atlas has been loaded and processed
let atlasLoaded = false;

// Hero prefixes used for hero-specific cards
const HERO_PREFIXES = [
  "arythea_",
  "goldyx_",
  "norowas_",
  "tovak_",
  "wolfhawk_",
  "krang_",
  "braevalar_",
  "ymirgh_",
];

/**
 * Strip hero prefix from card ID if present.
 * e.g., "arythea_battle_versatility" -> "battle_versatility"
 */
function stripHeroPrefix(cardId: string): string {
  for (const prefix of HERO_PREFIXES) {
    if (cardId.startsWith(prefix)) {
      return cardId.slice(prefix.length);
    }
  }
  return cardId;
}

/**
 * Compute sprite style for a single card (internal helper, called at load time)
 */
function computeSpriteStyle(
  sheet: SheetInfo,
  position: CardPosition,
  displayHeight: number
): CardSpriteStyle {
  // For sheets with even/odd layout, a full card spans 2 rows (artwork + text)
  const fullCardHeight = sheet.hasEvenOddLayout ? sheet.cardHeight * 2 : sheet.cardHeight;

  // Calculate aspect ratio and display width
  const aspectRatio = sheet.cardWidth / fullCardHeight;
  const displayWidth = displayHeight * aspectRatio;

  // Calculate scale factor
  const scale = displayHeight / fullCardHeight;

  // Calculate background position (negative because CSS background-position)
  // For sheets with even/odd layout, artwork is on even rows (row * 2)
  const physicalRow = sheet.hasEvenOddLayout ? position.row * 2 : position.row;
  const bgX = position.col * sheet.cardWidth * scale;
  const bgY = physicalRow * sheet.cardHeight * scale;

  // Calculate scaled background size
  const bgWidth = sheet.width * scale;
  const bgHeight = sheet.height * scale;

  return {
    backgroundImage: `url(/assets/${sheet.file})`,
    backgroundPosition: `-${bgX}px -${bgY}px`,
    backgroundSize: `${bgWidth}px ${bgHeight}px`,
    width: `${displayWidth}px`,
    height: `${displayHeight}px`,
  };
}

/**
 * Precompute all sprite styles and colors for every card in the atlas.
 * Called once at load time to populate the caches.
 */
function precomputeAllStyles(atlasData: AtlasData, displayHeight: number): void {
  const categories: CardCategory[] = ["basic_actions", "advanced_actions", "spells", "artifacts", "wound"];

  for (const category of categories) {
    const sheet = atlasData.sheets[category];
    const cards = atlasData.cards[category];

    if (!sheet || !cards) continue;

    for (const [cardId, position] of Object.entries(cards)) {
      // Skip description entries (start with _)
      if (cardId.startsWith("_")) continue;
      if (!position || typeof position !== "object" || !("col" in position)) continue;

      // Compute and cache sprite style
      const style = computeSpriteStyle(sheet, position, displayHeight);
      spriteStyleCache.set(cardId, style);

      // Cache card color
      cardColorCache.set(cardId, position.color);
    }
  }
  // Hero-prefixed cards (e.g., "arythea_march") are handled at lookup time
  // via stripHeroPrefix() - no need to precompute all combinations
}

/**
 * Load the atlas and precompute all sprite styles.
 * This is the only function that accesses the raw JSON data.
 */
export async function loadAtlas(): Promise<void> {
  if (atlasLoaded) return;

  const response = await fetch("/assets/atlas.json");
  const atlasData = (await response.json()) as AtlasData;

  // Precompute all styles at the default display height used by FloatingHand
  // Additional heights can be computed on-demand if needed
  precomputeAllStyles(atlasData, 180);

  // Mark as loaded - we no longer need the raw atlas data
  atlasLoaded = true;
}

/**
 * Check if the atlas has been loaded
 */
export function isAtlasLoaded(): boolean {
  return atlasLoaded;
}

/**
 * Get CSS styles to display a card from the sprite sheet.
 * Returns precomputed styles from cache - O(1) Map lookup.
 */
export function getCardSpriteStyle(cardId: CardId, displayHeight: number = 180): CardSpriteStyle | null {
  if (!atlasLoaded) return null;

  const id = cardId as string;

  // Try exact match first
  let style = spriteStyleCache.get(id);
  if (style) {
    // If requested height matches cached height (180), return directly
    if (displayHeight === 180) {
      return style;
    }
    // Otherwise scale the cached style to the requested height
    return scaleStyle(style, 180, displayHeight);
  }

  // Try without hero prefix
  const baseId = stripHeroPrefix(id);
  style = spriteStyleCache.get(baseId);
  if (style) {
    if (displayHeight === 180) {
      return style;
    }
    return scaleStyle(style, 180, displayHeight);
  }

  return null;
}

/**
 * Scale a precomputed style to a different display height
 */
function scaleStyle(style: CardSpriteStyle, fromHeight: number, toHeight: number): CardSpriteStyle {
  const scaleFactor = toHeight / fromHeight;

  // Parse the numeric values from the style strings
  const parsePixels = (s: string) => parseFloat(s.replace("px", ""));

  const oldWidth = parsePixels(style.width);
  const oldBgSize = style.backgroundSize.split(" ").map(parsePixels);
  const oldBgPos = style.backgroundPosition.split(" ").map(s => parseFloat(s.replace("px", "")));

  const bgPosX = oldBgPos[0] ?? 0;
  const bgPosY = oldBgPos[1] ?? 0;
  const bgSizeW = oldBgSize[0] ?? 0;
  const bgSizeH = oldBgSize[1] ?? 0;

  return {
    backgroundImage: style.backgroundImage,
    backgroundPosition: `${bgPosX * scaleFactor}px ${bgPosY * scaleFactor}px`,
    backgroundSize: `${bgSizeW * scaleFactor}px ${bgSizeH * scaleFactor}px`,
    width: `${oldWidth * scaleFactor}px`,
    height: `${toHeight}px`,
  };
}

/**
 * Get the mana color of a card (for border styling, etc.)
 * Returns precomputed color from cache - O(1) Map lookup.
 */
export function getCardColor(cardId: CardId): string | null {
  if (!atlasLoaded) return null;

  const id = cardId as string;

  // Try exact match first
  let color = cardColorCache.get(id);
  if (color) return color;

  // Try without hero prefix
  const baseId = stripHeroPrefix(id);
  color = cardColorCache.get(baseId);
  if (color) return color;

  return null;
}
