/**
 * Player count selector for game setup.
 * Displays 1-4 buttons to choose the number of players.
 */

import "./SetupScreen.css";

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
    <div className="player-count-selector">
      <h2 className="setup-section-title">Number of Players</h2>
      <div className="count-buttons">
        {counts.map((count) => (
          <button
            key={count}
            type="button"
            className={`count-button ${count === selectedCount ? "count-button--selected" : ""}`}
            onClick={() => onSelectCount(count)}
          >
            {count}
          </button>
        ))}
      </div>
    </div>
  );
}
