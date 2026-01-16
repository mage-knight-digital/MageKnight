/**
 * PixiJS-based hex grid renderer
 *
 * Phase 1: Basic static rendering
 * - Initialize PixiJS Application
 * - Render tiles, hexes, hero, enemies
 * - No animations or interactions yet
 */

import { useEffect, useRef, useState } from "react";
import { Application, Container, Sprite, Graphics, Assets, Texture } from "pixi.js";
import type { HexCoord, ClientHexState, ClientGameState } from "@mage-knight/shared";
import { hexKey } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
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
  type WorldLayers,
  type PixelPosition,
} from "./pixi/types";

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

  // Create layers in render order (back to front)
  const layers: WorldLayers = {
    tiles: new Container(),
    hexOverlays: new Container(),
    pathPreview: new Container(),
    enemies: new Container(),
    hero: new Container(),
    ghostHexes: new Container(),
    ui: new Container(),
  };

  // Set labels for debugging
  layers.tiles.label = "tiles";
  layers.hexOverlays.label = "hexOverlays";
  layers.pathPreview.label = "pathPreview";
  layers.enemies.label = "enemies";
  layers.hero.label = "hero";
  layers.ghostHexes.label = "ghostHexes";
  layers.ui.label = "ui";

  // Add layers to world in order
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
  // Check if already loaded
  if (Assets.cache.has(url)) {
    return Assets.get(url);
  }
  // Load and cache
  return Assets.load(url);
}

/**
 * Render all tiles
 */
