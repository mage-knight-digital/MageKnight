/**
 * DiscardCostOverlay - Card selection UI for discard-for-crystal (e.g., Savage Harvesting)
 *
 * Shown when player.pending.kind === "discard_for_crystal" only.
 * Other discard kinds ("discard", "discard_for_bonus") use different action types
 * and are handled elsewhere. Cancel/undo sends Undo to revert.
 */

import { useCallback, useMemo } from "react";
import type { CardId } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { CardSelectionOverlay } from "./CardSelectionOverlay";
import { actionData } from "../../rust/types";
import { hasAction, findAction } from "../../rust/legalActionUtils";

export function DiscardCostOverlay() {
  const { sendAction, legalActions } = useGame();
  const player = useMyPlayer();

  const kind = player?.pending?.kind;
  const isActive = kind === "discard_for_crystal";

  const discardActions = useMemo(() => {
    if (!isActive) return [];
    return legalActions.filter(
      (a) => typeof a !== "string" && "ResolveDiscardForCrystal" in a
    );
  }, [isActive, legalActions]);

  // Check for skip option (card_id: null)
  const canSkip = discardActions.some(
    (a) => actionData(a)?.["card_id"] === null
  );

  const canUndo = hasAction(legalActions, "Undo");

  // Build selectable card IDs from the actions
  const availableCardIds = useMemo(() => {
    return discardActions
      .map((a) => actionData(a)?.["card_id"] as string | null)
      .filter((id): id is string => id !== null) as CardId[];
  }, [discardActions]);

  const handleSelect = useCallback(
    (selectedCards: readonly CardId[]) => {
      const cardId = selectedCards[0];
      if (!cardId) return;
      const action = discardActions.find(
        (a) => actionData(a)?.["card_id"] === cardId
      );
      if (action) sendAction(action);
    },
    [sendAction, discardActions]
  );

  const handleSkip = useCallback(() => {
    const action = discardActions.find(
      (a) => actionData(a)?.["card_id"] === null
    );
    if (action) sendAction(action);
  }, [sendAction, discardActions]);

  const handleUndo = useCallback(() => {
    const action = findAction(legalActions, "Undo");
    if (action) sendAction(action);
  }, [sendAction, legalActions]);

  if (!isActive || availableCardIds.length === 0) {
    return null;
  }

  const instruction = canSkip
    ? "Select a card to discard (or skip)"
    : "Select a card to discard";

  return (
    <CardSelectionOverlay
      cards={availableCardIds}
      instruction={instruction}
      minSelect={1}
      maxSelect={1}
      canSkip={canSkip}
      skipText="Skip"
      onSelect={handleSelect}
      onSkip={canSkip ? handleSkip : undefined}
      onUndo={canUndo ? handleUndo : undefined}
    />
  );
}
