#!/usr/bin/env bun
/**
 * Parity Trace Generator
 *
 * Generates golden traces from the TS engine for replay in the Rust engine.
 *
 * Strategy:
 * 1. Mirror Rust's create_solo_game() RNG sequence exactly:
 *    - createRng(seed) → shuffleWithRng(deck) → draw 5 → createManaSource()
 * 2. Construct a TS GameState matching the Rust initial state
 * 3. Drive predefined action sequences through processAction()
 * 4. Capture StateSnapshot after each action → JSON fixture
 *
 * Usage: bun run packages/engine-rs/tools/generate-parity-traces.ts
 */

import {
  createRng,
  shuffleWithRng,
  createManaSource,
  createEngine,
  createInitialGameState,
  getValidActions,
  Hero,
  HEROES,
  hexKey,
  TileId,
  createEmptyCommandStack,
} from "../../core/src/index.js";
import type { GameState } from "../../core/src/index.js";
import type { PlayerAction, TacticId, CardId, ManaColor } from "../../shared/src/index.js";
import {
  GAME_PHASE_ROUND,
  TIME_OF_DAY_DAY,
  ROUND_PHASE_TACTICS_SELECTION,
  ALL_DAY_TACTICS,
  SELECT_TACTIC_ACTION,
  PLAY_CARD_ACTION,
  PLAY_CARD_SIDEWAYS_ACTION,
  END_TURN_ACTION,
  RESOLVE_CHOICE_ACTION,
  PLAY_SIDEWAYS_AS_MOVE,
} from "../../shared/src/index.js";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";

// =============================================================================
// Types
// =============================================================================

interface ActionRecord {
  type: string;
  tactic_id?: string;
  card_id?: string;
  hand_index?: number;
  mana_color?: string;
  sideways_as?: string;
  target?: { q: number; r: number };
  cost?: number;
  direction?: string;
  choice_index?: number;
}

interface PlayerSnapshot {
  position: { q: number; r: number };
  hand: string[];
  deck: string[];
  discard: string[];
  play_area: string[];
  move_points: number;
  influence_points: number;
  healing_points: number;
  fame: number;
  level: number;
  reputation: number;
  armor: number;
  hand_limit: number;
  crystals: { red: number; blue: number; green: number; white: number };
  mana_token_count: number;
  selected_tactic: string | null;
  flags: {
    has_moved: boolean;
    played_card: boolean;
    is_resting: boolean;
    has_taken_action: boolean;
  };
  has_pending: boolean;
  pending_option_count: number;
}

interface GameSnapshot {
  time_of_day: string;
  round: number;
  round_phase: string;
  in_combat: boolean;
}

interface DieSnapshot {
  id: string;
  color: string;
  depleted: boolean;
}

interface StateSnapshot {
  player: PlayerSnapshot;
  game: GameSnapshot;
  mana_dice: DieSnapshot[];
  map_hex_count: number;
  tile_count: number;
}

interface TraceStep {
  step: number;
  action: ActionRecord | null;
  expected: StateSnapshot;
}

interface TraceFile {
  format_version: string;
  scenario: string;
  seed: number;
  hero: string;
  steps: TraceStep[];
}

// =============================================================================
// Starting tile hex data (matches Rust StartingA tile in mk-data/src/tiles.rs)
// =============================================================================

interface TileHexDef {
  q: number;
  r: number;
  terrain: string;
  siteType?: string;
}

const STARTING_TILE_A_HEXES: TileHexDef[] = [
  { q: 0, r: 0, terrain: "plains", siteType: "portal" },
  { q: 1, r: -1, terrain: "forest" },
  { q: 1, r: 0, terrain: "hills" },
  { q: 0, r: 1, terrain: "plains" },
  { q: -1, r: 1, terrain: "forest" },
  { q: -1, r: 0, terrain: "hills" },
  { q: 0, r: -1, terrain: "plains" },
];

