/**
 * CrystalJoyReclaimDecision - Card selection UI for Crystal Joy reclaim
 *
 * Shown when player.pending.kind === "crystal_joy_reclaim".
 * Allows player to select which card from discard to reclaim (or skip).
 * Sends the ResolveCrystalJoyReclaim legal action directly.
 */

import { useCallback, useMemo } from "react";
import type { CardId } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { CardSelectionOverlay } from "./CardSelectionOverlay";
import { actionData } from "../../rust/types";

export function CrystalJoyReclaimDecision() {
  const { sendAction, legalActions } = useGame();
  const player = useMyPlayer();

  const isActive = player?.pending?.kind === "crystal_joy_reclaim";

  const reclaimActions = useMemo(() => {
    if (!isActive) return [];
    return legalActions.filter(
      (a) => typeof a !== "string" && "ResolveCrystalJoyReclaim" in a
    );
  }, [isActive, legalActions]);

  // Card IDs from pending info (discard pile exposed by server)
  const pendingCardIds = player?.pending?.cardIds;
  const discardCardIds = useMemo(() => pendingCardIds ?? [], [pendingCardIds]);

  // Build selectable card IDs from legal action discard indices
  const eligibleCardIds = useMemo(() => {
    return reclaimActions
      .map((a) => {
        const idx = actionData(a)?.["discard_index"] as number | null;
        if (idx === null) return null;
        return discardCardIds[idx] ?? null;
      })
      .filter((id): id is CardId => id !== null);
  }, [reclaimActions, discardCardIds]);

  // Check if skip is available (discard_index: null)
  const canSkip = reclaimActions.some(
    (a) => actionData(a)?.["discard_index"] === null
  );

  const handleSelect = useCallback(
    (selectedCards: readonly CardId[]) => {
      const cardId = selectedCards[0];
      if (!cardId) return;
      const discardIndex = discardCardIds.indexOf(cardId);
      if (discardIndex >= 0) {
        const action = reclaimActions.find(
          (a) => actionData(a)?.["discard_index"] === discardIndex
        );
        if (action) sendAction(action);
      }
    },
    [sendAction, reclaimActions, discardCardIds]
  );

  const handleSkip = useCallback(() => {
    const action = reclaimActions.find(
      (a) => actionData(a)?.["discard_index"] === null
    );
    if (action) sendAction(action);
  }, [sendAction, reclaimActions]);

  if (!isActive || eligibleCardIds.length === 0) {
    return null;
  }

  return (
    <CardSelectionOverlay
      cards={eligibleCardIds}
      instruction="Select a card to reclaim or skip"
      minSelect={0}
      maxSelect={1}
      canSkip={canSkip}
      skipText="Skip"
      onSelect={handleSelect}
      onSkip={canSkip ? handleSkip : undefined}
    />
  );
}
