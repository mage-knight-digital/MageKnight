/**
 * PixiJS-specific types for the hex grid renderer
 */

import type { Container, Sprite, Graphics } from "pixi.js";

/**
 * Pixel position on the canvas
 */
export interface PixelPosition {
  x: number;
  y: number;
}

/**
 * Camera state for pan/zoom (Phase 3)
 */
export interface CameraState {
  /** Camera center in world coordinates */
  center: PixelPosition;
  /** Zoom level (1.0 = default) */
  zoom: number;
  /** Target for smooth animation */
  targetCenter: PixelPosition;
  targetZoom: number;
  /** Whether user is currently panning */
  isPanning: boolean;
}

/**
 * Layer containers in the world
 */
export interface WorldLayers {
  /** Background tile images */
  tiles: Container;
  /** Drop shadows below tiles */
  shadows: Container;
  /** Particle effects */
  particles: Container;
  /** Hex overlay graphics for interactivity */
  hexOverlays: Container;
  /** Path preview line */
  pathPreview: Container;
  /** Enemy tokens */
  enemies: Container;
  /** Hero token */
  hero: Container;
  /** Ghost hexes for exploration */
  ghostHexes: Container;
  /** UI elements that stay on top */
  ui: Container;
}

/**
 * Sprite cache to avoid recreating sprites every frame
 */
export interface SpriteCache {
  tiles: Map<string, Sprite>;
  enemies: Map<string, Sprite>;
  hexOverlays: Map<string, Graphics>;
}

/**
 * Render constants matching the SVG version
 */
export const HEX_SIZE = 50; // pixels from center to corner

// Tile image dimensions (same as SVG version)
export const TILE_WIDTH = 3 * Math.sqrt(3) * HEX_SIZE;  // ~259.8 units
export const TILE_HEIGHT = TILE_WIDTH * (529 / 550);    // ~249.9 units

// Enemy token size relative to hex
export const ENEMY_TOKEN_SIZE = HEX_SIZE * 1.37; // ~71% bigger than original (was 0.8, now 1.37)

// Hero token radius
export const HERO_TOKEN_RADIUS = HEX_SIZE * 0.25;

// Camera constants
export const CAMERA_MIN_ZOOM = 0.3;
export const CAMERA_MAX_ZOOM = 2.5;
export const CAMERA_ZOOM_SPEED = 0.1;       // Multiplier per wheel tick
export const CAMERA_PAN_SPEED = 10;          // Pixels per key press
export const CAMERA_LERP_FACTOR = 0.15;      // Smooth interpolation (0-1, higher = snappier)
export const CAMERA_KEYBOARD_PAN_SPEED = 300; // Pixels per second for keyboard pan
