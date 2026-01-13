/**
 * ManaSourceOverlay - Displays mana source dice in a corner of the game board
 *
 * Shows the shared mana dice pool that all players can see.
 * Positioned in the bottom-left corner of the hex grid area.
 */

import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_GOLD,
  MANA_BLACK,
} from "@mage-knight/shared";

function getManaColor(color: string): string {
  switch (color) {
    case MANA_RED:
      return "#e74c3c";
    case MANA_BLUE:
      return "#3498db";
    case MANA_GREEN:
      return "#2ecc71";
    case MANA_WHITE:
      return "#bdc3c7";
    case MANA_GOLD:
      return "#f39c12";
    case MANA_BLACK:
      return "#2c3e50";
    default:
      return "#666";
  }
}

export function ManaSourceOverlay() {
  const { state } = useGame();
  const player = useMyPlayer();

  if (!state) return null;

  const myId = player?.id;

  return (
    <div className="mana-source-overlay">
      <div className="mana-source-overlay__label">Source</div>
      <div className="mana-source-overlay__dice">
        {state.source.dice.map((die) => {
          const isTakenByMe = die.takenByPlayerId === myId;
          const isTakenByOther = die.takenByPlayerId !== null && !isTakenByMe;
          const isUnavailable = die.isDepleted || isTakenByMe || isTakenByOther;

          return (
            <div
              key={die.id}
              className={`mana-source-overlay__die ${isUnavailable ? 'mana-source-overlay__die--unavailable' : ''}`}
              style={{
                backgroundColor: isUnavailable ? '#333' : getManaColor(die.color),
              }}
              title={
                die.isDepleted
                  ? `${die.color} (depleted)`
                  : isTakenByMe
                    ? `${die.color} (used by you)`
                    : isTakenByOther
                      ? `${die.color} (taken)`
                      : die.color
              }
            >
              {die.color.charAt(0).toUpperCase()}
              {isTakenByMe && <span className="mana-source-overlay__die-status">U</span>}
              {isTakenByOther && <span className="mana-source-overlay__die-status">T</span>}
              {die.isDepleted && <span className="mana-source-overlay__die-status">D</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
