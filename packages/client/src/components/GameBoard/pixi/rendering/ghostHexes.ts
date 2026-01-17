/**
 * Ghost hex rendering for PixiJS hex grid
 *
 * Renders exploration target hexes that players can click to reveal new tiles:
 * - Semi-transparent hex shape
 * - Question mark indicator
 * - Hover highlight effect
 * - Click handling for exploration action
 */

import { Graphics, Text, TextStyle } from "pixi.js";
import type { HexCoord, HexDirection } from "@mage-knight/shared";
import { hexKey } from "@mage-knight/shared";
import { hexToPixel, getHexVertices } from "../hexMath";
import type { WorldLayers } from "../types";
import { HEX_SIZE } from "../types";

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

    graphics
      .poly(vertices.map((v) => ({ x: x + v.x, y: y + v.y })))
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
