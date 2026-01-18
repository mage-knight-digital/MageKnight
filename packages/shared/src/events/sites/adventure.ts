/**
 * Adventure Site Events
 *
 * Events for entering, exploring, and conquering adventure sites.
 *
 * @module events/sites/adventure
 */

import type { HexCoord } from "../../hex.js";

// ============================================================================
// SITE_ENTERED
// ============================================================================

/**
 * Event type constant for entering a site.
 * @see SiteEnteredEvent
 */
export const SITE_ENTERED = "SITE_ENTERED" as const;

/**
 * Emitted when a player enters a site hex.
 *
 * This marks the beginning of site interaction.
 *
 * @remarks
 * - siteType identifies the type of site
 * - May trigger combat for adventure sites
 * - May start interaction for safe sites
 *
 * @example
 * ```typescript
 * if (event.type === SITE_ENTERED) {
 *   showSiteInfo(event.siteType);
 *   if (isAdventureSite(event.siteType)) {
 *     prepareForCombat();
 *   }
 * }
 * ```
 */
export interface SiteEnteredEvent {
  readonly type: typeof SITE_ENTERED;
  /** ID of the player who entered */
  readonly playerId: string;
  /** Type of site (e.g., "keep", "village", "dungeon") */
  readonly siteType: string;
  /** Location of the site */
  readonly hexCoord: HexCoord;
}

/**
 * Creates a SiteEnteredEvent.
 */
export function createSiteEnteredEvent(
  playerId: string,
  siteType: string,
  hexCoord: HexCoord
): SiteEnteredEvent {
  return {
    type: SITE_ENTERED,
    playerId,
    siteType,
    hexCoord,
  };
}

/**
 * Type guard for SiteEnteredEvent.
 */
export function isSiteEnteredEvent(event: {
  type: string;
}): event is SiteEnteredEvent {
  return event.type === SITE_ENTERED;
}

// ============================================================================
// ENEMIES_REVEALED
// ============================================================================

/**
 * Event type constant for revealing enemies.
 * @see EnemiesRevealedEvent
 */
export const ENEMIES_REVEALED = "ENEMIES_REVEALED" as const;

/**
 * Emitted when enemies at a location are revealed.
 *
 * Enemies become visible when approaching fortified sites.
 *
 * @remarks
 * - enemyTokenIds are the visible enemy tokens
 * - Enemies are revealed, not yet in combat
 * - Creates undo checkpoint
 *
 * @example
 * ```typescript
 * if (event.type === ENEMIES_REVEALED) {
 *   showEnemiesOnMap(event.hexCoord, event.enemyTokenIds);
 * }
 * ```
 */
export interface EnemiesRevealedEvent {
  readonly type: typeof ENEMIES_REVEALED;
  /** ID of the player who revealed enemies */
  readonly playerId: string;
  /** Location where enemies are revealed */
  readonly hexCoord: HexCoord;
  /** IDs of the revealed enemy tokens */
  readonly enemyTokenIds: readonly string[];
}

/**
 * Creates an EnemiesRevealedEvent.
 */
export function createEnemiesRevealedEvent(
  playerId: string,
  hexCoord: HexCoord,
  enemyTokenIds: readonly string[]
): EnemiesRevealedEvent {
  return {
    type: ENEMIES_REVEALED,
    playerId,
    hexCoord,
    enemyTokenIds,
  };
}

// ============================================================================
// ENEMIES_DRAWN_FOR_SITE
// ============================================================================

/**
 * Event type constant for drawing site enemies.
 * @see EnemiesDrawnForSiteEvent
 */
export const ENEMIES_DRAWN_FOR_SITE = "ENEMIES_DRAWN_FOR_SITE" as const;

