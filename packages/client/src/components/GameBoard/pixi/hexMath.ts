/**
 * Hex coordinate math utilities
 * Extracted from HexGrid.tsx for reuse across SVG and PixiJS renderers
 */

import type { HexCoord } from "@mage-knight/shared";
import { HEX_SIZE, type PixelPosition } from "./types";

/**
 * Convert axial hex coordinates to pixel position (pointy-top hexes)
 */
export function hexToPixel(coord: HexCoord): PixelPosition {
  const x = HEX_SIZE * (Math.sqrt(3) * coord.q + (Math.sqrt(3) / 2) * coord.r);
  const y = HEX_SIZE * ((3 / 2) * coord.r);
  return { x, y };
}

/**
 * Generate vertices for a pointy-topped hex polygon
 * @param size - Distance from center to corner
 * @returns Array of 6 vertex positions relative to center
 */
export function getHexVertices(size: number): PixelPosition[] {
  const vertices: PixelPosition[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6; // Start from top
    vertices.push({
      x: size * Math.cos(angle),
      y: size * Math.sin(angle),
    });
  }
  return vertices;
}

/**
 * Calculate bounds for a set of hex positions
 */
export function calculateBounds(positions: PixelPosition[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (positions.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
  }

  const minX = Math.min(...positions.map((p) => p.x)) - HEX_SIZE * 2;
  const maxX = Math.max(...positions.map((p) => p.x)) + HEX_SIZE * 2;
  const minY = Math.min(...positions.map((p) => p.y)) - HEX_SIZE * 2;
  const maxY = Math.max(...positions.map((p) => p.y)) + HEX_SIZE * 2;

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Position enemies in a grid pattern within a hex
 */
export function getEnemyOffset(
  index: number,
  total: number,
  tokenSize: number
): PixelPosition {
  if (total === 1) return { x: 0, y: 0 };
  if (total === 2) return { x: (index - 0.5) * tokenSize * 0.8, y: 0 };
  if (total <= 4) {
    const row = Math.floor(index / 2);
    const col = index % 2;
    return {
      x: (col - 0.5) * tokenSize * 0.8,
      y: (row - 0.5) * tokenSize * 0.7,
    };
  }
  // For 5+ enemies, arrange in a tighter grid
  const cols = 3;
  const row = Math.floor(index / cols);
  const col = index % cols;
  return {
    x: (col - 1) * tokenSize * 0.6,
    y: (row - 0.5) * tokenSize * 0.6,
  };
}
