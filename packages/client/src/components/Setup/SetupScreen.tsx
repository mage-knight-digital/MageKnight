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
import { HeroSelectionGrid } from "./HeroSelectionGrid";
import "./SetupScreen.css";

const SETUP_BEGIN_ARIA_READY = "Begin scenario" as const;
const SETUP_BEGIN_ARIA_PENDING =
  "Begin scenario, locked until every player seat has a hero" as const;
const SETUP_MAX_PLAYERS = 4;
type SetupStep = "table" | "heroes";

function getSlotState(index: number, isEnabled: boolean): "Host" | "Seat" | "Closed" {
  if (!isEnabled) return "Closed";
  return index === 0 ? "Host" : "Seat";
}

interface SetupScreenProps {
  /** Callback when setup is complete and game should start */
  onComplete: (config: GameConfig) => void;
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const [setupStep, setSetupStep] = useState<SetupStep>("table");

  // Player count (1-4)
  const [playerCount, setPlayerCount] = useState(1);

  // Selected heroes for each player slot (null = unselected)
  const [selectedHeroes, setSelectedHeroes] = useState<(HeroId | null)[]>([
    null,
  ]);

  /**
   * Handle player count change.
   * Preserves selections for seats that remain active.
   */
  const handlePlayerCountChange = useCallback((count: number) => {
    setPlayerCount(count);
    setSelectedHeroes((prev) =>
      Array.from({ length: count }, (_, index) => prev[index] ?? null)
    );
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

  const renderSeatSockets = () => (
    <div className="setup-screen__seats" aria-label="Player seats">
      {Array.from({ length: SETUP_MAX_PLAYERS }, (_, index) => {
        const hero = selectedHeroes[index] ?? null;
        const isEnabled = index < playerCount;
        const isActive =
          isEnabled && !allSelected && index === activeSeatIndex;
        const heroName = hero ? HERO_NAMES[hero] : "Open";
        const seatLabel = isEnabled
          ? `Player ${index + 1}: ${heroName}`
          : `Player ${index + 1}: inactive`;

        return (
          <div
            key={`seat-${index + 1}`}
            className={`setup-seat-chip ${
              isEnabled ? "setup-seat-chip--enabled" : ""
            } ${isActive ? "setup-seat-chip--active" : ""} ${
              hero ? "setup-seat-chip--filled" : ""
            }`}
            aria-current={isActive ? "step" : undefined}
            aria-label={seatLabel}
          >
            <span className="setup-seat-chip__mark" aria-hidden="true" />
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="setup-screen">
      {setupStep === "table" ? (
        <main className="setup-table" aria-label="Table setup">
          <div className="setup-table__header">
            <p className="setup-table__eyebrow">Scenario setup</p>
            <h1 className="setup-table__title">Prepare the table</h1>
          </div>

          <section className="setup-table__slots" aria-label="Player slots">
            {Array.from({ length: SETUP_MAX_PLAYERS }, (_, index) => {
              const isEnabled = index < playerCount;
              const hero = selectedHeroes[index] ?? null;
              const heroName = hero ? HERO_NAMES[hero] : "Open";
              const slotState = getSlotState(index, isEnabled);

              return (
                <button
                  key={`table-seat-${index + 1}`}
                  type="button"
                  className={`setup-table-seat ${
                    isEnabled ? "setup-table-seat--open" : ""
                  }`}
                  onClick={() => handlePlayerCountChange(index + 1)}
                  aria-pressed={isEnabled}
                >
                  <span className="setup-table-seat__number">
                    P{index + 1}
                  </span>
                  <span className="setup-table-seat__name">
                    {isEnabled ? heroName : "Closed"}
                  </span>
                  <span className="setup-table-seat__state">{slotState}</span>
                </button>
              );
            })}
          </section>

          <section
            className="setup-table__settings"
            aria-label="Scenario settings"
          >
            <div className="setup-table-setting">
              <span className="setup-table-setting__label">Scenario</span>
              <strong className="setup-table-setting__value">
                {scenarioTitle}
              </strong>
            </div>
            <div className="setup-table-setting">
              <span className="setup-table-setting__label">Seats</span>
              <strong className="setup-table-setting__value">
                {playerCount}
              </strong>
            </div>
            <div className="setup-table-setting setup-table-setting--muted">
              <span className="setup-table-setting__label">Variants</span>
              <strong className="setup-table-setting__value">Standard</strong>
            </div>
          </section>

          <footer className="setup-table__footer">
            <button
              type="button"
              className="setup-screen__begin setup-screen__begin--ready"
              onClick={() => setSetupStep("heroes")}
            >
              Choose heroes
            </button>
          </footer>
        </main>
      ) : (
        <>
          <header className="setup-screen__hud">
            <div className="setup-screen__brand">
              <button
                type="button"
                className="setup-screen__back"
                onClick={() => setSetupStep("table")}
              >
                Table
              </button>
            </div>

            <div className="setup-screen__party">{renderSeatSockets()}</div>
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
        </>
      )}
    </div>
  );
}
