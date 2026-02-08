/**
 * Shared test helpers for engine tests
 */

import { createInitialGameState } from "../../state/GameState.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { HexState, HexEnemy } from "../../types/map.js";
import { Hero } from "../../types/hero.js";
import { TileId, SiteType } from "../../types/map.js";
import type { Site } from "../../types/map.js";
import type { EnemyTokenId, EnemyColor } from "../../types/enemy.js";
import type { EnemyId } from "@mage-knight/shared";
import { ENEMIES } from "@mage-knight/shared";
import type { Terrain } from "@mage-knight/shared";
import {
  GAME_PHASE_ROUND,
  TIME_OF_DAY_DAY,
  TIME_OF_DAY_NIGHT,
  TERRAIN_FOREST,
  TERRAIN_HILLS,
  TERRAIN_PLAINS,
  hexKey,
  CARD_MARCH,
  ROUND_PHASE_PLAYER_TURNS,
  ROUND_PHASE_TACTICS_SELECTION,
  ALL_DAY_TACTICS,
  ALL_NIGHT_TACTICS,
  ENEMY_DIGGERS,
  ELEMENT_PHYSICAL,
  type TacticId,
} from "@mage-knight/shared";
import type { CombatState, CombatPhase } from "../../types/combat.js";

/**
 * Get the enemy ID part from a token ID (format: "enemyId_counter")
 */
function getEnemyIdFromTokenId(tokenId: EnemyTokenId): EnemyId {
  const parts = String(tokenId).split("_");
  parts.pop(); // Remove counter
  return parts.join("_") as EnemyId;
}

/**
 * Create a HexEnemy from an EnemyTokenId for test purposes.
 * Defaults to revealed (face-up), which is common for test scenarios.
 */
export function createHexEnemy(
  tokenId: EnemyTokenId,
  isRevealed: boolean = true
): HexEnemy {
  const enemyId = getEnemyIdFromTokenId(tokenId);
  const enemy = ENEMIES[enemyId];
  if (!enemy) {
    throw new Error(`Unknown enemy ID: ${enemyId}`);
  }
  return {
    tokenId,
    color: enemy.color as EnemyColor,
    isRevealed,
  };
}

// Default combat accumulator values
const defaultCombatAccumulator = {
  attack: {
    normal: 0,
    ranged: 0,
    siege: 0,
    normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
    rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
    siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
  },
  assignedAttack: {
    normal: 0,
    ranged: 0,
    siege: 0,
    normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
    rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
    siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
  },
  block: 0,
  blockElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
  swiftBlockElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
  blockSources: [] as const,
  assignedBlock: 0,
  assignedBlockElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
};

/**
 * Create a test player with sensible defaults
 */
