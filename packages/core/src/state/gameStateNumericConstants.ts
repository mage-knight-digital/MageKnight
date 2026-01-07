/**
 * Tier-A numeric defaults for GameState initialization.
 *
 * Centralizing these avoids silent drift across engine/server/client.
 */

export const INITIAL_ROUND = 1 as const;
export const INITIAL_CURRENT_PLAYER_INDEX = 0 as const;

// Wound pile is effectively unlimited.
export const INITIAL_WOUND_PILE_COUNT = null as const;


