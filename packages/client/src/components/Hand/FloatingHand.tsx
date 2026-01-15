import { useState, useEffect, useCallback, useRef, memo, useMemo } from "react";
import { CARD_WOUND, type CardId, type PlayableCard } from "@mage-knight/shared";
import { loadAtlas, getCardSpriteStyle, getCardColor } from "../../utils/cardAtlas";
import "./FloatingHand.css";

// Hand view modes
export type HandViewMode = "board" | "ready" | "focus";

// Card size multipliers for each view mode
const VIEW_CARD_SCALE: Record<HandViewMode, number> = {
  board: 0.25,  // Same as ready (hidden off screen anyway)
  ready: 0.25,  // Ready stance - 25% of viewport height
  focus: 0.40,  // Focus mode - 40% of viewport height (bigger but not overwhelming)
};

// Hook to get responsive card dimensions based on view mode
function useCardDimensions(viewMode: HandViewMode) {
  const [dimensions, setDimensions] = useState({ cardWidth: 120, cardHeight: 180 });

  useEffect(() => {
    const updateDimensions = () => {
      const scale = VIEW_CARD_SCALE[viewMode];
      const cardHeight = Math.round(window.innerHeight * scale);
      const cardWidth = Math.round(cardHeight * 0.667); // 2:3 aspect ratio
      setDimensions({ cardWidth, cardHeight });
    };

    updateDimensions();

    // Update on resize
    window.addEventListener("resize", updateDimensions);
    return () => {
      window.removeEventListener("resize", updateDimensions);
    };
  }, [viewMode]);

  return dimensions;
}

// Info passed when a card is clicked
export interface CardClickInfo {
  index: number;
  rect: DOMRect;
}

interface FloatingCardProps {
  cardId: CardId;
  index: number;
  originalIndex: number;
  totalCards: number;
  isSelected: boolean;
  isPlayable: boolean;
  isHovered: boolean;
  isCollapsed: boolean;
  isNew: boolean;
  dealDelay: number;
  cardWidth: number;
  cardHeight: number;
  onCardClick: (info: CardClickInfo) => void;
}

// Calculate card position based on index and total cards
// Exported so the parent can use the same logic for hit testing
// collapsed param no longer affects layout - cards stay fanned out
function getCardLayout(index: number, totalCards: number, cardWidth: number, _collapsed: boolean = false) {
  const centerIndex = (totalCards - 1) / 2;
  const offsetFromCenter = index - centerIndex;

  // Scale spread distances relative to card width (base: 120px)
  const scaleFactor = cardWidth / 120;

  // Dynamic spread - compress as hand grows
  // Few cards (1-5): 70px spread (at 120px width), comfortable viewing
  // Medium hand (6-8): 50px spread, slightly tighter
  // Large hand (9+): 35px spread, dense but readable
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

  // Scale spread and arc with card size
  const spreadDistance = baseSpread * scaleFactor;
  const arcPerCard = baseArc * scaleFactor;

  const spreadX = offsetFromCenter * spreadDistance;
  const rotation = offsetFromCenter * rotationPerCard;
  const arcY = Math.abs(offsetFromCenter) * arcPerCard;
  return { spreadX, rotation, arcY, cardWidth, spreadDistance };
}

