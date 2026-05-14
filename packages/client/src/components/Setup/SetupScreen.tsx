/**
 * Pre-game setup screen.
 * Allows players to configure player count and select heroes before starting.
 */

import { useState, useCallback } from "react";
import type { GameConfig, HeroId } from "@mage-knight/shared";
import {
  ALL_HEROES,
  HERO_NAMES,
  SCENARIO_DISPLAY_NAMES,
  SCENARIO_FIRST_RECONNAISSANCE,
} from "@mage-knight/shared";
import { PlayerCountSelector } from "./PlayerCountSelector";
import { HeroSelectionGrid } from "./HeroSelectionGrid";
import "./SetupScreen.css";

const SETUP_BEGIN_ARIA_READY = "Begin scenario" as const;
const SETUP_BEGIN_ARIA_PENDING =
  "Begin scenario, locked until every player seat has a hero" as const;

interface SetupScreenProps {
  /** Callback when setup is complete and game should start */
  onComplete: (config: GameConfig) => void;
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
  // Player count (1-4)
  const [playerCount, setPlayerCount] = useState(1);

  // Selected heroes for each player slot (null = unselected)
  const [selectedHeroes, setSelectedHeroes] = useState<(HeroId | null)[]>([
    null,
  ]);

  /**
   * Handle player count change.
   * Resets hero selections when count changes.
   */
  const handlePlayerCountChange = useCallback((count: number) => {
    setPlayerCount(count);
    setSelectedHeroes(Array(count).fill(null));
  }, []);

  /**
   * Handle hero selection for a specific player slot.
   */
  const handleSelectHero = useCallback(
    (playerIndex: number, hero: HeroId) => {
      setSelectedHeroes((prev) => {
        const newSelection = [...prev];
        newSelection[playerIndex] = hero;
        return newSelection;
      });
    },
    []
  );

  /**
   * Find the first player slot without a hero selected.
   * Returns -1 if all slots are filled.
   */
  const currentPlayerIndex = selectedHeroes.findIndex((h) => h === null);

  /**
   * Check if all players have selected heroes.
   */
  const allSelected = selectedHeroes.every((h) => h !== null);

  /**
   * Handle start game button click.
   */
  const handleStartGame = useCallback(() => {
    if (!allSelected) return;

    // Generate player IDs
    const playerIds = Array.from(
      { length: playerCount },
      (_, i) => `player${i + 1}`
    );

    // Cast is safe because we've verified allSelected
    const heroIds = selectedHeroes as HeroId[];

    onComplete({
      playerIds,
      heroIds,
      scenarioId: SCENARIO_FIRST_RECONNAISSANCE,
    });
  }, [allSelected, playerCount, selectedHeroes, onComplete]);

  const scenarioTitle =
    SCENARIO_DISPLAY_NAMES[SCENARIO_FIRST_RECONNAISSANCE];

  const activeSeatIndex =
    currentPlayerIndex >= 0 ? currentPlayerIndex : playerCount - 1;

  return (
    <div className="setup-screen">
      <header className="setup-screen__hud">
        <div className="setup-screen__brand">
          <p className="setup-screen__scenario">{scenarioTitle}</p>
        </div>

        <div className="setup-screen__party">
          <PlayerCountSelector
            selectedCount={playerCount}
            onSelectCount={handlePlayerCountChange}
          />

          <div className="setup-screen__seats" aria-label="Player seats">
            {selectedHeroes.map((hero, index) => {
              const isActive = !allSelected && index === activeSeatIndex;
              const heroName = hero ? HERO_NAMES[hero] : "Open";

              return (
                <div
                  key={`seat-${index + 1}`}
                  className={`setup-seat-chip ${isActive ? "setup-seat-chip--active" : ""} ${
                    hero ? "setup-seat-chip--filled" : ""
                  }`}
                  aria-current={isActive ? "step" : undefined}
                >
                  <span className="setup-seat-chip__label">P{index + 1}</span>
                  <span className="setup-seat-chip__value">{heroName}</span>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <main className="setup-screen__roster">
        <HeroSelectionGrid
          availableHeroes={ALL_HEROES}
          selectedHeroes={selectedHeroes}
          onSelectHero={handleSelectHero}
          currentPlayerIndex={activeSeatIndex}
        />
      </main>

      <footer className="setup-screen__footer">
        <button
          type="button"
          className="setup-screen__begin"
          disabled={!allSelected}
          onClick={handleStartGame}
          aria-label={
            allSelected ? SETUP_BEGIN_ARIA_READY : SETUP_BEGIN_ARIA_PENDING
          }
        >
          Begin scenario
        </button>
      </footer>
    </div>
  );
}
