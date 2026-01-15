import { useState, useCallback } from "react";
import {
  SELECT_TACTIC_ACTION,
  type TacticId,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { getTacticImageUrl } from "../../assets/assetPaths";
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

/**
 * Calculate z-index for a card based on which card is hovered.
 * Inscryption-style: when hovering, reorder entire hand so hovered card
 * is on top, cards to the left stack behind going left, cards to the right
 * have lowest z-index.
 */
function calculateZIndex(index: number, totalCards: number, hoveredIndex: number | null): number {
  if (hoveredIndex === null) {
    // Default: rightmost card on top (ascending z-index left to right)
    return 50 + index;
  }

  // When hovering, reorder z-indexes:
  // - Hovered card gets highest
  // - Cards to the LEFT of hovered: descending from hovered (they go "behind")
  // - Cards to the RIGHT of hovered: get lowest values

  if (index === hoveredIndex) {
    // Hovered card is always on top
    return 50 + totalCards;
  } else if (index < hoveredIndex) {
    // Cards to the left: higher z-index the closer to hovered
    // e.g., if hovered is 3, card 2 gets higher z than card 1
    return 50 + index;
  } else {
    // Cards to the right of hovered: push them behind
    // They get z-index below the leftmost card
    return 40 + (totalCards - index);
  }
}

function TacticCard({
  tacticId,
  index,
  totalCards,
  hoveredIndex,
  zIndexAnchor,
  isSelected,
  isDismissed,
  onClick,
  onMouseEnter,
}: TacticCardProps) {
  const { spreadX, rotation, arcY } = getTacticCardLayout(index, totalCards);
  const isHovered = hoveredIndex === index;

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
  const cardStyle: React.CSSProperties = {
    left: `calc(50% + ${spreadX}%)`,
    transform: `translateX(-50%) translateY(${arcY}%) rotate(${rotation}deg)`,
    zIndex,
  };

  return (
    <button
      className={classNames}
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      disabled={isDismissed}
      data-testid={`tactic-card-${tacticId}`}
    >
      <img
        src={getTacticImageUrl(tacticId)}
        alt={TACTIC_NAMES[tacticId]}
        className="tactic-carousel__card-image"
        draggable={false}
      />
    </button>
  );
}

// Animation timing
const SELECTION_DELAY_MS = 800;

export type ViewMode = "board" | "ready" | "focus";

interface TacticCarouselPaneProps {
  viewMode: ViewMode;
}

export function TacticCarouselPane({ viewMode }: TacticCarouselPaneProps) {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedTactic, setSelectedTactic] = useState<TacticId | null>(null);
  // Track which card the z-ordering is anchored to (Inscryption-style: persists after mouse leave)
  const [zIndexAnchor, setZIndexAnchor] = useState<number | null>(null);

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
            onClick={() => handleCardClick(tacticId)}
            onMouseEnter={() => handleMouseEnter(index)}
          />
        ))}
      </div>
    </div>
  );
}
