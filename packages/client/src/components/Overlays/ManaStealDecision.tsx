import type { ManaColor } from "@mage-knight/shared";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { extractManaStealOptions } from "../../rust/legalActionUtils";

function getManaColorHex(color: ManaColor): string {
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

function getManaLabel(color: ManaColor): string {
  switch (color) {
    case MANA_RED:
      return "Red";
    case MANA_BLUE:
      return "Blue";
    case MANA_GREEN:
      return "Green";
    case MANA_WHITE:
      return "White";
    default:
      return String(color);
  }
}

export function ManaStealDecision() {
  const { state, legalActions, sendAction } = useGame();
  const player = useMyPlayer();

  // Only show when we have a tactic_decision pending
  if (!player || player.pending?.kind !== "tactic_decision") {
    return null;
  }

  const manaStealOptions = extractManaStealOptions(legalActions);
  if (manaStealOptions.length === 0) {
    return null;
  }

  // Resolve each option's die color from the source dice array
  const dice = state?.source.dice ?? [];

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
          {manaStealOptions.map((opt) => {
            const die = dice[opt.dieIndex];
            const color = die?.color;
            const takenBy = die?.takenByPlayerId;
            const isSteal = takenBy != null;

            return (
              <button
                key={opt.dieIndex}
                className="choice-selection__option"
                onClick={() => sendAction(opt.action)}
                type="button"
                style={{
                  padding: "1.5rem 2rem",
                  borderRadius: "8px",
                  background: color ? getManaColorHex(color) : "#666",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "1.25rem",
                  border: isSteal ? "3px solid #e74c3c" : "3px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  minWidth: "5rem",
                  textTransform: "uppercase",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#fff";
                  e.currentTarget.style.transform = "scale(1.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = isSteal ? "#e74c3c" : "transparent";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                {color ? getManaLabel(color) : "?"}
                {isSteal && (
                  <div style={{ fontSize: "0.7rem", fontWeight: 400, marginTop: "0.25rem" }}>
                    Steal
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
