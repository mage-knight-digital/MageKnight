/**
 * Reachability boundary outline rendering
 *
 * Renders a Civ-style continuous border around all reachable hexes,
 * instead of filling each hex individually.
 */

import { Graphics, Text, TextStyle } from "pixi.js";
import {
  type HexCoord,
  type ReachableHex,
  type MoveTarget,
  hexKey,
  getNeighbor,
  HEX_DIRECTIONS,
  type HexDirection,
} from "@mage-knight/shared";
import { hexToPixel, getHexVertices, rotatePoint } from "../hexMath";
import type { WorldLayers, PixelPosition } from "../types";
import { HEX_SIZE } from "../types";

/**
 * Colors for boundary outlines
 */
const BOUNDARY_COLOR_SAFE = 0x00ff00; // Green - safe movement
const BOUNDARY_COLOR_TERMINAL = 0xffa500; // Orange - triggers combat

/**
 * For a pointy-top hex with y-down screen coordinates,
 * getHexVertices returns vertices starting from upper-right going clockwise:
 *
 *       5 (top, y=-85)
 *      / \
 *     4   0  (upper corners, y=-42.5)
 *     |   |
 *     3   1  (lower corners, y=+42.5)
 *      \ /
 *       2 (bottom, y=+85)
 *
 * HEX_DIRECTIONS = ["NE", "E", "SE", "SW", "W", "NW"]
 * with axial coordinate offsets:
 *   NE: q+1, r-1 (up-right)
 *   E:  q+1, r+0 (right)
 *   SE: q+0, r+1 (down-right)
 *   SW: q-1, r+1 (down-left)
 *   W:  q-1, r+0 (left)
 *   NW: q+0, r-1 (up-left)
 *
 * Map from direction index to the two vertex indices that form that edge:
 */
const DIRECTION_TO_EDGE_VERTICES: readonly (readonly [number, number])[] = [
  [5, 0], // NE: upper-right edge (vertices 5 and 0)
  [0, 1], // E: right edge (vertices 0 and 1)
  [1, 2], // SE: lower-right edge (vertices 1 and 2)
  [2, 3], // SW: lower-left edge (vertices 2 and 3)
  [3, 4], // W: left edge (vertices 3 and 4)
  [4, 5], // NW: upper-left edge (vertices 4 and 5)
];

/**
 * A boundary edge between a reachable hex and a non-reachable neighbor
 */
interface BoundaryEdge {
  start: PixelPosition;
  end: PixelPosition;
  isTerminal: boolean;
  /** For debug: the hex this edge belongs to */
  hexCoord: HexCoord;
  /** For debug: the direction of this edge */
  direction: HexDirection;
}

/**
 * Compute all boundary edges for the reachable area
 *
 * For each reachable hex, checks all 6 neighbors. If a neighbor is NOT
 * reachable, the shared edge is a boundary edge.
 */
function computeBoundaryEdges(
  reachableHexes: readonly ReachableHex[],
  validMoveTargets: readonly MoveTarget[],
  playerPosition: HexCoord | null
): BoundaryEdge[] {
  // Build lookup map of all reachable hexes (both multi-hop and adjacent)
  const reachableMap = new Map<string, { isTerminal: boolean }>();

  // Include the player's current position (not terminal since they're already there)
  if (playerPosition) {
    reachableMap.set(hexKey(playerPosition), { isTerminal: false });
  }

  for (const r of reachableHexes) {
    reachableMap.set(hexKey(r.hex), { isTerminal: r.isTerminal });
  }
  for (const t of validMoveTargets) {
    const key = hexKey(t.hex);
    if (!reachableMap.has(key)) {
      reachableMap.set(key, { isTerminal: t.isTerminal ?? false });
    }
  }

  const edges: BoundaryEdge[] = [];
  const hexVertices = getHexVertices(HEX_SIZE);

  for (const [key, data] of reachableMap) {
    // Parse hex key back to coordinate
    const [qStr, rStr] = key.split(",");
    const coord: HexCoord = { q: Number(qStr), r: Number(rStr) };
    const center = hexToPixel(coord);

    for (let dirIndex = 0; dirIndex < HEX_DIRECTIONS.length; dirIndex++) {
      const direction = HEX_DIRECTIONS[dirIndex];
      if (!direction) continue;

      const neighbor = getNeighbor(coord, direction);

      // If neighbor is not reachable, this edge is a boundary
      if (!reachableMap.has(hexKey(neighbor))) {
        const vertexIndices = DIRECTION_TO_EDGE_VERTICES[dirIndex];
        if (!vertexIndices) continue;

        const [v1Idx, v2Idx] = vertexIndices;
        const v1 = hexVertices[v1Idx];
        const v2 = hexVertices[v2Idx];

        if (!v1 || !v2) continue;

        // Apply rotation and translate to world coords
        const r1 = rotatePoint(v1.x, v1.y);
        const r2 = rotatePoint(v2.x, v2.y);

        edges.push({
          start: { x: center.x + r1.x, y: center.y + r1.y },
          end: { x: center.x + r2.x, y: center.y + r2.y },
          isTerminal: data.isTerminal,
          hexCoord: coord,
          direction,
        });
      }
    }
  }

  return edges;
}

