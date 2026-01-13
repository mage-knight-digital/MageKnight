import { useState } from "react";
import {
  SELECT_TACTIC_ACTION,
  type TacticId,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { getTacticImageUrl } from "../../assets/assetPaths";

// Human-readable tactic names
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
  onClick: () => void;
  isSelected: boolean;
  isOtherSelected: boolean;
  gridIndex: number;
}

function TacticCard({ tacticId, onClick, isSelected, isOtherSelected, gridIndex }: TacticCardProps) {
  let className = "tactic-card";
  if (isSelected) className += " tactic-card--selected";
  if (isOtherSelected) className += " tactic-card--dismissed";

  // Add position class so CSS knows where to animate from
  // Grid is 3x2: positions 0,1,2 on top row, 3,4,5 on bottom
  const positionClass = `tactic-card--pos-${gridIndex}`;

  return (
    <button
      className={`${className} ${positionClass}`}
      onClick={onClick}
      type="button"
      data-testid={`tactic-card-${tacticId}`}
      disabled={isOtherSelected}
    >
      <img
        src={getTacticImageUrl(tacticId)}
        alt={TACTIC_NAMES[tacticId]}
        className="tactic-card__image"
      />
    </button>
  );
}

// Duration for the selection animation before sending action
const SELECTION_ANIMATION_MS = 1000;

export function TacticSelection() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();
  const [selectedTactic, setSelectedTactic] = useState<TacticId | null>(null);
  const [isExiting, setIsExiting] = useState(false);

  // Don't show if no state or player already selected a tactic
  if (!state || !player || player.selectedTacticId !== null) {
    return null;
  }

  // Get available tactics from validActions (filters out removed tactics)
  const tacticsOptions = state.validActions.tactics;
  if (!tacticsOptions) {
    return null;
  }

  const availableTactics = tacticsOptions.availableTactics;

  const handleSelectTactic = (tacticId: TacticId) => {
    // Ignore clicks if already animating
    if (selectedTactic) return;

    // Start selection animation
    setSelectedTactic(tacticId);

    // After a brief pause for the "chosen" moment, start exit animation
    setTimeout(() => {
      setIsExiting(true);
    }, SELECTION_ANIMATION_MS * 0.5);

    // Send the actual action after full animation
    setTimeout(() => {
      sendAction({
        type: SELECT_TACTIC_ACTION,
        tacticId,
      });
    }, SELECTION_ANIMATION_MS);
  };

  const timeOfDay = state.timeOfDay;
  const themeClass = timeOfDay === "day" ? "tactic-selection--day" : "tactic-selection--night";
  const exitClass = isExiting ? "tactic-selection--exiting" : "";

  return (
    <div className={`overlay ${isExiting ? "overlay--exiting" : ""}`}>
      <div className={`overlay__content tactic-selection ${themeClass} ${exitClass}`}>
        <h2 className="tactic-selection__title" data-testid="tactic-selection-title">
          {timeOfDay === "day" ? "Dawn Breaks" : "Night Falls"} — Round {state.round}
        </h2>
        <p className="tactic-selection__subtitle">
          Choose your approach
        </p>
        <div className="tactic-selection__grid">
          {availableTactics.map((tacticId, index) => (
            <TacticCard
              key={tacticId}
              tacticId={tacticId}
              onClick={() => handleSelectTactic(tacticId)}
              isSelected={selectedTactic === tacticId}
              isOtherSelected={selectedTactic !== null && selectedTactic !== tacticId}
              gridIndex={index}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
