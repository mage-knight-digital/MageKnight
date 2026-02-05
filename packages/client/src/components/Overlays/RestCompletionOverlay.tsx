/**
 * RestCompletionOverlay - Card selection UI for completing rest
 *
 * Shown when player is in resting state (isResting === true).
 * Allows selecting cards to discard based on rest type:
 * - Standard Rest: select 1 non-wound + any number of wounds
 * - Slow Recovery: select exactly 1 wound (when hand is all wounds)
 * - Empty Hand: confirm completion with 0 cards (when all wounds healed during rest)
 */

import { useCallback } from "react";
import {
  COMPLETE_REST_ACTION,
  UNDO_ACTION,
  CARD_WOUND,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { useRegisterOverlay } from "../../contexts/OverlayContext";
import { CardSelectionOverlay } from "./CardSelectionOverlay";

export function RestCompletionOverlay() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();

  // Check if we're in resting state
  const isResting =
    state?.validActions?.mode === "normal_turn"
      ? (state.validActions.turn.isResting ?? false)
      : false;
  const isActive = isResting && !!player;

  // Register this overlay to disable background interactions when active
  useRegisterOverlay(isActive);

  const handleSelect = useCallback(
    (selectedCards: readonly CardId[]) => {
      sendAction({
        type: COMPLETE_REST_ACTION,
        discardCardIds: selectedCards,
      });
    },
    [sendAction]
  );

  const handleUndo = useCallback(() => {
    sendAction({ type: UNDO_ACTION });
  }, [sendAction]);

  if (!isActive) {
    return null;
  }

  const hand = Array.isArray(player.hand) ? player.hand : [];

  // Determine rest type based on hand composition
  const hasNonWound = hand.some((cardId) => cardId !== CARD_WOUND);

  // Edge case: If hand is empty (all wounds healed during rest),
  // show simple confirmation dialog for Slow Recovery with 0 discards
  if (hand.length === 0) {
    const handleEmptyHandComplete = () => {
      sendAction({
        type: COMPLETE_REST_ACTION,
        discardCardIds: [],
      });
    };

    return (
      <div className="overlay">
        <div className="overlay__content choice-selection">
          <h2 className="choice-selection__title">Complete Rest</h2>
          <p style={{ color: "#999", marginBottom: "1rem", textAlign: "center" }}>
            Your hand is empty (all wounds healed during rest).
          </p>
          <p style={{ color: "#3498db", marginBottom: "1.5rem", textAlign: "center" }}>
            Click Complete to finish your Slow Recovery rest.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            <button
              type="button"
              onClick={handleUndo}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "6px",
                background: "#1a1a3e",
                color: "#ddd",
                border: "2px solid #333",
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleEmptyHandComplete}
              style={{
                padding: "0.75rem 2rem",
                borderRadius: "6px",
                background: "#2ecc71",
                color: "#fff",
                border: "2px solid #27ae60",
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: 600,
              }}
            >
              Complete Rest
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Standard Rest: allow selecting 1+ cards
  // Validator enforces exactly 1 non-wound rule server-side
  if (hasNonWound) {
    return (
      <CardSelectionOverlay
        cards={hand}
        instruction="Standard Rest: Select cards to discard"
        minSelect={1}
        maxSelect={hand.length}
        onSelect={handleSelect}
        onUndo={handleUndo}
        filterMessage="Select exactly 1 non-wound card (plus any number of wounds)"
      />
    );
  }

  // Slow Recovery: exactly 1 wound (hand is all wounds)
  return (
    <CardSelectionOverlay
      cards={hand}
      instruction="Slow Recovery: Select 1 wound card"
      minSelect={1}
      maxSelect={1}
      onSelect={handleSelect}
      onUndo={handleUndo}
      filterMessage="Your hand contains only wounds - select one to discard"
    />
  );
}