/**
 * Render boundary edges with glow effect
 *
 * Draws each edge as a line segment. Since edges share vertices at corners,
 * this creates a continuous-looking outline.
 */
function renderBoundaryEdges(
  graphics: Graphics,
  edges: BoundaryEdge[],
  color: number
): void {
  if (edges.length === 0) return;

  // Draw outer glow (black shadow)
  for (const edge of edges) {
    graphics.moveTo(edge.start.x, edge.start.y);
    graphics.lineTo(edge.end.x, edge.end.y);
  }
  graphics.stroke({ color: 0x000000, width: 6, alpha: 0.4, cap: "round", join: "round" });

  // Draw colored glow
  for (const edge of edges) {
    graphics.moveTo(edge.start.x, edge.start.y);
    graphics.lineTo(edge.end.x, edge.end.y);
  }
  graphics.stroke({ color, width: 4, alpha: 0.6, cap: "round", join: "round" });

  // Draw main line
  for (const edge of edges) {
    graphics.moveTo(edge.start.x, edge.start.y);
    graphics.lineTo(edge.end.x, edge.end.y);
  }
  graphics.stroke({ color, width: 2, alpha: 1.0, cap: "round", join: "round" });
}

/**
 * Render debug labels for boundary edges
 */
function renderDebugLabels(
  layers: WorldLayers,
  edges: BoundaryEdge[]
): void {
  const debugStyle = new TextStyle({
    fontSize: 10,
    fontWeight: "bold",
    fill: 0xffff00, // Yellow
    stroke: { color: 0x000000, width: 2 },
  });

  for (const edge of edges) {
    // Put label at midpoint of edge
    const midX = (edge.start.x + edge.end.x) / 2;
    const midY = (edge.start.y + edge.end.y) / 2;

    const label = `${hexKey(edge.hexCoord)}:${edge.direction}`;
    const text = new Text({ text: label, style: debugStyle });
    text.anchor.set(0.5, 0.5);
    text.position.set(midX, midY);
    text.label = "reachability-boundary";
    layers.hexOverlays.addChild(text);
  }
}

/**
 * Render the reachability boundary outline
 *
 * Computes and renders a continuous border around all reachable hexes.
 * Safe hexes get a green border, terminal (combat) hexes get orange.
 */
export function renderReachabilityBoundary(
  layers: WorldLayers,
  reachableHexes: readonly ReachableHex[],
  validMoveTargets: readonly MoveTarget[],
  playerPosition: HexCoord | null,
  showDebugLabels: boolean = false
): void {
  // Remove previous boundary graphics
  const existingBoundaries = layers.hexOverlays.children.filter(
    (child) => child.label === "reachability-boundary"
  );
  for (const boundary of existingBoundaries) {
    layers.hexOverlays.removeChild(boundary);
  }

  // Skip if no reachable hexes and no player position
  if (reachableHexes.length === 0 && validMoveTargets.length === 0 && !playerPosition) {
    return;
  }

  // Compute boundary edges (includes player position)
  const edges = computeBoundaryEdges(reachableHexes, validMoveTargets, playerPosition);

  // Separate edges by terminal status
  const safeEdges = edges.filter((e) => !e.isTerminal);
  const terminalEdges = edges.filter((e) => e.isTerminal);

  // Render safe boundaries (green)
  if (safeEdges.length > 0) {
    const safeGraphics = new Graphics();
    safeGraphics.label = "reachability-boundary";
    safeGraphics.eventMode = "none"; // Click-through

    renderBoundaryEdges(safeGraphics, safeEdges, BOUNDARY_COLOR_SAFE);

    layers.hexOverlays.addChild(safeGraphics);
  }

  // Render terminal boundaries (orange)
  if (terminalEdges.length > 0) {
    const terminalGraphics = new Graphics();
    terminalGraphics.label = "reachability-boundary";
    terminalGraphics.eventMode = "none"; // Click-through

    renderBoundaryEdges(terminalGraphics, terminalEdges, BOUNDARY_COLOR_TERMINAL);

    layers.hexOverlays.addChild(terminalGraphics);
  }

  // Render debug labels if enabled
  if (showDebugLabels) {
    renderDebugLabels(layers, edges);
  }
}
