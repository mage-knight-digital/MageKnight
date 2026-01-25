/**
 * Layout utilities for @pixi/layout
 *
 * Provides reusable layout styles and combat-specific presets.
 * Used for migrating combat UI from manual positioning to declarative flexbox.
 */

import type { LayoutStyles } from "@pixi/layout";

// ============================================================================
// Common Layout Styles
// ============================================================================

/**
 * Basic row layout - horizontal flex with gap
 */
export function rowLayout(gap: number = 0): Partial<LayoutStyles> {
  return {
    flexDirection: "row",
    gap,
  };
}

/**
 * Basic column layout - vertical flex with gap
 */
export function columnLayout(gap: number = 0): Partial<LayoutStyles> {
  return {
    flexDirection: "column",
    gap,
  };
}

/**
 * Centered content - both horizontally and vertically
 */
export const centeredLayout: Partial<LayoutStyles> = {
  alignItems: "center",
  justifyContent: "center",
};

/**
 * Space between items with vertical centering
 */
export const spaceBetweenLayout: Partial<LayoutStyles> = {
  alignItems: "center",
  justifyContent: "space-between",
};

// ============================================================================
// Combat-Specific Layout Presets
// ============================================================================

/** Pool constants used across attack and block pools */
export const POOL_LAYOUT_CONSTANTS = {
  CHIP_WIDTH: 60,
  CHIP_HEIGHT: 32,
  CHIP_GAP: 6,
  POOL_PADDING: 12,
  ROW_GAP: 6,
  SECTION_GAP: 16,
} as const;

/**
 * Layout for a row of chips (block or attack)
 * Chips arranged horizontally with consistent gap
 */
export function chipRowLayout(): Partial<LayoutStyles> {
  return {
    flexDirection: "row",
    gap: POOL_LAYOUT_CONSTANTS.CHIP_GAP,
    alignItems: "center",
  };
}

/**
 * Layout for an individual chip container
 * Fixed size with internal content centering
 */
export function chipLayout(): Partial<LayoutStyles> {
  return {
    width: POOL_LAYOUT_CONSTANTS.CHIP_WIDTH,
    height: POOL_LAYOUT_CONSTANTS.CHIP_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  };
}

/**
 * Layout for pool section (header + chips)
 * Vertical stack with content centered
 */
export function poolSectionLayout(): Partial<LayoutStyles> {
  return {
    flexDirection: "column",
    gap: POOL_LAYOUT_CONSTANTS.ROW_GAP,
    alignItems: "center",
    padding: POOL_LAYOUT_CONSTANTS.POOL_PADDING,
  };
}

/**
 * Layout for pool container (may contain multiple sections)
 * Horizontal layout for attack pool with multiple sections
 */
export function poolContainerLayout(): Partial<LayoutStyles> {
  return {
    flexDirection: "row",
    gap: POOL_LAYOUT_CONSTANTS.SECTION_GAP,
    alignItems: "flex-start",
    padding: POOL_LAYOUT_CONSTANTS.POOL_PADDING,
  };
}

// ============================================================================
// Card Layout Presets (generic)
// ============================================================================

export const CARD_LAYOUT_CONSTANTS = {
  CARD_WIDTH: 280,
  CARD_PADDING: 10,
  ROW_GAP: 6,
} as const;

/**
 * Layout for card container (vertical stack)
 */
export function cardLayout(): Partial<LayoutStyles> {
  return {
    flexDirection: "column",
    gap: CARD_LAYOUT_CONSTANTS.ROW_GAP,
    padding: CARD_LAYOUT_CONSTANTS.CARD_PADDING,
    width: CARD_LAYOUT_CONSTANTS.CARD_WIDTH,
  };
}

/**
 * Layout for card controls row (horizontal buttons)
 */
export function cardControlsLayout(): Partial<LayoutStyles> {
  return {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    justifyContent: "space-between",
  };
}

// ============================================================================
// Enemy Card Layout Presets (PixiEnemyCard.tsx)
// ============================================================================

/** Constants matching PixiEnemyCard dimensions */
export const ENEMY_CARD_CONSTANTS = {
  CARD_WIDTH: 200,
  CARD_PADDING: 10,
  ROW_GAP: 6,
  SECTION_GAP: 8,
  BTN_SIZE: 24,
  BTN_RADIUS: 4,
  BADGE_HEIGHT: 20,
  COMMIT_BTN_HEIGHT: 28,
} as const;

/**
 * Root layout for an enemy card - vertical stack centered
 * Children are stacked vertically with consistent gap
 */
export function enemyCardRootLayout(): Partial<LayoutStyles> {
  return {
    flexDirection: "column",
    gap: ENEMY_CARD_CONSTANTS.ROW_GAP,
    alignItems: "center",
  };
}

/**
 * Layout for enemy card section (block/attack allocation boxes)
 * Column with padding, full width
 */
export function enemyCardSectionLayout(): Partial<LayoutStyles> {
  return {
    flexDirection: "column",
    gap: ENEMY_CARD_CONSTANTS.ROW_GAP,
    alignItems: "center",
    padding: ENEMY_CARD_CONSTANTS.CARD_PADDING,
    width: ENEMY_CARD_CONSTANTS.CARD_WIDTH,
  };
}

/**
 * Layout for a row of +/- control buttons
 * Horizontal with small gap, left-aligned
 */
export function enemyCardControlsRowLayout(): Partial<LayoutStyles> {
  return {
    flexDirection: "row",
    gap: 2,
    alignItems: "center",
  };
}

/**
 * Layout for element control group (icon + minus + plus buttons)
 */
export function enemyCardElementGroupLayout(): Partial<LayoutStyles> {
  return {
    flexDirection: "row",
    gap: 2,
    alignItems: "center",
    marginRight: 6,
  };
}

/**
 * Layout for badge containers (DEFEATED, BLOCKED)
 */
export function enemyCardBadgeLayout(): Partial<LayoutStyles> {
  return {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: ENEMY_CARD_CONSTANTS.BADGE_HEIGHT,
    width: 80,
  };
}

/**
 * Layout for a button with fixed dimensions
 */
export function enemyCardButtonLayout(
  width: number,
  height: number
): Partial<LayoutStyles> {
  return {
    width,
    height,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  };
}

/**
 * Layout for +/- square buttons
 */
export function enemyCardPlusMinusLayout(): Partial<LayoutStyles> {
  return enemyCardButtonLayout(
    ENEMY_CARD_CONSTANTS.BTN_SIZE,
    ENEMY_CARD_CONSTANTS.BTN_SIZE
  );
}

/**
 * Layout for full-width action buttons (commit block, take damage)
 */
export function enemyCardActionButtonLayout(): Partial<LayoutStyles> {
  return enemyCardButtonLayout(
    ENEMY_CARD_CONSTANTS.CARD_WIDTH - ENEMY_CARD_CONSTANTS.CARD_PADDING * 2,
    ENEMY_CARD_CONSTANTS.COMMIT_BTN_HEIGHT
  );
}

/**
 * Layout for centered text row (labels, progress)
 */
export function enemyCardTextRowLayout(height?: number): Partial<LayoutStyles> {
  return {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%" as unknown as number, // Full width of parent
    ...(height !== undefined && { height }),
  };
}

// ============================================================================
// Type Utilities
// ============================================================================

/**
 * Helper to merge multiple partial layout styles
 */
export function mergeLayouts(
  ...layouts: Partial<LayoutStyles>[]
): Partial<LayoutStyles> {
  return Object.assign({}, ...layouts);
}
