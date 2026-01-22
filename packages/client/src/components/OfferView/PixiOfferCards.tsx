/**
 * PixiOfferCards - PixiJS-based card rendering for offer panes
 *
 * Renders card sprites entirely in PixiJS with pre-uploaded GPU textures.
 * This eliminates the 300-500ms jank from DOM/CSS image decoding.
 *
 * Uses the shared PixiJS Application from PixiAppContext instead of creating
 * its own Application, avoiding WebGL context conflicts.
 *
 * Features:
 * - Single PixiJS canvas for all cards with hover/interaction
 * - Textures pre-loaded via Assets.load() during app init
 * - Minimal DOM overlay only for acquire button
 * - Responsive sizing based on container width
 */

import { useEffect, useRef, useState, useMemo, useId, useCallback } from "react";
import { Sprite, Graphics, Container } from "pixi.js";
import { usePixiApp } from "../../contexts/PixiAppContext";
import { getOfferCardTexture } from "../../utils/pixiTextureLoader";

export interface CardInfo {
  id: string;
  canAcquire: boolean;
  acquireLabel?: string;
  isElite?: boolean;
  onAcquire?: () => void;
}

interface PixiOfferCardsProps {
  cards: CardInfo[];
  cardHeight: number;
  type: "unit" | "spell" | "aa";
  /** Whether this offer pane is currently visible (for tab switching) */
  visible?: boolean;
}

// Card aspect ratio (width / height)
const CARD_ASPECT = 0.714;
const CARD_GAP = 24; // 1.5rem

// Border colors by type
const BORDER_COLORS: Record<string, number> = {
  unit: 0x7f8c8d,
  unit_elite: 0xf39c12,
  spell: 0x9b59b6,
  aa: 0xe67e22,
};

/**
 * Generate a pseudo-random rotation based on card ID and index
 */
