/**
 * Pre-game setup screen.
 * Allows players to configure player count and select heroes before starting.
 */

import { useState, useCallback } from "react";
import type { GameConfig, HeroId } from "@mage-knight/shared";
import {
  ALL_HEROES,
  GAME_LAUNCH_MODE_HOTSEAT,
  GAME_LAUNCH_MODE_SOLO,
  GAME_SEAT_CONTROLLER_LOCAL,
  HERO_NAMES,
  SCENARIO_BLITZ_CONQUEST_2P,
  SCENARIO_BLITZ_CONQUEST_3P,
  SCENARIO_BLITZ_CONQUEST_4P,
  SCENARIO_DISPLAY_NAMES,
  SCENARIO_FIRST_RECONNAISSANCE,
  SCENARIO_FULL_CONQUEST_2P,
  SCENARIO_FULL_CONQUEST_3P,
  SCENARIO_FULL_CONQUEST_4P,
} from "@mage-knight/shared";
import { HeroSelectionGrid } from "./HeroSelectionGrid";
import "./SetupScreen.css";

const SETUP_BEGIN_ARIA_READY = "Begin scenario" as const;
const SETUP_BEGIN_ARIA_PENDING =
  "Begin scenario, locked until every player seat has a hero" as const;
const SETUP_MAX_PLAYERS = 4;
const SETUP_PLAYER_ID_PREFIX = "player_" as const;
const SETUP_SCENARIO_STANDARD = "standard" as const;
const SETUP_SCENARIO_FULL_CONQUEST = "full_conquest" as const;
const SETUP_SCENARIO_BLITZ_CONQUEST = "blitz_conquest" as const;
const SETUP_SCENARIO_RECON_EXPLORE = "recon_explore" as const;
const SETUP_SCENARIO_EXPLORATION = "exploration" as const;
const SETUP_SCENARIO_EXPLORATION_TINY = "exploration_tiny" as const;
const SETUP_CATEGORY_ALL = "all" as const;
const SETUP_CATEGORY_LEARNING = "learning" as const;
const SETUP_CATEGORY_CONQUEST = "conquest" as const;
const SETUP_CATEGORY_DRILLS = "drills" as const;
type SetupStep = "table" | "heroes";
export type SetupScenarioKey =
  | typeof SETUP_SCENARIO_STANDARD
  | typeof SETUP_SCENARIO_FULL_CONQUEST
  | typeof SETUP_SCENARIO_BLITZ_CONQUEST
  | typeof SETUP_SCENARIO_RECON_EXPLORE
  | typeof SETUP_SCENARIO_EXPLORATION
  | typeof SETUP_SCENARIO_EXPLORATION_TINY;
type SetupScenarioCategory =
  | typeof SETUP_CATEGORY_LEARNING
  | typeof SETUP_CATEGORY_CONQUEST
  | typeof SETUP_CATEGORY_DRILLS;
type SetupScenarioFilter =
  | typeof SETUP_CATEGORY_ALL
  | SetupScenarioCategory;
type SetupPlayerCount = 1 | 2 | 3 | 4;

export interface SetupScenarioLaunchConfig {
  readonly scenarioId: GameConfig["scenarioId"];
  readonly serverScenario?: string;
}

interface SetupScenarioOption {
  readonly key: SetupScenarioKey;
  readonly category: SetupScenarioCategory;
  readonly title: string;
  readonly statusLabel: string;
  readonly summary: string;
  readonly detail: string;
  readonly launchConfig?: SetupScenarioLaunchConfig;
  readonly launchVariants?: Partial<Record<SetupPlayerCount, SetupScenarioLaunchConfig>>;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly rounds: string;
  readonly objective: string;
}

const SETUP_SCENARIO_CATEGORIES: readonly {
  readonly key: SetupScenarioFilter;
  readonly label: string;
}[] = [
  { key: SETUP_CATEGORY_ALL, label: "All" },
  { key: SETUP_CATEGORY_LEARNING, label: "Learning" },
  { key: SETUP_CATEGORY_CONQUEST, label: "Conquest" },
  { key: SETUP_CATEGORY_DRILLS, label: "Drills" },
] as const;

