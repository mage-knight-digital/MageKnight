/**
 * First Reconnaissance scenario configurations (Multiplayer Variants)
 *
 * These are multiplayer variants of the introductory scenario.
 * Uses open map shapes for more exploration freedom.
 *
 * Player count determines map shape:
 * - 2 players: Open 3 (tight map for faster games)
 * - 3 players: Open 4 (medium map)
 * - 4 players: Open 5 (full open map)
 */

import {
  SCENARIO_FIRST_RECONNAISSANCE,
  END_TRIGGER_CITY_REVEALED,
  MAP_SHAPE_OPEN_3,
  MAP_SHAPE_OPEN_4,
  MAP_SHAPE_OPEN_5,
  SCORING_CATEGORY_EXPLORATION,
  SCORING_CATEGORY_COMBAT,
  SCORING_CATEGORY_ACHIEVEMENTS,
  TACTIC_REMOVAL_ALL_USED,
  DUMMY_TACTIC_NONE,
  type ScenarioConfig,
} from "@mage-knight/shared";

/**
 * First Reconnaissance for 2 players using Open 3 map shape.
 * Tighter map encourages faster exploration and more interaction.
 */
export const FIRST_RECONNAISSANCE_2P: ScenarioConfig = {
  id: SCENARIO_FIRST_RECONNAISSANCE,
  name: "First Reconnaissance (2 Players)",
  description:
    "Introductory scenario for 2 players. Explore the countryside and find the city. Uses Open 3 map shape.",

  // Map setup - Open 3 for 2 players
  countrysideTileCount: 6,
  coreTileCount: 2,
  cityTileCount: 1,
  mapShape: MAP_SHAPE_OPEN_3,

  // Round limits - 3 rounds for 2 players
  dayRounds: 2,
  nightRounds: 1,
  totalRounds: 3,

  // Player setup
  minPlayers: 2,
  maxPlayers: 2,
  startingFame: 0,
  startingReputation: 0,

  // Special rules - training scenario, limited features
  skillsEnabled: false,
  eliteUnitsEnabled: false,
  pvpEnabled: false,
  spellsAvailable: true,
  advancedActionsAvailable: true,
  enabledExpansions: [],
  famePerTileExplored: 1,
  citiesCanBeEntered: false,

  // Tactic handling - No dummy player in multiplayer
  tacticRemovalMode: TACTIC_REMOVAL_ALL_USED,
  dummyTacticOrder: DUMMY_TACTIC_NONE,

  // End condition
  endTrigger: { type: END_TRIGGER_CITY_REVEALED },

  // Scoring
  scoringRules: [
    {
      id: "fame",
      description: "Total Fame",
      points: "per_item",
      category: SCORING_CATEGORY_ACHIEVEMENTS,
    },
    {
      id: "tiles_explored",
      description: "+2 per tile explored",
      points: 2,
      category: SCORING_CATEGORY_EXPLORATION,
    },
    {
      id: "monsters_defeated",
      description: "+1 per monster defeated",
      points: 1,
      category: SCORING_CATEGORY_COMBAT,
    },
  ],
};

/**
 * First Reconnaissance for 3 players using Open 4 map shape.
 */
export const FIRST_RECONNAISSANCE_3P: ScenarioConfig = {
  id: SCENARIO_FIRST_RECONNAISSANCE,
  name: "First Reconnaissance (3 Players)",
  description:
    "Introductory scenario for 3 players. Explore the countryside and find the city. Uses Open 4 map shape.",

  // Map setup - Open 4 for 3 players
  countrysideTileCount: 8,
  coreTileCount: 3,
  cityTileCount: 1,
  mapShape: MAP_SHAPE_OPEN_4,

  // Round limits - 3 rounds for 3 players
  dayRounds: 2,
  nightRounds: 1,
  totalRounds: 3,

  // Player setup
  minPlayers: 3,
  maxPlayers: 3,
  startingFame: 0,
  startingReputation: 0,

  // Special rules
  skillsEnabled: false,
  eliteUnitsEnabled: false,
  pvpEnabled: false,
  spellsAvailable: true,
  advancedActionsAvailable: true,
  enabledExpansions: [],
  famePerTileExplored: 1,
  citiesCanBeEntered: false,

  // Tactic handling
  tacticRemovalMode: TACTIC_REMOVAL_ALL_USED,
  dummyTacticOrder: DUMMY_TACTIC_NONE,

  // End condition
  endTrigger: { type: END_TRIGGER_CITY_REVEALED },

  // Scoring
  scoringRules: [
    {
      id: "fame",
      description: "Total Fame",
      points: "per_item",
      category: SCORING_CATEGORY_ACHIEVEMENTS,
    },
    {
      id: "tiles_explored",
      description: "+2 per tile explored",
      points: 2,
      category: SCORING_CATEGORY_EXPLORATION,
    },
    {
      id: "monsters_defeated",
      description: "+1 per monster defeated",
      points: 1,
      category: SCORING_CATEGORY_COMBAT,
    },
  ],
};

/**
 * First Reconnaissance for 4 players using Open 5 map shape.
 */
export const FIRST_RECONNAISSANCE_4P: ScenarioConfig = {
  id: SCENARIO_FIRST_RECONNAISSANCE,
  name: "First Reconnaissance (4 Players)",
  description:
    "Introductory scenario for 4 players. Explore the countryside and find the city. Uses Open 5 map shape.",

  // Map setup - Open 5 for 4 players
  countrysideTileCount: 10,
  coreTileCount: 4,
  cityTileCount: 1,
  mapShape: MAP_SHAPE_OPEN_5,

  // Round limits - 3 rounds for 4 players
  dayRounds: 2,
  nightRounds: 1,
  totalRounds: 3,

  // Player setup
  minPlayers: 4,
  maxPlayers: 4,
  startingFame: 0,
  startingReputation: 0,

  // Special rules
  skillsEnabled: false,
  eliteUnitsEnabled: false,
  pvpEnabled: false,
  spellsAvailable: true,
  advancedActionsAvailable: true,
  enabledExpansions: [],
  famePerTileExplored: 1,
  citiesCanBeEntered: false,

  // Tactic handling
  tacticRemovalMode: TACTIC_REMOVAL_ALL_USED,
  dummyTacticOrder: DUMMY_TACTIC_NONE,

  // End condition
  endTrigger: { type: END_TRIGGER_CITY_REVEALED },

  // Scoring
  scoringRules: [
    {
      id: "fame",
      description: "Total Fame",
      points: "per_item",
      category: SCORING_CATEGORY_ACHIEVEMENTS,
    },
    {
      id: "tiles_explored",
      description: "+2 per tile explored",
      points: 2,
      category: SCORING_CATEGORY_EXPLORATION,
    },
    {
      id: "monsters_defeated",
      description: "+1 per monster defeated",
      points: 1,
      category: SCORING_CATEGORY_COMBAT,
    },
  ],
};
