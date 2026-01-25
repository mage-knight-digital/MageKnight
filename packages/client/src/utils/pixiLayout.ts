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
// Card Layout Presets (for future enemy card migration)
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