const SETUP_SCENARIOS: readonly SetupScenarioOption[] = [
  {
    key: SETUP_SCENARIO_STANDARD,
    category: SETUP_CATEGORY_LEARNING,
    title: SCENARIO_DISPLAY_NAMES[SCENARIO_FIRST_RECONNAISSANCE],
    statusLabel: "Launchable",
    summary: "Standard solo start with the Rust rules engine in charge.",
    detail: "City reveal objective, four rounds, dummy tactic timing.",
    launchConfig: {
      scenarioId: SCENARIO_FIRST_RECONNAISSANCE,
    },
    minPlayers: 1,
    maxPlayers: 1,
    rounds: "4 rounds",
    objective: "Reveal a city",
  },
  {
    key: SETUP_SCENARIO_FULL_CONQUEST,
    category: SETUP_CATEGORY_CONQUEST,
    title: "Full Conquest",
    statusLabel: "Launchable",
    summary: "Full table conquest for 2-4 local hotseat players.",
    detail: "Choose a local seat for each hero. The pass screen covers private hands between turns.",
    launchVariants: {
      2: { scenarioId: SCENARIO_FULL_CONQUEST_2P },
      3: { scenarioId: SCENARIO_FULL_CONQUEST_3P },
      4: { scenarioId: SCENARIO_FULL_CONQUEST_4P },
    },
    minPlayers: 2,
    maxPlayers: 4,
    rounds: "6 rounds",
    objective: "Conquer all cities",
  },
  {
    key: SETUP_SCENARIO_BLITZ_CONQUEST,
    category: SETUP_CATEGORY_CONQUEST,
    title: "Blitz Conquest",
    statusLabel: "Launchable",
    summary: "Shorter conquest arc with hotter fame and source pacing.",
    detail: "A faster 2-4 player hotseat conquest with the same local handoff privacy.",
    launchVariants: {
      2: { scenarioId: SCENARIO_BLITZ_CONQUEST_2P },
      3: { scenarioId: SCENARIO_BLITZ_CONQUEST_3P },
      4: { scenarioId: SCENARIO_BLITZ_CONQUEST_4P },
    },
    minPlayers: 2,
    maxPlayers: 4,
    rounds: "4 rounds",
    objective: "Conquer all cities",
  },
  {
    key: SETUP_SCENARIO_RECON_EXPLORE,
    category: SETUP_CATEGORY_DRILLS,
    title: "Recon Explore",
    statusLabel: "Launchable",
    summary: "First Recon map shape with a movement-heavy exploration deck.",
    detail: "Use this when you want to validate tile flow without combat pressure.",
    launchConfig: {
      scenarioId: SCENARIO_FIRST_RECONNAISSANCE,
      serverScenario: SETUP_SCENARIO_RECON_EXPLORE,
    },
    minPlayers: 1,
    maxPlayers: 1,
    rounds: "Explore drill",
    objective: "Reach the city",
  },
  {
    key: SETUP_SCENARIO_EXPLORATION,
    category: SETUP_CATEGORY_DRILLS,
    title: "Exploration",
    statusLabel: "Launchable",
    summary: "Compact countryside route for fast map and movement checks.",
    detail: "A shorter no-enemy drill that still exercises reveal decisions.",
    launchConfig: {
      scenarioId: SCENARIO_FIRST_RECONNAISSANCE,
      serverScenario: SETUP_SCENARIO_EXPLORATION,
    },
    minPlayers: 1,
    maxPlayers: 1,
    rounds: "Short drill",
    objective: "Reveal a city",
  },
  {
    key: SETUP_SCENARIO_EXPLORATION_TINY,
    category: SETUP_CATEGORY_DRILLS,
    title: "Tiny Exploration",
    statusLabel: "Launchable",
    summary: "Smallest supported exploration setup for quick smoke tests.",
    detail: "Useful when you want to get from setup to board interaction fast.",
    launchConfig: {
      scenarioId: SCENARIO_FIRST_RECONNAISSANCE,
      serverScenario: SETUP_SCENARIO_EXPLORATION_TINY,
    },
    minPlayers: 1,
    maxPlayers: 1,
    rounds: "Tiny drill",
    objective: "Reveal a city",
  },
] as const;

function getSetupScenario(key: SetupScenarioKey): SetupScenarioOption {
  return (
    SETUP_SCENARIOS.find((scenario) => scenario.key === key) ??
    SETUP_SCENARIOS[0]!
  );
}

function clampPlayerCount(count: number, scenario: SetupScenarioOption): number {
  return Math.min(Math.max(count, scenario.minPlayers), scenario.maxPlayers);
}

function toSetupPlayerCount(count: number): SetupPlayerCount {
  return Math.min(Math.max(count, 1), SETUP_MAX_PLAYERS) as SetupPlayerCount;
}

