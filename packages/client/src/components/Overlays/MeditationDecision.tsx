/**
 * MeditationDecision - Card selection and placement UI for Meditation/Trance spell
 *
 * Shown when validActions.mode === "pending_meditation".
 *
 * Phase "select_cards" (powered mode): Player selects cards from discard pile.
 * Phase "place_cards": Player chooses to place selected cards on top or bottom of deck.
 *
 * Sends RESOLVE_MEDITATION_ACTION with selectedCardIds (phase 1) or placeOnTop (phase 2).
 */

import { useCallback } from "react";
import { RESOLVE_MEDITATION_ACTION } from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { CardSelectionOverlay } from "./CardSelectionOverlay";
import { useRegisterOverlay } from "../../contexts/OverlayContext";

export function MeditationDecision() {
  const { state, sendAction } = useGame();

  const isActive =
    state?.validActions?.mode === "pending_meditation" &&
    state.validActions.meditation != null;

  const options = isActive ? state.validActions.meditation : null;

  // Register overlay to block background interactions
  useRegisterOverlay(isActive);

  const handleSelectCards = useCallback(
    (selectedCards: readonly CardId[]) => {
      sendAction({
        type: RESOLVE_MEDITATION_ACTION,
        selectedCardIds: selectedCards,
      });
    },
    [sendAction]
  );

  const handlePlaceOnTop = useCallback(() => {
    sendAction({
      type: RESOLVE_MEDITATION_ACTION,
      placeOnTop: true,
    });
  }, [sendAction]);

  const handlePlaceOnBottom = useCallback(() => {
    sendAction({
      type: RESOLVE_MEDITATION_ACTION,
      placeOnTop: false,
    });
  }, [sendAction]);

  if (!isActive || !options) {
    return null;
  }

  // Phase 1: Select cards from discard (powered mode)
  if (options.phase === "select_cards" && options.eligibleCardIds && options.selectCount) {
    const instruction = `Select ${options.selectCount} card(s) from discard to place in deck`;
    return (
      <CardSelectionOverlay
        cards={options.eligibleCardIds}
        instruction={instruction}
        minSelect={options.selectCount}
        maxSelect={options.selectCount}
        canSkip={false}
        onSelect={handleSelectCards}
      />
    );
  }

  // Phase 2: Choose top or bottom placement
  if (options.phase === "place_cards") {
    return (
      <div className="overlay overlay--meditation-placement">
        <div className="overlay__content">
          <h3>Place cards on top or bottom of deck?</h3>
          <div className="overlay__buttons">
            <button className="btn btn--primary" onClick={handlePlaceOnTop}>
              Top of Deck
            </button>
            <button className="btn btn--secondary" onClick={handlePlaceOnBottom}>
              Bottom of Deck
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
