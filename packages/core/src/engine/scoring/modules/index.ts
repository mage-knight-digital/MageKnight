/**
 * Scoring Modules Dispatcher
 *
 * Routes scoring calculations to the appropriate module based on type.
 * Each scenario can enable multiple scoring modules which are all calculated here.
 */

import type { ScoringModuleConfig, ModuleScoreResult } from "@mage-knight/shared";
import { SCORING_MODULE_CITY_CONQUEST } from "@mage-knight/shared";
import type { GameState } from "../../../state/GameState.js";
import { calculateCityConquestScore } from "./cityConquest.js";

/**
 * Calculate scores for all enabled scoring modules.
 *
 * @param state - Current game state
 * @param modules - Array of module configurations enabled for this scenario
 * @returns Array of scoring results for each player from each module
 */
export function calculateModuleScores(
  state: GameState,
  modules: readonly ScoringModuleConfig[]
): readonly ModuleScoreResult[] {
  const results: ModuleScoreResult[] = [];

  for (const module of modules) {
    switch (module.type) {
      case SCORING_MODULE_CITY_CONQUEST:
        results.push(...calculateCityConquestScore(state, module));
        break;

      // Future modules will be added here:
      // case SCORING_MODULE_TIME_EFFICIENCY:
      //   results.push(...calculateTimeEfficiencyScore(state, module));
      //   break;
      // case SCORING_MODULE_OBJECTIVE_COMPLETION:
      //   results.push(...calculateObjectiveCompletionScore(state, module));
      //   break;

      default:
        // Type assertion to ensure exhaustive checking when new modules are added
        // This will cause a compile error if a new module type is added to the union
        // but not handled in this switch
        throw new Error(
          `Unknown scoring module type: ${(module as ScoringModuleConfig).type}`
        );
    }
  }

  return results;
}

// Re-export individual module calculators for direct access if needed
export { calculateCityConquestScore } from "./cityConquest.js";
