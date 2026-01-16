/**
 * PixiJS-based hex grid renderer
 *
 * Phase 1: Basic static rendering ✓
 * Phase 2: Interactivity (click, hover, path preview) ✓
 * Phase 3: Camera controls (pan/zoom)
 */

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { FederatedPointerEvent } from "pixi.js";
import { Application, Container, Sprite, Graphics, Assets, Texture, Text, TextStyle } from "pixi.js";
import type {
  HexCoord,
  ClientHexState,
  ClientGameState,
  MoveTarget,
  ReachableHex,
  HexDirection,
} from "@mage-knight/shared";
import { hexKey, MOVE_ACTION, EXPLORE_ACTION, getAllNeighbors } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { useGameIntro } from "../../contexts/GameIntroContext";
import { useAnimationDispatcher } from "../../contexts/AnimationDispatcherContext";
import {
  getTileImageUrl,
  getEnemyImageUrl,
  getEnemyTokenBackUrl,
  tokenIdToEnemyId,
  type EnemyTokenColor,
} from "../../assets/assetPaths";
import { hexToPixel, getHexVertices, calculateBounds, getEnemyOffset } from "./pixi/hexMath";
import {
  HEX_SIZE,
  TILE_WIDTH,
  TILE_HEIGHT,
  ENEMY_TOKEN_SIZE,
  HERO_TOKEN_RADIUS,
  CAMERA_MIN_ZOOM,
  CAMERA_MAX_ZOOM,
  CAMERA_ZOOM_SPEED,
  CAMERA_LERP_FACTOR,
  CAMERA_KEYBOARD_PAN_SPEED,
  type WorldLayers,
  type PixelPosition,
  type CameraState,
} from "./pixi/types";

// Movement highlight types
type MoveHighlightType = "none" | "adjacent" | "reachable" | "terminal";

interface MoveHighlight {
  type: MoveHighlightType;
  cost?: number;
}

// Explore target with direction info
interface ExploreTarget {
  coord: HexCoord;
  direction: HexDirection;
  fromTileCoord: HexCoord;
}

// Colors for movement highlights
const HIGHLIGHT_COLORS: Record<string, number> = {
  adjacent: 0x00ff00,    // Green - safe move
  reachable: 0x00ff00,   // Green - safe multi-hop
  terminal: 0xffa500,    // Orange - triggers combat
  hover: 0xffffff,       // White - hover highlight
  none: 0x000000,        // Black - no highlight
};

/**
 * Simple A* pathfinding for path preview visualization.
 */
function findPath(
  start: HexCoord,
  end: HexCoord,
  reachableHexes: readonly ReachableHex[],
  adjacentTargets: readonly MoveTarget[]
): HexCoord[] {
  const reachableMap = new Map<string, { cost: number; isTerminal: boolean }>();
  for (const r of reachableHexes) {
    reachableMap.set(hexKey(r.hex), { cost: r.totalCost, isTerminal: r.isTerminal });
  }
  for (const t of adjacentTargets) {
    reachableMap.set(hexKey(t.hex), { cost: t.cost, isTerminal: t.isTerminal ?? false });
  }

  const endKey = hexKey(end);
  if (!reachableMap.has(endKey)) {
    return [];
  }

  type Node = { f: number; g: number; coord: HexCoord; path: HexCoord[] };

  const heuristic = (a: HexCoord, b: HexCoord): number => {
    return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
  };

  const startKey = hexKey(start);
  const openSet: Node[] = [{ f: heuristic(start, end), g: 0, coord: start, path: [start] }];
  const visited = new Set<string>([startKey]);

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift()!;
    const currentKey = hexKey(current.coord);

    if (currentKey === endKey) {
      return current.path;
    }

    // Don't expand from terminal hexes (except start)
    const currentData = reachableMap.get(currentKey);
    if (currentData?.isTerminal && currentKey !== startKey) {
      continue;
    }

    const neighbors = getAllNeighbors(current.coord);
    for (const neighbor of neighbors) {
      const neighborKey = hexKey(neighbor);
      if (visited.has(neighborKey)) continue;

      const neighborData = reachableMap.get(neighborKey);
      if (!neighborData) continue;

      visited.add(neighborKey);
      const g = current.g + 1;
      const f = g + heuristic(neighbor, end);
      openSet.push({ f, g, coord: neighbor, path: [...current.path, neighbor] });
    }
  }

  return [];
}

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

  graphics
    .poly(vertices.map((v) => ({ x: center.x + v.x, y: center.y + v.y })))
    .fill({ color: fillColor, alpha: fillAlpha })
    .stroke({ color: strokeColor, width: strokeWidth, alpha: strokeAlpha });
}

