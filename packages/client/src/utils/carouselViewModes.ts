/**
 * Shared view mode configuration for PixiJS carousel components.
 *
 * These offsets control how carousel components (hand, tactics, units) position
 * themselves based on the current view mode (board/ready/focus).
 *
 * Note: The PixiJS values intentionally differ from the original CSS values.
 * The PixiJS implementation uses larger scales in focus mode, which means
 * less vertical displacement is needed to achieve the same visual effect.
 */

import type { CardFanViewMode } from "./cardFanLayout";

export interface ViewModeConfig {
  /** Y offset as fraction of viewport height (negative = up) */
  yOffset: number;
  /** Scale multiplier */
  scale: number;
  /** Whether the carousel should be visible in this mode */
  visible: boolean;
}

export type ViewModeOffsets = Record<CardFanViewMode, ViewModeConfig>;

/**
 * Standard view mode offsets for card-like carousels (hand, units).
 * Uses larger scale in focus mode with less vertical displacement.
 */
export const STANDARD_VIEW_MODE_OFFSETS: ViewModeOffsets = {
  board: { yOffset: 0.30, scale: 1, visible: false },
  ready: { yOffset: 0.07, scale: 1, visible: true },
  focus: { yOffset: -0.15, scale: 2.8, visible: true },
} as const;

/**
 * View mode offsets for tactic carousel.
 * Uses different values due to tactic card sizing and layout.
 */
export const TACTIC_VIEW_MODE_OFFSETS: ViewModeOffsets = {
  board: { yOffset: 0.30, scale: 1, visible: false },
  ready: { yOffset: 0.05, scale: 1, visible: true },
  focus: { yOffset: -0.35, scale: 2.2, visible: true },
} as const;

// Animation timing for view mode transitions
export const VIEW_MODE_TRANSITION_MS = 300;