export function getSetupScenarioLaunchConfig(
  scenarioKey: SetupScenarioKey,
  playerCount: number
): SetupScenarioLaunchConfig | undefined {
  return getLaunchConfig(getSetupScenario(scenarioKey), playerCount);
}

function getLaunchConfig(
  scenario: SetupScenarioOption,
  playerCount: number
): SetupScenarioLaunchConfig | undefined {
  return (
    scenario.launchVariants?.[toSetupPlayerCount(playerCount)] ??
    scenario.launchConfig
  );
}

export function createGameConfigForSetup(
  playerCount: number,
  selectedHeroes: readonly (HeroId | null)[],
  launchConfig: SetupScenarioLaunchConfig
): GameConfig | null {
  const heroIds = selectedHeroes.slice(0, playerCount);
  if (heroIds.length !== playerCount || heroIds.some((hero) => hero == null)) {
    return null;
  }

  const playerIds = Array.from(
    { length: playerCount },
    (_, i) => `${SETUP_PLAYER_ID_PREFIX}${i}`
  );
  const seats = heroIds.map((heroId, index) => ({
    playerId: playerIds[index]!,
    heroId: heroId!,
    controller: GAME_SEAT_CONTROLLER_LOCAL,
  }));

  const config: GameConfig = {
    launchMode:
      playerCount > 1 ? GAME_LAUNCH_MODE_HOTSEAT : GAME_LAUNCH_MODE_SOLO,
    playerIds,
    heroIds: heroIds as HeroId[],
    seats,
    scenarioId: launchConfig.scenarioId,
  };

  if (!launchConfig.serverScenario) return config;

  return {
    ...config,
    serverScenario: launchConfig.serverScenario,
  };
}

