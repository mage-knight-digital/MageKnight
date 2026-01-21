/**
 * PixiFloatingHand - PixiJS-based card rendering for the hand
 *
 * Renders hand cards in a dedicated PixiJS Application with its own canvas.
 * This canvas is positioned above the combat overlay via CSS z-index, ensuring
 * the hand is always visible during combat.
 *
 * Features:
 * - Dedicated PixiJS canvas with high z-index (above combat overlay)
 * - Screen-space overlay (not affected by camera pan/zoom)
 * - Fan layout with spread, rotation, arc
 * - Inscryption-style z-ordering (persists after mouse leave)
 * - Hover effects (lift, glow)
 * - Deal animations for new cards
 * - View mode support (board/ready/focus)
 */

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Application, Sprite, Graphics, Container } from "pixi.js";
import { CARD_WOUND, type CardId, type PlayableCard } from "@mage-knight/shared";
import { getCardColor } from "../../utils/cardAtlas";
import { getCardTexture, getPlaceholderTexture } from "../../utils/pixiTextureLoader";
import { calculateZIndex, CARD_FAN_BASE_SCALE, CARD_FAN_HOVER, type CardFanViewMode } from "../../utils/cardFanLayout";
import { playSound } from "../../utils/audioManager";
import { useOverlay } from "../../contexts/OverlayContext";
import { AnimationManager, Easing } from "../GameBoard/pixi/animations";
import "./FloatingHand.css";

// Animation timing constants
const HOVER_LIFT_DURATION_MS = CARD_FAN_HOVER.durationSec * 1000; // ~265ms synced to audio
const CARD_TO_MENU_DURATION_MS = 300; // Duration for card to animate to menu center
const CARD_RETURN_DURATION_MS = 300; // Duration for card to animate back to hand
const MENU_CARD_SCALE = 1.4; // Card scales up 40% when in menu (must match PixiCardActionMenu)
const VIEW_MODE_TRANSITION_MS = 300; // Duration for view mode transitions

// View mode position offsets (matching CSS transforms from FloatingHand.css)
// These are applied to the PixiJS container position
const VIEW_MODE_OFFSETS = {
  board: { yOffset: 0.25 + 0.05, scale: 1, visible: false }, // 25vh + 50px ≈ 30vh off screen
  ready: { yOffset: 0.07, scale: 1, visible: true },          // 7vh down from bottom
  focus: { yOffset: -0.15, scale: 2.8, visible: true },       // 15vh up, scaled 2.8x
} as const;

// Re-export for backwards compatibility
export type HandViewMode = CardFanViewMode;

// Card aspect ratio (width / height)
const CARD_ASPECT = 0.667;

// Glow colors by card color
const GLOW_COLORS: Record<string, number> = {
  red: 0xe74c3c,
  blue: 0x3498db,
  green: 0x2ecc71,
  white: 0xecf0f1,
};

// Info passed when a card is clicked
export interface CardClickInfo {
  index: number;
  rect: DOMRect;
}

interface PixiFloatingHandProps {
  hand: readonly CardId[];
  playableCards: Map<CardId, PlayableCard>;
  selectedIndex: number | null;
  onCardClick: (info: CardClickInfo) => void;
  deckCount: number;
  discardCount: number;
  viewMode: HandViewMode;
}

/**
 * Calculate card layout for fan display
 */
function getCardLayout(index: number, totalCards: number, cardWidth: number) {
  const centerIndex = (totalCards - 1) / 2;
  const offsetFromCenter = index - centerIndex;

  const scaleFactor = cardWidth / 120;

  let baseSpread: number;
  let rotationPerCard: number;
  let baseArc: number;

  if (totalCards <= 5) {
    baseSpread = 70;
    rotationPerCard = 2;
    baseArc = 4;
  } else if (totalCards <= 8) {
    baseSpread = 50;
    rotationPerCard = 1.5;
    baseArc = 3;
  } else {
    baseSpread = 35;
    rotationPerCard = 1;
    baseArc = 2;
  }

  const spreadDistance = baseSpread * scaleFactor;
  const arcPerCard = baseArc * scaleFactor;

  const spreadX = offsetFromCenter * spreadDistance;
  const rotation = offsetFromCenter * rotationPerCard * (Math.PI / 180); // Convert to radians
  const arcY = Math.abs(offsetFromCenter) * arcPerCard;

  return { spreadX, rotation, arcY, spreadDistance };
}

