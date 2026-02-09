/**
 * Game state types and management
 */

import type { GamePhase, TimeOfDay, ScenarioId, ScenarioConfig, RoundPhase, TacticId, CooperativeAssaultProposal, FinalScoreResult, ManaColor, SkillId, BasicManaColor } from "@mage-knight/shared";
import type { DummyPlayer } from "../types/dummyPlayer.js";
import { GAME_PHASE_SETUP, TIME_OF_DAY_DAY, SCENARIO_FIRST_RECONNAISSANCE, ROUND_PHASE_PLAYER_TURNS } from "@mage-knight/shared";
import { getScenario } from "../data/scenarios/index.js";
import type { Player } from "../types/player.js";
import {
  type MapState,
  type CityColor,
  createEmptyMapState,
} from "../types/map.js";
import { type ManaSource, createEmptyManaSource } from "../types/mana.js";
import { type GameOffers, createEmptyOffers } from "../types/offers.js";
import {
  type EnemyTokenPiles,
  createEmptyEnemyTokenPiles,
} from "../types/enemy.js";
import {
  type RuinsTokenPiles,
  createEmptyRuinsTokenPiles,
} from "../engine/helpers/ruinsTokenHelpers.js";
import { type GameDecks, createEmptyDecks } from "../types/decks.js";
import type { CityState } from "../types/city.js";
import type { ActiveModifier } from "../types/modifiers.js";
import type { CombatState } from "../types/combat.js";
import {
  type CommandStackState,
  createEmptyCommandStack,
} from "../engine/commands/stack.js";
import { type RngState, createRng } from "../utils/rng.js";
import {
  INITIAL_CURRENT_PLAYER_INDEX,
  INITIAL_ROUND,
  INITIAL_WOUND_PILE_COUNT,
} from "./gameStateNumericConstants.js";

// Re-export types for convenience
export type { CombatState } from "../types/combat.js";
export type { MapState } from "../types/map.js";
export type { ManaSource } from "../types/mana.js";
export type { GameOffers } from "../types/offers.js";
export type { EnemyTokenPiles } from "../types/enemy.js";
export type { RuinsTokenPiles } from "../engine/helpers/ruinsTokenHelpers.js";
export type { GameDecks } from "../types/decks.js";
export type { CityState } from "../types/city.js";
export type { ActiveModifier } from "../types/modifiers.js";
export type { CommandStackState } from "../engine/commands/stack.js";
export type { RngState } from "../utils/rng.js";

/**
 * Tracks Mana Overload skill when placed in center.
 * When active, the first player to power a Deed card with the marked color
 * that gives Move/Influence/Attack/Block gets +4 and the skill returns to owner.
 */
export interface ManaOverloadCenter {
  /** The mana color marked on the skill token */
  readonly markedColor: ManaColor;
  /** Player ID who owns the skill (skill returns to them) */
  readonly ownerId: string;
  /** The skill ID (for returning to owner) */
  readonly skillId: SkillId;
}

/**
 * Tracks Mana Enhancement skill token in center.
 * When active, other players may return it to gain one mana token
 * of the marked basic color. Expires at start of owner's next turn.
 */
export interface ManaEnhancementCenter {
  /** The basic mana color marked on the skill token */
  readonly markedColor: BasicManaColor;
  /** Player ID who owns the skill (token returns/removes for them) */
  readonly ownerId: string;
  /** The skill ID (for return mechanics) */
  readonly skillId: SkillId;
}

/**
 * Tracks Source Opening skill state.
 * Phase 1 (center): `returningPlayerId` is null. Skill is in center awaiting return.
 * Phase 2 (returned): `returningPlayerId` is set. The returning player has an extra
 * basic-color die to use. When they use it, the owner gets a crystal of that color.
 * Crystal is granted at end of turn based on the extra die used.
 */
export interface SourceOpeningCenter {
  /** Player ID who owns the skill (Goldyx) */
  readonly ownerId: string;
  /** The skill ID (for returning to owner) */
  readonly skillId: SkillId;
  /** Player who returned the skill (set after return, null while in center) */
  readonly returningPlayerId: string | null;
  /** Number of dice the returning player had before the extra die was granted */
  readonly usedDieCountAtReturn: number;
}

export interface GameState {
  readonly phase: GamePhase;
  readonly timeOfDay: TimeOfDay;
  readonly round: number;
  readonly turnOrder: readonly string[]; // player IDs in current round order
  readonly currentPlayerIndex: number; // index into turnOrder
  readonly endOfRoundAnnouncedBy: string | null; // player ID who announced
  readonly playersWithFinalTurn: readonly string[]; // players who still get one more turn after announcement
  readonly players: readonly Player[];
  readonly map: MapState;
  readonly combat: CombatState | null; // null when not in combat

