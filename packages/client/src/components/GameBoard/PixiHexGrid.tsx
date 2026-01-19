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
import { useHexHover } from "../../hooks/useHexHover";
import { HexTooltip } from "../HexTooltip";

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
} from "./pixi/camera";

// Rendering modules
import {
  renderTiles,
  renderEnemies,
  renderHeroIntoContainer,
  getOrCreateHeroContainer,
  renderHexOverlays,
  renderPathPreview,
  renderGhostHexes,
  renderBoardShape,
  type MoveHighlight,
  type ExploreTarget,
  type HexHoverEvent,
} from "./pixi/rendering";

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
  const [hoveredHex, setHoveredHex] = useState<HexCoord | null>(null);

  // Camera state refs
  const cameraRef = useRef<CameraState>(createInitialCameraState());
  const isDraggingRef = useRef(false);
  const lastPointerPosRef = useRef<PixelPosition>({ x: 0, y: 0 });
  const keysDownRef = useRef<Set<string>>(new Set());
  const hasCenteredOnHeroRef = useRef(false);

  // Animation state refs
  const animationManagerRef = useRef<AnimationManager | null>(null);
  const particleManagerRef = useRef<ParticleManager | null>(null);
  const backgroundRef = useRef<BackgroundAtmosphere | null>(null);
  const prevHeroPositionRef = useRef<HexCoord | null>(null);
  const heroContainerRef = useRef<Container | null>(null);
  const introPlayedRef = useRef(false);
  const prevTileCountRef = useRef(0);
  const knownTileIdsRef = useRef<Set<string>>(new Set());

  // Game state hooks
  const { state, sendAction } = useGame();
  const player = useMyPlayer();
  const { startIntro, isIntroComplete } = useGameIntro();
  const { emit: emitAnimationEvent } = useAnimationDispatcher();
  const { playCinematic, isInCinematic } = useCinematic();
  const { isOverlayActive } = useOverlay();

  // Tooltip hover hook
  const {
    hoveredHex: tooltipHoveredHex,
    tooltipPosition,
    isTooltipVisible,
    handleHexMouseEnter: handleHexTooltipEnter,
    handleHexMouseLeave: handleHexTooltipLeave,
    handleTooltipMouseEnter,
    handleTooltipMouseLeave,
  } = useHexHover({ delay: 400 });

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
        handleHexTooltipEnter(event.coord, event.screenPos);
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
      const app = new Application();

      await app.init({
        background: 0x0a0a12, // Dark fallback, atmosphere will cover this
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

      // Create atmospheric background fixed to screen (parallax effect)
      const background = new BackgroundAtmosphere();
      background.initialize(app.screen.width, app.screen.height);
      backgroundRef.current = background;

      // Add background to stage BEFORE world so it's behind everything
      app.stage.addChild(background.getContainer());
      app.stage.addChild(world);

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

      // Camera update ticker
      app.ticker.add((ticker) => {
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

      // Attach background atmosphere to ticker for dust animation
      background.attach(app.ticker);

      // Background is now part of world (fixed size), no resize needed

      appRef.current = app;
      layersRef.current = layers;
      worldRef.current = world;

      console.log("[PixiHexGrid] Initialized");
      setIsInitialized(true);
    };

    initPixi();

    return () => {
      destroyed = true;
      animationManagerRef.current?.detach();
      animationManagerRef.current = null;
      particleManagerRef.current?.clear();
      particleManagerRef.current?.detach();
      particleManagerRef.current = null;
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
        setIsInitialized(false);
      }
    };
  }, [handlePointerDown, handlePointerMove, handlePointerUp]);

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

  // Trigger intro sequence
  useEffect(() => {
    if (!isInitialized || !state || introPlayedRef.current) return;

    const tileCount = state.map.tiles.length;
    const enemyCount = Object.values(state.map.hexes).reduce(
      (sum, hex) => sum + hex.enemies.length,
      0
    );

    startIntro(tileCount, enemyCount);
    introPlayedRef.current = true;

    console.log("[PixiHexGrid] Started intro:", tileCount, "tiles,", enemyCount, "enemies");
  }, [isInitialized, state, startIntro]);

  // Update background day/night state
  useEffect(() => {
    if (!isInitialized || !state || !backgroundRef.current) return;
    const isNight = state.timeOfDay === TIME_OF_DAY_NIGHT;
    backgroundRef.current.setNight(isNight);
  }, [isInitialized, state?.timeOfDay]);

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
    const shouldPlayTileIntro = prevTileCountRef.current === 0 && currentTileCount > 0;
    prevTileCountRef.current = currentTileCount;

    const newTiles = state.map.tiles.filter(tile => !knownTileIdsRef.current.has(tile.tileId));
    const isExploration = !shouldPlayTileIntro && newTiles.length > 0;

    // Exploration cinematic
    if (isExploration && !isInCinematic) {
      const newTile = newTiles[0];
      const newTilePosition = newTile ? hexToPixel(newTile.centerCoord) : null;
      const heroPixelPosition = heroPosition ? hexToPixel(heroPosition) : null;

      const EXPLORATION_TILE_DURATION = TILE_RISE_DURATION_MS + TILE_SLAM_DURATION_MS + 300;
      const CAMERA_PAN_DURATION = 400;

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
            description: "Tile drop animation",
            duration: EXPLORATION_TILE_DURATION + 200,
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
        },
      };

      playCinematic(explorationCinematic);
    }

    // Async rendering
    const renderAsync = async () => {
      // Render board shape ghosts (unfilled tile slots)
      renderBoardShape(layers, state.map.tileSlots);

      // Render tiles
      await renderTiles(
        layers,
        state.map.tiles,
        animManager,
        particleManager,
        world,
        shouldPlayTileIntro,
        knownTileIdsRef.current,
        () => {
          emitAnimationEvent("tiles-complete");
          console.log("[PixiHexGrid] Tile intro complete");
        }
      );

      // Calculate timing for sequenced animations
      const PHASE5_TILE_STAGGER = 200;
      const PHASE5_SINGLE_TILE_TIME = HEX_OUTLINE_DURATION_MS + TILE_RISE_DURATION_MS + TILE_SLAM_DURATION_MS + 200;
      const tileAnimationTime = shouldPlayTileIntro
        ? (state.map.tiles.length - 1) * PHASE5_TILE_STAGGER + PHASE5_SINGLE_TILE_TIME + INTRO_PHASE_GAP_MS
        : 0;

      const enemyCount = Object.values(state.map.hexes).reduce(
        (count, hex) => count + (hex.enemies?.length ?? 0), 0
      );
      const ENEMY_DROP_DURATION = 250;
      const ENEMY_BOUNCE_DURATION = 100;
      const estimatedEnemyDuration = enemyCount > 0
        ? (enemyCount - 1) * ENEMY_FLIP_STAGGER_MS + ENEMY_DROP_DURATION + ENEMY_BOUNCE_DURATION + 200
        : 0;
      const heroRevealTime = tileAnimationTime + (shouldPlayTileIntro ? estimatedEnemyDuration : 0);

      // Render enemies
      await renderEnemies(
        layers,
        state.map.hexes,
        animManager,
        particleManager,
        shouldPlayTileIntro,
        tileAnimationTime,
        () => {
          emitAnimationEvent("enemies-complete");
          console.log("[PixiHexGrid] Enemy intro complete");
        }
      );

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
            Easing.easeOutQuad,
            () => centerAndApplyCamera(targetPixel, false)
          );
          centerAndApplyCamera(targetPixel, false);
        } else {
          heroContainer.position.set(targetPixel.x, targetPixel.y);
        }

        const heroId = player?.heroId ?? null;
        renderHeroIntoContainer(heroContainer, heroPosition, heroId);

        // Hero portal intro
        if (shouldPlayTileIntro && animManager && particleManager) {
          heroContainer.alpha = 0;
          heroContainer.scale.set(0.8);
          heroContainer.position.set(targetPixel.x, targetPixel.y);

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
        }
      }

      prevHeroPositionRef.current = heroPosition;

      // Initial camera setup
      if (!hasCenteredOnHeroRef.current && appRef.current) {
        const app = appRef.current;

        // Calculate bounds from tiles in play (not the full grid)
        // Camera focuses on what's actually there, ghost hexes still show full board shape
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

        // Calculate min zoom to fit tiles in play (with padding)
        // Use 0.6 multiplier to allow zooming out well beyond "just fits"
        const minZoomX = app.screen.width / paddedBounds.width;
        const minZoomY = app.screen.height / paddedBounds.height;
        const dynamicMinZoom = Math.max(minZoomX, minZoomY) * 0.6;

        // Initial zoom fits current hexes nicely
        const scaleX = app.screen.width / currentBounds.width;
        const scaleY = app.screen.height / currentBounds.height;
        const fitZoom = Math.min(scaleX, scaleY) * 0.85; // 15% padding
        const initialZoom = Math.max(dynamicMinZoom, Math.min(fitZoom, CAMERA_MAX_ZOOM));

        const camera = cameraRef.current;
        camera.minZoom = dynamicMinZoom;
        camera.targetZoom = initialZoom;
        camera.zoom = initialZoom;
        // Camera bounds based on tiles in play, centered on current content
        camera.bounds = {
          minX: paddedBounds.minX,
          maxX: paddedBounds.maxX,
          minY: paddedBounds.minY,
          maxY: paddedBounds.maxY,
        };
        camera.screenWidth = app.screen.width;
        camera.screenHeight = app.screen.height;

        if (heroPosition) {
          centerAndApplyCamera(hexToPixel(heroPosition), true);
        } else {
          centerAndApplyCamera({
            x: currentBounds.minX + currentBounds.width / 2,
            y: currentBounds.minY + currentBounds.height / 2,
          }, true);
        }

        hasCenteredOnHeroRef.current = true;
        console.log("[PixiHexGrid] Camera centered on tiles, zoom:", initialZoom.toFixed(2), "minZoom:", dynamicMinZoom.toFixed(2));
      }

      console.log("[PixiHexGrid] Rendered:", state.map.tiles.length, "tiles");
    };

    renderAsync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, state, player?.position, exploreTargets, centerAndApplyCamera, emitAnimationEvent]);

  // Interactive layer updates
  useEffect(() => {
    if (!isInitialized || !state || !layersRef.current) return;

    const layers = layersRef.current;

    if (!isIntroComplete) {
      layers.hexOverlays.removeChildren();
      return;
    }

    renderHexOverlays(
      layers,
      state.map.hexes,
      getMoveHighlight,
      hoveredHex,
      handleHexClick,
      setHoveredHex,
      handleHexHoverWithPos
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
      <HexTooltip
        hex={tooltipHex}
        coord={tooltipHoveredHex}
        position={tooltipPosition}
        isVisible={isTooltipVisible && isIntroComplete && !isOverlayActive}
        onMouseEnter={handleTooltipMouseEnter}
        onMouseLeave={handleTooltipMouseLeave}
      />
    </>
  );
}
