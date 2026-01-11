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

export function ActionBar() {
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

  return (
    <div className="action-bar">
      <div className="action-bar__info">
        {isMyTurn ? (
          <span className="action-bar__turn-indicator action-bar__turn-indicator--active">
            Your Turn
          </span>
        ) : (
          <span className="action-bar__turn-indicator">
            Waiting for {state.currentPlayerId}
          </span>
        )}
      </div>

      <div className="action-bar__buttons">
        {canActivateTheRightMoment && (
          <button
            className="action-bar__btn action-bar__btn--tactic"
            onClick={handleActivateTheRightMoment}
            type="button"
            title="Take another turn after this one"
            style={{
              background: "#9b59b6",
              color: "#fff",
            }}
          >
            The Right Moment
          </button>
        )}
        {canActivateLongNight && (
          <button
            className="action-bar__btn action-bar__btn--tactic"
            onClick={handleActivateLongNight}
            type="button"
            title="Shuffle discard, put 3 cards back in deck"
            style={{
              background: "#2c3e50",
              color: "#fff",
            }}
          >
            Long Night
          </button>
        )}
        {canActivateMidnightMeditation && (
          <button
            className="action-bar__btn action-bar__btn--tactic"
            onClick={handleActivateMidnightMeditation}
            type="button"
            title="Shuffle hand cards into deck, draw same amount"
            style={{
              background: "#1a237e",
              color: "#fff",
            }}
          >
            Midnight Meditation
          </button>
        )}
        <button
          className="action-bar__btn action-bar__btn--undo"
          onClick={handleUndo}
          disabled={!isMyTurn || !canUndo}
          type="button"
          title="Undo last action (Ctrl+Z)"
          data-testid="undo-btn"
        >
          Undo
        </button>
        <button
          className="action-bar__btn action-bar__btn--end-turn"
          onClick={handleEndTurn}
          disabled={!isMyTurn || !hasTactic}
          type="button"
          data-testid="end-turn-btn"
        >
          End Turn
        </button>
      </div>
    </div>
  );
}
