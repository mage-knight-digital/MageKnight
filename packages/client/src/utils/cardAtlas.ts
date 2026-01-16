import type { CardId, UnitId, TacticId } from "@mage-knight/shared";

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

interface IconSheetInfo {
  file: string;
  width: number;
  height: number;
  cols: number;
  rows: number;
  iconWidth: number;
  iconHeight: number;
}

interface CardPosition {
  col: number;
  row: number;
  color: string;
}

interface UnitPosition {
  sheet: string;
  col: number;
  row: number;
}

interface IconPosition {
  col: number;
  row: number;
}

interface AtlasData {
  sheets: Record<string, SheetInfo>;
  cards: {
    basic_actions: Record<string, CardPosition>;
    advanced_actions: Record<string, CardPosition>;
    spells: Record<string, CardPosition>;
    artifacts: Record<string, CardPosition>;
    wound: Record<string, CardPosition>;
    tactics: Record<string, CardPosition>;
  };
  units: {
    elite: Record<string, UnitPosition>;
    regular: Record<string, UnitPosition>;
  };
  icons: {
    crystals: Record<string, IconPosition>;
  };
}

// Separate type for raw JSON which may have icon sheets mixed in
interface RawAtlasData extends Omit<AtlasData, "sheets"> {
  sheets: Record<string, SheetInfo | IconSheetInfo>;
}

export interface CardSpriteStyle {
  backgroundImage: string;
  backgroundPosition: string;
  backgroundSize: string;
  width: string;
  height: string;
}

export type CardCategory = "basic_actions" | "advanced_actions" | "spells" | "artifacts" | "wound" | "tactics";

// Precomputed caches - populated once at load time
// Using Maps for fast, consistent O(1) lookup during renders
const spriteStyleCache = new Map<string, CardSpriteStyle>();
const cardColorCache = new Map<string, string>();
const unitSpriteStyleCache = new Map<string, CardSpriteStyle>();
const tacticSpriteStyleCache = new Map<string, CardSpriteStyle>();
const crystalSpriteStyleCache = new Map<string, CardSpriteStyle>();

// Default display height for crystals
const CRYSTAL_DEFAULT_HEIGHT = 24;

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

// Default display height for units (shorter than deed cards)
const UNIT_DEFAULT_HEIGHT = 140;

// Default display height for tactics (same as deed cards)
const TACTIC_DEFAULT_HEIGHT = 180;

/**
 * Precompute all unit sprite styles.
 * Units have a different structure in atlas.json (nested by type with sheet reference).
 */
function precomputeUnitStyles(atlasData: AtlasData, displayHeight: number): void {
  const unitTypes = ["elite", "regular"] as const;

  for (const unitType of unitTypes) {
    const units = atlasData.units[unitType];
    if (!units) continue;

    for (const [unitId, position] of Object.entries(units)) {
      // Skip description entries
      if (unitId.startsWith("_")) continue;
      if (!position || typeof position !== "object" || !("sheet" in position)) continue;

      const sheet = atlasData.sheets[position.sheet];
      if (!sheet) continue;

      // Create a CardPosition-compatible object for computeSpriteStyle
      const cardPosition: CardPosition = {
        col: position.col,
        row: position.row,
        color: unitType === "elite" ? "gold" : "silver",
      };

      const style = computeSpriteStyle(sheet, cardPosition, displayHeight);
      unitSpriteStyleCache.set(unitId, style);
    }
  }
}

/**
 * Precompute all tactic sprite styles.
 */
function precomputeTacticStyles(atlasData: AtlasData, displayHeight: number): void {
  const sheet = atlasData.sheets["tactics"];
  const tactics = atlasData.cards["tactics"];

  if (!sheet || !tactics) return;

  for (const [tacticId, position] of Object.entries(tactics)) {
    // Skip description entries
    if (tacticId.startsWith("_")) continue;
    if (!position || typeof position !== "object" || !("col" in position)) continue;

    const style = computeSpriteStyle(sheet, position, displayHeight);
    tacticSpriteStyleCache.set(tacticId, style);
  }
}

/**
 * Compute sprite style for an icon (not a card - uses iconWidth/iconHeight)
 */