/**
 * Emitted when enemies are drawn for a site (dungeons, tombs).
 *
 * Some sites draw random enemies from a pool.
 *
 * @remarks
 * - enemyCount is how many enemies were drawn
 * - Actual enemies determined by site type and RNG
 * - Precedes COMBAT_STARTED
 *
 * @example
 * ```typescript
 * if (event.type === ENEMIES_DRAWN_FOR_SITE) {
 *   showEnemyDrawAnimation(event.enemyCount);
 * }
 * ```
 */
export interface EnemiesDrawnForSiteEvent {
  readonly type: typeof ENEMIES_DRAWN_FOR_SITE;
  /** ID of the player exploring the site */
  readonly playerId: string;
  /** Type of site enemies were drawn for */
  readonly siteType: string;
  /** Number of enemies drawn */
  readonly enemyCount: number;
}

/**
 * Creates an EnemiesDrawnForSiteEvent.
 */
export function createEnemiesDrawnForSiteEvent(
  playerId: string,
  siteType: string,
  enemyCount: number
): EnemiesDrawnForSiteEvent {
  return {
    type: ENEMIES_DRAWN_FOR_SITE,
    playerId,
    siteType,
    enemyCount,
  };
}

// ============================================================================
// SITE_CONQUERED
// ============================================================================

/**
 * Event type constant for site conquest.
 * @see SiteConqueredEvent
 */
export const SITE_CONQUERED = "SITE_CONQUERED" as const;

/**
 * Emitted when a player conquers a site.
 *
 * The site's defenders have been defeated.
 *
 * @remarks
 * - Follows successful combat at the site
 * - May trigger reward events
 * - Site is marked with player's shield token
 * - Creates undo checkpoint
 *
 * @example
 * ```typescript
 * if (event.type === SITE_CONQUERED) {
 *   markSiteAsConquered(event.hexCoord, event.playerId);
 *   queueSiteRewards(event.siteType);
 * }
 * ```
 */
export interface SiteConqueredEvent {
  readonly type: typeof SITE_CONQUERED;
  /** ID of the conquering player */
  readonly playerId: string;
  /** Type of site conquered */
  readonly siteType: string;
  /** Location of the site */
  readonly hexCoord: HexCoord;
}

/**
 * Creates a SiteConqueredEvent.
 */
export function createSiteConqueredEvent(
  playerId: string,
  siteType: string,
  hexCoord: HexCoord
): SiteConqueredEvent {
  return {
    type: SITE_CONQUERED,
    playerId,
    siteType,
    hexCoord,
  };
}

/**
 * Type guard for SiteConqueredEvent.
 */
export function isSiteConqueredEvent(event: {
  type: string;
}): event is SiteConqueredEvent {
  return event.type === SITE_CONQUERED;
}

// ============================================================================
// SHIELD_TOKEN_PLACED
// ============================================================================

/**
 * Event type constant for shield token placement.
 * @see ShieldTokenPlacedEvent
 */
export const SHIELD_TOKEN_PLACED = "SHIELD_TOKEN_PLACED" as const;

/**
 * Emitted when a shield token is placed on a site.
 *
 * Shield tokens mark conquered sites.
 *
 * @remarks
 * - Cities can have multiple shields
 * - totalShields tracks cumulative conquest
 *
 * @example
 * ```typescript
 * if (event.type === SHIELD_TOKEN_PLACED) {
 *   placeShieldOnMap(event.hexCoord, event.playerId);
 * }
 * ```
 */
export interface ShieldTokenPlacedEvent {
  readonly type: typeof SHIELD_TOKEN_PLACED;
  /** ID of the player placing the shield */
  readonly playerId: string;
  /** Location of the shield */
  readonly hexCoord: HexCoord;
  /** Total shields at this location */
  readonly totalShields: number;
}

/**
 * Creates a ShieldTokenPlacedEvent.
 */
export function createShieldTokenPlacedEvent(
  playerId: string,
  hexCoord: HexCoord,
  totalShields: number
): ShieldTokenPlacedEvent {
  return {
    type: SHIELD_TOKEN_PLACED,
    playerId,
    hexCoord,
    totalShields,
  };
}
