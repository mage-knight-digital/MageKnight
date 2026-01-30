/**
 * Hero selection grid for game setup.
 * Displays available heroes and tracks which players have selected which heroes.
 */

import type { HeroId } from "@mage-knight/shared";
import { HeroCard } from "./HeroCard";
import "./SetupScreen.css";

interface HeroSelectionGridProps {
  /** Heroes available for selection */
  availableHeroes: readonly HeroId[];
  /** Selected heroes for each player slot (null = unselected) */
  selectedHeroes: (HeroId | null)[];
  /** Callback when a hero is selected for a player slot */
  onSelectHero: (playerIndex: number, hero: HeroId) => void;
  /** Which player slot is currently selecting */
  currentPlayerIndex: number;
}

export function HeroSelectionGrid({
  availableHeroes,
  selectedHeroes,
  onSelectHero,
  currentPlayerIndex,
}: HeroSelectionGridProps) {
  /**
   * Check if a hero is available for selection by the current player.
   * A hero is available if:
   * 1. It's not selected by any player, OR
   * 2. It's selected by the current player (they can re-select it)
   */
  const isHeroAvailable = (hero: HeroId): boolean => {
    const selectedIndex = selectedHeroes.indexOf(hero);
    return selectedIndex === -1 || selectedIndex === currentPlayerIndex;
  };

  /**
   * Get which player index has selected a given hero.
   * Returns undefined if hero is not selected.
   */
  const getPlayerIndexForHero = (hero: HeroId): number | undefined => {
    const index = selectedHeroes.indexOf(hero);
    return index >= 0 ? index : undefined;
  };

  // Check if all players have selected
  const allSelected = selectedHeroes.every((h) => h !== null);

  return (
    <div className="hero-selection-grid">
      <h2 className="setup-section-title">
        {allSelected
          ? "All heroes selected"
          : `Select Hero for Player ${currentPlayerIndex + 1}`}
      </h2>
      <div className="hero-grid">
        {availableHeroes.map((hero) => {
          const playerIndex = getPlayerIndexForHero(hero);
          const isSelected = selectedHeroes[currentPlayerIndex] === hero;
          const isDisabled = !isHeroAvailable(hero);

          return (
            <HeroCard
              key={hero}
              hero={hero}
              selected={isSelected}
              disabled={isDisabled}
              playerIndex={playerIndex}
              onClick={() => onSelectHero(currentPlayerIndex, hero)}
            />
          );
        })}
      </div>
    </div>
  );
}
