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
import { CARD_WOUND } from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { useRegisterOverlay } from "../../contexts/OverlayContext";
import { CardSelectionOverlay } from "./CardSelectionOverlay";
import { actionData } from "../../rust/types";
import { findAction, hasAction } from "../../rust/legalActionUtils";

export function RestCompletionOverlay() {
  const { sendAction, legalActions } = useGame();
  const player = useMyPlayer();

  // Check if we're in resting state — use player.isResting from Rust client state
  const isResting = player?.isResting ?? false;
  const isActive = isResting && !!player;

  // Register this overlay to disable background interactions when active
  useRegisterOverlay(isActive);

  // Find CompleteRest legal actions (one per valid discard index)
  const completeRestActions = legalActions.filter(
    (a) => typeof a !== "string" && "CompleteRest" in a
  );
  const canUndo = hasAction(legalActions, "Undo");

  const handleSelect = useCallback(
    (selectedCards: readonly CardId[]) => {
      if (selectedCards.length === 0) {
        // Empty hand — send CompleteRest with null index
        const action = findAction(legalActions, "CompleteRest");
        if (action) sendAction(action);
        return;
      }
      // Find the hand index for the selected card
      const cardId = selectedCards[0];
      const hand = Array.isArray(player?.hand) ? player.hand : [];
      const handIndex = hand.indexOf(cardId as string);
      if (handIndex >= 0) {
        const action = completeRestActions.find(
          (a) => actionData(a)?.["discard_hand_index"] === handIndex
        );
        if (action) sendAction(action);
      }
    },
    [sendAction, legalActions, completeRestActions, player?.hand]
  );

  const handleUndo = useCallback(() => {
    const undoAction = findAction(legalActions, "Undo");
    if (undoAction) sendAction(undoAction);
  }, [sendAction, legalActions]);

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
      const action = findAction(legalActions, "CompleteRest");
      if (action) sendAction(action);
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
                background: "var(--surface-hover-lift)",
                color: "var(--text-secondary)",
                border: "2px solid var(--border-on-raised)",
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

  // Standard Rest: select 1 non-wound card to discard (wounds are auto-discarded)
  if (hasNonWound) {
    // Only show non-wound cards as selectable (wounds go automatically)
    const nonWoundCards = hand.filter((cardId) => cardId !== CARD_WOUND);
    return (
      <CardSelectionOverlay
        cards={nonWoundCards}
        instruction="Standard Rest: Select a non-wound card to discard"
        minSelect={1}
        maxSelect={1}
        onSelect={handleSelect}
        onUndo={canUndo ? handleUndo : undefined}
        filterMessage="Select 1 non-wound card (all wounds are discarded automatically)"
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
      onUndo={canUndo ? handleUndo : undefined}
      filterMessage="Your hand contains only wounds - select one to discard"
    />
  );
}
