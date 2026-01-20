/**
 * PixiJS-based hex grid renderer
 *
 * Main component that orchestrates rendering modules:
 * - Camera: Pan/zoom controls with smooth interpolation
 * - Tiles: Background tile images with intro animations
 * - Enemies: Enemy tokens with drop animations
 * - Hero: Player token with portal emergence
 * - Overlays: Movement highlights and cost badges
 * - Path Preview: Movement path visualization
 * - Ghost Hexes: Exploration target indicators
 *
 * Phase 1: Basic static rendering ✓
 * Phase 2: Interactivity (click, hover, path preview) ✓
 * Phase 3: Camera controls (pan/zoom) ✓
 * Phase 4: Animations (hero movement, intro, tile reveal) ✓
 * Phase 5: Particle effects and polish ✓
 */

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { FederatedPointerEvent } from "pixi.js";
import { Application, Container } from "pixi.js";
import type { HexCoord, MoveTarget, ReachableHex } from "@mage-knight/shared";
import { MOVE_ACTION, EXPLORE_ACTION, TIME_OF_DAY_NIGHT } from "@mage-knight/shared";
import { hexKey } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { useGameIntro } from "../../contexts/GameIntroContext";
import { useAnimationDispatcher } from "../../contexts/AnimationDispatcherContext";
import { useCinematic } from "../../contexts/CinematicContext";
import type { CinematicSequence } from "../../contexts/CinematicContext";
import { useOverlay } from "../../contexts/OverlayContext";
import { useDebugDisplay } from "../../contexts/DebugDisplayContext";
import { usePixiApp } from "../../contexts/PixiAppContext";
import { useHexHover } from "../../hooks/useHexHover";
import { HexTooltip } from "../HexTooltip";
import { SitePanel } from "../SitePanel";

// Pixi utilities
import { hexToPixel, calculateBounds } from "./pixi/hexMath";
import type { WorldLayers, PixelPosition, CameraState } from "./pixi/types";
import { CAMERA_MAX_ZOOM } from "./pixi/types";
import { AnimationManager, Easing, HERO_MOVE_DURATION_MS, ENEMY_FLIP_STAGGER_MS, INTRO_PHASE_GAP_MS } from "./pixi/animations";
import { ParticleManager, HEX_OUTLINE_DURATION_MS, TILE_RISE_DURATION_MS, TILE_SLAM_DURATION_MS, PORTAL_HERO_EMERGE_DURATION_MS } from "./pixi/particles";
import { findPath } from "./pixi/pathfinding";
import { BackgroundAtmosphere } from "./pixi/background";
import {
  createInitialCameraState,
  applyCamera,
  updateCamera,
  handleWheelZoom,
  handlePointerDown as cameraPointerDown,
  handlePointerMove as cameraPointerMove,
  handlePointerUp as cameraPointerUp,
  centerCameraOn,
  isCameraPanKey,
  clampCameraCenter,
} from "./pixi/camera";

// Rendering modules
import {
  renderTiles,
  renderStaticTileOutlines,
  renderEnemies,
  animateEnemyFlips,
  renderHeroIntoContainer,
  getOrCreateHeroContainer,
  renderHexOverlays,
  renderPathPreview,
  renderGhostHexes,
  renderBoardShape,
  setGhostHexTicker,
  cleanupGhostHexEffects,
  type MoveHighlight,
  type ExploreTarget,
  type HexHoverEvent,
  type EnemyFlipTarget,
} from "./pixi/rendering";
import { preloadIntroAssets } from "./pixi/preloadIntroAssets";
import { TILE_HEX_OFFSETS } from "@mage-knight/shared";

/**
 * Create the world container hierarchy with labeled layers
 */
function createWorldLayers(): { world: Container; layers: WorldLayers } {
  const world = new Container();
  world.label = "world";

  const layers: WorldLayers = {
    boardShape: new Container(),
    shadows: new Container(),
    tiles: new Container(),
    particles: new Container(),
    hexOverlays: new Container(),
    pathPreview: new Container(),
    enemies: new Container(),
    hero: new Container(),
    ghostHexes: new Container(),
    ui: new Container(),
  };

  // Label layers for debugging
  layers.boardShape.label = "boardShape";
  layers.shadows.label = "shadows";
  layers.tiles.label = "tiles";
  layers.particles.label = "particles";
  layers.hexOverlays.label = "hexOverlays";
  layers.pathPreview.label = "pathPreview";
  layers.enemies.label = "enemies";
  layers.hero.label = "hero";
  layers.ghostHexes.label = "ghostHexes";
  layers.ui.label = "ui";

  // Add in z-order (bottom to top)
  world.addChild(layers.boardShape);
  world.addChild(layers.shadows);
  world.addChild(layers.tiles);
  world.addChild(layers.particles);
  world.addChild(layers.hexOverlays);
  world.addChild(layers.pathPreview);
  world.addChild(layers.enemies);
  world.addChild(layers.hero);
  world.addChild(layers.ghostHexes);
  world.addChild(layers.ui);

  return { world, layers };
}

/**
 * PixiJS Hex Grid Component
 */