export function PixiFloatingHand({
  hand,
  playableCards,
  selectedIndex,
  onCardClick,
  viewMode,
}: PixiFloatingHandProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const handContainerRef = useRef<Container | null>(null);
  const cardContainersRef = useRef<Map<number, Container>>(new Map());
  const glowGraphicsRef = useRef<Map<number, Graphics>>(new Map());
  const animationManagerRef = useRef<AnimationManager | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [zIndexAnchor, setZIndexAnchor] = useState<number | null>(null);
  const [screenDimensions, setScreenDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [isAppReady, setIsAppReady] = useState(false);

  // Check if an overlay (like CardActionMenu) is active - don't intercept clicks when it is
  const { isOverlayActive } = useOverlay();

  // Track previous view mode for transitions
  const prevViewModeRef = useRef<HandViewMode>(viewMode);

  // Track when a card selection is in progress - used to skip updateSprites
  // This is set synchronously in click handler BEFORE React state updates
  const selectionInProgressRef = useRef<number | null>(null);

  // Track new cards for deal animation
  const prevHandLengthRef = useRef<number>(hand.length);
  const isFirstRenderRef = useRef<boolean>(true);
  // State for tracking new cards (setter used for deal animation, getter reserved for future use)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [newCardIndices, setNewCardIndices] = useState<Set<number>>(new Set());

  // Card dimensions based on viewport
  const cardHeight = useMemo(() => {
    return Math.round(screenDimensions.height * CARD_FAN_BASE_SCALE);
  }, [screenDimensions.height]);
  const cardWidth = Math.round(cardHeight * CARD_ASPECT);

  // Keep all cards visible - selected card stays as placeholder while pie menu animates on top
  const visibleHand = useMemo(() => {
    return [...hand];
  }, [hand]);

  // Calculate container dimensions
  const containerWidth = useMemo(() => {
    if (visibleHand.length === 0) return 300;
    const { spreadDistance } = getCardLayout(0, visibleHand.length, cardWidth);
    const baseWidth = Math.max(cardWidth, (visibleHand.length - 1) * spreadDistance + cardWidth);
    return baseWidth + 100; // Extra padding for hover
  }, [visibleHand.length, cardWidth]);

  const containerHeight = cardHeight + 80; // Extra space for hover lift and arc

  // Card positions - only depends on count, not card IDs (positions don't change when cards change)
  const cardPositions = useMemo(() => {
    return visibleHand.map((_, index) => {
      const { spreadX, rotation, arcY } = getCardLayout(index, visibleHand.length, cardWidth);
      return {
        x: containerWidth / 2 + spreadX,
        y: containerHeight - 10 - arcY, // Bottom-aligned with arc
        rotation,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleHand.length, cardWidth, containerWidth, containerHeight]);

  // Track screen resize
  useEffect(() => {
    const handleResize = () => {
      setScreenDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Detect new cards for deal animation
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevHandLengthRef.current = hand.length;
      return;
    }

    const prevLength = prevHandLengthRef.current;
    const currentLength = hand.length;

    if (currentLength > prevLength) {
      const newIndices = new Set<number>();
      const startIndex = prevLength === 0 ? 0 : prevLength;
      for (let i = startIndex; i < currentLength; i++) {
        newIndices.add(i);
      }
      setNewCardIndices(newIndices);

      const newCount = newIndices.size;
      const animationDuration = 480 + (newCount * 180);
      setTimeout(() => setNewCardIndices(new Set()), animationDuration);
    }

    prevHandLengthRef.current = currentLength;
  }, [hand]);

  // When menu closes (selectedIndex goes from something to null), animate card back
  // The "animate up" is handled directly in the click handler for immediate response
  const prevSelectedIndexRef = useRef<number | null>(null);
  useEffect(() => {
    const prevSelected = prevSelectedIndexRef.current;
    const animManager = animationManagerRef.current;
    const handContainer = handContainerRef.current;
    const app = appRef.current;

    // Raise/lower canvas z-index based on selection state
    // When selected: z-index 300 (above pie menu at 250)
    // When not selected: z-index 200 (normal)
    if (app?.canvas) {
      app.canvas.style.zIndex = selectedIndex !== null ? "300" : "200";
    }

    // If we HAD a selected card and now we don't, animate it back to resting position
    if (prevSelected !== null && selectedIndex === null) {

      // Clear the selection-in-progress flag
      selectionInProgressRef.current = null;

      // Restore all cards visibility
      cardContainersRef.current.forEach((container) => {
        container.alpha = 1;
      });

      const prevContainer = cardContainersRef.current.get(prevSelected);
      const pos = cardPositions[prevSelected];
      if (prevContainer && pos && animManager) {
        // Animate back to resting position (scale back to 1)
        animManager.animate(`card-return-${prevSelected}`, prevContainer, {
          endX: pos.x,
          endY: pos.y,
          endScale: 1,
          endRotation: pos.rotation,
          duration: CARD_RETURN_DURATION_MS,
          easing: Easing.easeOutCubic,
          onComplete: () => {
            prevContainer.zIndex = calculateZIndex(prevSelected, visibleHand.length, zIndexAnchor);
            handContainer?.sortChildren();
          },
        });
      }
    }

    prevSelectedIndexRef.current = selectedIndex;
  }, [selectedIndex, cardPositions, visibleHand.length, zIndexAnchor]);

  // Get original index - now same as visible index since we don't filter
  const getOriginalIndex = useCallback((visibleIndex: number): number => {
    return visibleIndex;
  }, []);

  // Helper to find which card index is at a given local position
  const findCardAtPosition = useCallback((localX: number, localY: number): number | null => {
    // Check cards in reverse z-order (highest z-index first)
    const sortedIndices = [...cardContainersRef.current.keys()].sort((a, b) => {
      const zA = cardContainersRef.current.get(a)?.zIndex ?? 0;
      const zB = cardContainersRef.current.get(b)?.zIndex ?? 0;
      return zB - zA; // Higher z-index first
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

      // Check if point is inside card bounds (with some tolerance for the lift area)
      const liftTolerance = CARD_FAN_HOVER.liftY * 1.5;
      if (localX >= left && localX <= right && localY >= top - liftTolerance && localY <= bottom) {
        return index;
      }
    }
    return null;
  }, [cardPositions, cardWidth, cardHeight]);

  // Create dedicated PixiJS Application for the hand overlay
  useEffect(() => {
    if (!containerRef.current) return;

    let app: Application | null = null;
    let destroyed = false;

    const initApp = async () => {
      app = new Application();
      await app.init({
        backgroundAlpha: 0, // Transparent background
        width: window.innerWidth,
        height: window.innerHeight,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (destroyed) {
        app.destroy(true, { children: true });
        return;
      }

      // Style canvas: full screen, above combat overlay
      // pointer-events: none lets clicks pass through to combat UI beneath
      // IMPORTANT: Append to document.body, not a parent with CSS transform,
      // because transform creates a new containing block for position: fixed
      app.canvas.style.position = "fixed";
      app.canvas.style.top = "0";
      app.canvas.style.left = "0";
      app.canvas.style.width = "100%";
      app.canvas.style.height = "100%";
      app.canvas.style.zIndex = "200"; // Above combat overlay (z-index: 100)
      app.canvas.style.pointerEvents = "none"; // Pass through to combat UI

      document.body.appendChild(app.canvas);
      appRef.current = app;

      // Create hand container
      const handContainer = new Container();
      handContainer.label = "floating-hand";
      handContainer.sortableChildren = true;
      handContainer.eventMode = "none"; // Events handled via DOM
      handContainer.interactiveChildren = false;

      app.stage.addChild(handContainer);
      handContainerRef.current = handContainer;

      // Stage doesn't need events - we handle via DOM
      app.stage.eventMode = "none";
      app.stage.interactiveChildren = false;

      // Create and attach animation manager
      const animManager = new AnimationManager();
      animManager.attach(app.ticker);
      animationManagerRef.current = animManager;

      setIsAppReady(true);
    };

    initApp();

    // Capture refs for cleanup
    const cardContainers = cardContainersRef.current;
    const glowGraphics = glowGraphicsRef.current;

    return () => {
      destroyed = true;
      setIsAppReady(false);

      // Clean up animation manager
      if (animationManagerRef.current) {
        animationManagerRef.current.cancelAll();
        animationManagerRef.current.detach();
        animationManagerRef.current = null;
      }

      if (handContainerRef.current) {
        handContainerRef.current.destroy({ children: true });
        handContainerRef.current = null;
      }

      if (appRef.current) {
        // Remove canvas from body before destroying
        if (appRef.current.canvas.parentNode) {
          appRef.current.canvas.parentNode.removeChild(appRef.current.canvas);
        }
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }

      // Clear tracked containers
      cardContainers.clear();
      glowGraphics.clear();
    };
  }, []);

  // Update sprites when hand changes
  useEffect(() => {
    const handContainer = handContainerRef.current;
    if (!handContainer || !isAppReady) return;

    const updateSprites = async () => {
      // SKIP updateSprites if a card selection is in progress
      // This prevents destroying the card during the transition animation
      if (selectionInProgressRef.current !== null) {
        return;
      }

      handContainer.removeChildren();
      cardContainersRef.current.clear();
      glowGraphicsRef.current.clear();

      // Preload all textures first so container creation is synchronous
      const textures = await Promise.all(
        visibleHand.map(cardId => cardId ? getCardTexture(cardId) : Promise.resolve(getPlaceholderTexture()))
      );

      for (let i = 0; i < visibleHand.length; i++) {
        const cardId = visibleHand[i];
        if (!cardId) continue;

        const pos = cardPositions[i];
        if (!pos) continue;

        const isPlayable = playableCards.has(cardId);
        const isWound = cardId === CARD_WOUND;
        const shouldDim = !isPlayable && !isWound;
        const cardColor = getCardColor(cardId);

        const texture = textures[i];

        // Create container for card
        const cardContainer = new Container();
        cardContainer.x = pos.x;
        cardContainer.y = pos.y;
        cardContainer.rotation = pos.rotation;
        cardContainer.pivot.set(cardWidth / 2, cardHeight); // Pivot at bottom center

        // Glow effect for playable cards - simple colored outline (no blur filter)
        if (isPlayable && cardColor) {
          const glowColor = GLOW_COLORS[cardColor] ?? 0xffffff;
          // Draw multiple layers for a soft glow effect
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
          cardContainer.addChild(glow);
          glowGraphicsRef.current.set(i, glow);
        }

        // Card sprite
        const sprite = new Sprite(texture);
        sprite.width = cardWidth;
        sprite.height = cardHeight;
        if (shouldDim) {
          sprite.tint = 0x666666;
          sprite.alpha = 0.7;
        }
        cardContainer.addChild(sprite);

        // Border/rounded corner mask effect
        const border = new Graphics();
        border.setStrokeStyle({ width: 2, color: 0x333333 });
        border.roundRect(0, 0, cardWidth, cardHeight, cardWidth * 0.04);
        border.stroke();
        cardContainer.addChild(border);

        // No PixiJS events - clicks handled via DOM
        cardContainer.eventMode = "none";

        // Set initial z-index
        cardContainer.zIndex = calculateZIndex(i, visibleHand.length, zIndexAnchor);

        handContainer.addChild(cardContainer);
        cardContainersRef.current.set(i, cardContainer);
      }

      handContainer.sortChildren();
    };

    updateSprites();
  // Note: zIndexAnchor and selectedIndex intentionally excluded
  // - z-index updates happen in the hover effect
  // - selectedIndex changes are handled by a separate effect (we don't want to recreate sprites just because a card was selected)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleHand, cardPositions, cardWidth, cardHeight, isAppReady, playableCards, getOriginalIndex, onCardClick, viewMode]);

  // Handle hover detection using DOM events (canvas has pointer-events: none)
  useEffect(() => {
    const handContainer = handContainerRef.current;
    if (!handContainer || !isAppReady) return;

    let lastHoveredIndex: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (viewMode === "board") return;

      // Don't process hover when an overlay is active OR when a card is selected
      // Keep the card raised so pie menu can animate smoothly from it
      if (isOverlayActive || selectedIndex !== null) {
        return;
      }

      // Convert screen position to hand container local position
      const localPos = handContainer.toLocal({ x: e.clientX, y: e.clientY });
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

    // Use document-level listener since canvas has pointer-events: none
    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isAppReady, viewMode, findCardAtPosition, isOverlayActive, selectedIndex]);

  // Handle card clicks via DOM events (canvas has pointer-events: none)
  useEffect(() => {
    const handContainer = handContainerRef.current;
    if (!handContainer || !isAppReady) return;

    const handleClick = (e: MouseEvent) => {
      if (viewMode === "board") return;

      // Don't intercept clicks when an overlay (like CardActionMenu) is active
      // This allows clicks on the menu to work properly
      if (isOverlayActive) return;

      // Convert screen position to hand container local position
      const localPos = handContainer.toLocal({ x: e.clientX, y: e.clientY });
      const cardIndex = findCardAtPosition(localPos.x, localPos.y);

      if (cardIndex !== null) {
        const cardId = visibleHand[cardIndex];
        const originalIndex = getOriginalIndex(cardIndex);

        if (cardId && playableCards.has(cardId)) {
          // Prevent the click from propagating to elements below
          e.stopPropagation();
          e.preventDefault();

          const container = cardContainersRef.current.get(cardIndex);
          const animManager = animationManagerRef.current;

          if (container && handContainer && animManager) {
            // Mark selection in progress to prevent other effects from interfering
            selectionInProgressRef.current = cardIndex;

            // Cancel any hover animation
            animManager.cancel(`card-hover-${cardIndex}`);

            // Calculate target: center of screen in LOCAL coordinates
            const screenCenterX = window.innerWidth / 2;
            const screenCenterY = window.innerHeight / 2;
            const targetLocal = handContainer.toLocal({ x: screenCenterX, y: screenCenterY });

            // Adjust for card pivot (bottom center) and SCALE
            // Card scales to MENU_CARD_SCALE, so its visual height is cardHeight * scale
            // To center the visual card, we need pivot at screenCenter + (visualHeight / 2)
            const scaledCardHeight = cardHeight * MENU_CARD_SCALE;
            const targetY = targetLocal.y + (scaledCardHeight / 2);

            // Bring card to front
            container.zIndex = 1000;
            handContainer.sortChildren();

            // Hide all OTHER cards so they don't show above pie menu
            cardContainersRef.current.forEach((otherContainer, idx) => {
              if (idx !== cardIndex) {
                otherContainer.alpha = 0;
              }
            });

            // ANIMATE RIGHT NOW - no waiting for React
            // Card scales up as it moves to center for emphasis
            animManager.animate(`card-to-center-${cardIndex}`, container, {
              endX: targetLocal.x,
              endY: targetY,
              endScale: MENU_CARD_SCALE,
              endRotation: 0,
              duration: CARD_TO_MENU_DURATION_MS,
              easing: Easing.easeOutCubic,
            });

            // Now notify parent (this triggers pie menu, but animation already started)
            const globalPos = container.getGlobalPosition();
            const viewConfig = VIEW_MODE_OFFSETS[viewMode];
            const scale = viewConfig.scale;
            const cardRect = new DOMRect(
              globalPos.x - (cardWidth * scale) / 2,
              globalPos.y - (cardHeight * scale),
              cardWidth * scale,
              cardHeight * scale
            );
            onCardClick({ index: originalIndex, rect: cardRect });
          }
        }
      }
    };

    // Use capture phase to intercept clicks before they reach elements below
    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [isAppReady, viewMode, findCardAtPosition, visibleHand, getOriginalIndex, playableCards, cardWidth, cardHeight, onCardClick, isOverlayActive]);

  // Track previous hovered index for animation
  const prevHoveredIndexRef = useRef<number | null>(null);

  // Handle hover animation and z-index updates
  useEffect(() => {
    const containers = cardContainersRef.current;
    const glowGraphics = glowGraphicsRef.current;
    const animManager = animationManagerRef.current;
    const prevHovered = prevHoveredIndexRef.current;

    const liftY = CARD_FAN_HOVER.liftY * 1.25; // 25% more lift

    // Update z-index for all cards
    visibleHand.forEach((_, index) => {
      const container = containers.get(index);
      if (container) {
        container.zIndex = calculateZIndex(index, visibleHand.length, zIndexAnchor);
      }
    });
    handContainerRef.current?.sortChildren();

    // Animate the previously hovered card back down (if different from current)
    // BUT: Don't animate the selected card back down - it's exiting the hand upward
    // Also check selectionInProgressRef which is set synchronously before React state updates
    const selectionInProgress = selectionInProgressRef.current;
    if (prevHovered !== null && prevHovered !== hoveredIndex && prevHovered !== selectedIndex && prevHovered !== selectionInProgress) {
      const prevContainer = containers.get(prevHovered);
      const prevPos = cardPositions[prevHovered];
      if (prevContainer && prevPos) {
        if (animManager) {
          animManager.animate(`card-hover-${prevHovered}`, prevContainer, {
            endY: prevPos.y,
            duration: HOVER_LIFT_DURATION_MS,
            easing: Easing.easeOutCubic,
          });
        } else {
          prevContainer.y = prevPos.y;
        }
        // Reset glow
        const prevGlow = glowGraphics.get(prevHovered);
        if (prevGlow) prevGlow.alpha = 1;
      }
    }

    // Animate the newly hovered card up
    // BUT: don't animate if this card is selected (it's being animated by click handler)
    if (hoveredIndex !== null && viewMode !== "board" && hoveredIndex !== selectedIndex && hoveredIndex !== selectionInProgress) {
      const container = containers.get(hoveredIndex);
      const pos = cardPositions[hoveredIndex];
      const cardId = visibleHand[hoveredIndex];
      if (container && pos) {
        const targetY = pos.y - liftY;
        if (animManager) {
          animManager.animate(`card-hover-${hoveredIndex}`, container, {
            endY: targetY,
            duration: HOVER_LIFT_DURATION_MS,
            easing: Easing.easeOutCubic,
          });
        } else {
          container.y = targetY;
        }
        // Enhance glow on hover
        const glow = glowGraphics.get(hoveredIndex);
        if (glow && cardId && playableCards.has(cardId)) {
          glow.alpha = 1.5;
        }
      }
    }
    // Note: if hoveredIndex === selectedIndex or selectionInProgress, we skip hover animation
    // because the card is being animated by the click handler

    prevHoveredIndexRef.current = hoveredIndex;
  }, [hoveredIndex, zIndexAnchor, visibleHand, cardPositions, playableCards, viewMode, selectedIndex]);

  // Update position, scale, and visibility based on view mode
  useEffect(() => {
    if (!handContainerRef.current) return;

    const viewConfig = VIEW_MODE_OFFSETS[viewMode];
    const handContainer = handContainerRef.current;
    const animManager = animationManagerRef.current;
    const prevViewMode = prevViewModeRef.current;
    const isViewModeChange = prevViewMode !== viewMode;

    // The hand container uses bottom-center pivot for all modes
    // This matches CSS transform-origin: bottom center
    handContainer.pivot.set(containerWidth / 2, containerHeight);

    // Base position: horizontally centered, bottom of screen
    const baseX = screenDimensions.width / 2;
    const baseY = screenDimensions.height;

    // yOffset is a percentage of screen height (positive = down, negative = up)
    // This matches CSS translateY behavior
    const yOffset = viewConfig.yOffset * screenDimensions.height;

    // Calculate target position and scale
    const targetX: number = baseX;
    const targetY: number = baseY + yOffset;
    let targetScale: number = viewConfig.scale;

    // For focus mode, constrain scale to fit on screen
    if (viewMode === "focus") {
      // Calculate max scale that fits cards on screen with some padding
      const horizontalPadding = 40; // 20px on each side
      const maxScaledWidth = screenDimensions.width - horizontalPadding;
      const maxHorizontalScale = maxScaledWidth / containerWidth;

      // Also ensure cards don't get cut off vertically
      const verticalPadding = 60; // Space for top bar and bottom
      const availableHeight = screenDimensions.height - verticalPadding;
      const maxVerticalScale = availableHeight / containerHeight;

      // Use the smaller of: desired scale, max horizontal, max vertical
      targetScale = Math.min(viewConfig.scale, maxHorizontalScale, maxVerticalScale);
    }

    // Show container before animating in (but hide if going to board mode)
    if (viewConfig.visible) {
      handContainer.visible = true;
      handContainer.eventMode = "static";
    }

    // Animate the transition if view mode changed and we have an animation manager
    if (isViewModeChange && animManager && viewConfig.visible) {
      animManager.animate("hand-view-mode", handContainer, {
        endX: targetX,
        endY: targetY,
        endScale: targetScale,
        duration: VIEW_MODE_TRANSITION_MS,
        easing: Easing.easeOutCubic,
        onComplete: () => {
          // Hide container after animating out
          if (!viewConfig.visible) {
            handContainer.visible = false;
            handContainer.eventMode = "none";
          }
        },
      });
    } else {
      // Instant update (initial load or hidden mode)
      handContainer.x = targetX;
      handContainer.y = targetY;
      handContainer.scale.set(targetScale);
      handContainer.visible = viewConfig.visible;
      handContainer.eventMode = viewConfig.visible ? "static" : "none";
    }

    // Update ref for next comparison
    prevViewModeRef.current = viewMode;
  }, [viewMode, screenDimensions.width, screenDimensions.height, containerWidth, containerHeight]);

  // CSS classes for view mode
  const handClassName = [
    "floating-hand",
    `floating-hand--${viewMode}`,
  ].filter(Boolean).join(" ");

  // The DOM container is invisible but needed for click position calculations
  // The actual rendering happens in PixiJS overlay layer
  return (
    <div
      ref={containerRef}
      className={handClassName}
      style={{
        width: containerWidth,
        height: containerHeight,
        pointerEvents: visibleHand.length > 0 ? "none" : "none", // PixiJS handles events
      }}
    >
      {/* PixiJS renders cards in overlay layer - this div is just for positioning reference */}
    </div>
  );
}

// Re-export DeckDiscardIndicator from original for compatibility
export { DeckDiscardIndicator } from "./FloatingHand";