// =============================================================================
// Mirror Rust create_solo_game() — build initial TS state
// =============================================================================

function mirrorRustSetup(seed: number, heroId: string): GameState {
  let rng = createRng(seed);

  // 1. Build deck (same order as Rust STANDARD_DECK + hero replacements)
  const heroDef = HEROES[heroId as keyof typeof HEROES];
  if (!heroDef) throw new Error(`Unknown hero: ${heroId}`);
  const deckCards: CardId[] = [...heroDef.startingCards];

  // 2. Shuffle (Fisher-Yates, 15 calls for 16 cards — same as Rust rng.shuffle())
  const { result: shuffled, rng: rng2 } = shuffleWithRng(deckCards, rng);
  rng = rng2;

  // 3. Draw 5 cards → hand, rest → deck
  const hand = shuffled.slice(0, 5);
  const deck = shuffled.slice(5);

  // 4. Create mana source (3 dice for solo)
  const { source, rng: rng3 } = createManaSource(1, TIME_OF_DAY_DAY, rng);
  rng = rng3;

  // 5. Build map — Starting Tile A hexes
  const baseState = createInitialGameState(seed);

  const hexes: Record<string, any> = {};
  for (const hex of STARTING_TILE_A_HEXES) {
    const key = hexKey({ q: hex.q, r: hex.r });
    hexes[key] = {
      coord: { q: hex.q, r: hex.r },
      terrain: hex.terrain,
      tileId: TileId.StartingTileA,
      site: hex.siteType
        ? { type: hex.siteType as any, owner: null, isConquered: false, isBurned: false }
        : null,
      enemies: [],
      shieldTokens: [],
      rampagingEnemies: [],
    };
  }

  // 6. Build player from scratch
  const player = {
    ...createBarePlayer(),
    id: "player_0",
    hero: heroId,
    position: { q: 0, r: 0 },
    hand: hand as CardId[],
    deck: deck as CardId[],
  };

  // 7. Assemble full state
  return {
    ...baseState,
    phase: GAME_PHASE_ROUND,
    timeOfDay: TIME_OF_DAY_DAY,
    round: 1,
    turnOrder: ["player_0"],
    currentPlayerIndex: 0,
    endOfRoundAnnouncedBy: null,
    playersWithFinalTurn: [],
    players: [player],
    map: {
      ...baseState.map,
      hexes,
      tiles: [{ tileId: TileId.StartingTileA, center: { q: 0, r: 0 }, revealed: true }] as any,
    },
    combat: null,
    roundPhase: ROUND_PHASE_TACTICS_SELECTION,
    availableTactics: [...ALL_DAY_TACTICS] as TacticId[],
    removedTactics: [],
    dummyPlayerTactic: null,
    tacticsSelectionOrder: ["player_0"],
    currentTacticSelector: "player_0",
    source,
    rng,
    commandStack: createEmptyCommandStack(),
  } as any;
}

