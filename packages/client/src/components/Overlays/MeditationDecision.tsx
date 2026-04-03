/**
 * MeditationDecision - Card selection and placement UI for Meditation/Trance spell
 *
 * Shown when player.pending.kind === "meditation".
 *
 * Phase 1 (select_cards): Each ResolveMeditation with place_on_top=null represents a selectable
 * discard card. MeditationDoneSelecting finishes selection.
 * Phase 2 (place_cards): ResolveMeditation with place_on_top=true/false for placement choice.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { CardId } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { CardSelectionOverlay } from "./CardSelectionOverlay";
import { useRegisterOverlay } from "../../contexts/OverlayContext";
import { actionData } from "../../rust/types";
import { hasAction, findAction } from "../../rust/legalActionUtils";

export function MeditationDecision() {
  const { sendAction, legalActions } = useGame();
  const player = useMyPlayer();

  const isActive = player?.pending?.kind === "meditation";

  // Register overlay to block background interactions
  useRegisterOverlay(isActive);

  // Separate legal actions by phase
  const { selectActions, canDoneSelecting, placeTopAction, placeBottomAction } = useMemo(() => {
    const selectActions = legalActions.filter((a) => {
      if (typeof a === "string") return false;
      const d = actionData(a);
      return "ResolveMeditation" in a && d?.["place_on_top"] === null;
    });
    const canDoneSelecting = hasAction(legalActions, "MeditationDoneSelecting");
    const placeTopAction = legalActions.find((a) => {
      if (typeof a === "string") return false;
      const d = actionData(a);
      return "ResolveMeditation" in a && d?.["place_on_top"] === true;
    });
    const placeBottomAction = legalActions.find((a) => {
      if (typeof a === "string") return false;
      const d = actionData(a);
      return "ResolveMeditation" in a && d?.["place_on_top"] === false;
    });
    return { selectActions, canDoneSelecting, placeTopAction, placeBottomAction };
  }, [legalActions]);

  // Phase detection: if we have place actions, we're in phase 2
  const isPlacePhase = !!placeTopAction || !!placeBottomAction;
  const isSelectPhase = selectActions.length > 0 || canDoneSelecting;

  // Card IDs from pending info (discard pile exposed by server)
  const pendingCardIds = player?.pending?.cardIds;
  const discardCardIds = useMemo(() => pendingCardIds ?? [], [pendingCardIds]);

  const handleSelectCard = useCallback(
    (selectedCards: readonly CardId[]) => {
      // Find the action matching the selected card's discard index
      const cardId = selectedCards[0];
      if (!cardId) return;
      const discardIndex = discardCardIds.indexOf(cardId);
      if (discardIndex >= 0) {
        const action = selectActions.find(
          (a) => actionData(a)?.["selection_index"] === discardIndex
        );
        if (action) sendAction(action);
      }
    },
    [sendAction, selectActions, discardCardIds]
  );

  const handleDoneSelecting = useCallback(() => {
    const action = findAction(legalActions, "MeditationDoneSelecting");
    if (action) sendAction(action);
  }, [sendAction, legalActions]);

  const handlePlaceOnTop = useCallback(() => {
    if (placeTopAction) sendAction(placeTopAction);
  }, [sendAction, placeTopAction]);

  const handlePlaceOnBottom = useCallback(() => {
    if (placeBottomAction) sendAction(placeBottomAction);
  }, [sendAction, placeBottomAction]);

  // Auto-complete when no selectable cards remain but done is available
  const autoCompletedRef = useRef(false);
  useEffect(() => {
    if (
      isActive &&
      isSelectPhase &&
      !isPlacePhase &&
      selectActions.length === 0 &&
      canDoneSelecting &&
      !autoCompletedRef.current
    ) {
      autoCompletedRef.current = true;
      handleDoneSelecting();
    } else if (!isActive || !canDoneSelecting) {
      autoCompletedRef.current = false;
    }
  }, [isActive, isSelectPhase, isPlacePhase, selectActions.length, canDoneSelecting, handleDoneSelecting]);

  if (!isActive) {
    return null;
  }

  // Phase 1: Select cards from discard (one at a time)
  if (isSelectPhase && !isPlacePhase) {
    // Build list of selectable card IDs based on legal action indices
    const selectableCardIds = selectActions
      .map((a) => {
        const idx = actionData(a)?.["selection_index"] as number;
        return discardCardIds[idx];
      })
      .filter((id): id is CardId => !!id);

    if (selectableCardIds.length > 0) {
      return (
        <CardSelectionOverlay
          cards={selectableCardIds}
          instruction="Meditation: Select a card from discard to place in deck"
          minSelect={1}
          maxSelect={1}
          canSkip={canDoneSelecting}
          skipText="Done Selecting"
          onSelect={handleSelectCard}
          onSkip={canDoneSelecting ? handleDoneSelecting : undefined}
        />
      );
    }

  }

  // Phase 2: Choose top or bottom placement
  if (isPlacePhase) {
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
