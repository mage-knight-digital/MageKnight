/**
 * Camera system for PixiJS hex grid
 *
 * Handles pan/zoom controls, smooth interpolation, and input handling.
 * Camera state tracks both current and target positions for smooth transitions.
 */

import type { Application, Container } from "pixi.js";
import type { FederatedPointerEvent } from "pixi.js";
import type { CameraState, PixelPosition } from "./types";
import {
  CAMERA_MIN_ZOOM,
  CAMERA_MAX_ZOOM,
  CAMERA_ZOOM_SPEED,
  CAMERA_LERP_FACTOR,
  CAMERA_KEYBOARD_PAN_SPEED,
} from "./types";

/**
 * Linear interpolation between two values
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Create initial camera state centered at origin
 */
export function createInitialCameraState(): CameraState {
  return {
    center: { x: 0, y: 0 },
    zoom: 1,
    targetCenter: { x: 0, y: 0 },
    targetZoom: 1,
    isPanning: false,
  };
}

/**
 * Apply camera state to world container
 * Transforms world position and scale based on camera center and zoom
 */
export function applyCamera(
  app: Application,
  world: Container,
  camera: CameraState
): void {
  // Apply zoom
  world.scale.set(camera.zoom);

  // Calculate world position so camera.center is at screen center
  world.position.set(
    app.screen.width / 2 - camera.center.x * camera.zoom,
    app.screen.height / 2 - camera.center.y * camera.zoom
  );
}

/**
 * Update camera position with smooth interpolation
 * Call this every frame from the PixiJS ticker
 *
 * @param camera - Camera state to update (mutated in place)
 * @param keysDown - Set of currently pressed arrow keys
 * @param deltaTime - Time since last frame in milliseconds
 */
export function updateCamera(
  camera: CameraState,
  keysDown: Set<string>,
  deltaTime: number
): void {
  // Smooth interpolation toward target
  const t = 1 - Math.pow(1 - CAMERA_LERP_FACTOR, (deltaTime * 60) / 1000);

  // Interpolate zoom
  camera.zoom = lerp(camera.zoom, camera.targetZoom, t);

  // Interpolate center position
  camera.center.x = lerp(camera.center.x, camera.targetCenter.x, t);
  camera.center.y = lerp(camera.center.y, camera.targetCenter.y, t);

  // Handle keyboard panning
  const panAmount = (CAMERA_KEYBOARD_PAN_SPEED * deltaTime) / 1000 / camera.zoom;

  if (keysDown.has("arrowup")) {
    camera.targetCenter.y -= panAmount;
  }
  if (keysDown.has("arrowdown")) {
    camera.targetCenter.y += panAmount;
  }
  if (keysDown.has("arrowleft")) {
    camera.targetCenter.x -= panAmount;
  }
  if (keysDown.has("arrowright")) {
    camera.targetCenter.x += panAmount;
  }
}

/**
 * Handle mouse wheel zoom (cursor-centered)
 * Adjusts zoom while keeping the point under the cursor stable
 */
export function handleWheelZoom(
  event: WheelEvent,
  app: Application,
  camera: CameraState
): void {
  event.preventDefault();

  // Get mouse position relative to canvas
  const rect = (event.target as HTMLElement).getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  // Convert mouse position to world coordinates (before zoom)
  const worldMouseX = (mouseX - app.screen.width / 2) / camera.zoom + camera.center.x;
  const worldMouseY = (mouseY - app.screen.height / 2) / camera.zoom + camera.center.y;

  // Calculate new zoom
  const zoomDelta = event.deltaY > 0 ? -CAMERA_ZOOM_SPEED : CAMERA_ZOOM_SPEED;
  const newZoom = Math.max(
    CAMERA_MIN_ZOOM,
    Math.min(CAMERA_MAX_ZOOM, camera.targetZoom * (1 + zoomDelta))
  );

  // Update target zoom
  camera.targetZoom = newZoom;

  // Adjust center to keep mouse position stable (cursor-centered zoom)
  camera.targetCenter.x = worldMouseX - (mouseX - app.screen.width / 2) / newZoom;
  camera.targetCenter.y = worldMouseY - (mouseY - app.screen.height / 2) / newZoom;
}

/**
 * Handle pointer down for initiating pan
 * Supports right-click and middle-click for panning
 */
export function handlePointerDown(
  event: FederatedPointerEvent,
  camera: CameraState,
  lastPointerPos: PixelPosition,
  setDragging: (dragging: boolean) => void
): void {
  // Pan with right-click (button 2) or middle-click (button 1)
  if (event.button === 2 || event.button === 1) {
    setDragging(true);
    lastPointerPos.x = event.globalX;
    lastPointerPos.y = event.globalY;
    camera.isPanning = true;
  }
}

/**
 * Handle pointer move for panning
 * Updates camera target position based on drag delta
 */
export function handlePointerMove(
  event: FederatedPointerEvent,
  camera: CameraState,
  lastPointerPos: PixelPosition,
  isDragging: boolean
): void {
  if (!isDragging) return;

  const dx = event.globalX - lastPointerPos.x;
  const dy = event.globalY - lastPointerPos.y;

  // Move camera center (opposite direction of drag, scaled by zoom)
  camera.targetCenter.x -= dx / camera.zoom;
  camera.targetCenter.y -= dy / camera.zoom;

  lastPointerPos.x = event.globalX;
  lastPointerPos.y = event.globalY;
}

/**
 * Handle pointer up to stop panning
 */
export function handlePointerUp(
  camera: CameraState,
  setDragging: (dragging: boolean) => void
): void {
  setDragging(false);
  camera.isPanning = false;
}

/**
 * Center camera on a world position
 *
 * @param camera - Camera state to update
 * @param worldPos - World position to center on
 * @param instant - If true, snap immediately without interpolation
 */
export function centerCameraOn(
  camera: CameraState,
  worldPos: PixelPosition,
  instant: boolean = false
): void {
  camera.targetCenter = { ...worldPos };
  if (instant) {
    camera.center = { ...worldPos };
  }
}

/**
 * Check if a key is a camera pan key
 */
export function isCameraPanKey(key: string): boolean {
  const normalizedKey = key.toLowerCase();
  return ["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(normalizedKey);
}
