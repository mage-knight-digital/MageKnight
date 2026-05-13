/**
 * Hero card component for setup screen.
 * Displays a hero portrait with selection state.
 */

import type { HeroId } from "@mage-knight/shared";
import { HERO_NAMES } from "@mage-knight/shared";
import { getHeroTokenUrl } from "../../assets/assetPaths";
import "./SetupScreen.css";

// Distinct, saturated tones that keep light badge labels readable
const PLAYER_COLORS = ["#8b4513", "#1a4d3e", "#7c5e10", "#2c4a6e"];

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
  const imagePath = getHeroTokenUrl(hero);
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
        src={/* CodeQL[js/xss-through-dom, js/client-side-url-redirect] -- img src cannot execute scripts; URL base is protocol-validated in assetPaths.ts */ imagePath}
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
