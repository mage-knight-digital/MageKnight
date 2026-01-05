import { END_TURN_ACTION } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";

export function ActionBar() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();

  if (!state || !player) return null;

  const isMyTurn = state.currentPlayerId === player.id;
  const hasTactic = player.selectedTacticId !== null;

  const handleEndTurn = () => {
    sendAction({ type: END_TURN_ACTION });
  };

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
