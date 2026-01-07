/**
 * Shared Tier-A numeric defaults that affect game rules/state.
 *
 * These values are used across core/server/client and must not drift.
 */

import { getLevelStats } from "./levels.js";

export const STARTING_LEVEL = 1 as const;
export const STARTING_FAME = 0 as const;
export const STARTING_REPUTATION = 0 as const;

// Level 1 derived stats
const level1 = getLevelStats(STARTING_LEVEL);

export const STARTING_ARMOR: number = level1.armor;
export const STARTING_HAND_LIMIT: number = level1.handLimit;
export const STARTING_COMMAND_TOKENS: number = level1.commandSlots;


