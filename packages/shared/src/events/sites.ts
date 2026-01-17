/**
 * Site Events
 *
 * Events related to site interactions: conquest, exploration, rewards,
 * and special site types (glades, mines, villages, etc.).
 *
 * @module events/sites
 *
 * @remarks Site System Overview
 * - **Adventure Sites**: Require combat (keeps, dungeons, tombs, etc.)
 * - **Safe Sites**: No combat (villages, monasteries, etc.)
 * - **Special Sites**: Unique mechanics (magical glades, mines)
 *
 * @example Site Conquest Flow
 * ```
 * SITE_ENTERED (player enters site hex)
 *   └─► If fortified:
 *         └─► ENEMIES_REVEALED (garrison visible)
 *         └─► ENEMIES_DRAWN_FOR_SITE (if dungeon/tomb)
 *   └─► Combat occurs...
 *   └─► SITE_CONQUERED (after victory)
 *         └─► SHIELD_TOKEN_PLACED (marks conquered)
 *         └─► REWARD_QUEUED (pending reward selection)
 *               └─► REWARD_SELECTED (player picks reward)
 * ```
 *
 * @example Village Interaction Flow
 * ```
 * INTERACTION_STARTED (enter village)
 *   └─► HEALING_PURCHASED (if wounds healed)
 *   └─► UNIT_RECRUITED (if unit taken)
 *   └─► INTERACTION_COMPLETED (exit village)
 * ```
 */

import type { HexCoord } from "../hex.js";
import type { BasicManaColor, SpecialManaColor } from "../ids.js";

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

// ============================================================================
// REWARD_QUEUED
// ============================================================================

/**
 * Event type constant for queuing a reward.
 * @see RewardQueuedEvent
 */
export const REWARD_QUEUED = "REWARD_QUEUED" as const;

/**
 * Emitted when a reward is queued for selection.
 *
 * Player must select from available rewards before continuing.
 *
 * @remarks
 * - rewardType indicates what kind of reward (spell, artifact, etc.)
 * - Creates pending state requiring player input
 * - Multiple rewards can be queued
 *
 * @example
 * ```typescript
 * if (event.type === REWARD_QUEUED) {
 *   showRewardSelectionUI(event.rewardType);
 * }
 * ```
 */
export interface RewardQueuedEvent {
  readonly type: typeof REWARD_QUEUED;
  /** ID of the player receiving the reward */
  readonly playerId: string;
  /** Type of reward (e.g., "spell", "artifact", "advanced_action") */
  readonly rewardType: string;
}

/**
 * Creates a RewardQueuedEvent.
 */
export function createRewardQueuedEvent(
  playerId: string,
  rewardType: string
): RewardQueuedEvent {
  return {
    type: REWARD_QUEUED,
    playerId,
    rewardType,
  };
}

// ============================================================================
// REWARD_SELECTED
// ============================================================================

/**
 * Event type constant for selecting a reward.
 * @see RewardSelectedEvent
 */
export const REWARD_SELECTED = "REWARD_SELECTED" as const;

/**
 * Emitted when a player selects a reward.
 *
 * Confirms which reward was chosen.
 *
 * @remarks
 * - cardId is the selected card
 * - rewardType matches the queued reward
 * - Card typically goes to top of deed deck
 * - Triggers: SELECT_REWARD action
 *
 * @example
 * ```typescript
 * if (event.type === REWARD_SELECTED) {
 *   hideRewardSelectionUI();
 *   addRewardToDeck(event.playerId, event.cardId);
 * }
 * ```
 */
export interface RewardSelectedEvent {
  readonly type: typeof REWARD_SELECTED;
  /** ID of the player who selected */
  readonly playerId: string;
  /** ID of the selected card */
  readonly cardId: string;
  /** Type of reward that was selected */
  readonly rewardType: string;
}

/**
 * Creates a RewardSelectedEvent.
 */
export function createRewardSelectedEvent(
  playerId: string,
  cardId: string,
  rewardType: string
): RewardSelectedEvent {
  return {
    type: REWARD_SELECTED,
    playerId,
    cardId,
    rewardType,
  };
}

// ============================================================================
// INTERACTION_STARTED
// ============================================================================

/**
 * Event type constant for starting site interaction.
 * @see InteractionStartedEvent
 */
export const INTERACTION_STARTED = "INTERACTION_STARTED" as const;

