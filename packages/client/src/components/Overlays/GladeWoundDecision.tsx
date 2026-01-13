import {
  RESOLVE_GLADE_WOUND_ACTION,
  GLADE_WOUND_CHOICE_HAND,
  GLADE_WOUND_CHOICE_DISCARD,
  GLADE_WOUND_CHOICE_SKIP,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";

export function GladeWoundDecision() {
  const { state, sendAction } = useGame();

  // Check if we have a pending glade wound decision
  const gladeWoundOptions = state?.validActions.gladeWound;
  if (!gladeWoundOptions) {
    return null;
  }

  const { hasWoundsInHand, hasWoundsInDiscard } = gladeWoundOptions;

  const handleChoice = (choice: typeof GLADE_WOUND_CHOICE_HAND | typeof GLADE_WOUND_CHOICE_DISCARD | typeof GLADE_WOUND_CHOICE_SKIP) => {
    sendAction({
      type: RESOLVE_GLADE_WOUND_ACTION,
      choice,
    });
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
              onClick={() => handleChoice(GLADE_WOUND_CHOICE_HAND)}
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
              onClick={() => handleChoice(GLADE_WOUND_CHOICE_DISCARD)}
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
            onClick={() => handleChoice(GLADE_WOUND_CHOICE_SKIP)}
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
