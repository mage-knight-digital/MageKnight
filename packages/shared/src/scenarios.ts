/**
 * Scenario types and constants for Mage Knight
 *
 * Scenarios define the rules, map shape, and win conditions for a game.
 */

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
  readonly famePerTileExplored: number; // 0 for scenarios that don't give fame for exploration
  readonly citiesCanBeEntered: boolean; // false for First Reconnaissance

  // End condition
  readonly endTrigger: ScenarioEndTrigger;

  // Scoring
  readonly scoringRules: readonly ScoringRule[];
}
