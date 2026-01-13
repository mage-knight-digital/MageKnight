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
  };
}

// We'll load this from the JSON file
let atlasData: AtlasData | null = null;

export async function loadAtlas(): Promise<AtlasData> {
  if (atlasData) return atlasData;

  const response = await fetch("/assets/atlas.json");
  atlasData = (await response.json()) as AtlasData;
  return atlasData;
}

// Synchronous version - assumes atlas is already loaded
export function getAtlas(): AtlasData | null {
  return atlasData;
}

export type CardCategory = "basic_actions" | "advanced_actions" | "spells" | "artifacts";

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

export function findCardInAtlas(cardId: CardId): { category: CardCategory; position: CardPosition } | null {
  if (!atlasData) return null;

  // Try exact match first, then try without hero prefix
  const idsToTry = [cardId as string, stripHeroPrefix(cardId as string)];

  for (const id of idsToTry) {
    for (const category of ["basic_actions", "advanced_actions", "spells", "artifacts"] as CardCategory[]) {
      const cards = atlasData.cards[category];
      // Skip description entries
      const position = cards[id];
      if (position && typeof position === "object" && "col" in position) {
        return { category, position };
      }
    }
  }

  return null;
}

export interface CardSpriteStyle {
  backgroundImage: string;
  backgroundPosition: string;
  backgroundSize: string;
  width: string;
  height: string;
}

/**
 * Get CSS styles to display a card from the sprite sheet
 */
export function getCardSpriteStyle(cardId: CardId, displayHeight: number = 140): CardSpriteStyle | null {
  if (!atlasData) return null;

  const found = findCardInAtlas(cardId);
  if (!found) return null;

  const { category, position } = found;
  const sheet = atlasData.sheets[category];
  if (!sheet) return null;

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
 * Get the mana color of a card (for border styling, etc.)
 */
export function getCardColor(cardId: CardId): string | null {
  if (!atlasData) return null;

  const found = findCardInAtlas(cardId);
  if (!found) return null;

  return found.position.color;
}