export function createTestPlayer(overrides: Partial<Player> = {}): Player {
  // Merge combatAccumulator specially to avoid losing fields when partial override is given
  const { combatAccumulator: accOverrides, ...rest } = overrides;
  const mergedAccumulator = accOverrides
    ? { ...defaultCombatAccumulator, ...accOverrides }
    : defaultCombatAccumulator;

  return {
    id: "player1",
    hero: Hero.Arythea,
    position: { q: 0, r: 0 },
    fame: 0,
    level: 1,
    reputation: 0,
    armor: 2,
    handLimit: 5,
    commandTokens: 1,
    hand: [CARD_MARCH], // Default to having a card to avoid mandatory announcement
    deck: [],
    discard: [],
    units: [],
    bondsOfLoyaltyUnitInstanceId: null,
    attachedBanners: [],
    skills: [],
    skillCooldowns: {
      usedThisRound: [],
      usedThisTurn: [],
      usedThisCombat: [],
      activeUntilNextTurn: [],
    },
    skillFlipState: {
      flippedSkills: [],
    },
    crystals: { red: 0, blue: 0, green: 0, white: 0 },
    selectedTactic: null,
    tacticFlipped: false,
    tacticState: {},
    pendingTacticDecision: null,
    beforeTurnTacticPending: false,
    knockedOut: false,
    movePoints: 0,
    influencePoints: 0,
    playArea: [],
    pureMana: [],
    usedManaFromSource: false,
    usedDieIds: [],
    manaDrawDieIds: [],
    hasMovedThisTurn: false,
    hasTakenActionThisTurn: false,
    playedCardFromHandThisTurn: false,
    combatAccumulator: mergedAccumulator,
    pendingChoice: null,
    pendingLevelUps: [],
    pendingLevelUpRewards: [],
    remainingHeroSkills: [],
    pendingRewards: [],
    hasCombattedThisTurn: false,
    hasPlunderedThisTurn: false,
    hasRecruitedUnitThisTurn: false,
    unitsRecruitedThisInteraction: [],
    manaUsedThisTurn: [],
    spellColorsCastThisTurn: [],
    spellsCastByColorThisTurn: {},
    pendingGladeWoundChoice: false,
    pendingDiscard: null,
    pendingDeepMineChoice: null,
    pendingUnitMaintenance: null,
    pendingDiscardForAttack: null,
    pendingDiscardForCrystal: null,
    pendingDecompose: null,
    pendingTerrainCostReduction: null,
    pendingAttackDefeatFame: [],
    enemiesDefeatedThisTurn: 0,
    healingPoints: 0,
    woundsHealedFromHandThisTurn: 0,
    unitsHealedThisTurn: [],
    removedCards: [],
    isResting: false,
    woundImmunityActive: false,
    roundOrderTokenFlipped: false,
    isTimeBentTurn: false,
    timeBendingSetAsideCards: [],
    woundsReceivedThisTurn: { hand: 0, discard: 0 },
    bannerOfProtectionActive: false,
    pendingBannerProtectionChoice: false,
    spentCrystalsThisTurn: { red: 0, blue: 0, green: 0, white: 0 },
    crystalMasteryPoweredActive: false,
    pendingMeditation: undefined,
    meditationHandLimitBonus: 0,
    ...rest,
  };
}

/**
 * Create a test hex with sensible defaults
 */
export function createTestHex(
  q: number,
  r: number,
  terrain: Terrain = TERRAIN_PLAINS,
  site: Site | null = null
): HexState {
  return {
    coord: { q, r },
    terrain,
    tileId: TileId.StartingTileA,
    site,
    enemies: [],
    shieldTokens: [],
    rampagingEnemies: [],
  };
}

/**
 * Create a default village site
 */
export function createVillageSite(): Site {
  return {
    type: SiteType.Village,
    owner: null,
    isConquered: false,
    isBurned: false,
  };
}

/**
 * Create a test game state with a small map
 */
export function createTestGameState(
  overrides: Partial<GameState> = {}
): GameState {
  const baseState = createInitialGameState();
  const player = createTestPlayer({ movePoints: 4 });

  // Create a small map with adjacent hexes
  const hexes: Record<string, HexState> = {
    [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS), // Player starts here
    [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS), // East - cost 2
    [hexKey({ q: 0, r: 1 })]: createTestHex(0, 1, TERRAIN_FOREST), // Southeast - cost 3 day, 5 night
    [hexKey({ q: -1, r: 0 })]: createTestHex(-1, 0, TERRAIN_HILLS), // West - cost 3
  };

  return {
    ...baseState,
    phase: GAME_PHASE_ROUND,
    timeOfDay: TIME_OF_DAY_DAY,
    turnOrder: ["player1"],
    currentPlayerIndex: 0,
    endOfRoundAnnouncedBy: null,
    playersWithFinalTurn: [],
    players: [player],
    map: {
      ...baseState.map,
      hexes,
    },
    // Default to player turns phase (most tests don't need tactics)
    roundPhase: ROUND_PHASE_PLAYER_TURNS,
    availableTactics: [],
    tacticsSelectionOrder: [],
    currentTacticSelector: null,
    ...overrides,
  };
}

/**
 * Create a game state where the player is at a village (for recruitment/interaction tests)
 */
export function createStateWithVillage(
  playerOverrides: Partial<Player> = {}
): GameState {
  const player = createTestPlayer({
    position: { q: 0, r: 0 },
    ...playerOverrides,
  });

  const hexWithVillage = createTestHex(0, 0, undefined, createVillageSite());

  return createTestGameState({
    players: [player],
    phase: GAME_PHASE_ROUND,
    map: {
      hexes: {
        [hexKey({ q: 0, r: 0 })]: hexWithVillage,
      },
      tiles: [],
      tileDeck: { countryside: [], core: [] },
    },
  });
}

