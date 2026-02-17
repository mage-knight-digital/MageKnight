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

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Application, Container } from "pixi.js";
import type { HexCoord } from "@mage-knight/shared";
import { hexKey, ENTER_SITE_ACTION, BURN_MONASTERY_ACTION, PLUNDER_VILLAGE_ACTION } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { useIsMyTurn } from "../../hooks/useIsMyTurn";
import { useGameIntro } from "../../contexts/GameIntroContext";
import { useAnimationDispatcher } from "../../contexts/AnimationDispatcherContext";
import { useCinematic } from "../../contexts/CinematicContext";
import { useOverlay } from "../../contexts/OverlayContext";
import { useDebugDisplay } from "../../contexts/DebugDisplayContext";
import { usePixiApp } from "../../contexts/PixiAppContext";
import { useHexHover } from "../../hooks/useHexHover";
import { HexTooltip } from "../HexTooltip";
import { SitePanel } from "../SitePanel";
import { SiteActionList, type SiteAction } from "../SiteActionList";

import { useCameraControl } from "./hooks/useCameraControl";
import { hexToPixel } from "./pixi/hexMath";
import { HEX_SIZE } from "./pixi/types";
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
  /** Callback when user wants to navigate to spell offer panel */
  onNavigateToSpellOffer?: () => void;
}

/**
 * PixiJS Hex Grid Component
 */
