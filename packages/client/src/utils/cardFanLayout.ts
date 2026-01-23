/**
 * Shared utilities for card fan layouts (hand cards, tactic cards, etc.)
 * Provides consistent z-ordering and layout calculations across card displays.
 */

/**
 * Calculate z-index for a card based on which card is the z-index anchor.
 * Inscryption-style: when hovering, reorder entire hand so anchored card
 * is on top, cards to the left stack behind going left, cards to the right
 * have lowest z-index. The anchor persists after mouse leaves until a new
 * card is hovered.
 *
 * @param index - The index of the card in the fan
 * @param totalCards - Total number of cards in the fan
 * @param zIndexAnchor - The index of the card that should be on top (null for default ordering)
 * @returns The z-index value for this card
 */
export function calculateZIndex(
  index: number,
  totalCards: number,
  zIndexAnchor: number | null
): number {
  if (zIndexAnchor === null) {
    // Default: rightmost card on top (ascending z-index left to right)
    return 50 + index;
  }

  // When anchored, reorder z-indexes:
  // - Anchored card gets highest
  // - Cards to the LEFT of anchor: higher z-index closer to anchor
  // - Cards to the RIGHT of anchor: get lowest values

  if (index === zIndexAnchor) {
    // Anchored card is always on top
    return 50 + totalCards;
  } else if (index < zIndexAnchor) {
    // Cards to the left: higher z-index the closer to anchor
    return 50 + index;
  } else {
    // Cards to the right of anchor: push them behind
    return 40 + (totalCards - index);
  }
}

/**
 * View mode type shared across card fan components
 */
export type CardFanViewMode = "board" | "ready" | "focus";

/**
 * Base card height scale (percentage of viewport height).
 * Cards are always rendered at this size for consistent layout.
 * View mode scaling is done via CSS transform for GPU-acceleration.
 */
export const CARD_FAN_BASE_SCALE = 0.25;

/**
 * CSS transform scale factors for each view mode.
 * Applied via CSS for GPU-accelerated scaling (no layout recalc).
 */
export const CARD_FAN_VIEW_SCALE: Record<CardFanViewMode, number> = {
  board: 1,     // Same size but translated off screen
  ready: 1,     // Base size - 25% of viewport height
  focus: 2.2,   // Scaled up to ~55% of viewport height (0.55/0.25 = 2.2)
};

/**
 * @deprecated Use CARD_FAN_BASE_SCALE and CARD_FAN_VIEW_SCALE instead.
 * Kept for backwards compatibility during migration.
 */
export const CARD_FAN_SCALE: Record<CardFanViewMode, number> = {
  board: 0.25,  // Hidden off screen anyway
  ready: 0.25,  // Ready stance - 25% of viewport height
  focus: 0.55,  // Focus mode - 55% of viewport height
};

/**
 * Shared hover effect configuration.
 * Inscryption-style: lift only, no zoom.
 * Duration synced to card slide audio clips (~265ms).
 */
export const CARD_FAN_HOVER = {
  /** Vertical lift in pixels when hovered */
  liftY: 30,
  /** Hover animation duration in seconds (synced to audio) */
  durationSec: 0.265,
} as const;

/**
 * Tactic card aspect ratio (width / height).
 * Standard Mage Knight card proportions.
 */
export const TACTIC_ASPECT_RATIO = 1000 / 1400; // ~0.714

/**
 * Tactic fan layout configuration.
 * Tactics use a tighter fan than hand cards since there are only 6.
 */
export interface TacticLayoutResult {
  /** Horizontal offset from center in pixels */
  spreadX: number;
  /** Rotation in radians */
  rotation: number;
  /** Vertical arc offset in pixels (cards away from center lift up slightly) */
  arcY: number;
}

/**
 * Calculate layout position for a tactic card in a fan.
 *
 * @param index - Card index (0-based)
 * @param totalCards - Total number of cards in fan
 * @param cardWidth - Width of a card in pixels
 * @returns Layout position { spreadX, rotation, arcY }
 */
export function getTacticLayout(
  index: number,
  totalCards: number,
  cardWidth: number
): TacticLayoutResult {
  const centerIndex = (totalCards - 1) / 2;
  const offsetFromCenter = index - centerIndex;

  // Tactic-specific layout parameters
  // Spread: 70px base, scales with card width
  const scaleFactor = cardWidth / 120;
  const spreadDistance = 70 * scaleFactor;
  const rotationPerCard = 3; // degrees
  const arcPerCard = 4 * scaleFactor; // pixels

  const spreadX = offsetFromCenter * spreadDistance;
  const rotation = offsetFromCenter * rotationPerCard * (Math.PI / 180);
  const arcY = Math.abs(offsetFromCenter) * arcPerCard;

  return { spreadX, rotation, arcY };
}