/**
 * Create the world container hierarchy
 */
function createWorldLayers(): { world: Container; layers: WorldLayers } {
  const world = new Container();
  world.label = "world";

  const layers: WorldLayers = {
    tiles: new Container(),
    hexOverlays: new Container(),
    pathPreview: new Container(),
    enemies: new Container(),
    hero: new Container(),
    ghostHexes: new Container(),
    ui: new Container(),
  };

  layers.tiles.label = "tiles";
  layers.hexOverlays.label = "hexOverlays";
  layers.pathPreview.label = "pathPreview";
  layers.enemies.label = "enemies";
  layers.hero.label = "hero";
  layers.ghostHexes.label = "ghostHexes";
  layers.ui.label = "ui";

  world.addChild(layers.tiles);
  world.addChild(layers.hexOverlays);
  world.addChild(layers.pathPreview);
  world.addChild(layers.enemies);
  world.addChild(layers.hero);
  world.addChild(layers.ghostHexes);
  world.addChild(layers.ui);

  return { world, layers };
}

/**
 * Load a texture with caching
 */
async function loadTexture(url: string): Promise<Texture> {
  if (Assets.cache.has(url)) {
    return Assets.get(url);
  }
  return Assets.load(url);
}

/**
 * Render all tiles
 */
async function renderTiles(
  layers: WorldLayers,
  tiles: ClientGameState["map"]["tiles"]
): Promise<void> {
  layers.tiles.removeChildren();

  for (const tile of tiles) {
    const { x, y } = hexToPixel(tile.centerCoord);
    const imageUrl = getTileImageUrl(tile.tileId);

    try {
      const texture = await loadTexture(imageUrl);
      const sprite = new Sprite(texture);

      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(x, y);
      sprite.width = TILE_WIDTH;
      sprite.height = TILE_HEIGHT;
      sprite.label = `tile-${tile.tileId}`;
      layers.tiles.addChild(sprite);
    } catch (error) {
      console.error(`Failed to load tile texture: ${imageUrl}`, error);
    }
  }
}

/**
 * Render interactive hex overlays with movement highlights
 */
