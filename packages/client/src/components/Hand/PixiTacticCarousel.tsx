/**
 * PixiTacticCarousel - PixiJS-based tactic card rendering
 *
 * Renders tactic cards using the shared PixiJS Application via PixiAppContext.
 * The container is added to the overlayLayer for screen-space rendering.
 *
 * Features:
 * - Uses shared PixiJS app (no separate WebGL context)
 * - Screen-space overlay (not affected by camera pan/zoom)
 * - Fan layout with spread, rotation, arc
 * - Inscryption-style z-ordering (persists after mouse leave)
 * - Hover effects (lift, glow)
 * - Staggered deal entrance animation
 * - View mode support (board/ready/focus)
 * - Theme-based glow (gold for day, blue for night)
 */

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Sprite, Graphics, Container, type Texture } from "pixi.js";
import { SELECT_TACTIC_ACTION, type TacticId } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { extractTacticOptions } from "../../rust/legalActionUtils";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { useGameIntro } from "../../contexts/GameIntroContext";
import { useOnAnimationEvent, useAnimationDispatcher } from "../../contexts/AnimationDispatcherContext";
import { getTacticTexture, getPlaceholderTexture } from "../../utils/pixiTextureLoader";
import { loadAtlas } from "../../utils/cardAtlas";
import {
  calculateZIndex,
  CARD_FAN_BASE_SCALE,
  CARD_FAN_HOVER,
  getTacticLayout,
  TACTIC_ASPECT_RATIO,
  type CardFanViewMode,
} from "../../utils/cardFanLayout";
import { playSound } from "../../utils/audioManager";
import { usePixiApp } from "../../contexts/PixiAppContext";
import { AnimationManager, Easing } from "../GameBoard/pixi/animations";
import { PIXI_Z_INDEX } from "../../utils/pixiLayers";
import { TACTIC_VIEW_MODE_OFFSETS, VIEW_MODE_TRANSITION_MS } from "../../utils/carouselViewModes";

// Animation timing constants
const HOVER_LIFT_DURATION_MS = CARD_FAN_HOVER.durationSec * 1000; // ~265ms synced to audio
const SELECTION_DELAY_MS = 800; // Delay before sending action after selection animation

// Deal animation constants
const DEAL_STAGGER_MS = 110; // Stagger between each card's deal animation
const DEAL_DURATION_MS = 550; // Duration of each card's deal animation
const DEAL_START_OFFSET_Y = -200; // Cards start above their final position
const DEAL_START_ROTATION = -5 * (Math.PI / 180); // -5 degrees in radians

// Glow colors for day/night themes
const GLOW_COLORS = {
  day: 0xffc107, // Gold/amber
  night: 0x6495ed, // Cornflower blue
} as const;

// Use shared view mode offsets for tactics (different from hand/units)
const VIEW_MODE_OFFSETS = TACTIC_VIEW_MODE_OFFSETS;

interface PixiTacticCarouselProps {
  viewMode: CardFanViewMode;
  /** Whether this pane is active in the carousel (controls visibility) */
  isActive?: boolean;
}