const FloatingCard = memo(function FloatingCard({
  cardId,
  index,
  originalIndex,
  totalCards,
  isSelected,
  isPlayable,
  isHovered,
  isCollapsed,
  isNew,
  dealDelay,
  cardWidth,
  cardHeight,
  onCardClick,
}: FloatingCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Memoize sprite style - recalculate if cardId or dimensions change
  const spriteStyle = useMemo(() => getCardSpriteStyle(cardId, cardHeight), [cardId, cardHeight]);
  const cardColor = useMemo(() => getCardColor(cardId), [cardId]);

  const handleClick = useCallback(() => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      onCardClick({ index: originalIndex, rect });
    }
  }, [onCardClick, originalIndex]);

  const { spreadX, rotation, arcY } = getCardLayout(
    index,
    totalCards,
    cardWidth,
    isCollapsed
  );

  // Z-index: hovered cards come to front
  const zIndex = isHovered ? 100 : 50 + index;

  // Color-coded glow for playable cards
  const glowColor = cardColor
    ? {
        red: "rgba(231, 76, 60, 0.6)",
        blue: "rgba(52, 152, 219, 0.6)",
        green: "rgba(46, 204, 113, 0.6)",
        white: "rgba(236, 240, 241, 0.6)",
      }[cardColor] || "rgba(255, 255, 255, 0.3)"
    : "rgba(255, 255, 255, 0.3)";

  // Wounds are never dimmed - they should stay visually prominent as a penalty
  const isWound = cardId === CARD_WOUND;
  const shouldDim = !isPlayable && !isWound;

  const classNames = [
    "floating-card",
    isSelected ? "floating-card--selected" : "",
    isPlayable ? "floating-card--playable" : "",
    shouldDim ? "floating-card--unplayable" : "",
    isHovered ? "floating-card--hovered" : "",
    isNew ? "floating-card--dealing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Card wrapper style - positioning only
  const wrapperStyle: React.CSSProperties = {
    transform: `translateX(${spreadX}px) translateY(${arcY}px) rotate(${rotation}deg)`,
    zIndex,
    width: cardWidth,
    height: cardHeight,
  };

  // Card style with subtle hover effect (cards are already big enough in each view)
  const cardStyle: React.CSSProperties = {
    ...spriteStyle,
    transform: isHovered ? "scale(1.1) translateY(-10px)" : "scale(1)",
    "--glow-color": glowColor,
    ...(isNew && { animationDelay: `${dealDelay}s` }),
  } as React.CSSProperties;

  return (
    <div
      className={`floating-card-wrapper ${!isPlayable ? "floating-card-wrapper--disabled" : ""}`}
      style={wrapperStyle}
      onClick={isPlayable ? handleClick : undefined}
      data-card-index={index}
      data-testid={`hand-card-${cardId}`}
    >
      <div ref={cardRef} className={classNames} style={cardStyle}>
        {!spriteStyle && (
          <span className="floating-card__fallback">{cardId}</span>
        )}
      </div>
    </div>
  );
});

interface FloatingHandProps {
  hand: readonly CardId[];
  playableCards: Map<CardId, PlayableCard>;
  selectedIndex: number | null;
  onCardClick: (info: CardClickInfo) => void;
  deckCount: number;
  discardCount: number;
  viewMode: HandViewMode;
}

