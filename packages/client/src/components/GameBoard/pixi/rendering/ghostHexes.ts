/**
 * Ghost hex rendering for PixiJS hex grid
 *
 * Renders two types of ghost hexes:
 * 1. Board shape ghosts: Show the full map layout (unfilled tile slots)
 *    - Subtle parchment-colored outline
 *    - Non-interactive (just for visual reference)
 * 2. Exploration ghosts: Show where player can explore next
 *    - Blue interactive hexes with "?" marker
 *    - Click to trigger exploration
 */

import { Graphics, Text, TextStyle } from "pixi.js";
import type { HexCoord, HexDirection, ClientTileSlot } from "@mage-knight/shared";
import { hexKey } from "@mage-knight/shared";
import { hexToPixel, getHexVertices, rotatePoint } from "../hexMath";
import type { WorldLayers } from "../types";
import { HEX_SIZE } from "../types";
import { get7HexClusterVertices } from "../particles/outlineTracers";

/**
 * Explore target with direction info
 */
export interface ExploreTarget {
  coord: HexCoord;
  direction: HexDirection;
  fromTileCoord: HexCoord;
}

/**
 * Ghost hex visual colors
 */
const GHOST_FILL_COLOR = 0x6495ed;    // Cornflower blue
const GHOST_STROKE_COLOR = 0x4169e1;  // Royal blue
const GHOST_TEXT_COLOR = 0x4169e1;    // Royal blue

/**
 * Render ghost hexes for exploration targets with click handling
 *
 * @param layers - World layer containers
 * @param exploreTargets - Array of exploration targets from game state
 * @param onExploreClick - Callback when exploration target is clicked
 */
export function renderGhostHexes(
  layers: WorldLayers,
  exploreTargets: ExploreTarget[],
  onExploreClick: (target: ExploreTarget) => void
): void {
  layers.ghostHexes.removeChildren();

  for (const target of exploreTargets) {
    const { x, y } = hexToPixel(target.coord);

    const graphics = new Graphics();
    graphics.label = `ghost-${hexKey(target.coord)}`;

    const vertices = getHexVertices(HEX_SIZE * 0.95);

    // Rotate vertices to match map orientation
    graphics
      .poly(vertices.map((v) => { const r = rotatePoint(v.x, v.y); return { x: x + r.x, y: y + r.y }; }))
      .fill({ color: GHOST_FILL_COLOR, alpha: 0.2 })
      .stroke({ color: GHOST_STROKE_COLOR, width: 2, alpha: 0.8 });

    // Make interactive
    graphics.eventMode = "static";
    graphics.cursor = "pointer";
    graphics.on("pointerdown", () => onExploreClick(target));

    // Hover effect
    graphics.on("pointerenter", () => {
      graphics.alpha = 1.2;
    });
    graphics.on("pointerleave", () => {
      graphics.alpha = 1.0;
    });

    layers.ghostHexes.addChild(graphics);

    // Add "?" text
    const style = new TextStyle({
      fontSize: 24,
      fontWeight: "bold",
      fill: GHOST_TEXT_COLOR,
    });
    const questionMark = new Text({ text: "?", style });
    questionMark.anchor.set(0.5, 0.5);
    questionMark.position.set(x, y);
    layers.ghostHexes.addChild(questionMark);
  }
}

/**
 * Board shape ghost hex colors - subtle parchment tones
 */
const BOARD_SHAPE_FILL_COLOR = 0xc9a86c;    // Warm tan/parchment
const BOARD_SHAPE_STROKE_COLOR = 0x8b7355;  // Darker parchment edge

/**
 * Render board shape ghost hexes for unfilled tile slots
 *
 * These show the overall map shape and where tiles will eventually go.
 * Much more subtle than exploration ghosts - just a hint of the map boundary.
 *
 * @param layers - World layer containers
 * @param tileSlots - Record of tile slots from game state
 */
export function renderBoardShape(
  layers: WorldLayers,
  tileSlots: Record<string, ClientTileSlot>
): void {
  layers.boardShape.removeChildren();

  // Get all unfilled slots
  const unfilledSlots = Object.values(tileSlots).filter(slot => !slot.filled);

  for (const slot of unfilledSlots) {
    const { x, y } = hexToPixel(slot.coord);

    const graphics = new Graphics();
    graphics.label = `board-shape-${hexKey(slot.coord)}`;

    // Use the 7-hex cluster shape for a tile outline
    const vertices = get7HexClusterVertices(HEX_SIZE);

    // Rotate and translate to slot position
    const worldVertices = vertices.map((v) => {
      const r = rotatePoint(v.x, v.y);
      return { x: x + r.x, y: y + r.y };
    });

    // Draw filled shape with thick border
    graphics
      .poly(worldVertices)
      .fill({ color: BOARD_SHAPE_FILL_COLOR, alpha: 0.15 })
      .stroke({ color: BOARD_SHAPE_STROKE_COLOR, width: 5, alpha: 0.6 });

    layers.boardShape.addChild(graphics);
  }
}
