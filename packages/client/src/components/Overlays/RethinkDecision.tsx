import { useState } from "react";
import type { CardId } from "@mage-knight/shared";
import {
  RESOLVE_TACTIC_DECISION_ACTION,
  TACTIC_DECISION_RETHINK,
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

export function RethinkDecision() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();
  const [selectedCards, setSelectedCards] = useState<CardId[]>([]);

  // Check if we have a pending Rethink decision
  const pendingDecision = state?.validActions.tacticEffects?.pendingDecision;
  if (
    !pendingDecision ||
    pendingDecision.type !== TACTIC_DECISION_RETHINK ||
    !player
  ) {
    return null;
  }

  const maxCards = pendingDecision.maxCards ?? 3;
  const hand = Array.isArray(player.hand) ? player.hand : [];

  const toggleCard = (cardId: CardId) => {
    if (selectedCards.includes(cardId)) {
      setSelectedCards(selectedCards.filter((c) => c !== cardId));
    } else if (selectedCards.length < maxCards) {
      setSelectedCards([...selectedCards, cardId]);
    }
  };

  const handleConfirm = () => {
    sendAction({
      type: RESOLVE_TACTIC_DECISION_ACTION,
      decision: {
        type: TACTIC_DECISION_RETHINK,
        cardIds: selectedCards,
      },
    });
    setSelectedCards([]);
  };

  return (
    <div className="overlay">
      <div className="overlay__content choice-selection">
        <h2 className="choice-selection__title">Rethink</h2>
        <p style={{ color: "#999", marginBottom: "1rem", textAlign: "center" }}>
          Select up to {maxCards} cards to discard. Your discard pile will be
          shuffled into your deck, then you draw that many cards.
        </p>
        <p style={{ color: "#3498db", marginBottom: "1rem", textAlign: "center" }}>
          Selected: {selectedCards.length} / {maxCards}
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
            {hand.map((cardId) => {
              const isSelected = selectedCards.includes(cardId);
              const isWound = cardId.includes("wound");
              return (
                <button
                  key={cardId}
                  type="button"
                  onClick={() => toggleCard(cardId)}
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: "6px",
                    background: isSelected
                      ? "#3498db"
                      : isWound
                        ? "#8b4513"
                        : "#2c3e50",
                    color: "#fff",
                    border: isSelected
                      ? "2px solid #fff"
                      : "2px solid transparent",
                    cursor:
                      selectedCards.length >= maxCards && !isSelected
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      selectedCards.length >= maxCards && !isSelected ? 0.5 : 1,
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
              background: "#27ae60",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: 600,
            }}
          >
            {selectedCards.length === 0
              ? "Skip (Discard Nothing)"
              : `Discard ${selectedCards.length} Card${selectedCards.length > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