/**
 * Create a game state ready for tactics selection phase
 */
export function createTacticsSelectionState(
  playerIds: string[] = ["player1"],
  timeOfDay: "day" | "night" = "day",
  overrides: Partial<GameState> = {}
): GameState {
  const baseState = createInitialGameState();

  // Create players with decreasing fame so later players select first
  // (lowest fame selects first per the rules)
  const players = playerIds.map((id, index) =>
    createTestPlayer({
      id,
      position: { q: index, r: 0 },
      movePoints: 0,
      // Give decreasing fame: last player has lowest fame and selects first
      fame: (playerIds.length - 1 - index) * 10,
    })
  );

  // Available tactics depend on time of day
  const availableTactics: readonly TacticId[] =
    timeOfDay === "day" ? ALL_DAY_TACTICS : ALL_NIGHT_TACTICS;

  // Selection order: sorted by fame ascending (lowest first), ties by turn order index
  // Since we assigned decreasing fame values, this results in reverse player order
  const tacticsSelectionOrder = [...players]
    .map((p, turnOrderIndex) => ({
      id: p.id,
      fame: p.fame,
      turnOrderIndex,
    }))
    .sort((a, b) => {
      if (a.fame !== b.fame) {
        return a.fame - b.fame;
      }
      return a.turnOrderIndex - b.turnOrderIndex;
    })
    .map((p) => p.id);

  // Create a minimal map
  const hexes: Record<string, HexState> = {};
  playerIds.forEach((_, index) => {
    hexes[hexKey({ q: index, r: 0 })] = createTestHex(index, 0, TERRAIN_PLAINS);
  });

  return {
    ...baseState,
    phase: GAME_PHASE_ROUND,
    timeOfDay: timeOfDay === "day" ? TIME_OF_DAY_DAY : TIME_OF_DAY_NIGHT,
    turnOrder: playerIds,
    currentPlayerIndex: 0,
    endOfRoundAnnouncedBy: null,
    playersWithFinalTurn: [],
    players,
    map: {
      ...baseState.map,
      hexes,
    },
    // Set up tactics selection phase
    roundPhase: ROUND_PHASE_TACTICS_SELECTION,
    availableTactics,
    tacticsSelectionOrder,
    currentTacticSelector: tacticsSelectionOrder[0] ?? null,
    ...overrides,
  };
}

import { COMBAT_CONTEXT_STANDARD } from "../../types/combat.js";

/**
 * Create a combat state for unit tests with a default enemy
 */
export function createUnitCombatState(
  phase: CombatPhase,
  isAtFortifiedSite = false,
  assaultOrigin: { q: number; r: number } | null = null
): CombatState {
  return {
    enemies: [
      {
        instanceId: "enemy_1",
        enemyId: ENEMY_DIGGERS,
        definition: {
          id: ENEMY_DIGGERS,
          name: "Diggers",
          color: "green" as const,
          attack: 3,
          attackElement: ELEMENT_PHYSICAL,
          armor: 3,
          fame: 2,
          resistances: [],
          abilities: [],
        },
        isBlocked: false,
        isDefeated: false,
        damageAssigned: false,
        isRequiredForConquest: true,
      },
    ],
    phase,
    woundsThisCombat: 0,
    attacksThisPhase: 0,
    fameGained: 0,
    isAtFortifiedSite,
    unitsAllowed: true,
    nightManaRules: false,
    assaultOrigin,
    combatHexCoord: null,
    allDamageBlockedThisPhase: false,
    discardEnemiesOnFailure: false,
    pendingDamage: {},
    pendingBlock: {},
    pendingSwiftBlock: {},
    combatContext: COMBAT_CONTEXT_STANDARD,
    cumbersomeReductions: {},
    usedDefend: {},
    defendBonuses: {},
    paidHeroesAssaultInfluence: false,
    vampiricArmorBonus: {},
    paidThugsDamageInfluence: {},
    damageRedirects: {},
  };
}