function computeIconSpriteStyle(
  sheet: IconSheetInfo,
  position: IconPosition,
  displayHeight: number
): CardSpriteStyle {
  // Calculate aspect ratio and display width
  const aspectRatio = sheet.iconWidth / sheet.iconHeight;
  const displayWidth = displayHeight * aspectRatio;

  // Calculate scale factor
  const scale = displayHeight / sheet.iconHeight;

  // Calculate background position (negative because CSS background-position)
  const bgX = position.col * sheet.iconWidth * scale;
  const bgY = position.row * sheet.iconHeight * scale;

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
 * Precompute all crystal icon sprite styles.
 */
function precomputeCrystalStyles(atlasData: RawAtlasData, displayHeight: number): void {
  const sheet = atlasData.sheets["crystals"] as IconSheetInfo | undefined;
  const crystals = atlasData.icons?.crystals;

  if (!sheet || !crystals) return;

  for (const [crystalColor, position] of Object.entries(crystals)) {
    // Skip description entries
    if (crystalColor.startsWith("_")) continue;
    if (!position || typeof position !== "object" || !("col" in position)) continue;

    const style = computeIconSpriteStyle(sheet, position, displayHeight);
    crystalSpriteStyleCache.set(crystalColor, style);
  }
}

/**
 * Load the atlas and precompute all sprite styles.
 * This is the only function that accesses the raw JSON data.
 */
export async function loadAtlas(): Promise<void> {
  if (atlasLoaded) return;

  const response = await fetch("/assets/atlas.json");
  const rawData = (await response.json()) as RawAtlasData;

  // Cast to AtlasData for card/unit/tactic functions (they only access SheetInfo sheets)
  const atlasData = rawData as unknown as AtlasData;

  // Precompute all styles at the default display height used by FloatingHand
  // Additional heights can be computed on-demand if needed
  precomputeAllStyles(atlasData, 180);

  // Precompute unit styles at their default height
  precomputeUnitStyles(atlasData, UNIT_DEFAULT_HEIGHT);

  // Precompute tactic styles at their default height
  precomputeTacticStyles(atlasData, TACTIC_DEFAULT_HEIGHT);

  // Precompute crystal icon styles at their default height (uses raw data for icon sheets)
  precomputeCrystalStyles(rawData, CRYSTAL_DEFAULT_HEIGHT);

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

/**
 * Get CSS styles to display a unit from the sprite sheet.
 * Returns precomputed styles from cache - O(1) Map lookup.
 *
 * Note: For "heroes" unit, the atlas has heroes_1, heroes_2, heroes_3, heroes_4.
 * Pass the specific variant ID (e.g., "heroes_1") or just "heroes" for the first variant.
 */
export function getUnitSpriteStyle(unitId: UnitId, displayHeight: number = UNIT_DEFAULT_HEIGHT): CardSpriteStyle | null {
  if (!atlasLoaded) return null;

  const id = unitId as string;

  // Try exact match first
  let style = unitSpriteStyleCache.get(id);

  // For "heroes" unit type, try heroes_1 as fallback
  if (!style && id === "heroes") {
    style = unitSpriteStyleCache.get("heroes_1");
  }

  if (!style) return null;

  // If requested height matches cached height, return directly
  if (displayHeight === UNIT_DEFAULT_HEIGHT) {
    return style;
  }

  // Otherwise scale the cached style to the requested height
  return scaleStyle(style, UNIT_DEFAULT_HEIGHT, displayHeight);
}

/**
 * Get CSS styles to display a tactic from the sprite sheet.
 * Returns precomputed styles from cache - O(1) Map lookup.
 */
export function getTacticSpriteStyle(tacticId: TacticId, displayHeight: number = TACTIC_DEFAULT_HEIGHT): CardSpriteStyle | null {
  if (!atlasLoaded) return null;

  const id = tacticId as string;
  const style = tacticSpriteStyleCache.get(id);

  if (!style) return null;

  // If requested height matches cached height, return directly
  if (displayHeight === TACTIC_DEFAULT_HEIGHT) {
    return style;
  }

  // Otherwise scale the cached style to the requested height
  return scaleStyle(style, TACTIC_DEFAULT_HEIGHT, displayHeight);
}

/** Valid crystal colors for getCrystalSpriteStyle */
export type CrystalColor = "white" | "green" | "red" | "blue";

/**
 * Get CSS styles to display a crystal icon from the sprite sheet.
 * Returns precomputed styles from cache - O(1) Map lookup.
 */
export function getCrystalSpriteStyle(color: CrystalColor, displayHeight: number = CRYSTAL_DEFAULT_HEIGHT): CardSpriteStyle | null {
  if (!atlasLoaded) return null;

  const style = crystalSpriteStyleCache.get(color);
  if (!style) return null;

  // If requested height matches cached height, return directly
  if (displayHeight === CRYSTAL_DEFAULT_HEIGHT) {
    return style;
  }

  // Otherwise scale the cached style to the requested height
  return scaleStyle(style, CRYSTAL_DEFAULT_HEIGHT, displayHeight);
}
