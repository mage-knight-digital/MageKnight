import type { ManaColor } from "@mage-knight/shared";
import {
  RESOLVE_TACTIC_DECISION_ACTION,
  TACTIC_DECISION_MANA_STEAL,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";

function getManaColor(color: ManaColor): string {
  switch (color) {
    case MANA_RED:
      return "#e74c3c";
    case MANA_BLUE:
      return "#3498db";
    case MANA_GREEN:
      return "#2ecc71";
    case MANA_WHITE:
      return "#bdc3c7";
    default:
      return "#666";
  }
}

interface AvailableDie {
  readonly id: string;
  readonly color: ManaColor;
}

export function ManaStealDecision() {
  const { state, sendAction } = useGame();

  // Check if we have a pending Mana Steal decision
  const pendingDecision =
    state?.validActions?.mode === "pending_tactic_decision"
      ? state.validActions.tacticDecision
      : undefined;
  if (
    !pendingDecision ||
    pendingDecision.type !== TACTIC_DECISION_MANA_STEAL ||
    !pendingDecision.availableDiceIds
  ) {
    return null;
  }

  // Get the dice info from source to display colors
  const availableDice: AvailableDie[] = [];
  for (const dieId of pendingDecision.availableDiceIds) {
    const die = state?.source.dice.find((d) => d.id === dieId);
    if (die) {
      availableDice.push({ id: dieId, color: die.color });
    }
  }

  const handleSelectDie = (dieId: string) => {
    sendAction({
      type: RESOLVE_TACTIC_DECISION_ACTION,
      decision: {
        type: TACTIC_DECISION_MANA_STEAL,
        dieId,
      },
    });
  };

  return (
    <div className="overlay">
      <div className="overlay__content choice-selection">
        <h2 className="choice-selection__title">Mana Steal</h2>
        <p style={{ color: "#999", marginBottom: "1rem", textAlign: "center" }}>
          Choose a die from the Source to steal for this round
        </p>
        <div
          className="choice-selection__options"
          style={{
            display: "flex",
            gap: "1rem",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {availableDice.map((die) => (
            <button
              key={die.id}
              className="choice-selection__option"
              onClick={() => handleSelectDie(die.id)}
              type="button"
              style={{
                padding: "1.5rem 2rem",
                borderRadius: "8px",
                background: getManaColor(die.color),
                color: "#fff",
                fontWeight: 700,
                fontSize: "1.25rem",
                border: "3px solid transparent",
                cursor: "pointer",
                transition: "all 0.2s ease",
                minWidth: "5rem",
                textTransform: "uppercase",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = "3px solid #fff";
                e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = "3px solid transparent";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              {die.color}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
