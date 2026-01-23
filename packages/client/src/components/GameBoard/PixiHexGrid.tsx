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

import { useEffect, useRef, useState, useCallback } from "react";
import { Application, Container } from "pixi.js";
import type { HexCoord } from "@mage-knight/shared";
import { hexKey } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { useGameIntro } from "../../contexts/GameIntroContext";
import { useAnimationDispatcher } from "../../contexts/AnimationDispatcherContext";
import { useCinematic } from "../../contexts/CinematicContext";
import { useOverlay } from "../../contexts/OverlayContext";
import { useDebugDisplay } from "../../contexts/DebugDisplayContext";
import { usePixiApp } from "../../contexts/PixiAppContext";
import { useHexHover } from "../../hooks/useHexHover";
import { HexTooltip } from "../HexTooltip";
import { SitePanel } from "../SitePanel";

import { useCameraControl } from "./hooks/useCameraControl";
import { useHexInteraction } from "./hooks/useHexInteraction";
import { useGameBoardSelectors } from "./hooks/useGameBoardSelectors";
import { usePixiAppLifecycle } from "./hooks/usePixiAppLifecycle";
import { usePixiDomInput } from "./hooks/usePixiDomInput";
import { useGameBoardRenderer } from "./hooks/useGameBoardRenderer";
import type { WorldLayers } from "./pixi/types";
import { AnimationManager } from "./pixi/animations";
import { ParticleManager } from "./pixi/particles";
import { BackgroundAtmosphere } from "./pixi/background";

// Rendering modules
import {
  renderHexOverlays,
  renderPathPreview,
  renderGhostHexes,
  renderReachabilityBoundary,
  type HexHoverEvent,
} from "./pixi/rendering";

export interface PixiHexGridProps {
  /** Callback when user wants to navigate to unit offer panel */
  onNavigateToUnitOffer?: () => void;
}

/**
 * PixiJS Hex Grid Component
 */
export function PixiHexGrid({ onNavigateToUnitOffer }: PixiHexGridProps = {}) {
  // Refs for PixiJS objects
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const layersRef = useRef<WorldLayers | null>(null);
  const worldRef = useRef<Container | null>(null);
  const backgroundRef = useRef<BackgroundAtmosphere | null>(null);
  const animationManagerRef = useRef<AnimationManager | null>(null);
  const particleManagerRef = useRef<ParticleManager | null>(null);
  const heroContainerRef = useRef<Container | null>(null);
  const [hoveredHex, setHoveredHex] = useState<HexCoord | null>(null);

  // Camera control hook
  const {
    cameraRef,
    hasCenteredOnHeroRef,
    cameraReadyRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    handleKeyDown,
    handleKeyUp,
    centerAndApplyCamera,
    updateCameraTick,
  } = useCameraControl({ appRef, worldRef });

  const resetRendererRef = useRef<() => void>(() => {});
  const handlePixiDestroyed = useCallback(() => {
    resetRendererRef.current();
    heroContainerRef.current = null;
  }, []);

  // Game state hooks
  const { state, sendAction } = useGame();
  const player = useMyPlayer();
  const { startIntro, isIntroComplete } = useGameIntro();
  const { emit: emitAnimationEvent } = useAnimationDispatcher();
  const { playCinematic, isInCinematic } = useCinematic();
  const { isOverlayActive } = useOverlay();
  const { settings: debugDisplaySettings } = useDebugDisplay();
  const { setApp, setOverlayLayer } = usePixiApp();

  const isInitialized = usePixiAppLifecycle({
    containerRef,
    appRef,
    layersRef,
    worldRef,
    backgroundRef,
    animationManagerRef,
    particleManagerRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    updateCameraTick,
    setApp,
    setOverlayLayer,
    hasCenteredOnHeroRef,
    cameraReadyRef,
    onDestroyed: handlePixiDestroyed,
  });

  usePixiDomInput({
    isInitialized,
    containerRef,
    handleWheel,
    handleKeyDown,
    handleKeyUp,
  });

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
  } = useHexHover({ delay: 650 });


  // Site Panel state (detailed info panel)
  const [isSitePanelOpen, setIsSitePanelOpen] = useState(false);
  const [sitePanelHex, setSitePanelHex] = useState<HexCoord | null>(null);

  // Handler to open the site panel (from right-click on hex)
  const handleOpenSitePanel = useCallback((coord: HexCoord) => {
    // Only open if the hex has a site
    const hex = state?.map.hexes[hexKey(coord)];
    if (!hex?.site) return;

    setSitePanelHex(coord);
    setIsSitePanelOpen(true);
    handleHexTooltipLeave();
  }, [handleHexTooltipLeave, state?.map.hexes]);

  // Handler for right-click on hero token (opens site panel for hero's current location)
  const handleHeroRightClick = useCallback(() => {
    if (!player?.position) return;
    handleOpenSitePanel(player.position);
  }, [player?.position, handleOpenSitePanel]);

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
  }, [isSitePanelOpen, cameraRef]);

  // Memoized game board selectors
  const {
    validMoveTargets,
    reachableHexes,
    exploreTargets,
    pathPreview,
    isPathTerminal,
  } = useGameBoardSelectors({
    state,
    hoveredHex,
    playerPosition: player?.position ?? null,
  });

  const {
    isLoading,
    revealingHexKeysRef,
    revealingUpdateCounter,
    resetRenderer,
  } = useGameBoardRenderer({
    isInitialized,
    state,
    player,
    exploreTargets,
    appRef,
    layersRef,
    worldRef,
    animationManagerRef,
    particleManagerRef,
    backgroundRef,
    heroContainerRef,
    cameraRef,
    hasCenteredOnHeroRef,
    cameraReadyRef,
    centerAndApplyCamera,
    emitAnimationEvent,
    startIntro,
    isInCinematic,
    playCinematic,
    onHeroRightClick: handleHeroRightClick,
  });

  resetRendererRef.current = resetRenderer;

  // Hex interaction handlers
  const { getMoveHighlight, handleHexClick, handleExploreClick } = useHexInteraction({
    validMoveTargets,
    reachableHexes,
    playerPosition: player?.position ?? null,
    sendAction,
  });

  // Hide world and background when in combat (so hand overlay shows through transparent canvas)
  const inCombat = state?.combat !== null;
  useEffect(() => {
    if (!isInitialized) return;
    const world = worldRef.current;
    const background = backgroundRef.current;

    if (world) {
      // Only toggle if intro is complete (world starts hidden during intro)
      if (isIntroComplete) {
        world.visible = !inCombat;
      }
    }
    if (background) {
      background.getContainer().visible = !inCombat;
    }
  }, [isInitialized, inCombat, isIntroComplete]);

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
      excludeHexes,
      handleOpenSitePanel
    );

    renderGhostHexes(layers, exploreTargets, handleExploreClick);
    renderReachabilityBoundary(layers, reachableHexes, validMoveTargets, player?.position ?? null, debugDisplaySettings.showBoundaryEdges);
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
    reachableHexes,
    validMoveTargets,
    player?.position,
    handleHexHoverWithPos,
    debugDisplaySettings.showCoordinates,
    debugDisplaySettings.showBoundaryEdges,
    revealingHexKeysRef, // Ref is stable, added for exhaustive-deps compliance
    revealingUpdateCounter, // Force re-run when revealing state changes
    handleOpenSitePanel,
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
        onNavigateToUnitOffer={onNavigateToUnitOffer}
      />
    </>
  );
}
