import { useGame } from "../../hooks/useGame";
import { useIsMyTurn } from "../../hooks/useIsMyTurn";
import "./WaitingOverlay.css";

/**
 * Semi-transparent overlay shown when it is not the local player's turn.
 * Displays a waiting message with the current player's name.
 *
 * Uses pointer-events: none to allow viewing the game state without interaction.
 */
export function WaitingOverlay() {
  const { state } = useGame();
  const isMyTurn = useIsMyTurn();

  // Don't show overlay if it's my turn or no state loaded
  if (isMyTurn || !state) return null;

  // Find current player's hero name
  const currentPlayer = state.players.find(
    (p) => p.id === state.currentPlayerId
  );
  const playerName = currentPlayer?.heroId ?? "another player";

  return (
    <div className="waiting-overlay">
      <div className="waiting-overlay__message">
        Waiting for {playerName}&apos;s turn...
      </div>
    </div>
  );
}