function createBarePlayer() {
  return {
    id: "player_0",
    hero: Hero.Arythea,
    position: { q: 0, r: 0 },
    fame: 0, level: 1, reputation: 0,
    armor: 2, handLimit: 5, commandTokens: 1,
    hand: [] as CardId[], deck: [] as CardId[], discard: [] as CardId[],
    units: [], bondsOfLoyaltyUnitInstanceId: null, attachedBanners: [],
    skills: [],
    skillCooldowns: { usedThisRound: [], usedThisTurn: [], usedThisCombat: [], activeUntilNextTurn: [] },
    skillFlipState: { flippedSkills: [] },
    keptEnemyTokens: [],
    crystals: { red: 0, blue: 0, green: 0, white: 0 },
    selectedTactic: null, tacticFlipped: false, tacticState: {},
    pendingTacticDecision: null, beforeTurnTacticPending: false,
    knockedOut: false,
    movePoints: 0, influencePoints: 0,
    playArea: [] as CardId[],
    pureMana: [], usedManaFromSource: false,
    usedDieIds: [], manaDrawDieIds: [],
    hasMovedThisTurn: false, hasTakenActionThisTurn: false, playedCardFromHandThisTurn: false,
    combatAccumulator: {
      attack: { normal: 0, ranged: 0, siege: 0,
        normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
        rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
        siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 } },
      assignedAttack: { normal: 0, ranged: 0, siege: 0,
        normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
        rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
        siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 } },
      block: 0, blockElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
      swiftBlockElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
      blockSources: [], assignedBlock: 0,
      assignedBlockElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
    },
    pendingChoice: null, pendingLevelUps: [], pendingLevelUpRewards: [],
    remainingHeroSkills: [], pendingRewards: [],
    hasCombattedThisTurn: false, hasPlunderedThisTurn: false, pendingPlunderDecision: false,
    hasRecruitedUnitThisTurn: false, unitsRecruitedThisInteraction: [],
    manaUsedThisTurn: [], spellColorsCastThisTurn: [], spellsCastByColorThisTurn: {},
    pendingGladeWoundChoice: false, pendingDiscard: null,
    pendingDeepMineChoice: null, pendingUnitMaintenance: null,
    pendingDiscardForAttack: null, pendingDiscardForBonus: null, pendingDiscardForCrystal: null,
    pendingDecompose: null, pendingMaximalEffect: null,
    pendingBookOfWisdom: null, pendingTraining: null,
    mysteriousBoxState: null, pendingTerrainCostReduction: null,
    pendingAttackDefeatFame: [],
    enemiesDefeatedThisTurn: 0, healingPoints: 0,
    woundsHealedFromHandThisTurn: 0, unitsHealedThisTurn: [],
    removedCards: [], isResting: false, hasRestedThisTurn: false,
    woundImmunityActive: false, roundOrderTokenFlipped: false,
    isTimeBentTurn: false, timeBendingSetAsideCards: [],
    woundsReceivedThisTurn: { hand: 0, discard: 0 },
    bannerOfProtectionActive: false, pendingBannerProtectionChoice: false,
    spentCrystalsThisTurn: { red: 0, blue: 0, green: 0, white: 0 },
    crystalMasteryPoweredActive: false,
    pendingSourceOpeningRerollChoice: null,
    pendingMeditation: undefined, meditationHandLimitBonus: 0,
  };
}

// =============================================================================
// State snapshot extraction
// =============================================================================

function captureSnapshot(state: GameState): StateSnapshot {
  const player = state.players[0]!;
  return {
    player: {
      position: player.position ?? { q: 0, r: 0 },
      hand: player.hand.map(String),
      deck: player.deck.map(String),
      discard: player.discard.map(String),
      play_area: player.playArea.map(String),
      move_points: player.movePoints,
      influence_points: player.influencePoints,
      healing_points: player.healingPoints,
      fame: player.fame,
      level: player.level,
      reputation: player.reputation,
      armor: player.armor,
      hand_limit: player.handLimit,
      crystals: { red: player.crystals.red, blue: player.crystals.blue,
                  green: player.crystals.green, white: player.crystals.white },
      mana_token_count: player.pureMana.length,
      selected_tactic: player.selectedTactic ? String(player.selectedTactic) : null,
      flags: {
        has_moved: player.hasMovedThisTurn,
        played_card: player.playedCardFromHandThisTurn,
        is_resting: player.isResting,
        has_taken_action: player.hasTakenActionThisTurn,
      },
      has_pending: player.pendingChoice !== null,
      pending_option_count: player.pendingChoice?.options?.length ?? 0,
    },
    game: {
      time_of_day: state.timeOfDay,
      round: state.round,
      round_phase: state.roundPhase,
      in_combat: state.combat !== null,
    },
    mana_dice: state.source.dice.map((d) => ({
      id: String(d.id),
      color: d.color,
      depleted: d.isDepleted,
    })),
    map_hex_count: Object.keys(state.map.hexes).length,
    tile_count: state.map.tiles?.length ?? 0,
  };
}

