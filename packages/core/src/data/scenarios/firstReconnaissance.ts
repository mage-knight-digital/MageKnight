/**
 * First Reconnaissance scenario configuration (Solo Variant)
 *
 * This is the introductory solo scenario. The player explores the countryside
 * to find the city. The game ends when the city is revealed (not conquered).
 *
 * Solo variant specifics:
 * - 4 rounds total (2 day, 2 night)
 * - 8 countryside tiles, 2 core tiles, 1 city tile
 * - +1 Fame per tile explored
 * - City cannot be entered or conquered
 * - Elite units not available
 * - Skills disabled (training scenario)
 *
 * Note: Multiplayer variants of First Reconnaissance are not yet implemented.
 * The rulebook specifies different tile counts and round limits for 2-4 players.
 */

import {
  SCENARIO_FIRST_RECONNAISSANCE,
  END_TRIGGER_CITY_REVEALED,
  MAP_SHAPE_WEDGE,
  SCORING_CATEGORY_EXPLORATION,
  SCORING_CATEGORY_COMBAT,
  SCORING_CATEGORY_ACHIEVEMENTS,
  TACTIC_REMOVAL_ALL_USED,
  DUMMY_TACTIC_AFTER_HUMANS,
  BASE_SCORE_INDIVIDUAL_FAME,
  ACHIEVEMENT_MODE_SOLO,
  type ScenarioConfig,
} from "@mage-knight/shared";

export const FIRST_RECONNAISSANCE: ScenarioConfig = {
  id: SCENARIO_FIRST_RECONNAISSANCE,
  name: "First Reconnaissance (Solo)",
  description:
    "Solo introductory scenario. Explore the countryside and find the city. 4 rounds (2 day, 2 night).",

  // Map setup - solo uses smaller map (8 countryside for 2p equivalent)
  countrysideTileCount: 8,
  coreTileCount: 2,
  cityTileCount: 1,
  mapShape: MAP_SHAPE_WEDGE,

  // Round limits - 4 rounds for solo (2 days, 2 nights)
  dayRounds: 2,
  nightRounds: 2,
  totalRounds: 4,

  // Player setup
  minPlayers: 1,
  maxPlayers: 1,
  startingFame: 0,
  startingReputation: 0, // Neutral

  // Special rules - training scenario, limited features
  skillsEnabled: false,
  eliteUnitsEnabled: false,
  pvpEnabled: false,
  spellsAvailable: true, // Can acquire but not required
  advancedActionsAvailable: true,
  enabledExpansions: [], // Base game only - no expansions
  famePerTileExplored: 1, // +1 Fame per tile in First Reconnaissance
  citiesCanBeEntered: false, // Cannot enter city in this scenario
  defaultCityLevel: 1, // Cities aren't entered in this scenario

  // Tactic handling - Solo Conquest rules
  tacticRemovalMode: TACTIC_REMOVAL_ALL_USED, // All used tactics removed at end of round
  dummyTacticOrder: DUMMY_TACTIC_AFTER_HUMANS, // Human picks first, dummy gets random from remaining

  // End condition - game ends when city is REVEALED (not conquered)
  endTrigger: { type: END_TRIGGER_CITY_REVEALED },

  // Scoring (simplified for intro)
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

  // Scoring configuration (new system)
  // Solo intro scenario - achievements enabled but no titles (solo mode)
  scoringConfig: {
    baseScoreMode: BASE_SCORE_INDIVIDUAL_FAME,
    achievements: {
      enabled: true,
      mode: ACHIEVEMENT_MODE_SOLO,
    },
    modules: [],
  },
};
