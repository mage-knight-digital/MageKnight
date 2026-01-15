import { useState, useCallback, useEffect, useMemo } from "react";
import {
  SELECT_TACTIC_ACTION,
  type TacticId,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { loadAtlas, getTacticSpriteStyle } from "../../utils/cardAtlas";
import { calculateZIndex, CARD_FAN_SCALE, type CardFanViewMode } from "../../utils/cardFanLayout";
import { playSound } from "../../utils/audioManager";
import "./TacticCarouselPane.css";

// Human-readable tactic names for alt text
const TACTIC_NAMES: Record<TacticId, string> = {
  early_bird: "Early Bird",
  rethink: "Rethink",
  mana_steal: "Mana Steal",
  planning: "Planning",
  great_start: "Great Start",
  the_right_moment: "The Right Moment",
  from_the_dusk: "From The Dusk",
  long_night: "Long Night",
  mana_search: "Mana Search",
  midnight_meditation: "Midnight Meditation",
  preparation: "Preparation",
  sparing_power: "Sparing Power",
};

interface TacticCardProps {
  tacticId: TacticId;
  index: number;
  totalCards: number;
  hoveredIndex: number | null;  // For hover visual effect (lift)
  zIndexAnchor: number | null;  // For z-ordering (persists after mouse leave)
  isSelected: boolean;
  isDismissed: boolean;
  cardHeight: number;
  onClick: () => void;
  onMouseEnter: () => void;
}

function getTacticCardLayout(index: number, totalCards: number) {
  const centerIndex = (totalCards - 1) / 2;
  const offsetFromCenter = index - centerIndex;

  // Use percentage-based spread that works at any card size
  // Cards overlap more like a fanned hand (similar to FloatingHand)
  const spreadPercentage = 12; // % of container width per card offset
  const rotationPerCard = 3;   // degrees rotation per card offset
  const arcPerCard = 1.5;      // % vertical arc per card offset

  const spreadX = offsetFromCenter * spreadPercentage; // In percentage
  const rotation = offsetFromCenter * rotationPerCard;
  const arcY = Math.abs(offsetFromCenter) * arcPerCard; // In percentage

  return { spreadX, rotation, arcY };
}

function TacticCard({
  tacticId,
  index,
  totalCards,
  hoveredIndex,
  zIndexAnchor,
  isSelected,
  isDismissed,
  cardHeight,
  onClick,
  onMouseEnter,
}: TacticCardProps) {
  const { spreadX, rotation, arcY } = getTacticCardLayout(index, totalCards);
  const isHovered = hoveredIndex === index;

  // Memoize sprite style - recalculate if tacticId or cardHeight changes
  const spriteStyle = useMemo(
    () => getTacticSpriteStyle(tacticId, cardHeight),
    [tacticId, cardHeight]
  );

  const classNames = [
    "tactic-carousel__card",
    isHovered && "tactic-carousel__card--hovered",
    isSelected && "tactic-carousel__card--selected",
    isDismissed && "tactic-carousel__card--dismissed",
  ]
    .filter(Boolean)
    .join(" ");

  // Z-index: selected always on top, otherwise use Inscryption-style ordering based on anchor
  const zIndex = isSelected ? 100 : calculateZIndex(index, totalCards, zIndexAnchor);

  // Position using CSS left percentage + transform for centering
  // spreadX is now a percentage offset from center
  const wrapperStyle: React.CSSProperties = {
    left: `calc(50% + ${spreadX}%)`,
    transform: `translateX(-50%) translateY(${arcY}%) rotate(${rotation}deg)`,
    zIndex,
  };

  // Card inner style combines sprite positioning with dimensions
  const cardInnerStyle: React.CSSProperties = spriteStyle
    ? { ...spriteStyle }
    : {};

  return (
    <button
      className={classNames}
      style={wrapperStyle}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      disabled={isDismissed}
      data-testid={`tactic-card-${tacticId}`}
      aria-label={TACTIC_NAMES[tacticId]}
    >
      <div
        className="tactic-carousel__card-image"
        style={cardInnerStyle}
      >
        {!spriteStyle && (
          <span className="tactic-carousel__card-fallback">{tacticId}</span>
        )}
      </div>
    </button>
  );
}

// Animation timing
const SELECTION_DELAY_MS = 800;

// Re-export for backwards compatibility
export type ViewMode = CardFanViewMode;

interface TacticCarouselPaneProps {
  viewMode: ViewMode;
}

// Hook to get responsive card height based on view mode
function useCardHeight(viewMode: ViewMode): number {
  const [cardHeight, setCardHeight] = useState(() => {
    const scale = CARD_FAN_SCALE[viewMode];
    return Math.round(window.innerHeight * scale);
  });

  useEffect(() => {
    const updateHeight = () => {
      const scale = CARD_FAN_SCALE[viewMode];
      setCardHeight(Math.round(window.innerHeight * scale));
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [viewMode]);

  return cardHeight;
}

export function TacticCarouselPane({ viewMode }: TacticCarouselPaneProps) {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();
  const [atlasLoaded, setAtlasLoaded] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedTactic, setSelectedTactic] = useState<TacticId | null>(null);
  // Track which card the z-ordering is anchored to (Inscryption-style: persists after mouse leave)
  const [zIndexAnchor, setZIndexAnchor] = useState<number | null>(null);
  const cardHeight = useCardHeight(viewMode);

  // Load atlas on mount
  useEffect(() => {
    loadAtlas().then(() => setAtlasLoaded(true));
  }, []);

  // All hooks must be called before any early returns
  const handleCardClick = useCallback(
    (tacticId: TacticId) => {
      if (selectedTactic) return; // Already selecting

      setSelectedTactic(tacticId);

      // Send action after animation
      setTimeout(() => {
        sendAction({
          type: SELECT_TACTIC_ACTION,
          tacticId,
        });
      }, SELECTION_DELAY_MS);
    },
    [selectedTactic, sendAction]
  );

  const handleMouseEnter = useCallback(
    (index: number) => {
      if (!selectedTactic) {
        setHoveredIndex(index);
        setZIndexAnchor(index); // Update z-ordering anchor when hovering
        playSound("cardHover");
      }
    },
    [selectedTactic]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
    // Don't reset zIndexAnchor - keep the z-ordering until next hover
  }, []);

  // Don't show if no state or player already selected a tactic
  if (!state || !player || player.selectedTacticId !== null) {
    return (
      <div className={`tactic-carousel tactic-carousel--${viewMode} tactic-carousel--empty`}>
        {/* Empty state - tactic already selected */}
      </div>
    );
  }

  // Show loading state while atlas loads
  if (!atlasLoaded) {
    return (
      <div className={`tactic-carousel tactic-carousel--${viewMode} tactic-carousel--loading`}>
        Loading tactics...
      </div>
    );
  }

  // Get available tactics from validActions
  const tacticsOptions = state.validActions.tactics;
  if (!tacticsOptions) {
    return (
      <div className={`tactic-carousel tactic-carousel--${viewMode} tactic-carousel--empty`}>
        {/* No tactics available */}
      </div>
    );
  }

  const availableTactics = tacticsOptions.availableTactics;
  const timeOfDay = state.timeOfDay;

  const themeClass = timeOfDay === "day" ? "tactic-carousel--day" : "tactic-carousel--night";
  const selectingClass = selectedTactic ? "tactic-carousel--selecting" : "";

  return (
    <div
      className={`tactic-carousel tactic-carousel--${viewMode} ${themeClass} ${selectingClass}`}
      data-testid="tactic-carousel"
    >
      {/* Phase banner */}
      <div className="tactic-carousel__banner">
        <span className="tactic-carousel__banner-text">
          {timeOfDay === "day" ? "Dawn Breaks" : "Night Falls"} — Round {state.round}
        </span>
        <span className="tactic-carousel__banner-subtitle">Choose your tactic</span>
      </div>

      {/* Tactic cards fanned out */}
      <div className="tactic-carousel__cards" onMouseLeave={handleMouseLeave}>
        {availableTactics.map((tacticId, index) => (
          <TacticCard
            key={tacticId}
            tacticId={tacticId}
            index={index}
            totalCards={availableTactics.length}
            hoveredIndex={hoveredIndex}
            zIndexAnchor={zIndexAnchor}
            isSelected={selectedTactic === tacticId}
            isDismissed={selectedTactic !== null && selectedTactic !== tacticId}
            cardHeight={cardHeight}
            onClick={() => handleCardClick(tacticId)}
            onMouseEnter={() => handleMouseEnter(index)}
          />
        ))}
      </div>
    </div>
  );
}
