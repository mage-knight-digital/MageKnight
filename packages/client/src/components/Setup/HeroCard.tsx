/**
 * Hero strip tile for setup (octagonal agon portrait).
 */

import type { CSSProperties } from "react";
import type { HeroId } from "@mage-knight/shared";
import { HERO_NAMES } from "@mage-knight/shared";
import { getHeroTokenUrl } from "../../assets/assetPaths";
import "./SetupScreen.css";

// Distinct, saturated tones that keep light badge labels readable
const PLAYER_COLORS = ["#8b4513", "#1a4d3e", "#7c5e10", "#2c4a6e"];

interface HeroCardProps {
  /** Hero to display */
  hero: HeroId;
  /** Compact agon tile for bottom filmstrip */
  strip?: boolean;
  /** Whether this hero is currently selected by the active player slot */
  selected: boolean;
  /** Whether this hero is disabled (already selected by another player) */
  disabled: boolean;
  /** If selected, which player index (0-based) for the badge color */
  playerIndex?: number;
  /** Hover preview on strip (updates spotlight hero) */
  onHover?: () => void;
  /** Click handler */
  onClick: () => void;
}

export function HeroCard({
  hero,
  strip = false,
  selected,
  disabled,
  playerIndex,
  onHover,
  onClick,
}: HeroCardProps) {
  const imagePath = getHeroTokenUrl(hero);
  const heroName = HERO_NAMES[hero];

  return (
    <button
      type="button"
      className={`hero-card ${strip ? "hero-card--strip" : ""} ${selected ? "hero-card--selected" : ""} ${disabled ? "hero-card--disabled" : ""}`}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={strip && onHover && !disabled ? onHover : undefined}
      disabled={disabled}
      style={
        selected && playerIndex !== undefined
          ? ({
              "--hero-seat-ring": PLAYER_COLORS[playerIndex],
            } as CSSProperties)
          : undefined
      }
    >
      <span className="hero-card__figure">
        <img
          src={imagePath}
          alt=""
          className="hero-card__image"
          decoding="async"
          draggable={false}
        />
      </span>
      <span className="hero-card__name">{heroName}</span>
      {playerIndex !== undefined && (
        <span
          className="hero-card__player-badge"
          style={{ backgroundColor: PLAYER_COLORS[playerIndex] }}
        >
          P{playerIndex + 1}
        </span>
      )}
    </button>
  );
}
