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
}

function TacticCard({ tacticId, onClick }: TacticCardProps) {
  return (
    <button
      className="tactic-card"
      onClick={onClick}
      type="button"
      data-testid={`tactic-card-${tacticId}`}
    >
      <img
        src={getTacticImageUrl(tacticId)}
        alt={TACTIC_NAMES[tacticId]}
        className="tactic-card__image"
      />
      <div className="tactic-card__name">{TACTIC_NAMES[tacticId]}</div>
    </button>
  );
}

export function TacticSelection() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();

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
    sendAction({
      type: SELECT_TACTIC_ACTION,
      tacticId,
    });
  };

  return (
    <div className="overlay">
      <div className="overlay__content tactic-selection">
        <h2 className="tactic-selection__title" data-testid="tactic-selection-title">
          Select Your Tactic ({state.timeOfDay === "day" ? "Day" : "Night"} Round {state.round})
        </h2>
        <p className="tactic-selection__subtitle">
          Lower numbers go first in turn order
        </p>
        <div className="tactic-selection__grid">
          {availableTactics.map((tacticId) => (
            <TacticCard
              key={tacticId}
              tacticId={tacticId}
              onClick={() => handleSelectTactic(tacticId)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
