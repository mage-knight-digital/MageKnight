import type { ClientPlayer } from "@mage-knight/shared";
import { useGame } from "./useGame";

export function useMyPlayer(): ClientPlayer | null {
  const { state, myPlayerId } = useGame();
  if (!state) return null;
  return state.players.find((p) => p.id === myPlayerId) ?? null;
}