export function FloatingHand({
  hand,
  playableCards,
  selectedIndex,
  onCardClick,
  deckCount,
  discardCount,
  viewMode,
}: FloatingHandProps) {
  const [atlasLoaded, setAtlasLoaded] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { cardWidth, cardHeight } = useCardDimensions(viewMode);

  // Track which cards are newly dealt for animation
  const prevHandLengthRef = useRef<number>(hand.length); // Initialize to current length
  const isFirstRenderRef = useRef<boolean>(true);
  const [newCardIndices, setNewCardIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadAtlas().then(() => setAtlasLoaded(true));
  }, []);

  // Detect newly added cards - if hand grew, the new cards are at the end
  useEffect(() => {
    // Skip animation on first render
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevHandLengthRef.current = hand.length;
      return;
    }

    const prevLength = prevHandLengthRef.current;
    const currentLength = hand.length;

    // If hand grew from a non-zero state, animate only the new cards
    // If hand grew from zero (new round), animate all cards
    if (currentLength > prevLength) {
      const newIndices = new Set<number>();
      const startIndex = prevLength === 0 ? 0 : prevLength;
      for (let i = startIndex; i < currentLength; i++) {
        newIndices.add(i);
      }
      setNewCardIndices(newIndices);

      // Clear the "new" state after animation completes
      const newCount = newIndices.size;
      const animationDuration = 480 + (newCount * 180); // base + stagger
      setTimeout(() => setNewCardIndices(new Set()), animationDuration);
    }

    prevHandLengthRef.current = currentLength;
  }, [hand]);

  // Clear hover when a card is selected (modal opens)
  useEffect(() => {
    if (selectedIndex !== null) {
      setHoveredIndex(null);
    }
  }, [selectedIndex]);

  // Filter out the selected card - it's shown in the expanded view
  const visibleHand =
    selectedIndex !== null
      ? hand.filter((_, i) => i !== selectedIndex)
      : hand;

  // Track hovered index in a ref to avoid unnecessary state updates
  const hoveredIndexRef = useRef<number | null>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  // Hit test using ORIGINAL stacking order (higher index = on top)
  // This ignores the visual z-index boost when a card is hovered
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Only do card hover detection in ready or focus mode
      if (viewMode === "board") {
        if (hoveredIndexRef.current !== null) {
          hoveredIndexRef.current = null;
          setHoveredIndex(null);
        }
        return;
      }

      if (selectedIndex !== null) {
        if (hoveredIndexRef.current !== null) {
          hoveredIndexRef.current = null;
          setHoveredIndex(null);
        }
        return;
      }
      if (!cardsRef.current) return;

      const cardsRect = cardsRef.current.getBoundingClientRect();
      const containerCenterX = cardsRect.left + cardsRect.width / 2;
      const mouseX = e.clientX;
      const mouseY = e.clientY;

      // Check if mouse is within vertical card area
      const cardsBottom = cardsRect.bottom - 10;
      const cardsTop = cardsBottom - cardHeight - 40;
      if (mouseY < cardsTop || mouseY > cardsBottom) {
        if (hoveredIndexRef.current !== null) {
          hoveredIndexRef.current = null;
          setHoveredIndex(null);
        }
        return;
      }

      // Find the topmost card (by ORIGINAL index, not current z-index)
      // that contains the mouse position
      // Higher index = originally on top, so iterate high to low and take first match
      let hitCard: number | null = null;
      for (let i = visibleHand.length - 1; i >= 0; i--) {
        const { spreadX } = getCardLayout(i, visibleHand.length, cardWidth);
        const cardCenterX = containerCenterX + spreadX;
        const cardLeft = cardCenterX - cardWidth / 2;
        const cardRight = cardCenterX + cardWidth / 2;

        if (mouseX >= cardLeft && mouseX <= cardRight) {
          hitCard = i;
          break; // Take the first (topmost in original order) match
        }
      }

      if (hoveredIndexRef.current !== hitCard) {
        hoveredIndexRef.current = hitCard;
        setHoveredIndex(hitCard);
      }
    },
    [selectedIndex, visibleHand.length, viewMode, cardWidth, cardHeight]
  );

  const handleMouseLeave = useCallback(() => {
    if (hoveredIndexRef.current !== null) {
      hoveredIndexRef.current = null;
      setHoveredIndex(null);
    }
  }, []);

  // Recalculate indices for positioning (skip the gap)
  const getOriginalIndex = (visibleIndex: number): number => {
    if (selectedIndex === null) return visibleIndex;
    return visibleIndex >= selectedIndex ? visibleIndex + 1 : visibleIndex;
  };

  if (!atlasLoaded) {
    return (
      <div className="floating-hand floating-hand--loading">
        Loading cards...
      </div>
    );
  }

  // Calculate the width needed for the cards based on dynamic spread
  // Get the spread distance for this hand size
  const { spreadDistance } = getCardLayout(0, visibleHand.length, cardWidth);
  // Total span = (n-1) * spreadDistance + card width
  // Add extra padding to account for hover zoom
  const baseWidth = Math.max(cardWidth, (visibleHand.length - 1) * spreadDistance + cardWidth);
  const cardsWidth = baseWidth + 100;

  // CSS classes based on view mode
  const handClassName = [
    "floating-hand",
    `floating-hand--${viewMode}`,
  ].filter(Boolean).join(" ");

  // Deck/discard indicator class - hidden in board mode (when hand is hidden)
  const deckDiscardClassName = [
    "floating-hand__deck-discard",
    viewMode === "board" && "floating-hand__deck-discard--hidden",
  ].filter(Boolean).join(" ");

  return (
    <>
      {/* Deck and Discard - fixed position in bottom right, independent of hand */}
      <div className={deckDiscardClassName}>
        <div className="floating-hand__deck" title={`${deckCount} cards in deck`}>
          <img
            src="/assets/cards/card_back.jpg"
            alt="Deck"
            className="floating-hand__deck-image"
          />
          <span className="floating-hand__deck-count">{deckCount}</span>
        </div>
        <div className="floating-hand__discard" title={`${discardCount} cards in discard`}>
          <div className="floating-hand__discard-pile" />
          <span className="floating-hand__discard-count">{discardCount}</span>
        </div>
      </div>

      {/* Card hand - moves with view mode */}
      <div
        className={handClassName}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="floating-hand__cards" ref={cardsRef} style={{ width: cardsWidth }}>
          {visibleHand.map((cardId, visibleIndex) => {
            const originalIndex = getOriginalIndex(visibleIndex);
            const isPlayable = playableCards.has(cardId);
            // Check if this card is newly dealt (by original index in hand)
            const isNew = newCardIndices.has(originalIndex);
            // Calculate staggered delay based on position among new cards
            const newIndicesArray = Array.from(newCardIndices).sort((a, b) => a - b);
            const newCardPosition = newIndicesArray.indexOf(originalIndex);
            const dealDelay = isNew ? 0.08 + newCardPosition * 0.18 : 0;
            return (
              <FloatingCard
                key={`${cardId}-${originalIndex}`}
                cardId={cardId}
                index={visibleIndex}
                originalIndex={originalIndex}
                totalCards={visibleHand.length}
                isSelected={false}
                isPlayable={isPlayable}
                isHovered={hoveredIndex === visibleIndex}
                isCollapsed={false}
                isNew={isNew}
                dealDelay={dealDelay}
                cardWidth={cardWidth}
                cardHeight={cardHeight}
                onCardClick={onCardClick}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}