export function PixiHexGrid() {
  // Refs for PixiJS objects
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const layersRef = useRef<WorldLayers | null>(null);
  const worldRef = useRef<Container | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Loading screen state
  const [hoveredHex, setHoveredHex] = useState<HexCoord | null>(null);

  // Camera state refs
  const cameraRef = useRef<CameraState>(createInitialCameraState());
  const isDraggingRef = useRef(false);
  const lastPointerPosRef = useRef<PixelPosition>({ x: 0, y: 0 });
  const keysDownRef = useRef<Set<string>>(new Set());
  const hasCenteredOnHeroRef = useRef(false);
  const cameraReadyRef = useRef(false); // Don't apply camera until properly positioned

  // Animation state refs
  const animationManagerRef = useRef<AnimationManager | null>(null);
  const particleManagerRef = useRef<ParticleManager | null>(null);
  const backgroundRef = useRef<BackgroundAtmosphere | null>(null);
  const prevHeroPositionRef = useRef<HexCoord | null>(null);
  const heroContainerRef = useRef<Container | null>(null);
  const introPlayedRef = useRef(false);
  const prevTileCountRef = useRef(0);
  const knownTileIdsRef = useRef<Set<string>>(new Set());
  const revealedEnemyTokenIdsRef = useRef<Set<string>>(new Set());
  const pendingFlipTokenIdsRef = useRef<Set<string>>(new Set());
  const pendingFlipTargetsRef = useRef<EnemyFlipTarget[]>([]);
  const flipAnimationInProgressRef = useRef(false);

  // Track hexes being revealed (during exploration animation)
  // These hexes should not show movement overlays until animation completes
  // Use ref for immediate updates (no async delay) and state to trigger re-renders
  const revealingHexKeysRef = useRef<Set<string>>(new Set());
  // Use a counter to force effect re-run when revealing state changes
  const [revealingUpdateCounter, setRevealingUpdateCounter] = useState(0);

  // Game state hooks
  const { state, sendAction } = useGame();
  const player = useMyPlayer();
  const { startIntro, isIntroComplete } = useGameIntro();
  const { emit: emitAnimationEvent } = useAnimationDispatcher();
  const { playCinematic, isInCinematic } = useCinematic();
  const { isOverlayActive } = useOverlay();
  const { settings: debugDisplaySettings } = useDebugDisplay();
  const { setApp, setOverlayLayer } = usePixiApp();

  // Tooltip hover hook
  const {
    hoveredHex: tooltipHoveredHex,
    tooltipPosition,
    screenHexRadius,
    isTooltipVisible,
    handleHexMouseEnter: handleHexTooltipEnter,
    handleHexMouseLeave: handleHexTooltipLeave,
    handleTooltipMouseEnter,
    handleTooltipMouseLeave,
  } = useHexHover({ delay: 400 });

  // Site Panel state (detailed info panel)
  const [isSitePanelOpen, setIsSitePanelOpen] = useState(false);
  const [sitePanelHex, setSitePanelHex] = useState<HexCoord | null>(null);

  // Handler to open the site panel from tooltip "More Info" click
  const handleOpenSitePanel = useCallback((coord: HexCoord) => {
    setSitePanelHex(coord);
    setIsSitePanelOpen(true);
    handleHexTooltipLeave();
  }, [handleHexTooltipLeave]);

  // Handler to close the site panel
  const handleCloseSitePanel = useCallback(() => {
    setIsSitePanelOpen(false);
  }, []);

  // Track camera offset for panel (to restore when closed)
  const panelCameraOffsetRef = useRef<number>(0);

  // Shift camera when panel opens/closes
  useEffect(() => {
    const camera = cameraRef.current;
    const app = appRef.current;
    if (!app) return;

    // Panel takes ~40% of screen width (max 480px), shift camera left by half that
    // This keeps the game board centered in the remaining visible area
    const panelWidth = Math.min(app.screen.width * 0.4, 480);
    const offsetAmount = panelWidth / 2 / camera.zoom;

    if (isSitePanelOpen) {
      // Shift camera right (so viewport shows more of the left side)
      camera.targetCenter.x += offsetAmount;
      panelCameraOffsetRef.current = offsetAmount;
    } else if (panelCameraOffsetRef.current !== 0) {
      // Restore camera position
      camera.targetCenter.x -= panelCameraOffsetRef.current;
      panelCameraOffsetRef.current = 0;
    }
  }, [isSitePanelOpen]);

  // Memoized valid move targets
  const validMoveTargets = useMemo<readonly MoveTarget[]>(
    () => state?.validActions.move?.targets ?? [],
    [state?.validActions.move?.targets]
  );

  const reachableHexes = useMemo<readonly ReachableHex[]>(
    () => state?.validActions.move?.reachable ?? [],
    [state?.validActions.move?.reachable]
  );

  const exploreTargets = useMemo<ExploreTarget[]>(() => {
    if (!state?.validActions.explore) return [];
    return state.validActions.explore.directions.map((dir) => ({
      coord: dir.targetCoord,
      direction: dir.direction,
      fromTileCoord: dir.fromTileCoord,
    }));
  }, [state?.validActions.explore]);

  // Path preview computation
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

  // Movement highlight getter
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

  // Action handlers
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
        const path = findPath(player.position, coord, reachableHexes, validMoveTargets);
        if (path.length > 1 && path[1]) {
          sendAction({ type: MOVE_ACTION, target: path[1] });
        }
      }
    },
    [player?.position, validMoveTargets, reachableHexes, sendAction]
  );

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

  /**
   * Handle tooltip hover events from hex overlays
   * Disabled when an overlay (card action menu, combat, etc.) is active
   */
  const handleHexHoverWithPos = useCallback(
    (event: HexHoverEvent | null) => {
      // Don't show tooltips when an overlay is active
      if (isOverlayActive) {
        handleHexTooltipLeave();
        return;
      }

      if (event) {
        handleHexTooltipEnter(event.coord, event.screenPos, event.screenHexRadius);
      } else {
        handleHexTooltipLeave();
      }
    },
    [handleHexTooltipEnter, handleHexTooltipLeave, isOverlayActive]
  );

  // Camera helper to center and apply
  const centerAndApplyCamera = useCallback(
    (worldPos: PixelPosition, instant: boolean = false) => {
      const app = appRef.current;
      const world = worldRef.current;
      if (!app || !world) return;

      centerCameraOn(cameraRef.current, worldPos, instant);
      if (instant) {
        applyCamera(app, world, cameraRef.current);
      }
    },
    []
  );

  // Camera event handlers
  const handlePointerDown = useCallback((event: FederatedPointerEvent) => {
    cameraPointerDown(
      event,
      cameraRef.current,
      lastPointerPosRef.current,
      (dragging) => { isDraggingRef.current = dragging; }
    );
  }, []);

  const handlePointerMove = useCallback((event: FederatedPointerEvent) => {
    cameraPointerMove(
      event,
      cameraRef.current,
      lastPointerPosRef.current,
      isDraggingRef.current
    );
  }, []);

  const handlePointerUp = useCallback(() => {
    cameraPointerUp(
      cameraRef.current,
      (dragging) => { isDraggingRef.current = dragging; }
    );
  }, []);

  const handleWheel = useCallback((event: WheelEvent) => {
    const app = appRef.current;
    if (!app) return;
    handleWheelZoom(event, app, cameraRef.current);
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (isCameraPanKey(key)) {
      keysDownRef.current.add(key);
    }
  }, []);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    keysDownRef.current.delete(key);
  }, []);

  // Initialize PixiJS application
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    let destroyed = false;

    const initPixi = async () => {
      const t0 = performance.now();
      const app = new Application();

      await app.init({
        background: 0x0a0a12, // Dark fallback, atmosphere will cover this
        resizeTo: container,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      console.log(`[initPixi] app.init: ${(performance.now() - t0).toFixed(1)}ms`);

      if (destroyed) {
        app.destroy(true);
        return;
      }

      container.appendChild(app.canvas);

      const t1 = performance.now();
      const { world, layers } = createWorldLayers();
      console.log(`[initPixi] createWorldLayers: ${(performance.now() - t1).toFixed(1)}ms`);

      // Create atmospheric background fixed to screen (parallax effect)
      const t2 = performance.now();
      const background = new BackgroundAtmosphere();
      background.initialize(app.screen.width, app.screen.height);
      console.log(`[initPixi] BackgroundAtmosphere: ${(performance.now() - t2).toFixed(1)}ms`);
      backgroundRef.current = background;

      // Add background to stage BEFORE world so it's behind everything
      app.stage.addChild(background.getContainer());
      app.stage.addChild(world);

      // Create screen-space overlay layer for UI elements (hand, etc.)
      // This is NOT part of the world, so it won't be affected by camera pan/zoom
      const screenOverlay = new Container();
      screenOverlay.label = "screenOverlay";
      app.stage.addChild(screenOverlay);

      // Hide world until camera is properly positioned to avoid jarring initial movement
      world.visible = false;

      // Handle resize
      const handleResize = () => {
        if (backgroundRef.current) {
          backgroundRef.current.resize(app.screen.width, app.screen.height);
        }
      };
      app.renderer.on("resize", handleResize);

      // Enable interactivity
      app.stage.eventMode = "static";
      app.stage.hitArea = app.screen;

      // Camera event handlers
      app.stage.on("pointerdown", handlePointerDown);
      app.stage.on("pointermove", handlePointerMove);
      app.stage.on("pointerup", handlePointerUp);
      app.stage.on("pointerupoutside", handlePointerUp);

      // Disable context menu for right-click pan
      app.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

      // Camera update ticker - only apply camera after it's been properly positioned
      app.ticker.add((ticker) => {
        if (!cameraReadyRef.current) return;
        updateCamera(cameraRef.current, keysDownRef.current, ticker.deltaMS);
        applyCamera(app, world, cameraRef.current);
      });

      // Animation managers
      const animManager = new AnimationManager();
      animManager.attach(app.ticker);
      animationManagerRef.current = animManager;

      const particleManager = new ParticleManager();
      particleManager.attach(app.ticker);
      particleManagerRef.current = particleManager;

      // Set up ticker for ghost hex hover effects
      setGhostHexTicker(app.ticker);

      // Attach background atmosphere to ticker for dust animation
      background.attach(app.ticker);

      // Background is now part of world (fixed size), no resize needed

      appRef.current = app;
      layersRef.current = layers;
      worldRef.current = world;

      // Register app and overlay layer with context for other components to use
      setApp(app);
      setOverlayLayer(screenOverlay);

      console.log("[PixiHexGrid] Initialized");
      setIsInitialized(true);
    };

    initPixi();

    return () => {
      destroyed = true;
      // Unregister from context
      setApp(null);
      setOverlayLayer(null);
      animationManagerRef.current?.detach();
      animationManagerRef.current = null;
      particleManagerRef.current?.clear();
      particleManagerRef.current?.detach();
      particleManagerRef.current = null;
      cleanupGhostHexEffects();
      if (backgroundRef.current && appRef.current) {
        backgroundRef.current.detach(appRef.current.ticker);
        backgroundRef.current.destroy();
        backgroundRef.current = null;
      }
      if (appRef.current) {
        console.log("[PixiHexGrid] Destroying");
        appRef.current.destroy(true, { children: true, texture: true });
        appRef.current = null;
        layersRef.current = null;
        worldRef.current = null;
        heroContainerRef.current = null;
        // Reset camera state for potential re-init (hot reload)
        hasCenteredOnHeroRef.current = false;
        cameraReadyRef.current = false;
        // Clear revealing hex state for HMR
        revealingHexKeysRef.current = new Set();
        setIsInitialized(false);
      }
    };
  }, [handlePointerDown, handlePointerMove, handlePointerUp, setApp, setOverlayLayer]);

  // DOM event listeners
  useEffect(() => {
    if (!isInitialized) return;

    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isInitialized, handleWheel, handleKeyDown, handleKeyUp]);

  // Intro sequence is now triggered from renderAsync after board fade-in completes
  // This ensures smooth transition: background → fade in board → intro animation

  // Update background day/night state
  const timeOfDay = state?.timeOfDay;
  useEffect(() => {
    if (!isInitialized || !timeOfDay || !backgroundRef.current) return;
    const isNight = timeOfDay === TIME_OF_DAY_NIGHT;
    backgroundRef.current.setNight(isNight);
  }, [isInitialized, timeOfDay]);

  // Main render effect
  useEffect(() => {
    if (!isInitialized || !state || !layersRef.current || !worldRef.current) return;

    const layers = layersRef.current;
    const world = worldRef.current;
    const heroPosition = player?.position ?? null;
    const animManager = animationManagerRef.current;
    const particleManager = particleManagerRef.current;

    // Check for intro vs exploration
    const currentTileCount = state.map.tiles.length;
    const isFirstLoad = prevTileCountRef.current === 0 && currentTileCount > 0;
    const shouldPlayTileIntro = isFirstLoad;
    prevTileCountRef.current = currentTileCount;

    // Only consider revealed tiles (those with tileId) - unrevealed tiles don't send tileId to prevent map hacking
    const newTiles = state.map.tiles.filter(tile => tile.tileId && !knownTileIdsRef.current.has(tile.tileId));
    // Only treat as exploration if it's NOT the first load (exploration = discovering tiles mid-game)
    const isExploration = !isFirstLoad && newTiles.length > 0;

    // Exploration cinematic (only for mid-game tile discovery, not initial load)
    if (isExploration && !isInCinematic) {
      const newTile = newTiles[0];
      const newTilePosition = newTile ? hexToPixel(newTile.centerCoord) : null;
      const heroPixelPosition = heroPosition ? hexToPixel(heroPosition) : null;

      // IMMEDIATELY hide overlays for new hexes (before any async operations)
      // This prevents the pathfinding grid from flashing before the animation starts
      const newHexKeysImmediate = new Set<string>();
      for (const tile of newTiles) {
        newHexKeysImmediate.add(hexKey(tile.centerCoord));
        for (const offset of TILE_HEX_OFFSETS) {
          newHexKeysImmediate.add(hexKey({ q: tile.centerCoord.q + offset.q, r: tile.centerCoord.r + offset.r }));
        }
      }
      revealingHexKeysRef.current = newHexKeysImmediate;
      setRevealingUpdateCounter(c => c + 1);

      // Check for enemies that should flip after exploration completes
      // These are enemies on EXISTING tiles (not the new tile) that became revealed
      // because the hero is now adjacent to them after the tile was placed
      const adjacentFlipTargets: EnemyFlipTarget[] = [];
      for (const hex of Object.values(state.map.hexes)) {
        const hKey = hexKey(hex.coord);
        // Skip hexes on the new tile - those get drop animation
        if (newHexKeysImmediate.has(hKey)) continue;

        for (let i = 0; i < hex.enemies.length; i++) {
          const enemy = hex.enemies[i];
          if (enemy?.isRevealed && enemy.tokenId) {
            // Check if this enemy was just revealed (not in our previous set)
            if (!revealedEnemyTokenIdsRef.current.has(enemy.tokenId)) {
              adjacentFlipTargets.push({
                tokenId: enemy.tokenId,
                hexCoord: hex.coord,
                color: enemy.color,
                indexInHex: i,
                totalInHex: hex.enemies.length,
              });
            }
          }
        }
      }

      // If there are adjacent enemies to flip, mark them as pending
      if (adjacentFlipTargets.length > 0) {
        console.log("[PixiHexGrid] Will flip adjacent enemies after exploration:", adjacentFlipTargets.map(t => t.tokenId));
        pendingFlipTokenIdsRef.current = new Set(adjacentFlipTargets.map(t => t.tokenId));
        pendingFlipTargetsRef.current = adjacentFlipTargets;
      }

      // Expand camera bounds to include the new tile BEFORE panning
      // This prevents the camera from being clamped back during the pan
      const camera = cameraRef.current;
      for (const tile of newTiles) {
        const tileCenter = hexToPixel(tile.centerCoord);
        // Expand bounds to include this tile with generous padding
        const TILE_PADDING = 200;
        camera.bounds.minX = Math.min(camera.bounds.minX, tileCenter.x - TILE_PADDING);
        camera.bounds.maxX = Math.max(camera.bounds.maxX, tileCenter.x + TILE_PADDING);
        camera.bounds.minY = Math.min(camera.bounds.minY, tileCenter.y - TILE_PADDING);
        camera.bounds.maxY = Math.max(camera.bounds.maxY, tileCenter.y + TILE_PADDING);
      }

      // Tracer (outline trace) + tile drop + bounce + enemy drops
      const TRACER_DURATION = HEX_OUTLINE_DURATION_MS + 240 + 100; // trace + pulse + small gap
      const TILE_DROP_DURATION = TILE_RISE_DURATION_MS + TILE_SLAM_DURATION_MS + 200; // drop + bounce
      const ENEMY_DROP_ESTIMATE = 400; // enemies drop after tile lands
      const EXPLORATION_TOTAL_DURATION = TRACER_DURATION + TILE_DROP_DURATION + ENEMY_DROP_ESTIMATE;
      // Camera pan duration - must be long enough for smooth lerp interpolation
      const CAMERA_PAN_DURATION = 600;

      // Capture refs for use in cinematic callbacks
      const capturedLayers = layersRef.current;
      const capturedAnimManager = animManager;
      const capturedParticleManager = particleManager;

      const explorationCinematic: CinematicSequence = {
        id: "exploration",
        name: `Explore tile ${newTiles[0]?.tileId}`,
        steps: [
          {
            id: "pan-to-tile",
            description: "Pan camera to new tile",
            duration: newTilePosition ? CAMERA_PAN_DURATION : 0,
            execute: () => {
              if (newTilePosition) {
                centerAndApplyCamera(newTilePosition, false);
              }
            },
          },
          {
            id: "tile-animation",
            description: "Tile reveal animation (tracer + drop + enemies)",
            duration: EXPLORATION_TOTAL_DURATION,
            execute: () => {},
          },
          {
            id: "pan-to-hero",
            description: "Pan camera back to hero",
            duration: heroPixelPosition ? CAMERA_PAN_DURATION : 0,
            execute: () => {
              if (heroPixelPosition) {
                centerAndApplyCamera(heroPixelPosition, false);
              }
            },
          },
        ],
        onComplete: () => {
          console.log("[PixiHexGrid] Exploration cinematic complete");

          // Trigger flip animation for any adjacent enemies that were revealed
          if (pendingFlipTargetsRef.current.length > 0 && capturedLayers && capturedAnimManager && capturedParticleManager) {
            const flipTargets = pendingFlipTargetsRef.current;
            pendingFlipTargetsRef.current = [];
            flipAnimationInProgressRef.current = true;

            console.log("[PixiHexGrid] Starting post-exploration flip for:", flipTargets.map(t => t.tokenId));

            // Small delay after exploration completes before flipping
            setTimeout(() => {
              animateEnemyFlips(
                capturedLayers,
                flipTargets,
                capturedAnimManager,
                capturedParticleManager,
                0,
                () => {
                  pendingFlipTokenIdsRef.current = new Set();
                  flipAnimationInProgressRef.current = false;
                  console.log("[PixiHexGrid] Post-exploration flip complete");
                }
              );
            }, 200);
          }
        },
      };

      playCinematic(explorationCinematic);
    }

    // Detect newly revealed enemies (for enemy reveal cinematic)
    // This happens when moving adjacent to fortified sites during the day
    // Skip if we're in an exploration cinematic (those enemies get animated differently)
    const currentRevealedEnemyIds = new Set<string>();
    const enemyInfoByTokenId = new Map<string, { hexCoord: { q: number; r: number }; color: string; indexInHex: number; totalInHex: number }>();

    for (const hex of Object.values(state.map.hexes)) {
      for (let i = 0; i < hex.enemies.length; i++) {
        const enemy = hex.enemies[i];
        if (enemy?.isRevealed && enemy.tokenId) {
          currentRevealedEnemyIds.add(enemy.tokenId);
          enemyInfoByTokenId.set(enemy.tokenId, {
            hexCoord: hex.coord,
            color: enemy.color,
            indexInHex: i,
            totalInHex: hex.enemies.length,
          });
        }
      }
    }

    // Find newly revealed enemies (not in our previous set)
    const newlyRevealedTokenIds: string[] = [];
    for (const tokenId of currentRevealedEnemyIds) {
      if (!revealedEnemyTokenIdsRef.current.has(tokenId)) {
        newlyRevealedTokenIds.push(tokenId);
      }
    }

    // Update the ref for next render
    revealedEnemyTokenIdsRef.current = currentRevealedEnemyIds;

    // Trigger enemy reveal cinematic if:
    // 1. There are newly revealed enemies
    // 2. Not during exploration (exploration handles its own enemy animations)
    // 3. Not already in a cinematic
    // 4. Not the first load (intro handles enemy animation)
    const shouldPlayEnemyReveal =
      newlyRevealedTokenIds.length > 0 &&
      !isExploration &&
      !isInCinematic &&
      !isFirstLoad &&
      animManager &&
      particleManager;

    if (shouldPlayEnemyReveal) {
      console.log("[PixiHexGrid] Scheduling enemy reveal for:", newlyRevealedTokenIds);

      // Mark these tokens as pending flip so renderEnemies shows them as unrevealed
      pendingFlipTokenIdsRef.current = new Set(newlyRevealedTokenIds);

      // Build flip targets with position info (will be used after render completes)
      pendingFlipTargetsRef.current = newlyRevealedTokenIds
        .map(tokenId => {
          const info = enemyInfoByTokenId.get(tokenId);
          if (!info) return null;
          return {
            tokenId,
            hexCoord: info.hexCoord,
            color: info.color,
            indexInHex: info.indexInHex,
            totalInHex: info.totalInHex,
          };
        })
        .filter((t): t is EnemyFlipTarget => t !== null);
    }

    // Async rendering
    const renderAsync = async () => {
      const renderStart = performance.now();

      // Preload all intro assets FIRST (tiles, enemies, hero) to avoid blocking frames
      // This must happen before any rendering to prevent jank during initial load
      // Loading screen is shown during this phase
      const heroId = player?.heroId ?? null;
      await preloadIntroAssets(state, heroId);

      // NOTE: Loading screen stays visible until fade animation starts (see below)

      // FIRST: Set up camera before any rendering so position is correct from the start
      if (!hasCenteredOnHeroRef.current && appRef.current) {
        const app = appRef.current;

        // Calculate bounds from tiles in play
        const hexes = Object.values(state.map.hexes);
        const hexPositions = hexes.map((h) => hexToPixel(h.coord));
        for (const target of exploreTargets) {
          hexPositions.push(hexToPixel(target.coord));
        }
        const currentBounds = calculateBounds(hexPositions);

        // Add padding around current tiles for breathing room
        const GRID_PADDING = 150;
        const paddedBounds = {
          minX: currentBounds.minX - GRID_PADDING,
          maxX: currentBounds.maxX + GRID_PADDING,
          minY: currentBounds.minY - GRID_PADDING,
          maxY: currentBounds.maxY + GRID_PADDING,
          width: currentBounds.width + GRID_PADDING * 2,
          height: currentBounds.height + GRID_PADDING * 2,
        };

        // Calculate zoom to fit tiles
        const minZoomX = app.screen.width / paddedBounds.width;
        const minZoomY = app.screen.height / paddedBounds.height;
        const dynamicMinZoom = Math.max(minZoomX, minZoomY) * 0.6;
        const scaleX = app.screen.width / currentBounds.width;
        const scaleY = app.screen.height / currentBounds.height;
        const fitZoom = Math.min(scaleX, scaleY) * 0.85;
        const initialZoom = Math.max(dynamicMinZoom, Math.min(fitZoom, CAMERA_MAX_ZOOM));

        const camera = cameraRef.current;
        camera.minZoom = dynamicMinZoom;
        camera.targetZoom = initialZoom;
        camera.zoom = initialZoom;
        camera.bounds = {
          minX: paddedBounds.minX,
          maxX: paddedBounds.maxX,
          minY: paddedBounds.minY,
          maxY: paddedBounds.maxY,
        };
        camera.screenWidth = app.screen.width;
        camera.screenHeight = app.screen.height;

        // Set initial camera position, then clamp to bounds, then sync center with clamped target
        const initialPos = heroPosition
          ? hexToPixel(heroPosition)
          : { x: currentBounds.minX + currentBounds.width / 2, y: currentBounds.minY + currentBounds.height / 2 };
        camera.targetCenter = { ...initialPos };

        // Clamp adjusts targetCenter to valid bounds (may change it if view exceeds bounds)
        clampCameraCenter(camera);

        // Now sync center with the clamped targetCenter so there's no interpolation
        camera.center = { ...camera.targetCenter };

        // Apply camera transform and make world visible
        applyCamera(app, world, camera);
        world.visible = true;

        // For intro sequence, start with world invisible (will fade in later)
        // This must be set BEFORE the forced render to avoid a flash
        if (shouldPlayTileIntro && !introPlayedRef.current) {
          world.alpha = 0;
        }

        hasCenteredOnHeroRef.current = true;
        cameraReadyRef.current = true;

        // Force an immediate render so first frame shows correct position
        app.renderer.render(app.stage);
      }

      // Render board shape ghosts (unfilled tile slots)
      const t_board = performance.now();
      renderBoardShape(layers, state.map.tileSlots);
      console.log(`[renderAsync] renderBoardShape: ${(performance.now() - t_board).toFixed(1)}ms`);

      // Capture the current revealing hex keys for use in callbacks
      // (using the ref value since it was set synchronously before renderAsync)
      const hexKeysToReveal = new Set(revealingHexKeysRef.current);

      // For first load (intro), we SKIP tile rendering here - it happens after fade-in
      // For subsequent updates (exploration), render tiles normally
      const t_tiles = performance.now();
      if (!shouldPlayTileIntro) {
        const { revealingTileCoords } = await renderTiles(
          layers,
          state.map.tiles,
          animManager,
          particleManager,
          world,
          false,
          knownTileIdsRef.current,
          () => {
            emitAnimationEvent("tiles-complete");
            console.log("[PixiHexGrid] Tile intro complete");
          },
          // onRevealComplete - called when exploration tile lands
          () => {
            // Tile has landed, now animate enemies on the new tile
            if (isExploration && animManager && particleManager && hexKeysToReveal.size > 0) {
              console.log("[PixiHexGrid] Tile revealed, starting enemy animation for hexes:", [...hexKeysToReveal]);

              // Render enemies with drop animation (small delay after tile lands)
              // Also pass pendingFlipTokenIds so enemies on existing tiles that need
              // to flip (because hero is now adjacent) render as unrevealed
              renderEnemies(
                layers,
                state.map.hexes,
                animManager,
                particleManager,
                true, // playIntro = true for new enemies
                100, // Small delay after tile lands
                () => {
                  // Enemies done, clear revealing hexes to show overlays
                  revealingHexKeysRef.current = new Set();
                  setRevealingUpdateCounter(c => c + 1);
                  // NOTE: Do NOT emit enemies-complete here - that's only for the initial intro
                  // Emitting it during exploration resets the intro state machine
                },
                hexKeysToReveal, // Only animate enemies on new hexes
                pendingFlipTokenIdsRef.current // Render adjacent enemies as unrevealed for flip
              );
            } else {
              // No enemies or not exploration, just clear revealing hexes
              revealingHexKeysRef.current = new Set();
              setRevealingUpdateCounter(c => c + 1);
            }
          }
        );

        // Safety check: if renderTiles didn't find any tiles to reveal
        if (revealingTileCoords.length === 0 && revealingHexKeysRef.current.size > 0) {
          console.log("[PixiHexGrid] No tiles to reveal, clearing revealing state");
          revealingHexKeysRef.current = new Set();
          setRevealingUpdateCounter(c => c + 1);
        }
      }
      console.log(`[renderAsync] renderTiles: ${(performance.now() - t_tiles).toFixed(1)}ms`);

      // For first load (intro): skip all rendering here, it happens after fade-in below
      // For subsequent updates: render enemies and hero normally
      if (!shouldPlayTileIntro) {
        // For non-intro, enemies render immediately (no tile animation delay)
        const tileAnimationTime = 0;

        // Render enemies (for exploration, handled in onRevealComplete callback above)
        const t_enemies = performance.now();
        if (!isExploration && !flipAnimationInProgressRef.current) {
          await renderEnemies(
            layers,
            state.map.hexes,
            animManager,
            particleManager,
            false,
            tileAnimationTime,
            () => {
              emitAnimationEvent("enemies-complete");
              console.log("[PixiHexGrid] Enemy intro complete");
            },
            undefined, // onlyAnimateHexKeys
            pendingFlipTokenIdsRef.current // Render pending flips as unrevealed
          );

          // Trigger flip animation for any pending reveals (after enemies are rendered)
          if (pendingFlipTargetsRef.current.length > 0 && animManager && particleManager) {
            const flipTargets = pendingFlipTargetsRef.current;
            pendingFlipTargetsRef.current = []; // Clear immediately to prevent double-triggering
            flipAnimationInProgressRef.current = true;

            console.log("[PixiHexGrid] Starting enemy flip animation for:", flipTargets.map(t => t.tokenId));

            // Delay flip to let hero movement start/complete
            const FLIP_DELAY_AFTER_MOVE = HERO_MOVE_DURATION_MS + 100;
            setTimeout(() => {
              animateEnemyFlips(
                layers,
                flipTargets,
                animManager,
                particleManager,
                0,
                () => {
                  // Clear pending flip tokens when animation completes
                  pendingFlipTokenIdsRef.current = new Set();
                  flipAnimationInProgressRef.current = false;
                  console.log("[PixiHexGrid] Enemy flip animation complete");
                }
              );
            }, FLIP_DELAY_AFTER_MOVE);
          }
        }
        console.log(`[renderAsync] renderEnemies: ${(performance.now() - t_enemies).toFixed(1)}ms`);

        // Render hero
        const heroContainer = getOrCreateHeroContainer(layers, heroContainerRef);
        const prevPos = prevHeroPositionRef.current;

        if (heroPosition) {
          const targetPixel = hexToPixel(heroPosition);
          const heroMoved = prevPos && (prevPos.q !== heroPosition.q || prevPos.r !== heroPosition.r);

          if (heroMoved && animManager) {
            animManager.moveTo(
              "hero-move",
              heroContainer,
              targetPixel,
              HERO_MOVE_DURATION_MS,
              Easing.easeOutQuad
            );
          } else {
            heroContainer.position.set(targetPixel.x, targetPixel.y);
          }

          const heroId = player?.heroId ?? null;
          renderHeroIntoContainer(heroContainer, heroPosition, heroId);
        }

        prevHeroPositionRef.current = heroPosition;

        // Hide loading screen for non-intro renders
        setIsLoading(false);
      }

      // For first load: fade in the board shape, THEN render tiles/enemies/hero with intro animations
      // This creates a smooth transition: background → board fades in → pause → intro animation
      if (shouldPlayTileIntro && animManager && particleManager && !introPlayedRef.current) {
        const BOARD_FADE_DURATION = 800;
        const PAUSE_BEFORE_INTRO = 450; // Pause after fade before tracers start

        // world.alpha is already set to 0 earlier (before forced render) to avoid flash

        // Render static tile outlines that fade in with the board (matches board shape style)
        // These get removed when the tracer animation starts drawing animated outlines
        const BOARD_SHAPE_STROKE_COLOR = 0x8b7355; // Darker parchment edge - matches ghostHexes.ts
        renderStaticTileOutlines(
          layers.boardShape, // Add to boardShape layer so it fades with the ghosts
          state.map.tiles,
          0.6, // alpha - matches board shape stroke alpha
          BOARD_SHAPE_STROKE_COLOR
        );

        // Fade in the world (board shape ghosts + tile outlines together)
        animManager.animate("board-fade-in", world, {
          endAlpha: 1,
          duration: BOARD_FADE_DURATION,
          easing: Easing.easeOutCubic,
          onComplete: () => {
            // Pause to let the board settle before starting intro
            setTimeout(async () => {
              console.log("[PixiHexGrid] Fade complete, rendering tiles with intro...");

              // Keep static brown outlines visible - tracer draws blue over them
              // This maintains visual consistency during the animation

              // NOW render tiles with intro animations (tracer draws the outlines)
              await renderTiles(
                layers,
                state.map.tiles,
                animManager,
                particleManager,
                world,
                true, // playIntro = true
                knownTileIdsRef.current,
                () => {
                  emitAnimationEvent("tiles-complete");
                  console.log("[PixiHexGrid] Tile intro complete");
                }
              );

              // Calculate timing for enemies/hero
              const PHASE5_TILE_STAGGER = 200;
              const PHASE5_SINGLE_TILE_TIME = HEX_OUTLINE_DURATION_MS + TILE_RISE_DURATION_MS + TILE_SLAM_DURATION_MS + 200;
              const tileAnimationTime = (state.map.tiles.length - 1) * PHASE5_TILE_STAGGER + PHASE5_SINGLE_TILE_TIME + INTRO_PHASE_GAP_MS;

              const enemyCount = Object.values(state.map.hexes).reduce(
                (count, hex) => count + (hex.enemies?.length ?? 0), 0
              );
              const ENEMY_DROP_DURATION = 250;
              const ENEMY_BOUNCE_DURATION = 100;
              const estimatedEnemyDuration = enemyCount > 0
                ? (enemyCount - 1) * ENEMY_FLIP_STAGGER_MS + ENEMY_DROP_DURATION + ENEMY_BOUNCE_DURATION + 200
                : 0;
              const heroRevealTime = tileAnimationTime + estimatedEnemyDuration;

              // Render enemies with intro
              await renderEnemies(
                layers,
                state.map.hexes,
                animManager,
                particleManager,
                true, // playIntro
                tileAnimationTime,
                () => {
                  emitAnimationEvent("enemies-complete");
                  console.log("[PixiHexGrid] Enemy intro complete");
                }
              );

              // Render hero with portal intro
              const heroContainer = getOrCreateHeroContainer(layers, heroContainerRef);
              if (heroPosition) {
                const targetPixel = hexToPixel(heroPosition);
                const heroId = player?.heroId ?? null;

                heroContainer.alpha = 0;
                heroContainer.scale.set(0.8);
                heroContainer.position.set(targetPixel.x, targetPixel.y);
                renderHeroIntoContainer(heroContainer, heroPosition, heroId);

                setTimeout(() => {
                  particleManager.createPortal(
                    layers.particles,
                    targetPixel,
                    {
                      heroId: heroId ?? undefined,
                      onHeroEmerge: () => {
                        animManager.animate("hero-emerge", heroContainer, {
                          endAlpha: 1,
                          endScale: 1,
                          duration: PORTAL_HERO_EMERGE_DURATION_MS,
                          easing: Easing.easeOutCubic,
                        });
                      },
                      onComplete: () => {
                        emitAnimationEvent("hero-complete");
                        console.log("[PixiHexGrid] Hero portal complete");
                      },
                    }
                  );
                }, heroRevealTime);

                prevHeroPositionRef.current = heroPosition;
              }

              // Start intro state machine
              const tileCount = state.map.tiles.length;
              startIntro(tileCount, enemyCount);
              introPlayedRef.current = true;
              console.log("[PixiHexGrid] Starting intro:", tileCount, "tiles,", enemyCount, "enemies");
            }, PAUSE_BEFORE_INTRO);
          },
        });

        // Hide loading screen now that fade animation has started
        // (world.alpha = 0 so nothing visible yet, fade will reveal it)
        setIsLoading(false);
      }

      console.log(`[renderAsync] TOTAL: ${(performance.now() - renderStart).toFixed(1)}ms`);
      console.log("[PixiHexGrid] Rendered:", state.map.tiles.length, "tiles");
    };

    renderAsync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, state, player?.position, exploreTargets, centerAndApplyCamera, emitAnimationEvent, startIntro]);

  // Interactive layer updates
  useEffect(() => {
    if (!isInitialized || !state || !layersRef.current) return;

    const layers = layersRef.current;

    if (!isIntroComplete) {
      layers.hexOverlays.removeChildren();
      return;
    }

    // Use ref for the actual hex keys (updated synchronously)
    const excludeHexes = revealingHexKeysRef.current.size > 0
      ? revealingHexKeysRef.current
      : undefined;

    renderHexOverlays(
      layers,
      state.map.hexes,
      getMoveHighlight,
      hoveredHex,
      handleHexClick,
      setHoveredHex,
      handleHexHoverWithPos,
      debugDisplaySettings.showCoordinates,
      excludeHexes
    );

    renderGhostHexes(layers, exploreTargets, handleExploreClick);
    renderPathPreview(layers, pathPreview, isPathTerminal);
  }, [
    isInitialized,
    isIntroComplete,
    state,
    hoveredHex,
    pathPreview,
    isPathTerminal,
    getMoveHighlight,
    handleHexClick,
    handleExploreClick,
    exploreTargets,
    handleHexHoverWithPos,
    debugDisplaySettings.showCoordinates,
    revealingUpdateCounter, // Force re-run when revealing state changes
  ]);

  // Get hex data for tooltip
  const tooltipHex = tooltipHoveredHex && state
    ? state.map.hexes[hexKey(tooltipHoveredHex)] ?? null
    : null;

  return (
    <>
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

      {/* Loading overlay - shown while assets are loading */}
      {isLoading && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(10, 10, 18, 0.85)",
            zIndex: 100,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              color: "rgba(255, 248, 220, 0.8)",
              fontSize: "max(1rem, 2.5vw)",
              fontFamily: "serif",
              letterSpacing: "0.1em",
              animation: "pulse-opacity 2.5s ease-in-out infinite",
            }}
          >
            Preparing the realm...
          </div>
          <style>{`
            @keyframes pulse-opacity {
              0%, 100% { opacity: 0.6; }
              50% { opacity: 1; }
            }
          `}</style>
        </div>
      )}

      <HexTooltip
        hex={tooltipHex}
        coord={tooltipHoveredHex}
        position={tooltipPosition}
        hexRadius={screenHexRadius}
        isVisible={isTooltipVisible && isIntroComplete && !isOverlayActive && !isSitePanelOpen}
        timeOfDay={state?.timeOfDay}
        onMouseEnter={handleTooltipMouseEnter}
        onMouseLeave={handleTooltipMouseLeave}
        onClickMoreInfo={tooltipHoveredHex ? () => handleOpenSitePanel(tooltipHoveredHex) : undefined}
      />

      {/* Site Panel - detailed site information panel */}
      <SitePanel
        isOpen={isSitePanelOpen}
        siteOptions={
          sitePanelHex && player?.position &&
          sitePanelHex.q === player.position.q && sitePanelHex.r === player.position.r
            ? state?.validActions.sites ?? null
            : null
        }
        hex={sitePanelHex ? state?.map.hexes[hexKey(sitePanelHex)] ?? null : null}
        onClose={handleCloseSitePanel}
        isArrivalMode={false}
        timeOfDay={state?.timeOfDay}
      />
    </>
  );
}
