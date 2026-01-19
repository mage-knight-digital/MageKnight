/**
 * Tile Visual Effects
 *
 * Applies visual polish to tile sprites to help them blend
 * with the parchment background:
 * - Subtle drop shadow for depth
 * - Dark border/outline around tile edges
 * - Warm sepia tint to match parchment tones
 */

import { Graphics, Container, Sprite, ColorMatrixFilter } from "pixi.js";
import type { PixelPosition } from "../types";
import { get7HexClusterVertices } from "../particles/outlineTracers";
import { rotatePoint } from "../hexMath";

/**
 * Create a static drop shadow for a tile
 * This shadow stays permanently beneath the tile
 */
export function createTileShadow(
  container: Container,
  center: PixelPosition,
  hexSize: number,
  options: {
    offsetX?: number;
    offsetY?: number;
    alpha?: number;
  } = {}
): Graphics {
  const {
    offsetX = 3,
    offsetY = 4,
    alpha = 0.12, // Very subtle
  } = options;

  const graphics = new Graphics();
  graphics.label = "tile-shadow";

  // Get hex cluster shape for shadow
  const vertices = get7HexClusterVertices(hexSize);

  // Rotate and draw shadow offset from center
  const shadowPoints = vertices.map((v) => {
    const r = rotatePoint(v.x, v.y);
    return { x: center.x + r.x + offsetX, y: center.y + r.y + offsetY };
  });

  graphics.poly(shadowPoints);
  graphics.fill({ color: 0x0a0804, alpha });

  container.addChild(graphics);
  return graphics;
}

/**
 * Create a 3D-style border around the tile with dark outer edge and subtle highlight
 * Gives tiles a raised/beveled look against the parchment
 */
export function createTileBorder(
  container: Container,
  center: PixelPosition,
  hexSize: number,
  options: {
    color?: number;
    alpha?: number;
    lineWidth?: number;
  } = {}
): Graphics {
  const {
    color = 0x1a1208,
    alpha = 0.7,
    lineWidth = 3,
  } = options;

  const graphics = new Graphics();
  graphics.label = "tile-border";

  // Get hex cluster shape for border
  const vertices = get7HexClusterVertices(hexSize);

  // Rotate and draw border at tile position
  const borderPoints = vertices.map((v) => {
    const r = rotatePoint(v.x, v.y);
    return { x: center.x + r.x, y: center.y + r.y };
  });

  // Outer dark edge (shadow side)
  graphics.poly(borderPoints);
  graphics.stroke({ color, alpha, width: lineWidth });

  // Inner highlight edge (light side) - slightly inset
  const highlightPoints = vertices.map((v) => {
    const r = rotatePoint(v.x * 0.98, v.y * 0.98);
    return { x: center.x + r.x, y: center.y + r.y };
  });
  graphics.poly(highlightPoints);
  graphics.stroke({ color: 0xd4c4a8, alpha: 0.25, width: 1.5 });

  container.addChild(graphics);
  return graphics;
}

/**
 * Create a sepia/warm color filter to help tiles blend with parchment
 */
export function createWarmTintFilter(intensity: number = 0.15): ColorMatrixFilter {
  const filter = new ColorMatrixFilter();

  // Apply subtle sepia effect
  // Sepia matrix with reduced intensity for subtlety
  const sepia = intensity;

  // Custom warm tint matrix that's more subtle than full sepia
  filter.matrix = [
    1 + sepia * 0.2, sepia * 0.1, sepia * 0.05, 0, 0,
    sepia * 0.05, 1 + sepia * 0.1, sepia * 0.05, 0, 0,
    sepia * 0.02, sepia * 0.05, 1 - sepia * 0.1, 0, 0,
    0, 0, 0, 1, 0,
  ];

  return filter;
}

/**
 * Apply all visual effects to a tile sprite
 */
export function applyTileEffects(
  sprite: Sprite,
  shadowContainer: Container,
  center: PixelPosition,
  hexSize: number,
  options: {
    enableShadow?: boolean;
    enableBorder?: boolean;
    enableWarmTint?: boolean;
    shadowAlpha?: number;
    borderAlpha?: number;
    tintIntensity?: number;
  } = {}
): { shadow?: Graphics; border?: Graphics; filter?: ColorMatrixFilter } {
  const {
    enableShadow = true,
    enableBorder = true,
    enableWarmTint = true,
    shadowAlpha = 0.12,
    borderAlpha = 0.5,
    tintIntensity = 0.08,
  } = options;

  const result: { shadow?: Graphics; border?: Graphics; filter?: ColorMatrixFilter } = {};

  // Add subtle drop shadow (rendered first, behind border)
  if (enableShadow) {
    result.shadow = createTileShadow(shadowContainer, center, hexSize, {
      alpha: shadowAlpha,
      offsetX: 3,
      offsetY: 5,
    });
  }

  // Add dark border around tile edge
  if (enableBorder) {
    result.border = createTileBorder(shadowContainer, center, hexSize, {
      alpha: borderAlpha,
      lineWidth: 1.5,
      color: 0x1a1208,
    });
  }

  // Apply warm color filter
  if (enableWarmTint) {
    result.filter = createWarmTintFilter(tintIntensity);
    sprite.filters = [result.filter];
  }

  return result;
}