// =============================================================================
// Action helpers — take CURRENT state, compute hand_index correctly
// =============================================================================

type ActionPair = { ts: PlayerAction; record: ActionRecord };

function mkSelectTactic(tacticId: string): ActionPair {
  return {
    ts: { type: SELECT_TACTIC_ACTION, tacticId: tacticId as TacticId } as PlayerAction,
    record: { type: "select_tactic", tactic_id: tacticId },
  };
}

function mkPlayBasic(state: GameState, cardId: string): ActionPair {
  const hand = state.players[0]!.hand;
  const idx = hand.findIndex((c) => String(c) === cardId);
  if (idx === -1) throw new Error(`Card ${cardId} not in hand: ${hand.map(String)}`);
  return {
    ts: { type: PLAY_CARD_ACTION, cardId: cardId as CardId, powered: false } as PlayerAction,
    record: { type: "play_card_basic", card_id: cardId, hand_index: idx },
  };
}

function mkPlaySideways(state: GameState, cardId: string, sidewaysAs: string): ActionPair {
  const hand = state.players[0]!.hand;
  const idx = hand.findIndex((c) => String(c) === cardId);
  if (idx === -1) throw new Error(`Card ${cardId} not in hand: ${hand.map(String)}`);
  return {
    ts: { type: PLAY_CARD_SIDEWAYS_ACTION, cardId: cardId as CardId, as: sidewaysAs } as PlayerAction,
    record: { type: "play_card_sideways", card_id: cardId, hand_index: idx, sideways_as: sidewaysAs },
  };
}

function mkPlayPowered(state: GameState, cardId: string, manaColor: string): ActionPair {
  const hand = state.players[0]!.hand;
  const idx = hand.findIndex((c) => String(c) === cardId);
  if (idx === -1) throw new Error(`Card ${cardId} not in hand: ${hand.map(String)}`);

  // Find a die with matching color for the mana source
  const die = state.source.dice.find(
    (d) => d.color === manaColor && !d.isDepleted && d.takenByPlayerId === null
  );
  const manaSource = die
    ? { type: "die" as const, color: manaColor as ManaColor, dieId: String(die.id) }
    : { type: "token" as const, color: manaColor as ManaColor };

  return {
    ts: { type: PLAY_CARD_ACTION, cardId: cardId as CardId, powered: true, manaSource } as PlayerAction,
    record: { type: "play_card_powered", card_id: cardId, hand_index: idx, mana_color: manaColor },
  };
}

function mkEndTurn(): ActionPair {
  return {
    ts: { type: END_TURN_ACTION } as PlayerAction,
    record: { type: "end_turn" },
  };
}

function mkResolveChoice(choiceIndex: number): ActionPair {
  return {
    ts: { type: RESOLVE_CHOICE_ACTION, choiceIndex } as PlayerAction,
    record: { type: "resolve_choice", choice_index: choiceIndex },
  };
}

// =============================================================================
// Step-by-step scenario runner
// =============================================================================

/**
 * A scenario is a named sequence of step-builders.
 * Each step receives the current state and returns an action pair.
 */
type StepFn = (state: GameState) => ActionPair;

interface Scenario {
  name: string;
  seed: number;
  hero: string;
  steps: StepFn[];
}

