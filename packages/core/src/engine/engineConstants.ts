/**
 * Engine-wide constants.
 *
 * These are values that are meaningful domain identifiers (not arbitrary strings),
 * but do not belong in @mage-knight/shared.
 */

/** Used for engine-triggered/system commands (not issued by a player). */
export const SYSTEM_PLAYER_ID = "system" as const;

/** Prefix for core tile IDs (e.g. "core_01"). */
export const CORE_TILE_ID_PREFIX = "core_" as const;


