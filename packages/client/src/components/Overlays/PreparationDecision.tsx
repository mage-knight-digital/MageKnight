import { useCallback, useMemo } from "react";
import type { CardId } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { CardSelectionOverlay } from "./CardSelectionOverlay";
import { actionData } from "../../rust/types";

export function PreparationDecision() {
  const { sendAction, legalActions } = useGame();
  const player = useMyPlayer();

  // Preparation is a tactic_decision pending with ResolveTacticDecision(preparation) actions
  const isActive = player?.pending?.kind === "tactic_decision";

  const preparationActions = useMemo(() => {
    if (!isActive) return [];
    return legalActions.filter((a) => {
      if (typeof a === "string") return false;
      const d = actionData(a)?.["data"] as Record<string, unknown> | undefined;
      return "ResolveTacticDecision" in a && d?.["type"] === "preparation";
    });
  }, [isActive, legalActions]);

  // Not a preparation decision if no preparation actions exist
  if (!isActive || preparationActions.length === 0 || !player) {
    return null;
  }

  // Card IDs from pending info (deck snapshot exposed by server)
  const deckSnapshot = player.pending?.cardIds ?? [];

  const handleSelectCard = useCallback(
    (selectedCards: readonly CardId[]) => {
      const cardId = selectedCards[0];
      if (!cardId) return;
      const deckIndex = deckSnapshot.indexOf(cardId);
      if (deckIndex >= 0) {
        const action = preparationActions.find((a) => {
          const d = actionData(a)?.["data"] as Record<string, unknown> | undefined;
          return d?.["deck_card_index"] === deckIndex;
        });
        if (action) sendAction(action);
      }
    },
    [sendAction, preparationActions, deckSnapshot]
  );

  if (deckSnapshot.length === 0) {
    return null;
  }

  return (
    <CardSelectionOverlay
      cards={deckSnapshot as readonly CardId[]}
      instruction="Preparation: Choose a card from your deck to add to your hand"
      minSelect={1}
      maxSelect={1}
      canSkip={false}
      onSelect={handleSelectCard}
    />
  );
}
