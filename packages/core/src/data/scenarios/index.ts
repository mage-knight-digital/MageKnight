/**
 * Scenario registry - all available scenarios
 */

import {
  type ScenarioId,
  type ScenarioConfig,
  SCENARIO_FIRST_RECONNAISSANCE,
  SCENARIO_FULL_CONQUEST,
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

// Re-export the First Reconnaissance config for direct access
export { FIRST_RECONNAISSANCE } from "./firstReconnaissance.js";