/**
 * Emitted when a player begins interacting with a safe site.
 *
 * Safe sites (villages, monasteries) offer services.
 *
 * @remarks
 * - influenceAvailable is how much influence player can spend
 * - Services available depend on site type
 * - No combat required
 *
 * @example
 * ```typescript
 * if (event.type === INTERACTION_STARTED) {
 *   showSiteInteractionMenu(event.siteType);
 *   displayAvailableInfluence(event.influenceAvailable);
 * }
 * ```
 */
export interface InteractionStartedEvent {
  readonly type: typeof INTERACTION_STARTED;
  /** ID of the interacting player */
  readonly playerId: string;
  /** Type of site being interacted with */
  readonly siteType: string;
  /** Influence available for purchases */
  readonly influenceAvailable: number;
}

/**
 * Creates an InteractionStartedEvent.
 */
export function createInteractionStartedEvent(
  playerId: string,
  siteType: string,
  influenceAvailable: number
): InteractionStartedEvent {
  return {
    type: INTERACTION_STARTED,
    playerId,
    siteType,
    influenceAvailable,
  };
}

// ============================================================================
// HEALING_PURCHASED
// ============================================================================

/**
 * Event type constant for purchasing healing.
 * @see HealingPurchasedEvent
 */
export const HEALING_PURCHASED = "HEALING_PURCHASED" as const;

/**
 * Emitted when a player purchases healing at a site.
 *
 * Wounds are healed in exchange for influence.
 *
 * @remarks
 * - healingPoints is the healing purchased
 * - woundsHealed is how many wounds were actually healed
 * - influenceCost is the influence spent
 *
 * @example
 * ```typescript
 * if (event.type === HEALING_PURCHASED) {
 *   healWounds(event.playerId, event.woundsHealed);
 *   deductInfluence(event.influenceCost);
 * }
 * ```
 */
export interface HealingPurchasedEvent {
  readonly type: typeof HEALING_PURCHASED;
  /** ID of the player who purchased healing */
  readonly playerId: string;
  /** Healing points purchased */
  readonly healingPoints: number;
  /** Influence spent */
  readonly influenceCost: number;
  /** Wounds actually healed */
  readonly woundsHealed: number;
}

/**
 * Creates a HealingPurchasedEvent.
 */
export function createHealingPurchasedEvent(
  playerId: string,
  healingPoints: number,
  influenceCost: number,
  woundsHealed: number
): HealingPurchasedEvent {
  return {
    type: HEALING_PURCHASED,
    playerId,
    healingPoints,
    influenceCost,
    woundsHealed,
  };
}

// ============================================================================
// INTERACTION_COMPLETED
// ============================================================================

/**
 * Event type constant for completing interaction.
 * @see InteractionCompletedEvent
 */
export const INTERACTION_COMPLETED = "INTERACTION_COMPLETED" as const;

/**
 * Emitted when site interaction is completed.
 *
 * Player is done interacting with the safe site.
 *
 * @remarks
 * - Follows INTERACTION_STARTED
 * - Player can now take other actions
 *
 * @example
 * ```typescript
 * if (event.type === INTERACTION_COMPLETED) {
 *   hideSiteInteractionMenu();
 *   enableNormalActions();
 * }
 * ```
 */
export interface InteractionCompletedEvent {
  readonly type: typeof INTERACTION_COMPLETED;
  /** ID of the player who completed interaction */
  readonly playerId: string;
  /** Type of site interaction completed */
  readonly siteType: string;
}

/**
 * Creates an InteractionCompletedEvent.
 */
export function createInteractionCompletedEvent(
  playerId: string,
  siteType: string
): InteractionCompletedEvent {
  return {
    type: INTERACTION_COMPLETED,
    playerId,
    siteType,
  };
}

// ============================================================================
// MAGICAL GLADE EVENTS
// ============================================================================

/**
 * Event type constant for glade wound discard.
 * @see GladeWoundDiscardedEvent
 */
export const GLADE_WOUND_DISCARDED = "GLADE_WOUND_DISCARDED" as const;

/**
 * Emitted when a wound is discarded at a Magical Glade.
 *
 * Magical Glades allow discarding wounds for healing.
 *
 * @remarks
 * - source indicates where the wound came from (hand or discard)
 * - Wound is removed from game (not just discarded)
 */
export interface GladeWoundDiscardedEvent {
  readonly type: typeof GLADE_WOUND_DISCARDED;
  /** ID of the player */
  readonly playerId: string;
  /** Where the wound was discarded from */
  readonly source: "hand" | "discard";
}

/**
 * Creates a GladeWoundDiscardedEvent.
 */