async function renderTiles(
  layers: WorldLayers,
  tiles: ClientGameState["map"]["tiles"]
): Promise<void> {
  // Clear existing tiles
  layers.tiles.removeChildren();

  for (const tile of tiles) {
    const { x, y } = hexToPixel(tile.centerCoord);
    const imageUrl = getTileImageUrl(tile.tileId);

    try {
      const texture = await loadTexture(imageUrl);
      const sprite = new Sprite(texture);

      // Center the sprite on the tile center
      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(x, y);

      // Scale to match expected tile dimensions
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
 * Render hex overlays (transparent polygons for hit detection)
 */
function renderHexOverlays(
  layers: WorldLayers,
  hexes: Record<string, ClientHexState>
): void {
  // Clear existing overlays
  layers.hexOverlays.removeChildren();

  for (const hex of Object.values(hexes)) {
    const { x, y } = hexToPixel(hex.coord);

    const graphics = new Graphics();
    graphics.label = `hex-${hexKey(hex.coord)}`;

    // Draw transparent hex for hit detection
    drawHexPolygon(
      graphics,
      { x, y },
      HEX_SIZE * 0.95,
      0x000000, // fill color (won't be visible due to alpha)
      0.01,    // fill alpha (nearly transparent but still interactive)
      0x666666, // stroke color
      1,       // stroke width
      0.3      // stroke alpha
    );

    layers.hexOverlays.addChild(graphics);
  }
}

/**
 * Render enemy tokens on hexes
 */
async function renderEnemies(
  layers: WorldLayers,
  hexes: Record<string, ClientHexState>
): Promise<void> {
  // Clear existing enemies
  layers.enemies.removeChildren();

  for (const hex of Object.values(hexes)) {
    if (hex.enemies.length === 0) continue;

    const hexCenter = hexToPixel(hex.coord);

    for (let i = 0; i < hex.enemies.length; i++) {
      const enemy = hex.enemies[i];
      if (!enemy) continue;

      const offset = getEnemyOffset(i, hex.enemies.length, ENEMY_TOKEN_SIZE);

      // Get the appropriate image URL
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

        // Position relative to hex center
        sprite.anchor.set(0.5, 0.5);
        sprite.position.set(hexCenter.x + offset.x, hexCenter.y + offset.y);

        // Size the token
        sprite.width = ENEMY_TOKEN_SIZE;
        sprite.height = ENEMY_TOKEN_SIZE;

        // Create circular mask
        const mask = new Graphics();
        mask.circle(hexCenter.x + offset.x, hexCenter.y + offset.y, ENEMY_TOKEN_SIZE / 2);
        mask.fill({ color: 0xffffff });
        sprite.mask = mask;

        // Add mask to container so it renders
        const enemyContainer = new Container();
        enemyContainer.label = `enemy-${hexKey(hex.coord)}-${i}`;
        enemyContainer.addChild(mask);
        enemyContainer.addChild(sprite);

        // Add subtle border
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
function renderHero(
  layers: WorldLayers,
  position: HexCoord | null
): void {
  // Clear existing hero
  layers.hero.removeChildren();

  if (!position) return;

  const { x, y } = hexToPixel(position);

  const heroGraphics = new Graphics();
  heroGraphics.label = "hero-token";

  // Red circle with white stroke (matching SVG version)
  heroGraphics
    .circle(x, y, HERO_TOKEN_RADIUS)
    .fill({ color: 0xff4444 })
    .stroke({ color: 0xffffff, width: 2 });

  layers.hero.addChild(heroGraphics);
}

/**
 * Render ghost hexes for exploration targets
 */
function renderGhostHexes(
  layers: WorldLayers,
  exploreTargets: Array<{ coord: HexCoord }>
): void {
  // Clear existing ghost hexes
  layers.ghostHexes.removeChildren();

  for (const target of exploreTargets) {
    const { x, y } = hexToPixel(target.coord);

    const graphics = new Graphics();
    graphics.label = `ghost-${hexKey(target.coord)}`;

    // Dashed border hex (approximated with solid for Phase 1)
    // TODO: Add dashed line support in Phase 2
    const vertices = getHexVertices(HEX_SIZE * 0.95);

    graphics
      .poly(vertices.map((v) => ({ x: x + v.x, y: y + v.y })))
      .fill({ color: 0x6495ed, alpha: 0.2 })
      .stroke({ color: 0x4169e1, width: 2, alpha: 0.8 });

    // Question mark text (placeholder - PixiJS text requires more setup)
    // TODO: Add text rendering in Phase 2

    layers.ghostHexes.addChild(graphics);
  }
}

/**
 * Main render function - updates all layers based on game state
 */
async function renderGameState(
  layers: WorldLayers,
  state: ClientGameState,
  heroPosition: HexCoord | null
): Promise<void> {
  // Extract explore targets from validActions
  const exploreTargets: Array<{ coord: HexCoord }> = [];
  if (state.validActions.explore) {
    for (const exploreDir of state.validActions.explore.directions) {
      exploreTargets.push({ coord: exploreDir.targetCoord });
    }
  }

  // Render all layers (tiles async, others sync)
  await renderTiles(layers, state.map.tiles);
  renderHexOverlays(layers, state.map.hexes);
  await renderEnemies(layers, state.map.hexes);
  renderHero(layers, heroPosition);
  renderGhostHexes(layers, exploreTargets);
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

  const { state } = useGame();
  const player = useMyPlayer();

  // Initialize PixiJS application
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    let destroyed = false;

    const initPixi = async () => {
      // Create application
      const app = new Application();

      await app.init({
        background: 0x1a1a2e, // Dark background matching game theme
        resizeTo: container,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      // Check if we were destroyed while initializing
      if (destroyed) {
        app.destroy(true);
        return;
      }

      // Add canvas to DOM
      container.appendChild(app.canvas);

      // Create world container hierarchy
      const { world, layers } = createWorldLayers();
      app.stage.addChild(world);

      // Store refs
      appRef.current = app;
      layersRef.current = layers;
      worldRef.current = world;

      console.log("[PixiHexGrid] Initialized PixiJS application");
      setIsInitialized(true);
    };

    initPixi();

    // Cleanup on unmount
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
  }, []);

  // Update rendering when game state changes
  useEffect(() => {
    if (!isInitialized || !state || !layersRef.current || !worldRef.current) return;

    const heroPosition = player?.position ?? null;

    // Render the game state
    renderGameState(layersRef.current, state, heroPosition).then(() => {
      // After rendering, center the world in the viewport
      if (!appRef.current || !worldRef.current) return;

      // Calculate bounds of all hexes
      const hexes = Object.values(state.map.hexes);
      const positions = hexes.map((h) => hexToPixel(h.coord));

      // Add explore target positions
      if (state.validActions.explore) {
        for (const exploreDir of state.validActions.explore.directions) {
          positions.push(hexToPixel(exploreDir.targetCoord));
        }
      }

      const bounds = calculateBounds(positions);

      // Center world in viewport
      const app = appRef.current;
      const world = worldRef.current;

      // Calculate scale to fit bounds in viewport with padding
      const scaleX = app.screen.width / bounds.width;
      const scaleY = app.screen.height / bounds.height;
      const scale = Math.min(scaleX, scaleY) * 0.9; // 90% to add padding

      world.scale.set(scale);

      // Center the world
      const centerX = bounds.minX + bounds.width / 2;
      const centerY = bounds.minY + bounds.height / 2;

      world.position.set(
        app.screen.width / 2 - centerX * scale,
        app.screen.height / 2 - centerY * scale
      );

      console.log("[PixiHexGrid] Rendered:", state.map.tiles.length, "tiles,", hexes.length, "hexes");
    });
  }, [isInitialized, state, player?.position]);

  return (
    <div
      ref={containerRef}
      className="hex-grid"
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
      data-testid="pixi-hex-grid"
    />
  );
}