function getHoverRotation(cardId: string, index: number): number {
  let hash = 0;
  const str = `${cardId}-${index}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const positive = Math.abs(hash);
  const sign = hash >= 0 ? 1 : -1;
  const magnitude = 0.5 + (positive % 16) / 10;
  return sign * magnitude * (Math.PI / 180); // Convert to radians
}

export function PixiOfferCards({ cards, cardHeight, type, visible = true }: PixiOfferCardsProps) {
  const uniqueId = useId();
  const { app, overlayLayer } = usePixiApp();

  const containerRef = useRef<HTMLDivElement>(null);
  const rootContainerRef = useRef<Container | null>(null);
  const cardContainersRef = useRef<Map<number, Container>>(new Map());
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [buttonPosition, setButtonPosition] = useState<{ x: number; y: number; width: number } | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [screenPosition, setScreenPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const cardWidth = Math.round(cardHeight * CARD_ASPECT);

  // Calculate ideal canvas dimensions based on card count
  const idealCanvasWidth = useMemo(() => {
    if (cards.length === 0) return 300;
    // Cards in a row with gaps + extra padding for hover scale
    return cards.length * cardWidth + (cards.length - 1) * CARD_GAP + 40;
  }, [cards.length, cardWidth]);

  // Use container width to determine if we need to scale down
  const scaleFactor = useMemo(() => {
    if (containerWidth === 0 || idealCanvasWidth <= containerWidth) return 1;
    return containerWidth / idealCanvasWidth;
  }, [containerWidth, idealCanvasWidth]);

  // Actual canvas dimensions (may be scaled down to fit)
  const canvasWidth = Math.round(idealCanvasWidth * scaleFactor);
  const canvasHeight = Math.round((cardHeight + 60) * scaleFactor); // Extra space for hover lift

  // Scaled card dimensions
  const scaledCardWidth = Math.round(cardWidth * scaleFactor);
  const scaledCardHeight = Math.round(cardHeight * scaleFactor);
  const scaledGap = Math.round(CARD_GAP * scaleFactor);

  // Track container width and screen position for responsive scaling
  // Also update when visibility changes since DOM position may have changed
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      const parentWidth = container.parentElement?.clientWidth ?? window.innerWidth;
      setContainerWidth(parentWidth - 48); // Account for padding

      const rect = container.getBoundingClientRect();
      setScreenPosition({ x: rect.left, y: rect.top });
    };

    // Update immediately and when visibility changes
    // Use requestAnimationFrame to ensure DOM has settled after visibility change
    if (visible) {
      requestAnimationFrame(updateDimensions);
    }

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [visible]);

  // Card base positions (before hover transforms) - uses scaled dimensions
  // Only depends on cards.length, not cards content (positions don't change when card IDs change)
  const cardPositions = useMemo(() => {
    const padding = 20 * scaleFactor;
    const topPadding = 30 * scaleFactor;
    return cards.map((_, index) => ({
      x: padding + index * (scaledCardWidth + scaledGap) + scaledCardWidth / 2, // Center anchor
      y: topPadding + scaledCardHeight / 2, // Center anchor with top padding
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length, scaledCardWidth, scaledCardHeight, scaledGap, scaleFactor]);

  // Stable hover handlers using useCallback
  const handlePointerEnter = useCallback((cardIndex: number) => {
    setHoveredIndex(cardIndex);
  }, []);

  const handlePointerLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  const handlePointerDown = useCallback((card: CardInfo) => {
    if (card.canAcquire && card.onAcquire) {
      card.onAcquire();
    }
  }, []);

  // Create root container and add to overlay layer
  // Container stays in overlay layer but visibility is controlled
  useEffect(() => {
    if (!app || !overlayLayer) return;

    // Create root container for this offer cards instance
    const rootContainer = new Container();
    rootContainer.label = `offer-cards-${uniqueId}`;
    rootContainer.visible = false; // Start hidden
    overlayLayer.addChild(rootContainer);
    rootContainerRef.current = rootContainer;

    // Capture ref for cleanup
    const cardContainers = cardContainersRef.current;

    return () => {
      if (rootContainerRef.current) {
        if (rootContainerRef.current.parent) {
          rootContainerRef.current.parent.removeChild(rootContainerRef.current);
        }
        rootContainerRef.current.destroy({ children: true });
        rootContainerRef.current = null;
      }
      cardContainers.clear();
    };
  }, [app, overlayLayer, uniqueId]);

  // Control visibility and position - only show when visible AND position is valid
  useEffect(() => {
    const rootContainer = rootContainerRef.current;
    if (!rootContainer) return;

    if (visible) {
      // When becoming visible, update position from DOM then show
      const domContainer = containerRef.current;
      if (domContainer) {
        // Use requestAnimationFrame to ensure DOM has laid out
        requestAnimationFrame(() => {
          if (!rootContainerRef.current) return;
          const rect = domContainer.getBoundingClientRect();
          rootContainerRef.current.position.set(rect.left, rect.top);
          rootContainerRef.current.visible = true;
        });
      }
    } else {
      rootContainer.visible = false;
    }
  }, [visible]);

  // Update container position when screen position changes (only when visible)
  useEffect(() => {
    const rootContainer = rootContainerRef.current;
    if (!rootContainer || !visible) return;

    rootContainer.position.set(screenPosition.x, screenPosition.y);
  }, [screenPosition, visible]);

  // Update sprites when cards change
  useEffect(() => {
    const rootContainer = rootContainerRef.current;
    if (!rootContainer || !app) return;

    const updateSprites = async () => {
      // Clear old children
      rootContainer.removeChildren();
      cardContainersRef.current.clear();

      // Add new card containers
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        if (!card) continue;

        const pos = cardPositions[i];
        if (!pos) continue;

        const texture = await getOfferCardTexture(card.id, type);

        // Create container for card + border
        const cardContainer = new Container();
        cardContainer.x = pos.x;
        cardContainer.y = pos.y;
        cardContainer.pivot.set(scaledCardWidth / 2, scaledCardHeight / 2);

        // Card sprite - uses scaled dimensions
        const sprite = new Sprite(texture);
        sprite.width = scaledCardWidth;
        sprite.height = scaledCardHeight;
        cardContainer.addChild(sprite);

        // Border graphics
        const borderColor = type === "unit" && card.isElite
          ? BORDER_COLORS['unit_elite']
          : BORDER_COLORS[type];
        const border = new Graphics();
        border.setStrokeStyle({ width: Math.max(2, 3 * scaleFactor), color: borderColor });
        border.roundRect(0, 0, scaledCardWidth, scaledCardHeight, scaledCardWidth * 0.04);
        border.stroke();
        cardContainer.addChild(border);

        // Make interactive
        cardContainer.eventMode = "static";
        cardContainer.cursor = "pointer";

        const cardIndex = i; // Capture for closure
        const cardRef = card; // Capture for closure
        cardContainer.on("pointerenter", () => handlePointerEnter(cardIndex));
        cardContainer.on("pointerleave", handlePointerLeave);
        cardContainer.on("pointerdown", () => handlePointerDown(cardRef));

        rootContainer.addChild(cardContainer);
        cardContainersRef.current.set(i, cardContainer);
      }
    };

    updateSprites();
  }, [cards, cardPositions, scaledCardWidth, scaledCardHeight, scaleFactor, app, type, handlePointerEnter, handlePointerLeave, handlePointerDown]);

  // Handle hover animation
  useEffect(() => {
    const containers = cardContainersRef.current;

    cards.forEach((card, index) => {
      const container = containers.get(index);
      if (!container) return;

      const pos = cardPositions[index];
      if (!pos) return;

      const isHovered = hoveredIndex === index;
      const canAcquire = card.canAcquire;

      if (isHovered) {
        const rotation = getHoverRotation(card.id, index);
        const liftY = (canAcquire ? -15 : -8) * scaleFactor;
        const scale = canAcquire ? 1.05 : 1;

        container.rotation = rotation;
        container.y = pos.y + liftY;
        container.scale.set(scale);
        container.zIndex = 10;

        // Update button position for DOM overlay
        if (card.onAcquire) {
          // Calculate position relative to screen (container is at screenPosition)
          const localX = pos.x;
          const localY = pos.y + liftY;
          setButtonPosition({
            x: localX - (scaledCardWidth * scale) / 2,
            y: localY + (scaledCardHeight * scale) / 2 - 40 * scaleFactor,
            width: scaledCardWidth * scale,
          });
        }
      } else {
        container.rotation = 0;
        container.y = pos.y;
        container.scale.set(1);
        container.zIndex = 1;
      }
    });

    // Sort by zIndex
    rootContainerRef.current?.sortChildren();

    // Clear button position when not hovering
    if (hoveredIndex === null) {
      setButtonPosition(null);
    }
  }, [hoveredIndex, cards, cardPositions, scaledCardWidth, scaledCardHeight, scaleFactor]);

  if (cards.length === 0) {
    return <div className="offer-pane__empty">No {type}s available</div>;
  }

  const hoveredCard = hoveredIndex !== null ? cards[hoveredIndex] : null;

  return (
    <div
      ref={containerRef}
      className="pixi-offer-cards"
      style={{
        position: "relative",
        width: canvasWidth,
        height: canvasHeight,
        margin: "0 auto",
      }}
    >
      {/* Acquire button overlay - only shown when hovering a card with onAcquire */}
      {visible && hoveredCard?.onAcquire && buttonPosition && (
        <button
          className={`offer-card__acquire-btn ${!hoveredCard.canAcquire ? "offer-card__acquire-btn--disabled" : ""}`}
          style={{
            position: "absolute",
            left: buttonPosition.x + 8,
            top: buttonPosition.y,
            width: buttonPosition.width - 16,
            opacity: 1,
            transform: "translateY(0)",
            zIndex: 100,
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (hoveredCard.canAcquire && hoveredCard.onAcquire) {
              hoveredCard.onAcquire();
            }
          }}
          disabled={!hoveredCard.canAcquire}
        >
          {hoveredCard.acquireLabel || "Acquire"}
        </button>
      )}
    </div>
  );
}