export function createGladeWoundDiscardedEvent(
  playerId: string,
  source: "hand" | "discard"
): GladeWoundDiscardedEvent {
  return {
    type: GLADE_WOUND_DISCARDED,
    playerId,
    source,
  };
}

/**
 * Event type constant for skipping glade wound.
 * @see GladeWoundSkippedEvent
 */
export const GLADE_WOUND_SKIPPED = "GLADE_WOUND_SKIPPED" as const;

/**
 * Emitted when a player skips wound healing at a glade.
 */
export interface GladeWoundSkippedEvent {
  readonly type: typeof GLADE_WOUND_SKIPPED;
  /** ID of the player who skipped */
  readonly playerId: string;
}

/**
 * Creates a GladeWoundSkippedEvent.
 */
export function createGladeWoundSkippedEvent(
  playerId: string
): GladeWoundSkippedEvent {
  return {
    type: GLADE_WOUND_SKIPPED,
    playerId,
  };
}

/**
 * Event type constant for glade mana gain.
 * @see GladeManaGainedEvent
 */
export const GLADE_MANA_GAINED = "GLADE_MANA_GAINED" as const;

/**
 * Emitted when mana is gained at a Magical Glade.
 *
 * Glades provide special mana colors (gold or black).
 */
export interface GladeManaGainedEvent {
  readonly type: typeof GLADE_MANA_GAINED;
  /** ID of the player */
  readonly playerId: string;
  /** Color of mana gained (gold or black) */
  readonly manaColor: SpecialManaColor;
}

/**
 * Creates a GladeManaGainedEvent.
 */
export function createGladeManaGainedEvent(
  playerId: string,
  manaColor: SpecialManaColor
): GladeManaGainedEvent {
  return {
    type: GLADE_MANA_GAINED,
    playerId,
    manaColor,
  };
}

// ============================================================================
// DEEP MINE EVENTS
// ============================================================================

/**
 * Event type constant for deep mine crystal gain.
 * @see DeepMineCrystalGainedEvent
 */
export const DEEP_MINE_CRYSTAL_GAINED = "DEEP_MINE_CRYSTAL_GAINED" as const;

/**
 * Emitted when a crystal is gained at a Deep Mine.
 *
 * Deep Mines provide basic color crystals.
 */
export interface DeepMineCrystalGainedEvent {
  readonly type: typeof DEEP_MINE_CRYSTAL_GAINED;
  /** ID of the player */
  readonly playerId: string;
  /** Color of crystal gained */
  readonly color: BasicManaColor;
}

/**
 * Creates a DeepMineCrystalGainedEvent.
 */
export function createDeepMineCrystalGainedEvent(
  playerId: string,
  color: BasicManaColor
): DeepMineCrystalGainedEvent {
  return {
    type: DEEP_MINE_CRYSTAL_GAINED,
    playerId,
    color,
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for SiteConqueredEvent.
 */
export function isSiteConqueredEvent(event: {
  type: string;
}): event is SiteConqueredEvent {
  return event.type === SITE_CONQUERED;
}

/**
 * Type guard for SiteEnteredEvent.
 */
export function isSiteEnteredEvent(event: {
  type: string;
}): event is SiteEnteredEvent {
  return event.type === SITE_ENTERED;
}

/**
 * Type guard for RewardQueuedEvent.
 */
export function isRewardQueuedEvent(event: {
  type: string;
}): event is RewardQueuedEvent {
  return event.type === REWARD_QUEUED;
}

/**
 * Type guard for InteractionStartedEvent.
 */
export function isInteractionStartedEvent(event: {
  type: string;
}): event is InteractionStartedEvent {
  return event.type === INTERACTION_STARTED;
}

/**
 * Check if an event is any site-related event.
 */
export function isSiteEvent(event: { type: string }): boolean {
  return [
    SITE_CONQUERED,
    SITE_ENTERED,
    ENEMIES_DRAWN_FOR_SITE,
    ENEMIES_REVEALED,
    SHIELD_TOKEN_PLACED,
    REWARD_QUEUED,
    REWARD_SELECTED,
    INTERACTION_STARTED,
    HEALING_PURCHASED,
    INTERACTION_COMPLETED,
    GLADE_WOUND_DISCARDED,
    GLADE_WOUND_SKIPPED,
    GLADE_MANA_GAINED,
    DEEP_MINE_CRYSTAL_GAINED,
  ].includes(event.type as typeof SITE_CONQUERED);
}
