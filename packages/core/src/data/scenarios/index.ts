/**
 * Scenario registry - all available scenarios
 */

import {
  type ScenarioId,
  type ScenarioConfig,
  type MapShape,
  SCENARIO_FIRST_RECONNAISSANCE,
  SCENARIO_FULL_CONQUEST,
  MAP_SHAPE_WEDGE,
  MAP_SHAPE_OPEN_3,
  MAP_SHAPE_OPEN_4,
  MAP_SHAPE_OPEN_5,
} from "@mage-knight/shared";
import { FIRST_RECONNAISSANCE } from "./firstReconnaissance.js";
import { FULL_CONQUEST_STUB } from "./fullConquestStub.js";
export const SCENARIOS: Record<ScenarioId, ScenarioConfig> = {
  [SCENARIO_FIRST_RECONNAISSANCE]: FIRST_RECONNAISSANCE,
  [SCENARIO_FULL_CONQUEST]: FULL_CONQUEST_STUB,
};

/**
 * Get a scenario configuration by ID
 */
export function getScenario(id: ScenarioId): ScenarioConfig {
  const scenario = SCENARIOS[id];
  if (!scenario) {
    throw new Error(`Unknown scenario: ${id}`);
  }
  return scenario;
}

/**
 * Get the recommended map shape based on player count.
 *
 * Player count recommendations:
 * - 1 player: Wedge (classic solo experience)
 * - 2 players: Open 3 (tight map for faster games)
 * - 3 players: Open 4 (medium map)
 * - 4 players: Open 5 (full open map)
 */
export function getRecommendedMapShape(playerCount: number): MapShape {
  switch (playerCount) {
    case 1:
      return MAP_SHAPE_WEDGE;
    case 2:
      return MAP_SHAPE_OPEN_3;
    case 3:
      return MAP_SHAPE_OPEN_4;
    case 4:
    default:
      return MAP_SHAPE_OPEN_5;
  }
}

// Re-export the First Reconnaissance config for direct access
export { FIRST_RECONNAISSANCE } from "./firstReconnaissance.js";

// Re-export multiplayer variants for direct access
export {
  FIRST_RECONNAISSANCE_2P,
  FIRST_RECONNAISSANCE_3P,
  FIRST_RECONNAISSANCE_4P,
} from "./firstReconnaissanceMultiplayer.js";