export function PixiTacticCarousel({ viewMode, isActive = true }: PixiTacticCarouselProps) {
  const { app, overlayLayer } = usePixiApp();
  const { state, sendAction, legalActions, isRustMode } = useGame();
  const player = useMyPlayer();
  const { isIntroComplete } = useGameIntro();
  const { emit: emitAnimationEvent } = useAnimationDispatcher();

  // PixiJS object refs
  const containerRef = useRef<Container | null>(null);
  const cardContainersRef = useRef<Map<number, Container>>(new Map());
  const glowGraphicsRef = useRef<Map<number, Graphics>>(new Map());
  const animationManagerRef = useRef<AnimationManager | null>(null);

  // State
  const [atlasLoaded, setAtlasLoaded] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [zIndexAnchor, setZIndexAnchor] = useState<number | null>(null);
  const [selectedTactic, setSelectedTactic] = useState<TacticId | null>(null);
  const [manaSourceComplete, setManaSourceComplete] = useState(false);
  const [screenDimensions, setScreenDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Track for selection in progress
  const selectionInProgressRef = useRef(false);

  // Track previous view mode for transitions
  const prevViewModeRef = useRef<CardFanViewMode>(viewMode);

  // App is ready when we have both the shared app and overlay layer
  const isAppReady = !!(app && overlayLayer);

  // Card dimensions based on viewport
  const cardHeight = useMemo(() => {
    return Math.round(screenDimensions.height * CARD_FAN_BASE_SCALE);
  }, [screenDimensions.height]);
  const cardWidth = Math.round(cardHeight * TACTIC_ASPECT_RATIO);

  // Get available tactics from game state
  const rustTacticOptions = useMemo(() => extractTacticOptions(legalActions), [legalActions]);
  const availableTactics = useMemo(() => {
    if (isRustMode) {
      return rustTacticOptions.map(opt => opt.tacticId as TacticId);
    }
    return state?.validActions?.mode === "tactics_selection"
      ? (state.validActions.tactics.availableTactics ?? [])
      : [];
  }, [isRustMode, rustTacticOptions, state?.validActions]);

  const timeOfDay = state?.timeOfDay ?? "day";

  // Should show tactics: active pane, atlas loaded, mana source complete (or intro done), player hasn't selected yet
  const shouldShowTactics = useMemo(() => {
    if (!isActive) return false;
    if (!atlasLoaded) return false;
    if (!manaSourceComplete && !isIntroComplete) return false;
    if (!player || player.selectedTacticId !== null) return false;
    if (availableTactics.length === 0) return false;
    return true;
  }, [isActive, atlasLoaded, manaSourceComplete, isIntroComplete, player, availableTactics.length]);

  // Calculate container dimensions
  const containerWidth = useMemo(() => {
    if (availableTactics.length === 0) return 300;
    const { spreadX } = getTacticLayout(availableTactics.length - 1, availableTactics.length, cardWidth);
    const baseWidth = Math.abs(spreadX) * 2 + cardWidth;
    return baseWidth + 100; // Extra padding
  }, [availableTactics.length, cardWidth]);

  const containerHeight = cardHeight + 80; // Extra space for hover lift and arc

  // Card positions
  const cardPositions = useMemo(() => {
    return availableTactics.map((_, index) => {
      const { spreadX, rotation, arcY } = getTacticLayout(index, availableTactics.length, cardWidth);
      return {
        x: containerWidth / 2 + spreadX,
        y: containerHeight - 10 - arcY,
        rotation,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- positions only depend on count, not IDs
  }, [availableTactics.length, cardWidth, containerWidth, containerHeight]);

  // Listen for mana-source-complete event (tactics show after mana dice are revealed)
  useOnAnimationEvent("mana-source-complete", useCallback(() => {
    setManaSourceComplete(true);
  }, []));

  // Reset selection state when tactics change (new round)
  useEffect(() => {
    selectionInProgressRef.current = false;
    setSelectedTactic(null);
  }, [availableTactics]);

  // Load atlas on mount
  useEffect(() => {
    loadAtlas().then(() => setAtlasLoaded(true));
  }, []);

  // Track screen resize
  useEffect(() => {
    const handleResize = () => {
      setScreenDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Helper to find which card index is at a given local position
  const findCardAtPosition = useCallback((localX: number, localY: number): number | null => {
    // Check cards in reverse z-order (highest z-index first)
    const sortedIndices = [...cardContainersRef.current.keys()].sort((a, b) => {
      const zA = cardContainersRef.current.get(a)?.zIndex ?? 0;
      const zB = cardContainersRef.current.get(b)?.zIndex ?? 0;
      return zB - zA;
    });

    for (const index of sortedIndices) {
      const container = cardContainersRef.current.get(index);
      if (!container) continue;

      const pos = cardPositions[index];
      if (!pos) continue;

      // Card bounds (pivot is at bottom center)
      const left = pos.x - cardWidth / 2;
      const right = pos.x + cardWidth / 2;
      const top = pos.y - cardHeight;
      const bottom = pos.y;

      // Check if point is inside card bounds (with tolerance for lift area)
      const liftTolerance = CARD_FAN_HOVER.liftY * 1.5;
      if (localX >= left && localX <= right && localY >= top - liftTolerance && localY <= bottom) {
        return index;
      }
    }
    return null;
  }, [cardPositions, cardWidth, cardHeight]);

  // Create container on the shared overlay layer
  useEffect(() => {
    if (!app || !overlayLayer) return;

    const tacticContainer = new Container();
    tacticContainer.label = "tactic-carousel";
    tacticContainer.sortableChildren = true;
    tacticContainer.zIndex = PIXI_Z_INDEX.TACTIC_CAROUSEL;
    tacticContainer.eventMode = "none"; // Events handled via DOM
    tacticContainer.interactiveChildren = false;
    tacticContainer.visible = false; // Start hidden

    overlayLayer.addChild(tacticContainer);
    overlayLayer.sortChildren();
    containerRef.current = tacticContainer;

    // Create and attach animation manager
    const animManager = new AnimationManager();
    animManager.attach(app.ticker);
    animationManagerRef.current = animManager;

    // Capture refs for cleanup
    const cardContainers = cardContainersRef.current;
    const glowGraphics = glowGraphicsRef.current;

    return () => {
      if (animationManagerRef.current) {
        animationManagerRef.current.cancelAll();
        animationManagerRef.current.detach();
        animationManagerRef.current = null;
      }

      if (containerRef.current) {
        if (containerRef.current.parent) {
          containerRef.current.parent.removeChild(containerRef.current);
        }
        containerRef.current.destroy({ children: true });
        containerRef.current = null;
      }

      cardContainers.clear();
      glowGraphics.clear();
    };
  }, [app, overlayLayer]);

  // Update sprites when tactics change
  useEffect(() => {
    const tacticContainer = containerRef.current;
    if (!tacticContainer || !isAppReady || !shouldShowTactics) return;

    // Skip if selection in progress
    if (selectionInProgressRef.current) return;

    const updateSprites = async () => {
      tacticContainer.removeChildren();
      cardContainersRef.current.clear();
      glowGraphicsRef.current.clear();

      // Preload all textures
      const textures: Texture[] = await Promise.all(
        availableTactics.map(tacticId =>
          tacticId ? getTacticTexture(tacticId) : Promise.resolve(getPlaceholderTexture())
        )
      );

      const animManager = animationManagerRef.current;
      const glowColor = GLOW_COLORS[timeOfDay];

      for (let i = 0; i < availableTactics.length; i++) {
        const tacticId = availableTactics[i];
        if (!tacticId) continue;

        const pos = cardPositions[i];
        if (!pos) continue;

        const texture = textures[i];

        // Create container for card
        const cardContainer = new Container();
        // Start above for deal animation
        cardContainer.x = pos.x;
        cardContainer.y = pos.y + DEAL_START_OFFSET_Y;
        cardContainer.rotation = pos.rotation + DEAL_START_ROTATION;
        cardContainer.pivot.set(cardWidth / 2, cardHeight);
        cardContainer.alpha = 0; // Start invisible for deal animation

        // Glow effect - themed based on time of day
        const glow = new Graphics();
        // Outer glow layer
        glow.roundRect(-6, -6, cardWidth + 12, cardHeight + 12, cardWidth * 0.04 + 6);
        glow.fill({ color: glowColor, alpha: 0.15 });
        // Middle glow layer
        glow.roundRect(-4, -4, cardWidth + 8, cardHeight + 8, cardWidth * 0.04 + 4);
        glow.fill({ color: glowColor, alpha: 0.2 });
        // Inner glow layer
        glow.roundRect(-2, -2, cardWidth + 4, cardHeight + 4, cardWidth * 0.04 + 2);
        glow.fill({ color: glowColor, alpha: 0.25 });
        glow.alpha = 0; // Start invisible, show on hover
        cardContainer.addChild(glow);
        glowGraphicsRef.current.set(i, glow);

        // Card sprite
        const sprite = new Sprite(texture);
        sprite.width = cardWidth;
        sprite.height = cardHeight;
        cardContainer.addChild(sprite);

        // Border
        const border = new Graphics();
        border.setStrokeStyle({ width: 2, color: 0x333333 });
        border.roundRect(0, 0, cardWidth, cardHeight, cardWidth * 0.04);
        border.stroke();
        cardContainer.addChild(border);

        cardContainer.eventMode = "none";
        cardContainer.zIndex = calculateZIndex(i, availableTactics.length, zIndexAnchor);

        tacticContainer.addChild(cardContainer);
        cardContainersRef.current.set(i, cardContainer);

        // Staggered deal animation
        if (animManager) {
          const delay = i * DEAL_STAGGER_MS;
          setTimeout(() => {
            if (cardContainer.destroyed) return;
            animManager.animate(`tactic-deal-${i}`, cardContainer, {
              endY: pos.y,
              endRotation: pos.rotation,
              endAlpha: 1,
              duration: DEAL_DURATION_MS,
              easing: Easing.easeOutBack,
            });
          }, delay);
        } else {
          // No animation manager - just set final position
          cardContainer.y = pos.y;
          cardContainer.rotation = pos.rotation;
          cardContainer.alpha = 1;
        }
      }

      tacticContainer.sortChildren();
    };

    updateSprites();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTactics, cardPositions, cardWidth, cardHeight, isAppReady, shouldShowTactics, timeOfDay]);

  // Handle hover detection using DOM events
  useEffect(() => {
    const tacticContainer = containerRef.current;
    if (!tacticContainer || !isAppReady || !shouldShowTactics) return;

    let lastHoveredIndex: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (viewMode === "board") return;
      if (selectionInProgressRef.current || selectedTactic !== null) return;

      const localPos = tacticContainer.toLocal({ x: e.clientX, y: e.clientY });
      const cardIndex = findCardAtPosition(localPos.x, localPos.y);

      if (cardIndex !== lastHoveredIndex) {
        if (cardIndex !== null) {
          setHoveredIndex(cardIndex);
          setZIndexAnchor(cardIndex);
          if (lastHoveredIndex === null) {
            playSound("cardHover");
          }
        } else {
          setHoveredIndex(null);
        }
        lastHoveredIndex = cardIndex;
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, [isAppReady, viewMode, findCardAtPosition, shouldShowTactics, selectedTactic]);

  // Handle card clicks via DOM events
  useEffect(() => {
    const tacticContainer = containerRef.current;
    if (!tacticContainer || !isAppReady || !shouldShowTactics) return;

    const handleClick = (e: MouseEvent) => {
      if (viewMode === "board") return;
      if (selectionInProgressRef.current || selectedTactic !== null) return;

      const localPos = tacticContainer.toLocal({ x: e.clientX, y: e.clientY });
      const cardIndex = findCardAtPosition(localPos.x, localPos.y);

      if (cardIndex !== null) {
        const tacticId = availableTactics[cardIndex];
        if (!tacticId) return;

        e.stopPropagation();
        e.preventDefault();

        selectionInProgressRef.current = true;
        setSelectedTactic(tacticId);

        const animManager = animationManagerRef.current;
        const containers = cardContainersRef.current;
        const glows = glowGraphicsRef.current;

        // Animate selected card up with enhanced glow
        const selectedContainer = containers.get(cardIndex);
        const selectedGlow = glows.get(cardIndex);
        const pos = cardPositions[cardIndex];

        if (selectedContainer && pos && animManager) {
          // Cancel hover animation
          animManager.cancel(`tactic-hover-${cardIndex}`);

          // Lift selected card
          selectedContainer.zIndex = 100;
          tacticContainer.sortChildren();

          animManager.animate(`tactic-select-${cardIndex}`, selectedContainer, {
            endY: pos.y - 50,
            duration: 300,
            easing: Easing.easeOutCubic,
          });

          // Show and enhance glow
          if (selectedGlow) {
            selectedGlow.alpha = 2;
          }
        }

        // Fade out other cards
        containers.forEach((container, idx) => {
          if (idx !== cardIndex && animManager) {
            animManager.animate(`tactic-dismiss-${idx}`, container, {
              endAlpha: 0,
              endScale: 0.8,
              endY: (cardPositions[idx]?.y ?? 0) + 20,
              duration: 300,
              easing: Easing.easeOutCubic,
            });
          }
        });

        // Send action after animation delay
        setTimeout(() => {
          if (isRustMode) {
            const rustAction = rustTacticOptions.find(opt => opt.tacticId === tacticId);
            if (rustAction) sendAction(rustAction.action);
          } else {
            sendAction({ type: SELECT_TACTIC_ACTION, tacticId });
          }
          emitAnimationEvent("tactics-complete");
        }, SELECTION_DELAY_MS);
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [isAppReady, viewMode, findCardAtPosition, shouldShowTactics, availableTactics, selectedTactic, cardPositions, sendAction, emitAnimationEvent, isRustMode, rustTacticOptions]);

  // Track previous hovered index for animation
  const prevHoveredIndexRef = useRef<number | null>(null);

  // Handle hover animation and z-index updates
  useEffect(() => {
    const containers = cardContainersRef.current;
    const glowGraphics = glowGraphicsRef.current;
    const animManager = animationManagerRef.current;
    const prevHovered = prevHoveredIndexRef.current;

    const liftY = CARD_FAN_HOVER.liftY;

    // Update z-index for all cards
    availableTactics.forEach((_, index) => {
      const container = containers.get(index);
      if (container && selectedTactic === null) {
        container.zIndex = calculateZIndex(index, availableTactics.length, zIndexAnchor);
      }
    });
    containerRef.current?.sortChildren();

    // Animate previously hovered card back down
    if (prevHovered !== null && prevHovered !== hoveredIndex && selectedTactic === null) {
      const prevContainer = containers.get(prevHovered);
      const prevGlow = glowGraphics.get(prevHovered);
      const prevPos = cardPositions[prevHovered];

      if (prevContainer && prevPos) {
        if (animManager) {
          animManager.animate(`tactic-hover-${prevHovered}`, prevContainer, {
            endY: prevPos.y,
            duration: HOVER_LIFT_DURATION_MS,
            easing: Easing.easeOutCubic,
          });
        } else {
          prevContainer.y = prevPos.y;
        }
        if (prevGlow) prevGlow.alpha = 0;
      }
    }

    // Animate newly hovered card up
    if (hoveredIndex !== null && viewMode !== "board" && selectedTactic === null) {
      const container = containers.get(hoveredIndex);
      const glow = glowGraphics.get(hoveredIndex);
      const pos = cardPositions[hoveredIndex];

      if (container && pos) {
        const targetY = pos.y - liftY;
        if (animManager) {
          animManager.animate(`tactic-hover-${hoveredIndex}`, container, {
            endY: targetY,
            duration: HOVER_LIFT_DURATION_MS,
            easing: Easing.easeOutCubic,
          });
        } else {
          container.y = targetY;
        }
        if (glow) glow.alpha = 1;
      }
    }

    prevHoveredIndexRef.current = hoveredIndex;
  }, [hoveredIndex, zIndexAnchor, availableTactics, cardPositions, viewMode, selectedTactic]);

  // Update position, scale, and visibility based on view mode
  useEffect(() => {
    const tacticContainer = containerRef.current;
    if (!tacticContainer) return;

    const viewConfig = VIEW_MODE_OFFSETS[viewMode];
    const animManager = animationManagerRef.current;
    const prevViewMode = prevViewModeRef.current;
    const isViewModeChange = prevViewMode !== viewMode;

    // Set pivot at bottom center
    tacticContainer.pivot.set(containerWidth / 2, containerHeight);

    // Base position: horizontally centered, bottom of screen
    const baseX = screenDimensions.width / 2;
    const baseY = screenDimensions.height;

    const yOffset = viewConfig.yOffset * screenDimensions.height;
    const targetX = baseX;
    const targetY = baseY + yOffset;
    let targetScale: number = viewConfig.scale;

    // Constrain scale for focus mode
    if (viewMode === "focus") {
      const horizontalPadding = 40;
      const maxScaledWidth = screenDimensions.width - horizontalPadding;
      const maxHorizontalScale = maxScaledWidth / containerWidth;

      const verticalPadding = 60;
      const availableHeight = screenDimensions.height - verticalPadding;
      const maxVerticalScale = availableHeight / containerHeight;

      targetScale = Math.min(viewConfig.scale, maxHorizontalScale, maxVerticalScale);
    }

    // Show/hide based on whether we should display and view config
    const shouldBeVisible = shouldShowTactics && viewConfig.visible;

    if (shouldBeVisible) {
      tacticContainer.visible = true;
      tacticContainer.eventMode = "static";
    }

    if (isViewModeChange && animManager && shouldBeVisible) {
      animManager.animate("tactic-view-mode", tacticContainer, {
        endX: targetX,
        endY: targetY,
        endScale: targetScale,
        duration: VIEW_MODE_TRANSITION_MS,
        easing: Easing.easeOutCubic,
        onComplete: () => {
          if (!viewConfig.visible || !shouldShowTactics) {
            tacticContainer.visible = false;
            tacticContainer.eventMode = "none";
          }
        },
      });
    } else {
      tacticContainer.x = targetX;
      tacticContainer.y = targetY;
      tacticContainer.scale.set(targetScale);
      tacticContainer.visible = shouldBeVisible;
      tacticContainer.eventMode = shouldBeVisible ? "static" : "none";
    }

    prevViewModeRef.current = viewMode;
  }, [viewMode, screenDimensions.width, screenDimensions.height, containerWidth, containerHeight, shouldShowTactics]);

  // Hide container when tactics shouldn't be shown
  useEffect(() => {
    const tacticContainer = containerRef.current;
    if (!tacticContainer) return;

    if (!shouldShowTactics) {
      tacticContainer.visible = false;
      tacticContainer.eventMode = "none";
    }
  }, [shouldShowTactics]);

  // No DOM element needed - renders to PixiJS overlay layer
  return null;
}
