import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { actionData } from "../../rust/types";

const GLADE_WOUND_HAND = "hand";
const GLADE_WOUND_DISCARD = "discard";
const GLADE_WOUND_SKIP = "skip";

export function GladeWoundDecision() {
  const { sendAction, legalActions } = useGame();
  const player = useMyPlayer();

  // Check if we have a pending glade wound decision
  if (player?.pending?.kind !== "glade_wound_choice") {
    return null;
  }

  // Derive available choices from legal actions
  const gladeActions = legalActions.filter(
    (a) => typeof a !== "string" && "ResolveGladeWound" in a
  );
  const hasWoundsInHand = gladeActions.some(
    (a) => actionData(a)?.["choice"] === GLADE_WOUND_HAND
  );
  const hasWoundsInDiscard = gladeActions.some(
    (a) => actionData(a)?.["choice"] === GLADE_WOUND_DISCARD
  );
  const handleChoice = (choice: string) => {
    const action = gladeActions.find((a) => actionData(a)?.["choice"] === choice);
    if (action) sendAction(action);
  };

  return (
    <div className="overlay">
      <div className="overlay__content choice-selection">
        <h2 className="choice-selection__title">Magical Glade</h2>
        <p style={{ color: "#999", marginBottom: "1rem", textAlign: "center" }}>
          You may discard one wound card
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
          {hasWoundsInHand && (
            <button
              className="choice-selection__option"
              onClick={() => handleChoice(GLADE_WOUND_HAND)}
              type="button"
              style={{
                padding: "1.5rem 2rem",
                borderRadius: "8px",
                background: "#8b4513",
                color: "#fff",
                fontWeight: 700,
                fontSize: "1rem",
                border: "3px solid transparent",
                cursor: "pointer",
                transition: "all 0.2s ease",
                minWidth: "8rem",
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
              Discard from Hand
            </button>
          )}
          {hasWoundsInDiscard && (
            <button
              className="choice-selection__option"
              onClick={() => handleChoice(GLADE_WOUND_DISCARD)}
              type="button"
              style={{
                padding: "1.5rem 2rem",
                borderRadius: "8px",
                background: "#5d4037",
                color: "#fff",
                fontWeight: 700,
                fontSize: "1rem",
                border: "3px solid transparent",
                cursor: "pointer",
                transition: "all 0.2s ease",
                minWidth: "8rem",
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
              Discard from Discard Pile
            </button>
          )}
          <button
            className="choice-selection__option"
            onClick={() => handleChoice(GLADE_WOUND_SKIP)}
            type="button"
            style={{
              padding: "1.5rem 2rem",
              borderRadius: "8px",
              background: "#555",
              color: "#fff",
              fontWeight: 700,
              fontSize: "1rem",
              border: "3px solid transparent",
              cursor: "pointer",
              transition: "all 0.2s ease",
              minWidth: "8rem",
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
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
