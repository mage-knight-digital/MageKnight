/**
 * Scoring System for Mage Knight
 *
 * This module provides the complete scoring implementation for end-game scoring.
 * It includes:
 * - Achievement calculators for the 6 standard categories
 * - Title bonus/penalty logic for competitive multiplayer
 * - Final score calculation combining base fame + achievements
 *
 * @module scoring
 */

// Achievement calculators
export {
  calculateGreatestKnowledge,
  calculateGreatestLoot,
  calculateGreatestLeader,
  calculateGreatestConqueror,
  calculateGreatestAdventurer,
  calculateGreatestBeating,
  ACHIEVEMENT_CALCULATORS,
} from "./achievementCalculators.js";

// Base score calculation
export { calculateBaseScores } from "./baseScore.js";

// Standard achievements scoring
export {
  calculateAchievementResults,
  calculateFinalScores,
  createDefaultScoringConfig,
} from "./standardAchievements.js";
