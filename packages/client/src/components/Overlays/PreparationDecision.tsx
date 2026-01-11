import type { CardId } from "@mage-knight/shared";
import {
  RESOLVE_TACTIC_DECISION_ACTION,
  TACTIC_DECISION_PREPARATION,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";

// Format card ID for display (convert snake_case to Title Case)
function formatCardName(cardId: string): string {
  return cardId
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function PreparationDecision() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();

  // Check if we have a pending Preparation decision
  const pendingDecision = state?.validActions.tacticEffects?.pendingDecision;
  if (
    !pendingDecision ||
    pendingDecision.type !== TACTIC_DECISION_PREPARATION ||
    !player
  ) {
    return null;
  }

  // Get deck snapshot from pending decision
  const deckSnapshot: readonly CardId[] = pendingDecision.deckSnapshot ?? [];

  const handleSelectCard = (cardId: CardId) => {
    sendAction({
      type: RESOLVE_TACTIC_DECISION_ACTION,
      decision: {
        type: TACTIC_DECISION_PREPARATION,
        cardId,
      },
    });
  };

  return (
    <div className="overlay">
      <div className="overlay__content choice-selection">
        <h2 className="choice-selection__title">Preparation</h2>
        <p style={{ color: "#999", marginBottom: "1rem", textAlign: "center" }}>
          Choose a card from your deck to add to your hand.
          The remaining deck will be shuffled.
        </p>

        {deckSnapshot.length === 0 ? (
          <p style={{ color: "#999", textAlign: "center" }}>
            Your deck is empty.
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              justifyContent: "center",
              marginBottom: "1rem",
              maxWidth: "600px",
            }}
          >
            {deckSnapshot.map((cardId) => {
              const isWound = cardId.includes("wound");
              return (
                <button
                  key={cardId}
                  type="button"
                  onClick={() => handleSelectCard(cardId)}
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: "6px",
                    background: isWound ? "#8b4513" : "#2c3e50",
                    color: "#fff",
                    border: "2px solid transparent",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: 400,
                    transition: "all 0.2s ease",
                  }}
                  onMouseOver={(e) => {
                    (e.target as HTMLButtonElement).style.background = "#1a237e";
                    (e.target as HTMLButtonElement).style.borderColor = "#fff";
                  }}
                  onMouseOut={(e) => {
                    (e.target as HTMLButtonElement).style.background = isWound ? "#8b4513" : "#2c3e50";
                    (e.target as HTMLButtonElement).style.borderColor = "transparent";
                  }}
                >
                  {formatCardName(cardId)}
                  {isWound && " (Wound)"}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
