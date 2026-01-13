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
  atlasData = await response.json();
  return atlasData!;
}

// Synchronous version - assumes atlas is already loaded
export function getAtlas(): AtlasData | null {
  return atlasData;
}

export type CardCategory = "basic_actions" | "advanced_actions" | "spells" | "artifacts";

export function findCardInAtlas(cardId: CardId): { category: CardCategory; position: CardPosition } | null {
  if (!atlasData) return null;

  for (const category of ["basic_actions", "advanced_actions", "spells", "artifacts"] as CardCategory[]) {
    const cards = atlasData.cards[category];
    // Skip description entries
    const position = cards[cardId as string];
    if (position && typeof position === "object" && "col" in position) {
      return { category, position };
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

  // Calculate aspect ratio and display width
  const aspectRatio = sheet.cardWidth / sheet.cardHeight;
  const displayWidth = displayHeight * aspectRatio;

  // Calculate scale factor
  const scale = displayHeight / sheet.cardHeight;

  // Calculate background position (negative because CSS background-position)
  const bgX = position.col * sheet.cardWidth * scale;
  const bgY = position.row * sheet.cardHeight * scale;

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
