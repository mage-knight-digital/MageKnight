/**
 * Reward system types and constants.
 */

import type { GameState } from "../../../state/GameState.js";
import type { GameEvent } from "@mage-knight/shared";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_GOLD,
  MANA_BLACK,
} from "@mage-knight/shared";

/**
 * Result of processing a reward.
 */
export interface RewardResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

/**
 * The 6 die faces for crystal rolls.
 * Used when rolling for crystal rewards.
 */
export const DIE_FACES = [
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_GOLD,
  MANA_BLACK,
] as const;
