import type { Container } from "pixi.js";

/**
 * Centralized z-index constants for PixiJS overlay layer.
 *
 * Z-INDEX HIERARCHY (lower = behind, higher = in front):
 * ─────────────────────────────────────────────────────
 * -100  COMBAT_BACKGROUND    Combat gradient overlay
 *    5  ENEMY_TOKENS         Enemy token circles
 *    6  ENEMY_CARDS          Interactive UI below enemy tokens
 *   10  PHASE_RAIL           Combat phase indicator
 *   50  SCREEN_EFFECTS       Flash/shake effects
 *   60  TACTIC_CAROUSEL      Tactic card display
 *  100  HAND                 Player's card hand
 *  120  ATTACK_POOL          Draggable attack chips
 *  120  BLOCK_POOL           Draggable block chips
 *  500  CONTEXT_MENU         Hex context menus
 * 1000  PIE_MENU             Card action pie menus
 * 1100  HAND_ACTIVE          Selected card (above pie menu)
 * 1150  POWER_LINE           Drag connection line
 * 1200  DRAG_PREVIEW         Dragged chip preview
 * ─────────────────────────────────────────────────────
 *
 * RULES:
 * - Always import from here, never use magic numbers
 * - Leave gaps (10, 50, 100) for future layers
 * - Menus/modals use 1000+
 */
export const PIXI_Z_INDEX = {
  // Background layers
  COMBAT_BACKGROUND: -100,

  // Combat UI (10-99)
  ENEMY_TOKENS: 5,
  ENEMY_CARDS: 6,
  PHASE_RAIL: 10,
  SCREEN_EFFECTS: 50,
  TACTIC_CAROUSEL: 60,

  // Interactive layers (100-499)
  HAND: 100,
  ATTACK_POOL: 120,
  BLOCK_POOL: 120,

  // Menus and overlays (500-999)
  CONTEXT_MENU: 500,

  // Modal overlays (1000+)
  PIE_MENU: 1000,
  HAND_ACTIVE: 1100,
  POWER_LINE: 1150,
  DRAG_PREVIEW: 1200,
} as const;

export type PixiZIndex = (typeof PIXI_Z_INDEX)[keyof typeof PIXI_Z_INDEX];

/**
 * Register a container on the overlay layer with proper z-index.
 * Handles sortChildren() call automatically.
 */
export function addToOverlayLayer(
  overlayLayer: Container,
  container: Container,
  zIndex: PixiZIndex
): void {
  container.zIndex = zIndex;
  overlayLayer.addChild(container);
  overlayLayer.sortChildren();
}

/**
 * Update a container's z-index and re-sort the overlay layer.
 * Use for dynamic state changes (selection, hover, etc.)
 */
export function setOverlayZIndex(
  overlayLayer: Container,
  container: Container,
  zIndex: PixiZIndex
): void {
  container.zIndex = zIndex;
  overlayLayer.sortChildren();
}
