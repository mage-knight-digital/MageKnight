import { useState, useCallback } from "react";
import {
  SELECT_TACTIC_ACTION,
  type TacticId,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { useGameIntro } from "../../contexts/GameIntroContext";
import { getTacticImageUrl } from "../../assets/assetPaths";
import "./TacticHand.css";

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
  isHovered: boolean;
  isSelected: boolean;
  isDismissed: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

function getTacticCardLayout(index: number, totalCards: number) {
  const centerIndex = (totalCards - 1) / 2;
  const offsetFromCenter = index - centerIndex;

  // Tactic cards spread wider since they're bigger and fewer
  const spreadDistance = 110;
  const rotationPerCard = 5;
  const arcPerCard = 6;

  const spreadX = offsetFromCenter * spreadDistance;
  const rotation = offsetFromCenter * rotationPerCard;
  const arcY = Math.abs(offsetFromCenter) * arcPerCard;

  return { spreadX, rotation, arcY };
}

// Card width for centering calculation
const CARD_WIDTH = 140;

function TacticCard({
  tacticId,
  index,
  totalCards,
  isHovered,
  isSelected,
  isDismissed,
  onClick,
  onMouseEnter,
}: TacticCardProps) {
  const { spreadX, rotation, arcY } = getTacticCardLayout(index, totalCards);

  const classNames = [
    "tactic-hand__card",
    isHovered && "tactic-hand__card--hovered",
    isSelected && "tactic-hand__card--selected",
    isDismissed && "tactic-hand__card--dismissed",
  ]
    .filter(Boolean)
    .join(" ");

  // Z-index: hovered/selected cards come to front
  const zIndex = isSelected ? 100 : isHovered ? 90 : 50 + index;

  // Position card: center it (-half width) plus the fan spread offset
  const translateX = spreadX - CARD_WIDTH / 2;

  const cardStyle: React.CSSProperties = {
    transform: `translateX(${translateX}px) translateY(${arcY}px) rotate(${rotation}deg)`,
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
        className="tactic-hand__card-image"
        draggable={false}
      />
    </button>
  );
}

// Animation timing
const SELECTION_DELAY_MS = 800;

export function TacticHand() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();
  const { phase: introPhase } = useGameIntro();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedTactic, setSelectedTactic] = useState<TacticId | null>(null);

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
      }
    },
    [selectedTactic]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  // Don't show if no state or player already selected a tactic
  if (!state || !player || player.selectedTacticId !== null) {
    return null;
  }

  // Wait for intro sequence to reach tactics phase before showing
  // TODO: This timing check is unreliable - see docs/tickets/animation-event-dispatcher.md
  if (introPhase !== "tactics" && introPhase !== "complete") {
    return null;
  }

  // Get available tactics from validActions
  const tacticsOptions = state.validActions.tactics;
  if (!tacticsOptions) {
    return null;
  }

  const availableTactics = tacticsOptions.availableTactics;
  const timeOfDay = state.timeOfDay;

  const themeClass = timeOfDay === "day" ? "tactic-hand--day" : "tactic-hand--night";
  const selectingClass = selectedTactic ? "tactic-hand--selecting" : "";

  return (
    <div className={`tactic-hand ${themeClass} ${selectingClass}`} data-testid="tactic-hand">
      {/* Phase banner */}
      <div className="tactic-hand__banner">
        <span className="tactic-hand__banner-text">
          {timeOfDay === "day" ? "Dawn Breaks" : "Night Falls"} — Round {state.round}
        </span>
        <span className="tactic-hand__banner-subtitle">Choose your tactic</span>
      </div>

      {/* Tactic cards fanned out */}
      <div className="tactic-hand__cards" onMouseLeave={handleMouseLeave}>
        {availableTactics.map((tacticId, index) => (
          <TacticCard
            key={tacticId}
            tacticId={tacticId}
            index={index}
            totalCards={availableTactics.length}
            isHovered={hoveredIndex === index}
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
