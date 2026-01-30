/**
 * Scenario types and constants for Mage Knight
 *
 * Scenarios define the rules, map shape, and win conditions for a game.
 */

// === Tactic Removal Modes ===
// Defines what happens to tactics at end of each day/night
export const TACTIC_REMOVAL_NONE = "none" as const; // Tactics collected and re-displayed each round
export const TACTIC_REMOVAL_ALL_USED = "all_used" as const; // All tactics used this round removed from game
export const TACTIC_REMOVAL_VOTE_ONE = "vote_one" as const; // Players agree to remove ONE used tactic (co-op)

export type TacticRemovalMode =
  | typeof TACTIC_REMOVAL_NONE
  | typeof TACTIC_REMOVAL_ALL_USED
  | typeof TACTIC_REMOVAL_VOTE_ONE;

// === Dummy Player Tactic Order ===
// Defines when dummy player selects their tactic
export const DUMMY_TACTIC_NONE = "none" as const; // No dummy player
export const DUMMY_TACTIC_AFTER_HUMANS = "after_humans" as const; // Human picks first, dummy gets random
export const DUMMY_TACTIC_BEFORE_HUMANS = "before_humans" as const; // Dummy gets random first, then humans

export type DummyTacticOrder =
  | typeof DUMMY_TACTIC_NONE
  | typeof DUMMY_TACTIC_AFTER_HUMANS
  | typeof DUMMY_TACTIC_BEFORE_HUMANS;

// === Scenario IDs ===
export const SCENARIO_FIRST_RECONNAISSANCE = "first_reconnaissance" as const;
export const SCENARIO_FULL_CONQUEST = "full_conquest" as const;

export type ScenarioId =
  | typeof SCENARIO_FIRST_RECONNAISSANCE
  | typeof SCENARIO_FULL_CONQUEST;

// === Map Shape Types ===
export const MAP_SHAPE_WEDGE = "wedge" as const;
export const MAP_SHAPE_OPEN = "open" as const;

export type MapShape = typeof MAP_SHAPE_WEDGE | typeof MAP_SHAPE_OPEN;

// === Expansion IDs ===
export const EXPANSION_LOST_LEGION = "lost_legion" as const;
export const EXPANSION_KRANG = "krang" as const;
export const EXPANSION_SHADES_OF_TEZLA = "shades_of_tezla" as const;

export type ExpansionId =
  | typeof EXPANSION_LOST_LEGION
  | typeof EXPANSION_KRANG
  | typeof EXPANSION_SHADES_OF_TEZLA;

// === End Trigger Types ===
export const END_TRIGGER_CITY_REVEALED = "city_revealed" as const;
export const END_TRIGGER_CITY_CONQUERED = "city_conquered" as const;
export const END_TRIGGER_ROUND_LIMIT = "round_limit" as const;

export type ScenarioEndTriggerType =
  | typeof END_TRIGGER_CITY_REVEALED
  | typeof END_TRIGGER_CITY_CONQUERED
  | typeof END_TRIGGER_ROUND_LIMIT;

export interface ScenarioEndTrigger {
  readonly type: ScenarioEndTriggerType;
}

// === Scoring Rule Types ===
export const SCORING_CATEGORY_EXPLORATION = "exploration" as const;
export const SCORING_CATEGORY_COMBAT = "combat" as const;
export const SCORING_CATEGORY_CONQUEST = "conquest" as const;
export const SCORING_CATEGORY_ACHIEVEMENTS = "achievements" as const;

export type ScoringCategory =
  | typeof SCORING_CATEGORY_EXPLORATION
  | typeof SCORING_CATEGORY_COMBAT
  | typeof SCORING_CATEGORY_CONQUEST
  | typeof SCORING_CATEGORY_ACHIEVEMENTS;

export interface ScoringRule {
  readonly id: string;
  readonly description: string;
  readonly points: number | "per_item";
  readonly category: ScoringCategory;
}

// === Fame Source Reasons (for tracking) ===
export const FAME_SOURCE_TILE_EXPLORED = "tile_explored" as const;
export const FAME_SOURCE_ENEMY_DEFEATED = "enemy_defeated" as const;
export const FAME_SOURCE_SITE_CONQUERED = "site_conquered" as const;

export type FameSource =
  | typeof FAME_SOURCE_TILE_EXPLORED
  | typeof FAME_SOURCE_ENEMY_DEFEATED
  | typeof FAME_SOURCE_SITE_CONQUERED;

// === Faction Leader Configuration ===
import type { FactionLeaderId } from "./enemies/factionLeaders.js";
import { getFactionLeader } from "./enemies/factionLeaders.js";
import type { EnemyId, Faction } from "./enemies/types.js";

/**
 * Configuration for a faction leader in a scenario.
 * Faction leaders are powerful boss enemies from the Shades of Tezla expansion.
 */
export interface FactionLeaderConfig {
  /** ID of the faction leader (Elementalist or Dark Crusader) */
  readonly leaderId: FactionLeaderId;

  /** Initial level (1-4) - determines starting Armor and Attack values */
  readonly initialLevel: number;

  /**
   * Enemy tokens that accompany the faction leader.
   * These should be from the same faction as the leader.
   * Per rulebook: "Use only the faction tokens for the matching faction"
   */
  readonly accompaniedBy: readonly EnemyId[];
}

/**
 * Validate that faction leader config has valid accompanying enemies.
 * Accompanying enemies should match the leader's faction.
 */
export function validateFactionLeaderConfig(
  config: FactionLeaderConfig,
  factions: Record<EnemyId, Faction | undefined>
): boolean {
  // Get leader's faction from the definition (not string matching)
  const leaderDef = getFactionLeader(config.leaderId);
  const leaderFaction = leaderDef.faction;

  // Check all accompanying enemies are from the same faction
  for (const enemyId of config.accompaniedBy) {
    const enemyFaction = factions[enemyId];
    if (enemyFaction && enemyFaction !== leaderFaction) {
      return false;
    }
  }

  // Validate level is in range
  if (config.initialLevel < 1 || config.initialLevel > 4) {
    return false;
  }

  return true;
}

// === Scenario Configuration ===
export interface ScenarioConfig {
  readonly id: ScenarioId;
  readonly name: string;
  readonly description: string;

  // Map setup
  readonly countrysideTileCount: number;
  readonly coreTileCount: number;
  readonly cityTileCount: number;
  readonly mapShape: MapShape;

  // Round limits
  readonly dayRounds: number;
  readonly nightRounds: number;
  readonly totalRounds: number;

  // Player setup
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly startingFame: number;
  readonly startingReputation: number;

  // Special rules
  readonly skillsEnabled: boolean;
  readonly eliteUnitsEnabled: boolean;
  readonly pvpEnabled: boolean;
  readonly spellsAvailable: boolean;
  readonly advancedActionsAvailable: boolean;
  readonly enabledExpansions: readonly ExpansionId[]; // which expansions are active
  readonly famePerTileExplored: number; // 0 for scenarios that don't give fame for exploration
  readonly citiesCanBeEntered: boolean; // false for First Reconnaissance

  // Tactic handling
  readonly tacticRemovalMode: TacticRemovalMode;
  readonly dummyTacticOrder: DummyTacticOrder;

  // End condition
  readonly endTrigger: ScenarioEndTrigger;

  // Scoring
  readonly scoringRules: readonly ScoringRule[];

  // Faction Leaders (Shades of Tezla expansion)
  /**
   * Optional faction leader configuration for Shades of Tezla scenarios.
   * When present, the scenario includes a faction leader boss enemy.
   */
  readonly factionLeaderConfig?: FactionLeaderConfig;
}
