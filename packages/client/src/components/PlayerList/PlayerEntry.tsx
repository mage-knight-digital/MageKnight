import type { ClientPlayer } from "@mage-knight/shared";
import "./PlayerEntry.css";

interface PlayerEntryProps {
  player: ClientPlayer;
  isActive: boolean;
  isLocalPlayer: boolean;
}

export function PlayerEntry({ player, isActive, isLocalPlayer }: PlayerEntryProps) {
  const className = [
    "player-entry",
    isActive && "player-entry--active",
    !isActive && "player-entry--waiting",
    isLocalPlayer && "player-entry--local",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={className}
      title={`${player.heroId} - ${isActive ? "Active Turn" : "Waiting"}`}
      role="listitem"
      aria-current={isActive ? "true" : undefined}
    >
      {/* Hero name */}
      <span className="player-entry__hero">{player.heroId}</span>

      {/* Level */}
      <span className="player-entry__stat player-entry__stat--level" title="Level">
        <span className="player-entry__icon">⬡</span>
        <span className="player-entry__value">{player.level}</span>
      </span>

      {/* Fame */}
      <span className="player-entry__stat player-entry__stat--fame" title="Fame">
        <span className="player-entry__icon">★</span>
        <span className="player-entry__value">{player.fame}</span>
      </span>

      {/* Armor */}
      <span className="player-entry__stat player-entry__stat--armor" title="Armor">
        <span className="player-entry__icon">🛡</span>
        <span className="player-entry__value">{player.armor}</span>
      </span>

      {/* Move Points */}
      <span className="player-entry__stat player-entry__stat--move" title="Move Points">
        <span className="player-entry__icon">→</span>
        <span className="player-entry__value">{player.movePoints}</span>
      </span>

      {/* Influence Points */}
      <span className="player-entry__stat player-entry__stat--influence" title="Influence">
        <span className="player-entry__icon">♦</span>
        <span className="player-entry__value">{player.influencePoints}</span>
      </span>

      {/* YOU badge for local player */}
      {isLocalPlayer && (
        <span className="player-entry__badge">YOU</span>
      )}
    </div>
  );
}
