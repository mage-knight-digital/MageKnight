/**
 * Pre-game setup screen.
 * Allows players to configure player count and select heroes before starting.
 */

import { useState, useCallback } from "react";
import type { GameConfig, HeroId } from "@mage-knight/shared";
import { BASE_HEROES, SCENARIO_FIRST_RECONNAISSANCE } from "@mage-knight/shared";
import { PlayerCountSelector } from "./PlayerCountSelector";
import { HeroSelectionGrid } from "./HeroSelectionGrid";
import "./SetupScreen.css";

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

  return (
    <div className="setup-screen">
      <h1 className="setup-screen__title">Mage Knight</h1>

      <div className="setup-screen__content">
        <PlayerCountSelector
          selectedCount={playerCount}
          onSelectCount={handlePlayerCountChange}
        />

        <HeroSelectionGrid
          availableHeroes={BASE_HEROES}
          selectedHeroes={selectedHeroes}
          onSelectHero={handleSelectHero}
          currentPlayerIndex={
            currentPlayerIndex >= 0 ? currentPlayerIndex : playerCount - 1
          }
        />

        <button
          type="button"
          className="start-game-button"
          disabled={!allSelected}
          onClick={handleStartGame}
        >
          Start Game
        </button>
      </div>
    </div>
  );
}
