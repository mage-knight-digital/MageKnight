/**
 * RoundTimeOverlay - Displays round number and time of day in a corner of the game board
 *
 * Shows the current round and whether it's Day or Night.
 * Positioned in the top-right corner of the hex grid area.
 */

import { useGame } from "../../hooks/useGame";
import { TIME_OF_DAY_DAY, TIME_OF_DAY_NIGHT } from "@mage-knight/shared";

export function RoundTimeOverlay() {
  const { state } = useGame();

  if (!state) return null;

  const isNight = state.timeOfDay === TIME_OF_DAY_NIGHT;

  return (
    <div className="round-time-overlay">
      <div className="round-time-overlay__round">
        Round {state.round}
      </div>
      <div className={`round-time-overlay__time ${isNight ? "round-time-overlay__time--night" : ""}`}>
        {state.timeOfDay === TIME_OF_DAY_DAY ? "Day" : "Night"}
      </div>
    </div>
  );
}
