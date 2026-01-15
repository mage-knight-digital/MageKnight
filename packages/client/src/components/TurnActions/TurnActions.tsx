import { useEffect } from "react";
import {
  END_TURN_ACTION,
  UNDO_ACTION,
  ACTIVATE_TACTIC_ACTION,
  TACTIC_THE_RIGHT_MOMENT,
  TACTIC_LONG_NIGHT,
  TACTIC_MIDNIGHT_MEDITATION,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import "./TurnActions.css";

export function TurnActions() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();

  const isMyTurn = state?.currentPlayerId === player?.id;
  const hasTactic = player?.selectedTacticId !== null;
  const canUndo = state?.validActions.turn?.canUndo ?? false;

  // Check for activatable tactics
  const canActivate = state?.validActions.tacticEffects?.canActivate;
  const canActivateTheRightMoment = canActivate?.theRightMoment === true;
  const canActivateLongNight = canActivate?.longNight === true;
  const canActivateMidnightMeditation = canActivate?.midnightMeditation === true;

  // Ctrl+Z / Cmd+Z keyboard shortcut for undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (canUndo && isMyTurn) {
          sendAction({ type: UNDO_ACTION });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, isMyTurn, sendAction]);

  if (!state || !player) return null;

  const handleEndTurn = () => {
    sendAction({ type: END_TURN_ACTION });
  };

  const handleUndo = () => {
    sendAction({ type: UNDO_ACTION });
  };

  const handleActivateTheRightMoment = () => {
    sendAction({ type: ACTIVATE_TACTIC_ACTION, tacticId: TACTIC_THE_RIGHT_MOMENT });
  };

  const handleActivateLongNight = () => {
    sendAction({ type: ACTIVATE_TACTIC_ACTION, tacticId: TACTIC_LONG_NIGHT });
  };

  const handleActivateMidnightMeditation = () => {
    sendAction({ type: ACTIVATE_TACTIC_ACTION, tacticId: TACTIC_MIDNIGHT_MEDITATION });
  };

  return (
    <>
      {/* End Turn - fixed bottom left, styled like a seal/sigil */}
      <button
        className="end-turn-seal"
        onClick={handleEndTurn}
        disabled={!isMyTurn || !hasTactic}
        type="button"
        data-testid="end-turn-btn"
        title="End your turn"
      >
        <span className="end-turn-seal__icon">⚔</span>
        <span className="end-turn-seal__text">End Turn</span>
      </button>

      {/* Other actions - right side */}
      <div className="turn-actions">
        {/* Tactic buttons */}
        {canActivateTheRightMoment && (
          <button
            className="turn-actions__btn turn-actions__btn--tactic"
            onClick={handleActivateTheRightMoment}
            type="button"
            title="Take another turn after this one"
          >
            Right Moment
          </button>
        )}
        {canActivateLongNight && (
          <button
            className="turn-actions__btn turn-actions__btn--tactic-dark"
            onClick={handleActivateLongNight}
            type="button"
            title="Shuffle discard, put 3 cards back in deck"
          >
            Long Night
          </button>
        )}
        {canActivateMidnightMeditation && (
          <button
            className="turn-actions__btn turn-actions__btn--tactic-dark"
            onClick={handleActivateMidnightMeditation}
            type="button"
            title="Shuffle hand cards into deck, draw same amount"
          >
            Meditation
          </button>
        )}

        {/* Undo button */}
        <button
          className="turn-actions__btn turn-actions__btn--undo"
          onClick={handleUndo}
          disabled={!isMyTurn || !canUndo}
          type="button"
          title="Undo last action (Ctrl+Z)"
          data-testid="undo-btn"
        >
          ↩
        </button>
      </div>
    </>
  );
}
