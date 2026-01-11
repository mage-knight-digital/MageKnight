import { useState } from "react";
import {
  RESOLVE_TACTIC_DECISION_ACTION,
  TACTIC_DECISION_MIDNIGHT_MEDITATION,
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

export function MidnightMeditationDecision() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();
  // Track selected cards by their index in the hand array (to handle duplicates)
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  // Check if we have a pending Midnight Meditation decision
  const pendingDecision = state?.validActions.tacticEffects?.pendingDecision;
  if (
    !pendingDecision ||
    pendingDecision.type !== TACTIC_DECISION_MIDNIGHT_MEDITATION ||
    !player
  ) {
    return null;
  }

  const maxCards = pendingDecision.maxCards ?? 5;
  const hand = Array.isArray(player.hand) ? player.hand : [];

  const toggleCard = (index: number) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter((i) => i !== index));
    } else if (selectedIndices.length < maxCards) {
      setSelectedIndices([...selectedIndices, index]);
    }
  };

  const handleConfirm = () => {
    // Convert indices back to cardIds for the action
    const selectedCards = selectedIndices.map((i) => hand[i]);
    sendAction({
      type: RESOLVE_TACTIC_DECISION_ACTION,
      decision: {
        type: TACTIC_DECISION_MIDNIGHT_MEDITATION,
        cardIds: selectedCards,
      },
    });
    setSelectedIndices([]);
  };

  return (
    <div className="overlay">
      <div className="overlay__content choice-selection">
        <h2 className="choice-selection__title">Midnight Meditation</h2>
        <p style={{ color: "#999", marginBottom: "1rem", textAlign: "center" }}>
          Select up to {maxCards} cards to shuffle into your deck.
          You will draw the same number of cards back.
        </p>
        <p style={{ color: "#3498db", marginBottom: "1rem", textAlign: "center" }}>
          Selected: {selectedIndices.length} / {maxCards}
        </p>

        {hand.length === 0 ? (
          <p style={{ color: "#999", textAlign: "center" }}>
            Your hand is empty.
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
            {hand.map((cardId, index) => {
              const isSelected = selectedIndices.includes(index);
              const isWound = cardId.includes("wound");
              return (
                <button
                  key={`${cardId}-${index}`}
                  type="button"
                  onClick={() => toggleCard(index)}
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: "6px",
                    background: isSelected
                      ? "#1a237e"
                      : isWound
                        ? "#8b4513"
                        : "#2c3e50",
                    color: "#fff",
                    border: isSelected
                      ? "2px solid #fff"
                      : "2px solid transparent",
                    cursor:
                      selectedIndices.length >= maxCards && !isSelected
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      selectedIndices.length >= maxCards && !isSelected ? 0.5 : 1,
                    fontSize: "0.85rem",
                    fontWeight: isSelected ? 700 : 400,
                    transition: "all 0.2s ease",
                  }}
                >
                  {formatCardName(cardId)}
                  {isWound && " (Wound)"}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          <button
            type="button"
            onClick={handleConfirm}
            style={{
              padding: "0.75rem 2rem",
              borderRadius: "6px",
              background: "#1a237e",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: 600,
            }}
          >
            {selectedIndices.length === 0
              ? "Skip (Shuffle Nothing)"
              : `Shuffle ${selectedIndices.length} Card${selectedIndices.length > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
