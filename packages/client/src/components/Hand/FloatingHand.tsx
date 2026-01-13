import { useState, useEffect, useRef, useCallback } from "react";
import type { CardId, PlayableCard } from "@mage-knight/shared";
import { loadAtlas, getCardSpriteStyle, getCardColor } from "../../utils/cardAtlas";
import "./FloatingHand.css";

interface FloatingCardProps {
  cardId: CardId;
  index: number;
  totalCards: number;
  isSelected: boolean;
  isPlayable: boolean;
  isHovered: boolean;
  onClick: () => void;
}

// Calculate card position based on index and total cards
// Exported so the parent can use the same logic for hit testing
function getCardLayout(index: number, totalCards: number, cardWidth: number) {
  const centerIndex = (totalCards - 1) / 2;
  const offsetFromCenter = index - centerIndex;
  const spreadX = offsetFromCenter * 70;
  const rotation = offsetFromCenter * 3;
  const arcY = Math.abs(offsetFromCenter) * 8;
  return { spreadX, rotation, arcY, cardWidth };
}

function FloatingCard({
  cardId,
  index,
  totalCards,
  isSelected,
  isPlayable,
  isHovered,
  onClick,
}: FloatingCardProps) {
  const spriteStyle = getCardSpriteStyle(cardId, 180);
  const cardColor = getCardColor(cardId);

  const cardWidth = typeof spriteStyle?.width === "number" ? spriteStyle.width : 120;
  const { spreadX, rotation, arcY } = getCardLayout(
    index,
    totalCards,
    cardWidth
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

  // Card style - this scales and lifts on hover
  const cardStyle: React.CSSProperties = {
    ...spriteStyle,
    transform: isHovered ? "scale(2.5) translateY(-20px)" : "scale(1)",
    opacity: isPlayable ? 1 : 0.6,
    "--glow-color": glowColor,
  } as React.CSSProperties;

  return (
    <div
      className={`floating-card-wrapper ${!isPlayable ? "floating-card-wrapper--disabled" : ""}`}
      style={wrapperStyle}
      onClick={isPlayable ? onClick : undefined}
      data-testid={`floating-card-${cardId}`}
    >
      <div className={classNames} style={cardStyle}>
        {!spriteStyle && (
          <span className="floating-card__fallback">{cardId}</span>
        )}
      </div>
    </div>
  );
}

interface FloatingHandProps {
  hand: readonly CardId[];
  playableCards: Map<CardId, PlayableCard>;
  selectedIndex: number | null;
  onCardClick: (index: number) => void;
}

export function FloatingHand({
  hand,
  playableCards,
  selectedIndex,
  onCardClick,
}: FloatingHandProps) {
  const [atlasLoaded, setAtlasLoaded] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAtlas().then(() => setAtlasLoaded(true));
  }, []);

  // Filter out the selected card - it's shown in the expanded view
  const visibleHand =
    selectedIndex !== null
      ? hand.filter((_, i) => i !== selectedIndex)
      : hand;

  // Calculate which card is hovered based on mouse X position relative to base card centers
  // This ignores the zoomed visual and uses the original card positions
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current || visibleHand.length === 0) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerCenterX = containerRect.left + containerRect.width / 2;
      const mouseX = e.clientX;

      // Get the card width (approximate - we use the same for all cards)
      const cardWidth = 120; // Base card width at 180px height
      const spreadDistance = 70; // Same as in getCardLayout

      // Find which card's base position the mouse is closest to
      let closestIndex = 0;
      let closestDistance = Infinity;

      for (let i = 0; i < visibleHand.length; i++) {
        const { spreadX } = getCardLayout(i, visibleHand.length, cardWidth);
        const cardCenterX = containerCenterX + spreadX;
        const distance = Math.abs(mouseX - cardCenterX);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = i;
        }
      }

      // Only hover if mouse is reasonably close to a card
      // (within half the spread distance + half card width)
      const hoverThreshold = spreadDistance / 2 + cardWidth / 2;
      if (closestDistance <= hoverThreshold) {
        setHoveredIndex(closestIndex);
      } else {
        setHoveredIndex(null);
      }
    },
    [visibleHand.length]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
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

  return (
    <div
      className="floating-hand"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="floating-hand__cards">
        {visibleHand.map((cardId, visibleIndex) => {
          const originalIndex = getOriginalIndex(visibleIndex);
          const isPlayable = playableCards.has(cardId);
          return (
            <FloatingCard
              key={`${cardId}-${originalIndex}`}
              cardId={cardId}
              index={visibleIndex}
              totalCards={visibleHand.length}
              isSelected={false}
              isPlayable={isPlayable}
              isHovered={hoveredIndex === visibleIndex}
              onClick={() => onCardClick(originalIndex)}
            />
          );
        })}
      </div>
    </div>
  );
}