function renderHexOverlays(
  layers: WorldLayers,
  hexes: Record<string, ClientHexState>,
  getHighlight: (coord: HexCoord) => MoveHighlight,
  hoveredHex: HexCoord | null,
  onHexClick: (coord: HexCoord) => void,
  onHexHover: (coord: HexCoord | null) => void
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

    drawHexPolygon(graphics, { x, y }, HEX_SIZE * 0.95, fillColor, fillAlpha, strokeColor, 1, strokeAlpha);

    // Make interactive
    graphics.eventMode = "static";
    graphics.cursor = highlight.type !== "none" ? "pointer" : "default";

    // Store coord for event handlers
    const coord = hex.coord;
    graphics.on("pointerdown", () => onHexClick(coord));
    graphics.on("pointerenter", () => onHexHover(coord));
    graphics.on("pointerleave", () => onHexHover(null));

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

/**
 * Render path preview line
 */
function renderPathPreview(
  layers: WorldLayers,
  path: HexCoord[],
  isTerminal: boolean
): void {
  layers.pathPreview.removeChildren();

  if (path.length < 2) return;

  const graphics = new Graphics();
  graphics.label = "path-line";

  const color = isTerminal ? 0xffa500 : 0x00ff00;

  // Draw path line
  const points = path.map((coord) => hexToPixel(coord));
  const firstPoint = points[0];
  if (!firstPoint) return;

  // Outer glow
  graphics.moveTo(firstPoint.x, firstPoint.y);
  for (let i = 1; i < points.length; i++) {
    const pt = points[i];
    if (pt) graphics.lineTo(pt.x, pt.y);
  }
  graphics.stroke({ color: 0x000000, width: 8, alpha: 0.5 });

  // Main line
  graphics.moveTo(firstPoint.x, firstPoint.y);
  for (let i = 1; i < points.length; i++) {
    const pt = points[i];
    if (pt) graphics.lineTo(pt.x, pt.y);
  }
  graphics.stroke({ color, width: 4, alpha: 1 });

  // Arrow at the end
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

/**
 * Render enemy tokens on hexes
 */
async function renderEnemies(
  layers: WorldLayers,
  hexes: Record<string, ClientHexState>
): Promise<void> {
  layers.enemies.removeChildren();

  for (const hex of Object.values(hexes)) {
    if (hex.enemies.length === 0) continue;

    const hexCenter = hexToPixel(hex.coord);

    for (let i = 0; i < hex.enemies.length; i++) {
      const enemy = hex.enemies[i];
      if (!enemy) continue;

      const offset = getEnemyOffset(i, hex.enemies.length, ENEMY_TOKEN_SIZE);

      let imageUrl: string;
      if (enemy.isRevealed && enemy.tokenId) {
        const enemyId = tokenIdToEnemyId(enemy.tokenId);
        imageUrl = getEnemyImageUrl(enemyId);
      } else {
        const tokenColor = (enemy.color === "gray" ? "grey" : enemy.color) as EnemyTokenColor;
        imageUrl = getEnemyTokenBackUrl(tokenColor);
      }

      try {
        const texture = await loadTexture(imageUrl);
        const sprite = new Sprite(texture);

        sprite.anchor.set(0.5, 0.5);
        sprite.position.set(hexCenter.x + offset.x, hexCenter.y + offset.y);
        sprite.width = ENEMY_TOKEN_SIZE;
        sprite.height = ENEMY_TOKEN_SIZE;

        const mask = new Graphics();
        mask.circle(hexCenter.x + offset.x, hexCenter.y + offset.y, ENEMY_TOKEN_SIZE / 2);
        mask.fill({ color: 0xffffff });
        sprite.mask = mask;

        const enemyContainer = new Container();
        enemyContainer.label = `enemy-${hexKey(hex.coord)}-${i}`;
        enemyContainer.addChild(mask);
        enemyContainer.addChild(sprite);

        const border = new Graphics();
        border.circle(hexCenter.x + offset.x, hexCenter.y + offset.y, ENEMY_TOKEN_SIZE / 2);
        border.stroke({ color: 0x000000, width: 1, alpha: 0.5 });
        enemyContainer.addChild(border);

        layers.enemies.addChild(enemyContainer);
      } catch (error) {
        console.error(`Failed to load enemy texture: ${imageUrl}`, error);
      }
    }
  }
}

/**
 * Render the hero token
 */
function renderHero(layers: WorldLayers, position: HexCoord | null): void {
  layers.hero.removeChildren();

  if (!position) return;

  const { x, y } = hexToPixel(position);

  const heroGraphics = new Graphics();
  heroGraphics.label = "hero-token";

  heroGraphics
    .circle(x, y, HERO_TOKEN_RADIUS)
    .fill({ color: 0xff4444 })
    .stroke({ color: 0xffffff, width: 2 });

  layers.hero.addChild(heroGraphics);
}

/**
 * Render ghost hexes for exploration targets with click handling
 */
function renderGhostHexes(
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
      .fill({ color: 0x6495ed, alpha: 0.2 })
      .stroke({ color: 0x4169e1, width: 2, alpha: 0.8 });

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
      fill: 0x4169e1,
    });
    const questionMark = new Text({ text: "?", style });
    questionMark.anchor.set(0.5, 0.5);
    questionMark.position.set(x, y);
    layers.ghostHexes.addChild(questionMark);
  }
}

