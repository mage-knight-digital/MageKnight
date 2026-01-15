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
 * Shared card height scale factors for each view mode (percentage of viewport height).
 * Used by all card fan components to ensure consistent sizing.
 */
export const CARD_FAN_SCALE: Record<CardFanViewMode, number> = {
  board: 0.25,  // Hidden off screen anyway
  ready: 0.25,  // Ready stance - 25% of viewport height
  focus: 0.55,  // Focus mode - 55% of viewport height
};

/**
 * Shared hover effect configuration.
 * Inscryption-style: lift only, no zoom.
 */
export const CARD_FAN_HOVER = {
  /** Vertical lift in pixels when hovered */
  liftY: 30,
} as const;
