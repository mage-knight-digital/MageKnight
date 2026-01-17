/**
 * Path preview rendering for PixiJS hex grid
 *
 * Renders the movement path preview line with:
 * - Outer glow for visibility
 * - Color coding for safe vs terminal paths
 * - Arrow head at destination
 */

import { Graphics } from "pixi.js";
import type { HexCoord } from "@mage-knight/shared";
import { hexToPixel } from "../hexMath";
import type { WorldLayers } from "../types";

/**
 * Path line colors
 */
const PATH_COLOR_SAFE = 0x00ff00;     // Green - safe path
const PATH_COLOR_TERMINAL = 0xffa500; // Orange - ends in combat

/**
 * Render path preview line with arrow
 *
 * @param layers - World layer containers
 * @param path - Array of hex coordinates forming the path
 * @param isTerminal - Whether the path ends at a terminal (combat) hex
 */
export function renderPathPreview(
  layers: WorldLayers,
  path: HexCoord[],
  isTerminal: boolean
): void {
  layers.pathPreview.removeChildren();

  if (path.length < 2) return;

  const graphics = new Graphics();
  graphics.label = "path-line";

  const color = isTerminal ? PATH_COLOR_TERMINAL : PATH_COLOR_SAFE;

  // Convert path to pixel positions
  const points = path.map((coord) => hexToPixel(coord));
  const firstPoint = points[0];
  if (!firstPoint) return;

  // Draw outer glow (black shadow)
  graphics.moveTo(firstPoint.x, firstPoint.y);
  for (let i = 1; i < points.length; i++) {
    const pt = points[i];
    if (pt) graphics.lineTo(pt.x, pt.y);
  }
  graphics.stroke({ color: 0x000000, width: 8, alpha: 0.5 });

  // Draw main line
  graphics.moveTo(firstPoint.x, firstPoint.y);
  for (let i = 1; i < points.length; i++) {
    const pt = points[i];
    if (pt) graphics.lineTo(pt.x, pt.y);
  }
  graphics.stroke({ color, width: 4, alpha: 1 });

  // Draw arrow at the end
  if (points.length >= 2) {
    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    if (last && prev) {
      const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
      const arrowSize = 12;

      graphics.moveTo(last.x, last.y);
      graphics.lineTo(
        last.x - arrowSize * Math.cos(angle - Math.PI / 6),
        last.y - arrowSize * Math.sin(angle - Math.PI / 6)
      );
      graphics.moveTo(last.x, last.y);
      graphics.lineTo(
        last.x - arrowSize * Math.cos(angle + Math.PI / 6),
        last.y - arrowSize * Math.sin(angle + Math.PI / 6)
      );
      graphics.stroke({ color, width: 4, alpha: 1 });
    }
  }

  layers.pathPreview.addChild(graphics);
}
