import { useCallback } from "react";
import {
  RESOLVE_TACTIC_DECISION_ACTION,
  TACTIC_DECISION_RETHINK,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { CardSelectionOverlay } from "./CardSelectionOverlay";

export function RethinkDecision() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();

  const pendingDecision =
    state?.validActions?.mode === "pending_tactic_decision"
      ? state.validActions.tacticDecision
      : undefined;

  const isActive =
    !!pendingDecision &&
    pendingDecision.type === TACTIC_DECISION_RETHINK &&
    !!player;

  const handleSelect = useCallback(
    (selectedCards: readonly CardId[]) => {
      sendAction({
        type: RESOLVE_TACTIC_DECISION_ACTION,
        decision: {
          type: TACTIC_DECISION_RETHINK,
          cardIds: selectedCards,
        },
      });
    },
    [sendAction]
  );

  const handleSkip = useCallback(() => {
    sendAction({
      type: RESOLVE_TACTIC_DECISION_ACTION,
      decision: {
        type: TACTIC_DECISION_RETHINK,
        cardIds: [],
      },
    });
  }, [sendAction]);

  if (!isActive || !pendingDecision || !player) {
    return null;
  }

  const maxCards = pendingDecision.maxCards ?? 3;
  const hand = Array.isArray(player.hand) ? player.hand : [];

  return (
    <CardSelectionOverlay
      cards={hand}
      instruction={`Rethink: Select up to ${maxCards} cards to discard and redraw`}
      minSelect={1}
      maxSelect={maxCards}
      canSkip={true}
      skipText="Skip (Discard Nothing)"
      onSelect={handleSelect}
      onSkip={handleSkip}
    />
  );
}