/**
 * Create initial camera state
 */
function createInitialCameraState(): CameraState {
  return {
    center: { x: 0, y: 0 },
    zoom: 1,
    targetCenter: { x: 0, y: 0 },
    targetZoom: 1,
    isPanning: false,
  };
}

/**
 * Linear interpolation
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * PixiJS Hex Grid Component
 */
export function PixiHexGrid() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const layersRef = useRef<WorldLayers | null>(null);
  const worldRef = useRef<Container | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hoveredHex, setHoveredHex] = useState<HexCoord | null>(null);

  // Camera state (using refs for smooth animation without re-renders)
  const cameraRef = useRef<CameraState>(createInitialCameraState());
  const isDraggingRef = useRef(false);
  const lastPointerPosRef = useRef<PixelPosition>({ x: 0, y: 0 });
  const keysDownRef = useRef<Set<string>>(new Set());
  const hasCenteredOnHeroRef = useRef(false);

  const { state, sendAction } = useGame();
  const player = useMyPlayer();
  const { startIntro } = useGameIntro();
  const { emit: emitAnimationEvent } = useAnimationDispatcher();

  // Get valid move targets from server
  const validMoveTargets = useMemo<readonly MoveTarget[]>(
    () => state?.validActions.move?.targets ?? [],
    [state?.validActions.move?.targets]
  );

  // Get reachable hexes (multi-hop)
  const reachableHexes = useMemo<readonly ReachableHex[]>(
    () => state?.validActions.move?.reachable ?? [],
    [state?.validActions.move?.reachable]
  );

  // Extract explore targets
  const exploreTargets = useMemo<ExploreTarget[]>(() => {
    if (!state?.validActions.explore) return [];
    return state.validActions.explore.directions.map((dir) => ({
      coord: dir.targetCoord,
      direction: dir.direction,
      fromTileCoord: dir.fromTileCoord,
    }));
  }, [state?.validActions.explore]);

  // Compute path to hovered hex
  const pathPreview = useMemo<HexCoord[]>(() => {
    if (!hoveredHex || !player?.position) return [];

    const isAdjacent = validMoveTargets.some(
      (t) => t.hex.q === hoveredHex.q && t.hex.r === hoveredHex.r
    );
    const isReachable = reachableHexes.some(
      (r) => r.hex.q === hoveredHex.q && r.hex.r === hoveredHex.r
    );

    if (!isAdjacent && !isReachable) return [];

    return findPath(player.position, hoveredHex, reachableHexes, validMoveTargets);
  }, [hoveredHex, player?.position, reachableHexes, validMoveTargets]);

  // Check if path ends at terminal hex
  const isPathTerminal = useMemo(() => {
    if (pathPreview.length === 0) return false;
    const endHex = pathPreview[pathPreview.length - 1];
    if (!endHex) return false;
    const reachable = reachableHexes.find(
      (r) => r.hex.q === endHex.q && r.hex.r === endHex.r
    );
    const adjacent = validMoveTargets.find(
      (t) => t.hex.q === endHex.q && t.hex.r === endHex.r
    );
    return reachable?.isTerminal || adjacent?.isTerminal || false;
  }, [pathPreview, reachableHexes, validMoveTargets]);

  // Get movement highlight for a hex
  const getMoveHighlight = useCallback(
    (coord: HexCoord): MoveHighlight => {
      const adjacentTarget = validMoveTargets.find(
        (t) => t.hex.q === coord.q && t.hex.r === coord.r
      );
      if (adjacentTarget) {
        if (adjacentTarget.isTerminal) {
          return { type: "terminal", cost: adjacentTarget.cost };
        }
        return { type: "adjacent", cost: adjacentTarget.cost };
      }

      const reachable = reachableHexes.find(
        (r) => r.hex.q === coord.q && r.hex.r === coord.r
      );
      if (reachable) {
        if (reachable.isTerminal) {
          return { type: "terminal", cost: reachable.totalCost };
        }
        return { type: "reachable", cost: reachable.totalCost };
      }

      return { type: "none" };
    },
    [validMoveTargets, reachableHexes]
  );

  // Handle hex click for movement
  const handleHexClick = useCallback(
    (coord: HexCoord) => {
      if (!player?.position) return;

      const isAdjacentTarget = validMoveTargets.some(
        (t) => t.hex.q === coord.q && t.hex.r === coord.r
      );

      if (isAdjacentTarget) {
        sendAction({ type: MOVE_ACTION, target: coord });
        return;
      }

      const isReachableTarget = reachableHexes.some(
        (r) => r.hex.q === coord.q && r.hex.r === coord.r
      );

      if (isReachableTarget) {
        // For multi-hop, compute path and move to first hop
        const path = findPath(player.position, coord, reachableHexes, validMoveTargets);
        if (path.length > 1 && path[1]) {
          sendAction({ type: MOVE_ACTION, target: path[1] });
        }
      }
    },
    [player?.position, validMoveTargets, reachableHexes, sendAction]
  );

  // Handle explore click
  const handleExploreClick = useCallback(
    (target: ExploreTarget) => {
      sendAction({
        type: EXPLORE_ACTION,
        direction: target.direction,
        fromTileCoord: target.fromTileCoord,
      });
    },
    [sendAction]
  );

  // Apply camera state to world container
  const applyCamera = useCallback(() => {
    const app = appRef.current;
    const world = worldRef.current;
    if (!app || !world) return;

    const camera = cameraRef.current;

    // Apply zoom
    world.scale.set(camera.zoom);

    // Calculate world position so camera.center is at screen center
    world.position.set(
      app.screen.width / 2 - camera.center.x * camera.zoom,
      app.screen.height / 2 - camera.center.y * camera.zoom
    );
  }, []);

  // Update camera position with smooth interpolation
  const updateCamera = useCallback((deltaTime: number) => {
    const camera = cameraRef.current;

    // Smooth interpolation toward target
    const t = 1 - Math.pow(1 - CAMERA_LERP_FACTOR, deltaTime * 60 / 1000);

    // Interpolate zoom
    camera.zoom = lerp(camera.zoom, camera.targetZoom, t);

    // Interpolate center position
    camera.center.x = lerp(camera.center.x, camera.targetCenter.x, t);
    camera.center.y = lerp(camera.center.y, camera.targetCenter.y, t);

    // Handle keyboard panning
    const keys = keysDownRef.current;
    const panAmount = (CAMERA_KEYBOARD_PAN_SPEED * deltaTime / 1000) / camera.zoom;

    if (keys.has("arrowup")) {
      camera.targetCenter.y -= panAmount;
    }
    if (keys.has("arrowdown")) {
      camera.targetCenter.y += panAmount;
    }
    if (keys.has("arrowleft")) {
      camera.targetCenter.x -= panAmount;
    }
    if (keys.has("arrowright")) {
      camera.targetCenter.x += panAmount;
    }

    applyCamera();
  }, [applyCamera]);

  // Handle mouse wheel zoom (cursor-centered)
  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();

    const app = appRef.current;
    if (!app) return;

    const camera = cameraRef.current;

    // Get mouse position relative to canvas
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Convert mouse position to world coordinates (before zoom)
    const worldMouseX = (mouseX - app.screen.width / 2) / camera.zoom + camera.center.x;
    const worldMouseY = (mouseY - app.screen.height / 2) / camera.zoom + camera.center.y;

    // Calculate new zoom
    const zoomDelta = event.deltaY > 0 ? -CAMERA_ZOOM_SPEED : CAMERA_ZOOM_SPEED;
    const newZoom = Math.max(CAMERA_MIN_ZOOM, Math.min(CAMERA_MAX_ZOOM, camera.targetZoom * (1 + zoomDelta)));

    // Update target zoom
    camera.targetZoom = newZoom;

    // Adjust center to keep mouse position stable (cursor-centered zoom)
    // After zoom, the world coords under the mouse should be the same
    camera.targetCenter.x = worldMouseX - (mouseX - app.screen.width / 2) / newZoom;
    camera.targetCenter.y = worldMouseY - (mouseY - app.screen.height / 2) / newZoom;
  }, []);

  // Handle pointer down for panning
  const handlePointerDown = useCallback((event: FederatedPointerEvent) => {
    // Only pan with middle mouse button or when holding space
    // For now, use right-click for panning
    if (event.button === 2 || event.button === 1) {
      isDraggingRef.current = true;
      lastPointerPosRef.current = { x: event.globalX, y: event.globalY };
      cameraRef.current.isPanning = true;
    }
  }, []);

  // Handle pointer move for panning
  const handlePointerMove = useCallback((event: FederatedPointerEvent) => {
    if (!isDraggingRef.current) return;

    const camera = cameraRef.current;
    const dx = event.globalX - lastPointerPosRef.current.x;
    const dy = event.globalY - lastPointerPosRef.current.y;

    // Move camera center (opposite direction of drag, scaled by zoom)
    camera.targetCenter.x -= dx / camera.zoom;
    camera.targetCenter.y -= dy / camera.zoom;

    lastPointerPosRef.current = { x: event.globalX, y: event.globalY };
  }, []);

  // Handle pointer up to stop panning
  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
    cameraRef.current.isPanning = false;
  }, []);

  // Handle keyboard events for panning (arrow keys only - WASD reserved for game actions)
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      keysDownRef.current.add(key);
    }
  }, []);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    keysDownRef.current.delete(key);
  }, []);

  // Center camera on a world position
  const centerCameraOn = useCallback((worldPos: PixelPosition, instant: boolean = false) => {
    const camera = cameraRef.current;
    camera.targetCenter = { ...worldPos };
    if (instant) {
      camera.center = { ...worldPos };
      applyCamera();
    }
  }, [applyCamera]);

  // Initialize PixiJS application
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    let destroyed = false;

    const initPixi = async () => {
      const app = new Application();

      await app.init({
        background: 0x1a1a2e,
        resizeTo: container,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (destroyed) {
        app.destroy(true);
        return;
      }

      container.appendChild(app.canvas);

      const { world, layers } = createWorldLayers();
      app.stage.addChild(world);

      // Enable interactivity on stage
      app.stage.eventMode = "static";
      app.stage.hitArea = app.screen;

      // Set up camera pan event handlers on stage
      app.stage.on("pointerdown", handlePointerDown);
      app.stage.on("pointermove", handlePointerMove);
      app.stage.on("pointerup", handlePointerUp);
      app.stage.on("pointerupoutside", handlePointerUp);

      // Disable context menu on canvas (for right-click pan)
      app.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

      // Set up ticker for smooth camera updates
      app.ticker.add((ticker) => {
        updateCamera(ticker.deltaMS);
      });

      appRef.current = app;
      layersRef.current = layers;
      worldRef.current = world;

      console.log("[PixiHexGrid] Initialized PixiJS application with camera controls");
      setIsInitialized(true);
    };

    initPixi();

    return () => {
      destroyed = true;
      if (appRef.current) {
        console.log("[PixiHexGrid] Destroying PixiJS application");
        appRef.current.destroy(true, { children: true, texture: true });
        appRef.current = null;
        layersRef.current = null;
        worldRef.current = null;
        setIsInitialized(false);
      }
    };
  }, [handlePointerDown, handlePointerMove, handlePointerUp, updateCamera]);

  // Set up DOM event listeners (wheel, keyboard)
  useEffect(() => {
    if (!isInitialized) return;

    const container = containerRef.current;
    if (!container) return;

    // Wheel zoom (needs to be on DOM element, not PixiJS)
    container.addEventListener("wheel", handleWheel, { passive: false });

    // Keyboard pan
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isInitialized, handleWheel, handleKeyDown, handleKeyUp]);

  // Trigger intro sequence immediately (no animations in Pixi yet)
  useEffect(() => {
    if (!isInitialized || !state) return;

    // Count tiles and enemies for the intro system
    const tileCount = state.map.tiles.length;
    const enemyCount = Object.values(state.map.hexes).reduce(
      (sum, hex) => sum + hex.enemies.length,
      0
    );

    // Start the intro sequence
    startIntro(tileCount, enemyCount);

    // Since we don't animate tiles/enemies in Pixi yet, emit completion immediately
    // This allows the tactic selection overlay to appear
    emitAnimationEvent("tiles-complete");
    emitAnimationEvent("enemies-complete");

    console.log("[PixiHexGrid] Triggered intro completion for tactic selection");
  }, [isInitialized, state, startIntro, emitAnimationEvent]);

  // Update rendering when game state changes
  useEffect(() => {
    if (!isInitialized || !state || !layersRef.current || !worldRef.current) return;

    const layers = layersRef.current;
    const heroPosition = player?.position ?? null;

    // Render static layers
    const renderAsync = async () => {
      await renderTiles(layers, state.map.tiles);
      await renderEnemies(layers, state.map.hexes);
      renderHero(layers, heroPosition);

      // Initialize camera on first render (center on hero)
      if (!hasCenteredOnHeroRef.current && appRef.current) {
        const hexes = Object.values(state.map.hexes);
        const positions = hexes.map((h) => hexToPixel(h.coord));

        for (const target of exploreTargets) {
          positions.push(hexToPixel(target.coord));
        }

        const bounds = calculateBounds(positions);
        const app = appRef.current;

        // Calculate initial zoom to fit content
        const scaleX = app.screen.width / bounds.width;
        const scaleY = app.screen.height / bounds.height;
        const initialZoom = Math.min(scaleX, scaleY) * 0.9;

        // Set initial camera state
        const camera = cameraRef.current;
        camera.targetZoom = initialZoom;
        camera.zoom = initialZoom;

        // Center on hero if available, otherwise center on map bounds
        if (heroPosition) {
          const heroPixel = hexToPixel(heroPosition);
          centerCameraOn(heroPixel, true);
        } else {
          const centerX = bounds.minX + bounds.width / 2;
          const centerY = bounds.minY + bounds.height / 2;
          centerCameraOn({ x: centerX, y: centerY }, true);
        }

        hasCenteredOnHeroRef.current = true;
        console.log("[PixiHexGrid] Centered camera on hero, zoom:", initialZoom.toFixed(2));
      }

      console.log("[PixiHexGrid] Rendered:", state.map.tiles.length, "tiles");
    };

    renderAsync();
  }, [isInitialized, state, player?.position, exploreTargets, centerCameraOn]);

  // Update interactive layers (hex overlays, ghost hexes, path preview)
  useEffect(() => {
    if (!isInitialized || !state || !layersRef.current) return;

    const layers = layersRef.current;

    // Render interactive hex overlays
    renderHexOverlays(
      layers,
      state.map.hexes,
      getMoveHighlight,
      hoveredHex,
      handleHexClick,
      setHoveredHex
    );

    // Render ghost hexes
    renderGhostHexes(layers, exploreTargets, handleExploreClick);

    // Render path preview
    renderPathPreview(layers, pathPreview, isPathTerminal);
  }, [
    isInitialized,
    state,
    hoveredHex,
    pathPreview,
    isPathTerminal,
    getMoveHighlight,
    handleHexClick,
    handleExploreClick,
    exploreTargets,
  ]);

  return (
    <div
      ref={containerRef}
      className="hex-grid"
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
      tabIndex={0}
      data-testid="pixi-hex-grid"
    />
  );
}
