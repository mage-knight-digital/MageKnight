import { useCallback } from "react";
import type { CardId } from "@mage-knight/shared";
import {
  RESOLVE_TACTIC_DECISION_ACTION,
  TACTIC_DECISION_PREPARATION,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { CardSelectionOverlay } from "./CardSelectionOverlay";

export function PreparationDecision() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();

  // Check if we have a pending Preparation decision
  const pendingDecision =
    state?.validActions?.mode === "pending_tactic_decision"
      ? state.validActions.tacticDecision
      : undefined;

  const isActive =
    !!pendingDecision &&
    pendingDecision.type === TACTIC_DECISION_PREPARATION &&
    !!player;

  const handleSelectCard = useCallback(
    (selectedCards: readonly CardId[]) => {
      const cardId = selectedCards[0];
      if (!cardId) return;
      sendAction({
        type: RESOLVE_TACTIC_DECISION_ACTION,
        decision: {
          type: TACTIC_DECISION_PREPARATION,
          cardId,
        },
      });
    },
    [sendAction]
  );

  if (!isActive || !pendingDecision) {
    return null;
  }

  const deckSnapshot: readonly CardId[] = pendingDecision.deckSnapshot ?? [];

  return (
    <CardSelectionOverlay
      cards={deckSnapshot}
      instruction="Preparation: Choose a card from your deck to add to your hand"
      minSelect={1}
      maxSelect={1}
      canSkip={false}
      onSelect={handleSelectCard}
    />
  );
}
