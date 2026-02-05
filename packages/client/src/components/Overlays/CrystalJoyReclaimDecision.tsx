/**
 * CrystalJoyReclaimDecision - Card selection UI for Crystal Joy reclaim
 *
 * Shown when validActions.mode === "pending_crystal_joy_reclaim".
 * Allows player to select which card from discard to reclaim (or skip).
 * Sends RESOLVE_CRYSTAL_JOY_RECLAIM_ACTION with selected cardId or undefined for skip.
 */

import { useCallback } from "react";
import { RESOLVE_CRYSTAL_JOY_RECLAIM_ACTION } from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { CardSelectionOverlay } from "./CardSelectionOverlay";

export function CrystalJoyReclaimDecision() {
  const { state, sendAction } = useGame();

  const isActive =
    state?.validActions?.mode === "pending_crystal_joy_reclaim" &&
    state.validActions.crystalJoyReclaim != null;

  const options = isActive ? state.validActions.crystalJoyReclaim : null;

  const handleSelect = useCallback(
    (selectedCards: readonly CardId[]) => {
      // We expect exactly 1 card or none (skip)
      const cardId = selectedCards.length > 0 ? selectedCards[0] : undefined;
      sendAction({
        type: RESOLVE_CRYSTAL_JOY_RECLAIM_ACTION,
        cardId,
      });
    },
    [sendAction]
  );

  const handleSkip = useCallback(() => {
    sendAction({
      type: RESOLVE_CRYSTAL_JOY_RECLAIM_ACTION,
      cardId: undefined,
    });
  }, [sendAction]);

  if (!isActive || !options) {
    return null;
  }

  const { eligibleCardIds } = options;

  const instruction = "Select a card to reclaim or skip";

  return (
    <CardSelectionOverlay
      cards={eligibleCardIds}
      instruction={instruction}
      minSelect={0}
      maxSelect={1}
      canSkip={true}
      skipText="Skip"
      onSelect={handleSelect}
      onSkip={handleSkip}
    />
  );
}