interface SetupScreenProps {
  /** Callback when setup is complete and game should start */
  onComplete: (config: GameConfig) => void;
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const [setupStep, setSetupStep] = useState<SetupStep>("table");
  const [selectedScenarioKey, setSelectedScenarioKey] =
    useState<SetupScenarioKey>(SETUP_SCENARIO_STANDARD);
  const [selectedFilter, setSelectedFilter] =
    useState<SetupScenarioFilter>(SETUP_CATEGORY_ALL);

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
    const selectedScenario = getSetupScenario(selectedScenarioKey);
    const nextCount = clampPlayerCount(count, selectedScenario);
    setPlayerCount(nextCount);
    setSelectedHeroes((prev) =>
      Array.from({ length: nextCount }, (_, index) => prev[index] ?? null)
    );
  }, [selectedScenarioKey]);

  const handleScenarioChange = useCallback((scenarioKey: SetupScenarioKey) => {
    const scenario = getSetupScenario(scenarioKey);
    setSelectedScenarioKey(scenarioKey);
    setPlayerCount((currentCount) => {
      const nextCount = clampPlayerCount(currentCount, scenario);
      setSelectedHeroes((prev) =>
        Array.from({ length: nextCount }, (_, index) => prev[index] ?? null)
      );
      return nextCount;
    });
  }, []);

  const handleFilterChange = useCallback((filter: SetupScenarioFilter) => {
    setSelectedFilter(filter);
    if (
      filter === SETUP_CATEGORY_ALL ||
      getSetupScenario(selectedScenarioKey).category === filter
    ) {
      return;
    }

    const nextScenario =
      SETUP_SCENARIOS.find((scenario) => scenario.category === filter) ??
      SETUP_SCENARIOS[0]!;
    setSelectedScenarioKey(nextScenario.key);
    setPlayerCount((currentCount) => {
      const nextCount = clampPlayerCount(currentCount, nextScenario);
      setSelectedHeroes((prev) =>
        Array.from({ length: nextCount }, (_, index) => prev[index] ?? null)
      );
      return nextCount;
    });
  }, [selectedScenarioKey]);

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
  const selectedScenario = getSetupScenario(selectedScenarioKey);
  const scenarioTitle = selectedScenario.title;
  const launchConfig = getLaunchConfig(selectedScenario, playerCount);
  const isScenarioLaunchable = Boolean(launchConfig);
  const visibleScenarios = SETUP_SCENARIOS.filter(
    (scenario) =>
      selectedFilter === SETUP_CATEGORY_ALL ||
      scenario.category === selectedFilter
  );

  /**
   * Handle start game button click.
   */
  const handleStartGame = useCallback(() => {
    if (!allSelected || !launchConfig) return;

    const config = createGameConfigForSetup(
      playerCount,
      selectedHeroes,
      launchConfig
    );
    if (config) onComplete(config);
  }, [allSelected, playerCount, selectedHeroes, launchConfig, onComplete]);

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

          <section className="setup-scenario-browser" aria-label="Scenario library">
            <div className="setup-scenario-browser__header">
              <span className="setup-table-setting__label">
                Scenario library
              </span>
              <strong>{SETUP_SCENARIOS.length} entries</strong>
            </div>

            <div className="setup-scenario-tabs" role="tablist" aria-label="Scenario filters">
              {SETUP_SCENARIO_CATEGORIES.map((category) => (
                <button
                  key={category.key}
                  type="button"
                  className={`setup-scenario-tab ${
                    selectedFilter === category.key
                      ? "setup-scenario-tab--selected"
                      : ""
                  }`}
                  onClick={() => handleFilterChange(category.key)}
                  aria-selected={selectedFilter === category.key}
                  role="tab"
                >
                  {category.label}
                </button>
              ))}
            </div>

            <div className="setup-scenario-list setup-scenario-list--catalog">
              {visibleScenarios.map((scenario) => {
                const isSelected = scenario.key === selectedScenarioKey;

                return (
                  <button
                    key={scenario.key}
                    type="button"
                    className={`setup-scenario-option ${
                      isSelected ? "setup-scenario-option--selected" : ""
                    }`}
                    onClick={() => handleScenarioChange(scenario.key)}
                    aria-pressed={isSelected}
                  >
                    <span className="setup-scenario-option__topline">
                      <span className="setup-scenario-option__eyebrow">
                        {scenario.statusLabel}
                      </span>
                      <span className="setup-scenario-option__players">
                        {scenario.minPlayers === scenario.maxPlayers
                          ? `${scenario.maxPlayers}P`
                          : `${scenario.minPlayers}-${scenario.maxPlayers}P`}
                      </span>
                    </span>
                    <span className="setup-scenario-option__title">
                      {scenario.title}
                    </span>
                    <span className="setup-scenario-option__summary">
                      {scenario.summary}
                    </span>
                    <span className="setup-scenario-option__facts">
                      <span>{scenario.rounds}</span>
                      <span>{scenario.objective}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section
            className="setup-table__settings"
            aria-label="Scenario selection"
          >
            <div className="setup-table__scenario-heading">
              <span className="setup-table-setting__label">Scenario</span>
              <strong className="setup-table-setting__value">
                {scenarioTitle}
              </strong>
              <span className="setup-table__scenario-note">
                {selectedScenario.detail}
              </span>
            </div>

            <div
              className="setup-table__table-facts"
              aria-label="Selected table facts"
            >
              <div className="setup-table-fact">
                <span className="setup-table-setting__label">Seats</span>
                <strong className="setup-table-setting__value">
                  {playerCount}
                </strong>
              </div>
              <div className="setup-table-fact">
                <span className="setup-table-setting__label">Status</span>
                <strong className="setup-table-setting__value">
                  {selectedScenario.statusLabel}
                </strong>
              </div>
            </div>

            <div className="setup-seat-selector" aria-label="Player count">
              <span className="setup-table-setting__label">Players</span>
              <div className="setup-seat-selector__buttons">
                {Array.from({ length: SETUP_MAX_PLAYERS }, (_, index) => {
                  const count = index + 1;
                  const isSelectedCount = playerCount === count;
                  const isAvailable =
                    count >= selectedScenario.minPlayers &&
                    count <= selectedScenario.maxPlayers;

                  return (
                    <button
                      key={`table-seat-count-${count}`}
                      type="button"
                      className={`setup-seat-selector__button ${
                        isSelectedCount
                          ? "setup-seat-selector__button--open"
                          : ""
                      }`}
                      onClick={() => handlePlayerCountChange(count)}
                      disabled={!isAvailable}
                      aria-pressed={isSelectedCount}
                      aria-label={`${count} player${count === 1 ? "" : "s"}`}
                    >
                      {count}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <footer className="setup-table__footer">
            <button
              type="button"
              className="setup-screen__begin setup-screen__begin--ready"
              disabled={!isScenarioLaunchable}
              onClick={() => setSetupStep("heroes")}
            >
              {isScenarioLaunchable ? "Choose heroes" : "Launch path pending"}
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
