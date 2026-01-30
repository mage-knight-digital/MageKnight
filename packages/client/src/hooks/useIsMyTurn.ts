import { useGame } from "./useGame";
import { useMyPlayer } from "./useMyPlayer";

/**
 * Returns whether it is currently the local player's turn.
 * Used to disable UI interactions when waiting for other players.
 *
 * Returns false if game state or player is not yet loaded (safe default).
 */
export function useIsMyTurn(): boolean {
  const { state } = useGame();
  const player = useMyPlayer();

  if (!state || !player) return false;
  return state.currentPlayerId === player.id;
}
