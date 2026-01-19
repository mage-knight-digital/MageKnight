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
  CAMERA_MAX_ZOOM,
  CAMERA_ZOOM_SPEED,
  CAMERA_LERP_FACTOR,
  CAMERA_KEYBOARD_PAN_SPEED,
  CAMERA_MIN_ZOOM,
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
    minZoom: CAMERA_MIN_ZOOM, // Will be updated dynamically based on screen/background
    bounds: { minX: -2400, maxX: 2400, minY: -1600, maxY: 1600 }, // Default, will be updated
    screenWidth: 1920,
    screenHeight: 1080,
  };
}

/**
 * Clamp camera center to stay within bounds (accounting for screen size and zoom)
 * This modifies targetCenter to ensure it stays within valid bounds.
 * If the visible area exceeds bounds, centers on bounds.
 */
export function clampCameraCenter(camera: CameraState): void {
  // Calculate how much world space is visible at current zoom
  const visibleWidth = camera.screenWidth / camera.zoom;
  const visibleHeight = camera.screenHeight / camera.zoom;

  // Calculate the allowed center range so the camera doesn't show outside bounds
  const halfVisibleW = visibleWidth / 2;
  const halfVisibleH = visibleHeight / 2;

  // If visible area is larger than bounds, center on bounds
  const boundsWidth = camera.bounds.maxX - camera.bounds.minX;
  const boundsHeight = camera.bounds.maxY - camera.bounds.minY;

  if (visibleWidth >= boundsWidth) {
    camera.targetCenter.x = (camera.bounds.minX + camera.bounds.maxX) / 2;
  } else {
    const minCenterX = camera.bounds.minX + halfVisibleW;
    const maxCenterX = camera.bounds.maxX - halfVisibleW;
    camera.targetCenter.x = Math.max(minCenterX, Math.min(maxCenterX, camera.targetCenter.x));
  }

  if (visibleHeight >= boundsHeight) {
    camera.targetCenter.y = (camera.bounds.minY + camera.bounds.maxY) / 2;
  } else {
    const minCenterY = camera.bounds.minY + halfVisibleH;
    const maxCenterY = camera.bounds.maxY - halfVisibleH;
    camera.targetCenter.y = Math.max(minCenterY, Math.min(maxCenterY, camera.targetCenter.y));
  }
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

  // Snap if very close to target (avoid endless tiny interpolations)
  const SNAP_THRESHOLD = 0.01;

  // Interpolate zoom
  if (Math.abs(camera.zoom - camera.targetZoom) < SNAP_THRESHOLD) {
    camera.zoom = camera.targetZoom;
  } else {
    camera.zoom = lerp(camera.zoom, camera.targetZoom, t);
  }

  // Interpolate center position
  if (Math.abs(camera.center.x - camera.targetCenter.x) < SNAP_THRESHOLD) {
    camera.center.x = camera.targetCenter.x;
  } else {
    camera.center.x = lerp(camera.center.x, camera.targetCenter.x, t);
  }

  if (Math.abs(camera.center.y - camera.targetCenter.y) < SNAP_THRESHOLD) {
    camera.center.y = camera.targetCenter.y;
  } else {
    camera.center.y = lerp(camera.center.y, camera.targetCenter.y, t);
  }

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

  // Clamp camera to bounds
  clampCameraCenter(camera);
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

  // Calculate new zoom (use dynamic minZoom from camera state)
  const zoomDelta = event.deltaY > 0 ? -CAMERA_ZOOM_SPEED : CAMERA_ZOOM_SPEED;
  const newZoom = Math.max(
    camera.minZoom,
    Math.min(CAMERA_MAX_ZOOM, camera.targetZoom * (1 + zoomDelta))
  );

  // Update target zoom
  camera.targetZoom = newZoom;

  // Adjust center to keep mouse position stable (cursor-centered zoom)
  camera.targetCenter.x = worldMouseX - (mouseX - app.screen.width / 2) / newZoom;
  camera.targetCenter.y = worldMouseY - (mouseY - app.screen.height / 2) / newZoom;

  // Clamp camera to bounds
  clampCameraCenter(camera);
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

  // Clamp camera to bounds
  clampCameraCenter(camera);

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
