/**
 * Full Conquest scenario configuration (STUB)
 *
 * This is a placeholder for the standard Mage Knight scenario.
 * Not yet implemented - will be filled in when we're ready.
 */

import {
  SCENARIO_FULL_CONQUEST,
  END_TRIGGER_CITY_CONQUERED,
  MAP_SHAPE_OPEN_5,
  SCORING_CATEGORY_ACHIEVEMENTS,
  EXPANSION_LOST_LEGION,
  EXPANSION_KRANG,
  EXPANSION_SHADES_OF_TEZLA,
  TACTIC_REMOVAL_ALL_USED,
  DUMMY_TACTIC_AFTER_HUMANS,
  type ScenarioConfig,
} from "@mage-knight/shared";

export const FULL_CONQUEST_STUB: ScenarioConfig = {
  id: SCENARIO_FULL_CONQUEST,
  name: "Full Conquest (Not Implemented)",
  description:
    "Standard scenario. Conquer the city to win. This scenario is not yet implemented.",

  // Map setup - Open 5 for standard 4-player game
  countrysideTileCount: 8,
  coreTileCount: 4,
  cityTileCount: 1,
  mapShape: MAP_SHAPE_OPEN_5,

  // Round limits
  dayRounds: 3,
  nightRounds: 3,
  totalRounds: 6,

  // Player setup
  minPlayers: 1,
  maxPlayers: 4,
  startingFame: 0,
  startingReputation: 0,

  // All features enabled
  skillsEnabled: true,
  eliteUnitsEnabled: true,
  pvpEnabled: true,
  spellsAvailable: true,
  advancedActionsAvailable: true,
  enabledExpansions: [EXPANSION_LOST_LEGION, EXPANSION_KRANG, EXPANSION_SHADES_OF_TEZLA],
  famePerTileExplored: 0, // No fame for exploring in full conquest
  citiesCanBeEntered: true, // Can enter and conquer cities

  // Tactic handling - Solo Conquest rules (stub uses solo rules)
  tacticRemovalMode: TACTIC_REMOVAL_ALL_USED,
  dummyTacticOrder: DUMMY_TACTIC_AFTER_HUMANS,

  // End condition
  endTrigger: { type: END_TRIGGER_CITY_CONQUERED },

  // Scoring (stub)
  scoringRules: [
    {
      id: "fame",
      description: "Total Fame",
      points: "per_item",
      category: SCORING_CATEGORY_ACHIEVEMENTS,
    },
  ],
};
