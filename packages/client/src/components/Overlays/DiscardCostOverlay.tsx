/**
 * DiscardCostOverlay - Card selection UI for discard-as-cost (e.g. Improvisation)
 *
 * Shown when validActions.mode === "pending_discard_cost".
 * Uses CardSelectionOverlay to let the player select the required card(s) to discard,
 * then sends RESOLVE_DISCARD_ACTION. Cancel/undo sends UNDO_ACTION to revert the play.
 */

import { useCallback } from "react";
import { RESOLVE_DISCARD_ACTION, UNDO_ACTION } from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { CardSelectionOverlay } from "./CardSelectionOverlay";

export function DiscardCostOverlay() {
  const { state, sendAction } = useGame();

  const isActive =
    state?.validActions?.mode === "pending_discard_cost" &&
    state.validActions.discardCost != null;

  const discardCost = isActive ? state.validActions.discardCost : null;

  const handleSelect = useCallback(
    (selectedCards: readonly CardId[]) => {
      sendAction({
        type: RESOLVE_DISCARD_ACTION,
        cardIds: selectedCards,
      });
    },
    [sendAction]
  );

  const handleSkip = useCallback(() => {
    sendAction({
      type: RESOLVE_DISCARD_ACTION,
      cardIds: [],
    });
  }, [sendAction]);

  const handleUndo = useCallback(() => {
    sendAction({ type: UNDO_ACTION });
  }, [sendAction]);

  if (!isActive || !discardCost) {
    return null;
  }

  const { availableCardIds, count, optional } = discardCost;
  const minSelect = optional ? 0 : count;
  const maxSelect = count;

  const instruction =
    count === 1
      ? optional
        ? "Select a card to discard (or skip)"
        : "Select a card to discard"
      : optional
        ? `Select up to ${count} cards to discard (or skip)`
        : `Select ${count} cards to discard`;

  return (
    <CardSelectionOverlay
      cards={availableCardIds}
      instruction={instruction}
      minSelect={minSelect}
      maxSelect={maxSelect}
      canSkip={optional}
      skipText="Skip"
      onSelect={handleSelect}
      onSkip={optional ? handleSkip : undefined}
      onUndo={handleUndo}
    />
  );
}