  // Tactics selection phase
  readonly roundPhase: RoundPhase; // Sub-phase within GAME_PHASE_ROUND
  readonly availableTactics: readonly TacticId[]; // Tactics not yet selected this round
  readonly removedTactics: readonly TacticId[]; // Tactics removed from game (solo/co-op modes)
  readonly dummyPlayerTactic: TacticId | null; // Tactic selected by dummy player (solo mode)
  readonly tacticsSelectionOrder: readonly string[]; // Order in which players select (reverse of last turn order)
  readonly currentTacticSelector: string | null; // Player ID currently selecting, null if phase complete

  // Mana source (dice pool)
  readonly source: ManaSource;

  // All offers
  readonly offers: GameOffers;

  // Enemy tokens
  readonly enemyTokens: EnemyTokenPiles;

  // Ruins tokens (Ancient Ruins yellow tokens)
  readonly ruinsTokens: RuinsTokenPiles;

  // All draw decks (spells, advanced actions, artifacts, units)
  readonly decks: GameDecks;

  // City configuration
  readonly cityLevel: number; // garrison level for cities (1-11)

  // City states (only revealed cities have entries)
  readonly cities: Partial<Record<CityColor, CityState>>;

  // Active modifiers (from skills, cards, units, etc.)
  readonly activeModifiers: readonly ActiveModifier[];

  // Command stack for undo support (cleared at end of turn)
  readonly commandStack: CommandStackState;

  // Seeded RNG for reproducible games
  readonly rng: RngState;

  // Wound pile (effectively unlimited). `null` means unlimited.
  readonly woundPileCount: number | null;

  // Scenario configuration and tracking
  readonly scenarioId: ScenarioId;
  readonly scenarioConfig: ScenarioConfig;
  readonly scenarioEndTriggered: boolean; // distinct from endOfRoundAnnouncedBy
  readonly finalTurnsRemaining: number | null; // null = not in final turns, number = turns left
  readonly gameEnded: boolean;
  readonly winningPlayerId: string | null; // For competitive scenarios

  // Cooperative assault
  readonly pendingCooperativeAssault: CooperativeAssaultProposal | null;

  // Final scoring results (populated when game ends)
  readonly finalScoreResult: FinalScoreResult | null;

  // Mana Overload skill center state (Tovak interactive skill)
  // When non-null, the skill is in the center with a color marker
  readonly manaOverloadCenter: ManaOverloadCenter | null;

  // Mana Enhancement skill center state (Krang interactive skill)
  // When non-null, the skill is in the center with a basic color marker
  readonly manaEnhancementCenter: ManaEnhancementCenter | null;

  // Source Opening skill center state (Goldyx interactive skill)
  // When non-null, the skill is in the center; other players (or owner in solo)
  // can return it for an extra basic-color die + give owner a crystal
  readonly sourceOpeningCenter: SourceOpeningCenter | null;

  // Dummy player for solo mode (null in multiplayer)
  readonly dummyPlayer: DummyPlayer | null;
}

export function createInitialGameState(
  seed?: number,
  scenarioId: ScenarioId = SCENARIO_FIRST_RECONNAISSANCE
): GameState {
  const scenarioConfig = getScenario(scenarioId);

  return {
    phase: GAME_PHASE_SETUP,
    timeOfDay: TIME_OF_DAY_DAY,
    round: INITIAL_ROUND,
    turnOrder: [],
    currentPlayerIndex: INITIAL_CURRENT_PLAYER_INDEX,
    endOfRoundAnnouncedBy: null,
    playersWithFinalTurn: [],
    players: [],
    map: createEmptyMapState(),
    combat: null,
    // Tactics selection - starts in player turns (tactics phase entered at round start)
    roundPhase: ROUND_PHASE_PLAYER_TURNS,
    availableTactics: [],
    removedTactics: [],
    dummyPlayerTactic: null,
    tacticsSelectionOrder: [],
    currentTacticSelector: null,
    // Mana and offers
    source: createEmptyManaSource(),
    offers: createEmptyOffers(),
    enemyTokens: createEmptyEnemyTokenPiles(),
    ruinsTokens: createEmptyRuinsTokenPiles(),
    decks: createEmptyDecks(),
    cityLevel: scenarioConfig.defaultCityLevel,
    cities: {},
    activeModifiers: [],
    commandStack: createEmptyCommandStack(),
    rng: createRng(seed),
    woundPileCount: INITIAL_WOUND_PILE_COUNT,
    scenarioId,
    scenarioConfig,
    scenarioEndTriggered: false,
    finalTurnsRemaining: null,
    gameEnded: false,
    winningPlayerId: null,
    pendingCooperativeAssault: null,
    finalScoreResult: null,
    manaOverloadCenter: null,
    manaEnhancementCenter: null,
    sourceOpeningCenter: null,
    dummyPlayer: null,
  };
}
