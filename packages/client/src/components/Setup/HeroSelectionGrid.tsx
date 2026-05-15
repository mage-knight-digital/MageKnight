/**
 * Hero selection: Divinity-style full-stage spotlight + bottom filmstrip.
 * Uses octagonal agon portraits (`*_card.png`), not circular crops.
 */

import { useCallback, useEffect, useState } from "react";
import type { HeroId } from "@mage-knight/shared";
import { HERO_NAMES } from "@mage-knight/shared";
import { getHeroTokenUrl } from "../../assets/assetPaths";
import { HeroCard } from "./HeroCard";
import "./SetupScreen.css";

const SETUP_HERO_ROSTER_ARIA_LABEL = "Choose a hero from the roster strip" as const;

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
  const isHeroAvailable = useCallback(
    (hero: HeroId): boolean => {
      const selectedIndex = selectedHeroes.indexOf(hero);
      return selectedIndex === -1 || selectedIndex === currentPlayerIndex;
    },
    [currentPlayerIndex, selectedHeroes]
  );

  const getPlayerIndexForHero = useCallback(
    (hero: HeroId): number | undefined => {
      const index = selectedHeroes.indexOf(hero);
      return index >= 0 ? index : undefined;
    },
    [selectedHeroes]
  );

  const [spotlightHero, setSpotlightHero] = useState<HeroId>(
    () => availableHeroes[0]!
  );

  useEffect(() => {
    const assigned = selectedHeroes[currentPlayerIndex];
    if (assigned != null) {
      setSpotlightHero(assigned);
      return;
    }
    const firstFree = availableHeroes.find((h) => isHeroAvailable(h));
    setSpotlightHero(firstFree ?? availableHeroes[0]!);
  }, [
    availableHeroes,
    currentPlayerIndex,
    isHeroAvailable,
    selectedHeroes,
  ]);

  const handleStripHover = useCallback(
    (hero: HeroId) => {
      if (isHeroAvailable(hero)) {
        setSpotlightHero(hero);
      }
    },
    [isHeroAvailable]
  );

  const splashUrl = getHeroTokenUrl(spotlightHero);
  const splashName = HERO_NAMES[spotlightHero];
  const selectedByIndex = getPlayerIndexForHero(spotlightHero);
  const heroState = selectedByIndex === undefined ? "Available" : null;

  return (
    <div
      className="setup-hero-stage"
      role="region"
      aria-label={SETUP_HERO_ROSTER_ARIA_LABEL}
    >
      <div
        key={spotlightHero}
        className="setup-hero-splash-bg"
        style={{ backgroundImage: `url(${splashUrl})` }}
        aria-hidden
      />
      <div className="setup-hero-splash-scrim" aria-hidden />
      <div className="setup-hero-splash-vignette" aria-hidden />

      <div className="setup-hero-stage-inner">
        <div key={spotlightHero} className="setup-hero-splash-main">
          <img
            src={splashUrl}
            alt=""
            className="setup-hero-splash-token"
            decoding="async"
            draggable={false}
          />
          <p className="setup-hero-splash-name">{splashName}</p>
          {heroState ? (
            <p className="setup-hero-splash-state">{heroState}</p>
          ) : null}
        </div>

        <div className="setup-hero-strip" role="presentation">
          {availableHeroes.map((hero) => {
            const playerIndex = getPlayerIndexForHero(hero);
            const isSelected = selectedHeroes[currentPlayerIndex] === hero;
            const isDisabled = !isHeroAvailable(hero);

            return (
              <HeroCard
                key={hero}
                hero={hero}
                strip
                selected={isSelected}
                disabled={isDisabled}
                playerIndex={playerIndex}
                onHover={() => handleStripHover(hero)}
                onClick={() => onSelectHero(currentPlayerIndex, hero)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
