/**
 * Player count selector for game setup.
 * Displays 1-4 controls to choose the number of players.
 */

import "./SetupScreen.css";

const SETUP_PLAYERS_GROUP_ARIA = "Number of players" as const;

interface PlayerCountSelectorProps {
  /** Currently selected player count */
  selectedCount: number;
  /** Callback when player count changes */
  onSelectCount: (count: number) => void;
  /** Minimum number of players (from scenario config) */
  minPlayers?: number;
  /** Maximum number of players (from scenario config) */
  maxPlayers?: number;
}

export function PlayerCountSelector({
  selectedCount,
  onSelectCount,
  minPlayers = 1,
  maxPlayers = 4,
}: PlayerCountSelectorProps) {
  const counts = Array.from(
    { length: maxPlayers - minPlayers + 1 },
    (_, i) => i + minPlayers
  );

  return (
    <div
      className="setup-players"
      role="group"
      aria-label={SETUP_PLAYERS_GROUP_ARIA}
    >
      <span className="setup-players__label">Players</span>
      <div className="setup-players__rail">
        {counts.map((count) => (
          <button
            key={count}
            type="button"
            className={`setup-players__btn ${count === selectedCount ? "setup-players__btn--on" : ""}`}
            onClick={() => onSelectCount(count)}
            aria-pressed={count === selectedCount}
          >
            {count}
          </button>
        ))}
      </div>
    </div>
  );
}
