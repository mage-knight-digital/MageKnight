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

function getManaIconUrl(color: string): string {
  const colorMap: Record<string, string> = {
    [MANA_RED]: "red",
    [MANA_BLUE]: "blue",
    [MANA_GREEN]: "green",
    [MANA_WHITE]: "white",
    [MANA_GOLD]: "gold",
    [MANA_BLACK]: "black",
  };
  const colorName = colorMap[color] || "white";
  return `/assets/mana_icons/glossy/${colorName}.png`;
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
              <img
                src={getManaIconUrl(die.color)}
                alt={die.color}
                className="mana-source-overlay__die-icon"
              />
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
