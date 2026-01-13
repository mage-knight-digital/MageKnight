import { useState, useEffect, useCallback, useRef, memo, useMemo } from "react";
import type { CardId, PlayableCard } from "@mage-knight/shared";
import { loadAtlas, getCardSpriteStyle, getCardColor } from "../../utils/cardAtlas";
import "./FloatingHand.css";

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
  onCardClick: (index: number) => void;
}

// Calculate card position based on index and total cards
// Exported so the parent can use the same logic for hit testing
function getCardLayout(index: number, totalCards: number, cardWidth: number, collapsed: boolean = false) {
  const centerIndex = (totalCards - 1) / 2;
  const offsetFromCenter = index - centerIndex;

  // When collapsed, stack cards tightly like a pile
  if (collapsed) {
    const spreadDistance = 8; // Very tight overlap
    const rotationPerCard = 0.5; // Minimal rotation

    const spreadX = offsetFromCenter * spreadDistance;
    const rotation = offsetFromCenter * rotationPerCard;
    const arcY = 0;
    return { spreadX, rotation, arcY, cardWidth, spreadDistance };
  }

  // Dynamic spread - compress as hand grows
  // Few cards (1-5): 70px spread, comfortable viewing
  // Medium hand (6-8): 50px spread, slightly tighter
  // Large hand (9+): 35px spread, dense but readable
  let spreadDistance: number;
  let rotationPerCard: number;
  let arcPerCard: number;

  if (totalCards <= 5) {
    spreadDistance = 70;
    rotationPerCard = 3;
    arcPerCard = 8;
  } else if (totalCards <= 8) {
    spreadDistance = 50;
    rotationPerCard = 2.5;
    arcPerCard = 6;
  } else {
    spreadDistance = 35;
    rotationPerCard = 2;
    arcPerCard = 4;
  }

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
  onCardClick,
}: FloatingCardProps) {
  // Memoize sprite style - only recalculate if cardId changes
  const spriteStyle = useMemo(() => getCardSpriteStyle(cardId, 180), [cardId]);
  const cardColor = useMemo(() => getCardColor(cardId), [cardId]);

  const handleClick = useCallback(() => {
    onCardClick(originalIndex);
  }, [onCardClick, originalIndex]);

  const cardWidth = typeof spriteStyle?.width === "number" ? spriteStyle.width : 120;
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

  const classNames = [
    "floating-card",
    isSelected ? "floating-card--selected" : "",
    isPlayable ? "floating-card--playable" : "",
    isHovered ? "floating-card--hovered" : "",
    isNew ? "floating-card--dealing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Card wrapper style - positioning only
  const wrapperStyle: React.CSSProperties = {
    transform: `translateX(${spreadX}px) translateY(${arcY}px) rotate(${rotation}deg)`,
    zIndex,
    width: spriteStyle?.width,
    height: spriteStyle?.height,
  };

  // Card style with hover zoom effect
  const cardStyle: React.CSSProperties = {
    ...spriteStyle,
    transform: isHovered ? "scale(2.5) translateY(-20px)" : "scale(1)",
    opacity: isPlayable ? 1 : 0.6,
    "--glow-color": glowColor,
    ...(isNew && { animationDelay: `${dealDelay}s` }),
  } as React.CSSProperties;

  return (
    <div
      className={`floating-card-wrapper ${!isPlayable ? "floating-card-wrapper--disabled" : ""}`}
      style={wrapperStyle}
      onClick={isPlayable ? handleClick : undefined}
      data-card-index={index}
      data-testid={`floating-card-${cardId}`}
    >
      <div className={classNames} style={cardStyle}>
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
  onCardClick: (index: number) => void;
  deckCount: number;
  discardCount: number;
  collapsed?: boolean;
}

export function FloatingHand({
  hand,
  playableCards,
  selectedIndex,
  onCardClick,
  deckCount,
  discardCount,
  collapsed = false,
}: FloatingHandProps) {
  const [atlasLoaded, setAtlasLoaded] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isHoveringHand, setIsHoveringHand] = useState(false);

  // Track which cards are newly dealt for animation
  const prevHandLengthRef = useRef<number>(hand.length); // Initialize to current length
  const isFirstRenderRef = useRef<boolean>(true);
  const [newCardIndices, setNewCardIndices] = useState<Set<number>>(new Set());

  // When collapsed, hovering expands temporarily
  const effectivelyCollapsed = collapsed && !isHoveringHand;

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
      // Always set hovering state when mouse moves over hand
      if (!isHoveringHand) {
        setIsHoveringHand(true);
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

      const cardWidth = 120;
      const cardHeight = 180;

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
    [selectedIndex, visibleHand.length, isHoveringHand]
  );

  const handleMouseLeave = useCallback(() => {
    if (hoveredIndexRef.current !== null) {
      hoveredIndexRef.current = null;
      setHoveredIndex(null);
    }
    setIsHoveringHand(false);
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
  const cardWidth = 120;
  const { spreadDistance } = getCardLayout(0, visibleHand.length, cardWidth, effectivelyCollapsed);
  // Total span = (n-1) * spreadDistance + card width
  // Add extra padding to account for hover zoom (2.5x scale)
  const baseWidth = Math.max(cardWidth, (visibleHand.length - 1) * spreadDistance + cardWidth);
  const cardsWidth = effectivelyCollapsed ? cardWidth + 60 : baseWidth + 100; // Narrower when collapsed

  // Use collapsed prop directly for CSS class - CSS :hover handles the visual expansion
  // But use effectivelyCollapsed for card layout (fan vs stack)
  const handClassName = [
    "floating-hand",
    collapsed && "floating-hand--collapsed",
    collapsed && isHoveringHand && "floating-hand--expanded",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={handClassName}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={() => setIsHoveringHand(true)}
    >
      {/* Deck indicator - left side */}
      <div className="floating-hand__deck" title={`${deckCount} cards in deck`}>
        <img
          src="/assets/cards/card_back.jpg"
          alt="Deck"
          className="floating-hand__deck-image"
        />
        <span className="floating-hand__deck-count">{deckCount}</span>
      </div>

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
              isCollapsed={effectivelyCollapsed}
              isNew={isNew}
              dealDelay={dealDelay}
              onCardClick={onCardClick}
            />
          );
        })}
      </div>

      {/* Discard indicator - right side */}
      <div className="floating-hand__discard" title={`${discardCount} cards in discard`}>
        <div className="floating-hand__discard-pile" />
        <span className="floating-hand__discard-count">{discardCount}</span>
      </div>
    </div>
  );
}
