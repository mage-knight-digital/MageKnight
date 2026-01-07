import { useEffect } from "react";
import { END_TURN_ACTION, UNDO_ACTION } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";

export function ActionBar() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();

  const isMyTurn = state?.currentPlayerId === player?.id;
  const hasTactic = player?.selectedTacticId !== null;
  const canUndo = state?.validActions.turn?.canUndo ?? false;

  const handleEndTurn = () => {
    sendAction({ type: END_TURN_ACTION });
  };

  const handleUndo = () => {
    sendAction({ type: UNDO_ACTION });
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
        <button
          className="action-bar__btn action-bar__btn--undo"
          onClick={handleUndo}
          disabled={!isMyTurn || !canUndo}
          type="button"
          title="Undo last action (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          className="action-bar__btn action-bar__btn--end-turn"
          onClick={handleEndTurn}
          disabled={!isMyTurn || !hasTactic}
          type="button"
        >
          End Turn
        </button>
      </div>
    </div>
  );
}
