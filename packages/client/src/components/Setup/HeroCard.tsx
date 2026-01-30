/**
 * Hero card component for setup screen.
 * Displays a hero portrait with selection state.
 */

import type { HeroId } from "@mage-knight/shared";
import { HERO_NAMES } from "@mage-knight/shared";
import "./SetupScreen.css";

// Player colors for badges (matches existing game UI)
const PLAYER_COLORS = ["#FF6B6B", "#4ECDC4", "#FFE66D", "#95E1D3"];

interface HeroCardProps {
  /** Hero to display */
  hero: HeroId;
  /** Whether this hero is currently selected by the active player slot */
  selected: boolean;
  /** Whether this hero is disabled (already selected by another player) */
  disabled: boolean;
  /** If selected, which player index (0-based) for the badge color */
  playerIndex?: number;
  /** Click handler */
  onClick: () => void;
}

export function HeroCard({
  hero,
  selected,
  disabled,
  playerIndex,
  onClick,
}: HeroCardProps) {
  const imagePath = `/assets/heroes/${hero}_card.png`;
  const heroName = HERO_NAMES[hero];

  return (
    <button
      type="button"
      className={`hero-card ${selected ? "hero-card--selected" : ""} ${disabled ? "hero-card--disabled" : ""}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        borderColor:
          selected && playerIndex !== undefined
            ? PLAYER_COLORS[playerIndex]
            : undefined,
      }}
    >
      <img
        src={imagePath}
        alt={heroName}
        className="hero-card__image"
        decoding="async"
        draggable={false}
      />
      <div className="hero-card__name">{heroName}</div>
      {playerIndex !== undefined && (
        <div
          className="hero-card__player-badge"
          style={{ backgroundColor: PLAYER_COLORS[playerIndex] }}
        >
          P{playerIndex + 1}
        </div>
      )}
    </button>
  );
}