function generateTrace(scenario: Scenario): TraceFile {
  console.log(`\nGenerating scenario: ${scenario.name}`);

  let state = mirrorRustSetup(scenario.seed, scenario.hero);
  const engine = createEngine();
  const traceSteps: TraceStep[] = [];

  // Step 0: initial state
  traceSteps.push({ step: 0, action: null, expected: captureSnapshot(state) });
  console.log(`  Step 0: initial`);
  console.log(`    Hand: [${state.players[0]!.hand.map(String).join(", ")}]`);
  console.log(`    Dice: [${state.source.dice.map((d) => `${d.id}:${d.color}`).join(", ")}]`);

  // Execute steps
  for (let i = 0; i < scenario.steps.length; i++) {
    const stepFn = scenario.steps[i]!;
    const pair = stepFn(state);

    const result = engine.processAction(state, "player_0", pair.ts);

    // Check for errors
    const invalid = result.events.find((e: any) => e.type === "INVALID_ACTION");
    if (invalid) {
      console.error(`  Step ${i + 1}: INVALID — ${(invalid as any).reason}`);
      console.error(`    Action: ${JSON.stringify(pair.ts)}`);
      throw new Error(`Step ${i + 1} invalid: ${(invalid as any).reason}`);
    }

    state = result.state;
    traceSteps.push({ step: i + 1, action: pair.record, expected: captureSnapshot(state) });
    console.log(`  Step ${i + 1}: ${pair.record.type} → OK`);
  }

  return {
    format_version: "1.0.0",
    scenario: scenario.name,
    seed: scenario.seed,
    hero: scenario.hero,
    steps: traceSteps,
  };
}

// =============================================================================
// Scenarios
// =============================================================================

// Seed 42 + Arythea hand: [determination, promise, march, stamina, march]
// Dice: [die_0:green, die_1:green, die_2:blue]

/**
 * Scenario 1: basic_turn
 * SelectTactic → PlayBasic(march) → PlaySideways(promise, move) → EndTurn
 */
const basicTurn: Scenario = {
  name: "basic_turn",
  seed: 42,
  hero: "arythea",
  steps: [
    (_s) => mkSelectTactic("early_bird"),
    (s) => mkPlayBasic(s, "march"),
    (s) => mkPlaySideways(s, "promise", PLAY_SIDEWAYS_AS_MOVE),
    (_s) => mkEndTurn(),
  ],
};

/**
 * Scenario 2: sideways_play
 * SelectTactic → PlayBasic(stamina) → PlaySideways(determination, move) → EndTurn
 */
const sidewaysPlay: Scenario = {
  name: "sideways_play",
  seed: 42,
  hero: "arythea",
  steps: [
    (_s) => mkSelectTactic("early_bird"),
    (s) => mkPlayBasic(s, "stamina"),
    (s) => mkPlaySideways(s, "determination", PLAY_SIDEWAYS_AS_MOVE),
    (_s) => mkEndTurn(),
  ],
};

/**
 * Scenario 3: multiple_cards
 * SelectTactic → PlayBasic(march) → PlayBasic(march) → PlaySideways(promise, move) → EndTurn
 */
const multipleCards: Scenario = {
  name: "multiple_cards",
  seed: 42,
  hero: "arythea",
  steps: [
    (_s) => mkSelectTactic("early_bird"),
    (s) => mkPlayBasic(s, "march"),      // First march
    (s) => mkPlayBasic(s, "march"),      // Second march (index changes after first removal)
    (s) => mkPlaySideways(s, "promise", PLAY_SIDEWAYS_AS_MOVE),
    (_s) => mkEndTurn(),
  ],
};

// =============================================================================
// Main
// =============================================================================

const scenarios: Scenario[] = [basicTurn, sidewaysPlay, multipleCards];

const outDir = join(
  dirname(new URL(import.meta.url).pathname),
  "..", "crates", "mk-engine", "tests", "fixtures"
);
mkdirSync(outDir, { recursive: true });

for (const scenario of scenarios) {
  try {
    const trace = generateTrace(scenario);
    const outPath = join(outDir, `${scenario.name}.json`);
    writeFileSync(outPath, JSON.stringify(trace, null, 2) + "\n");
    console.log(`  Written to: ${outPath}`);
  } catch (err) {
    console.error(`  FAILED: ${err}`);
    process.exit(1);
  }
}

console.log(`\nAll ${scenarios.length} traces generated successfully.`);