export function PixiHexGrid({ onNavigateToUnitOffer, onNavigateToSpellOffer }: PixiHexGridProps = {}) {
  // Refs for PixiJS objects
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const layersRef = useRef<WorldLayers | null>(null);
  const worldRef = useRef<Container | null>(null);
  const backgroundRef = useRef<BackgroundAtmosphere | null>(null);
  const animationManagerRef = useRef<AnimationManager | null>(null);
  const particleManagerRef = useRef<ParticleManager | null>(null);
  const heroContainersRef = useRef<Map<string, Container>>(new Map());
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
    heroContainersRef.current = new Map();
  }, []);

  // Game state hooks
  const { state, sendAction, myPlayerId } = useGame();
  const player = useMyPlayer();
  const isMyTurn = useIsMyTurn();
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

  // Site Action List state (compact action menu on Space key)
  const [showSiteActionList, setShowSiteActionList] = useState(false);
  const [actionListPosition, setActionListPosition] = useState<{ x: number; y: number } | null>(null);

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

  // Handler to close the site action list
  const handleCloseSiteActionList = useCallback(() => {
    setShowSiteActionList(false);
    setActionListPosition(null);
  }, []);

  // Handler for site action list actions
  const handleSiteAction = useCallback((action: SiteAction) => {
    // Block interaction if not player's turn
    if (!isMyTurn) return;

    switch (action) {
      case "enter":
        sendAction({ type: ENTER_SITE_ACTION });
        break;
      case "details":
        if (player?.position) {
          handleOpenSitePanel(player.position);
        }
        break;
      case "heal":
        // TODO: Implement healing UI
        console.log("Heal action - not yet implemented");
        break;
      case "recruit":
        onNavigateToUnitOffer?.();
        break;
      case "buySpell":
        onNavigateToSpellOffer?.();
        break;
      case "buyAA":
        // Monastery AAs are shown in the units pane alongside regular units
        onNavigateToUnitOffer?.();
        break;
      case "burn":
        sendAction({ type: BURN_MONASTERY_ACTION });
        break;
      case "plunder":
        sendAction({ type: PLUNDER_VILLAGE_ACTION });
        break;
    }
    handleCloseSiteActionList();
  }, [isMyTurn, sendAction, player?.position, handleOpenSitePanel, handleCloseSiteActionList, onNavigateToUnitOffer, onNavigateToSpellOffer]);

  // Calculate screen position for hero (for action list)
  const getHeroScreenPosition = useCallback((): { x: number; y: number } | null => {
    if (!player?.position || !worldRef.current || !appRef.current) return null;

    // Get world position of hero
    const worldPos = hexToPixel(player.position);

    // Convert to screen position using the world container's transform
    const world = worldRef.current;
    const globalPos = world.toGlobal({ x: worldPos.x, y: worldPos.y });

    // Calculate the screen-space hex radius
    const hexEdgeWorld = { x: worldPos.x + HEX_SIZE * Math.sqrt(3) / 2, y: worldPos.y };
    const hexEdgeScreen = world.toGlobal(hexEdgeWorld);
    const screenHexRadius = hexEdgeScreen.x - globalPos.x;

    // Position action list to the right of the hero
    return {
      x: globalPos.x + screenHexRadius + 10,
      y: globalPos.y,
    };
  }, [player?.position]);

  // Site options only available during normal_turn
  const siteOptions = useMemo(
    () =>
      state?.validActions?.mode === "normal_turn"
        ? state.validActions.sites ?? null
        : null,
    [state?.validActions]
  );

  // Enhanced keyboard handler that intercepts Space for site actions
  const handleGameKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't handle if overlays are active or site panel is open
    if (isOverlayActive || isSitePanelOpen) {
      handleKeyDown(event);
      return;
    }

    // Space - toggle site action list (only if it's my turn and we have site options)
    if (event.code === "Space" && isMyTurn && siteOptions) {
      event.preventDefault();
      if (showSiteActionList) {
        handleCloseSiteActionList();
      } else {
        const pos = getHeroScreenPosition();
        if (pos) {
          setActionListPosition(pos);
          setShowSiteActionList(true);
          handleHexTooltipLeave(); // Hide tooltip when showing action list
        }
      }
      return;
    }

    // Pass other keys to camera control
    handleKeyDown(event);
  }, [
    isMyTurn,
    siteOptions,
    showSiteActionList,
    isOverlayActive,
    isSitePanelOpen,
    handleKeyDown,
    getHeroScreenPosition,
    handleCloseSiteActionList,
    handleHexTooltipLeave,
  ]);

  // Attach DOM event handlers (moved here after handleGameKeyDown is defined)
  usePixiDomInput({
    isInitialized,
    containerRef,
    handleWheel,
    handleKeyDown: handleGameKeyDown,
    handleKeyUp,
  });

  // Memoized game board selectors
  const {
    validMoveTargets,
    reachableHexes,
    challengeTargetHexes,
    hexCostReductionTargets,
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
    myPlayerId,
    exploreTargets,
    appRef,
    layersRef,
    worldRef,
    animationManagerRef,
    particleManagerRef,
    backgroundRef,
    heroContainersRef,
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
    challengeTargetHexes,
    hexCostReductionTargets,
    playerPosition: player?.position ?? null,
    sendAction,
    isMyTurn,
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

  // Close site action list when player moves or enters combat
  useEffect(() => {
    if (showSiteActionList) {
      handleCloseSiteActionList();
    }
    // Intentionally only trigger on player position or combat change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.position?.q, player?.position?.r, inCombat]);

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
      handleOpenSitePanel,
      debugDisplaySettings.showTileNames
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
    debugDisplaySettings.showTileNames,
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
            ? siteOptions
            : null
        }
        hex={sitePanelHex ? state?.map.hexes[hexKey(sitePanelHex)] ?? null : null}
        onClose={handleCloseSitePanel}
        isArrivalMode={false}
        timeOfDay={state?.timeOfDay}
        onNavigateToUnitOffer={onNavigateToUnitOffer}
      />

      {/* Site Action List - compact action menu on Space key */}
      {showSiteActionList && actionListPosition && siteOptions && (
        <SiteActionList
          siteOptions={siteOptions}
          position={actionListPosition}
          onAction={handleSiteAction}
          onClose={handleCloseSiteActionList}
        />
      )}
    </>
  );
}
