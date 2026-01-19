/**
 * Hex overlay rendering for PixiJS hex grid
 *
 * Handles interactive hex overlays with movement highlights:
 * - Movement type highlighting (adjacent, reachable, terminal)
 * - Hover effects
 * - Cost badges
 * - Click/hover event handling
 */

import { Graphics, Text, TextStyle } from "pixi.js";
import type { HexCoord, ClientHexState } from "@mage-knight/shared";
import { hexKey } from "@mage-knight/shared";
import { hexToPixel, getHexVertices, rotatePoint } from "../hexMath";
import type { WorldLayers, PixelPosition } from "../types";
import { HEX_SIZE } from "../types";

/**
 * Movement highlight types
 */
export type MoveHighlightType = "none" | "adjacent" | "reachable" | "terminal";

/**
 * Movement highlight data for a hex
 */
export interface MoveHighlight {
  type: MoveHighlightType;
  cost?: number;
}

/**
 * Colors for movement highlights
 */
const HIGHLIGHT_COLORS: Record<string, number> = {
  adjacent: 0x00ff00,    // Green - safe move
  reachable: 0x00ff00,   // Green - safe multi-hop
  terminal: 0xffa500,    // Orange - triggers combat
  hover: 0xffffff,       // White - hover highlight
  none: 0x000000,        // Black - no highlight
};

/**
 * Draw a hex polygon on a Graphics object
 */
function drawHexPolygon(
  graphics: Graphics,
  center: PixelPosition,
  size: number,
  fillColor: number,
  fillAlpha: number,
  strokeColor: number,
  strokeWidth: number,
  strokeAlpha: number = 1
): void {
  const vertices = getHexVertices(size);

  // Rotate vertices to match map orientation
  graphics
    .poly(vertices.map((v) => { const r = rotatePoint(v.x, v.y); return { x: center.x + r.x, y: center.y + r.y }; }))
    .fill({ color: fillColor, alpha: fillAlpha })
    .stroke({ color: strokeColor, width: strokeWidth, alpha: strokeAlpha });
}

/**
 * Hover event with screen position for tooltip positioning
 */
export interface HexHoverEvent {
  coord: HexCoord;
  screenPos: { x: number; y: number };
}

/**
 * Render interactive hex overlays with movement highlights
 *
 * @param layers - World layer containers
 * @param hexes - Hex data from game state
 * @param getHighlight - Function to get highlight data for a hex
 * @param hoveredHex - Currently hovered hex (null if none)
 * @param onHexClick - Callback when hex is clicked
 * @param onHexHover - Callback when hex hover state changes
 * @param onHexHoverWithPos - Optional callback with screen position for tooltips
 */
export function renderHexOverlays(
  layers: WorldLayers,
  hexes: Record<string, ClientHexState>,
  getHighlight: (coord: HexCoord) => MoveHighlight,
  hoveredHex: HexCoord | null,
  onHexClick: (coord: HexCoord) => void,
  onHexHover: (coord: HexCoord | null) => void,
  onHexHoverWithPos?: (event: HexHoverEvent | null) => void
): void {
  layers.hexOverlays.removeChildren();

  for (const hex of Object.values(hexes)) {
    const { x, y } = hexToPixel(hex.coord);
    const highlight = getHighlight(hex.coord);
    const isHovered = hoveredHex && hoveredHex.q === hex.coord.q && hoveredHex.r === hex.coord.r;

    const graphics = new Graphics();
    graphics.label = `hex-${hexKey(hex.coord)}`;

    // Determine fill based on highlight type
    let fillColor = 0x000000;
    let fillAlpha = 0.01;
    let strokeColor = 0x666666;
    let strokeAlpha = 0.3;

    if (highlight.type !== "none") {
      fillColor = HIGHLIGHT_COLORS[highlight.type] ?? 0x00ff00;
      fillAlpha = isHovered ? 0.4 : 0.2;
      strokeColor = HIGHLIGHT_COLORS[highlight.type] ?? 0x00ff00;
      strokeAlpha = 0.8;
    } else if (isHovered) {
      fillAlpha = 0.1;
      strokeColor = HIGHLIGHT_COLORS["hover"] ?? 0xffffff;
      strokeAlpha = 0.5;
    }

    drawHexPolygon(graphics, { x, y }, HEX_SIZE, fillColor, fillAlpha, strokeColor, 1, strokeAlpha);

    // Make interactive
    graphics.eventMode = "static";
    graphics.cursor = highlight.type !== "none" ? "pointer" : "default";

    // Store coord for event handlers
    const coord = hex.coord;
    graphics.on("pointerdown", () => onHexClick(coord));
    graphics.on("pointerenter", (event) => {
      onHexHover(coord);
      if (onHexHoverWithPos) {
        // Use actual cursor position for tooltip positioning
        const screenPos = { x: event.globalX, y: event.globalY };
        onHexHoverWithPos({ coord, screenPos });
      }
    });
    graphics.on("pointerleave", () => {
      onHexHover(null);
      if (onHexHoverWithPos) {
        onHexHoverWithPos(null);
      }
    });

    layers.hexOverlays.addChild(graphics);

    // Add cost badge if there's a movement cost
    if (highlight.cost !== undefined && highlight.cost > 0) {
      const badgeX = x;
      const badgeY = y + HEX_SIZE * 0.5;

      // Badge background
      const badge = new Graphics();
      badge.circle(badgeX, badgeY, 12);
      badge.fill({ color: HIGHLIGHT_COLORS[highlight.type], alpha: 0.9 });
      badge.stroke({ color: 0x000000, width: 1, alpha: 0.5 });
      layers.hexOverlays.addChild(badge);

      // Cost text
      const style = new TextStyle({
        fontSize: 14,
        fontWeight: "bold",
        fill: 0x000000,
      });
      const costText = new Text({ text: String(highlight.cost), style });
      costText.anchor.set(0.5, 0.5);
      costText.position.set(badgeX, badgeY);
      layers.hexOverlays.addChild(costText);
    }
  }
}
