/**
 * Event Categories and Metadata
 *
 * This module provides category constants, groupings, and metadata for game events.
 * Optimized for LLM-driven agent development with clear documentation of event
 * relationships, categories, and patterns.
 *
 * @module events/categories
 */

// ============================================================================
// EVENT CATEGORIES
// ============================================================================

/**
 * Event categories for grouping and filtering events.
 * Use these constants when filtering event streams or building event handlers.
 */
export const EVENT_CATEGORY = {
  /** Game lifecycle: start, rounds, turns, end */
  LIFECYCLE: "lifecycle",
  /** Tactics selection and activation */
  TACTICS: "tactics",
  /** Player movement and map exploration */
  MOVEMENT: "movement",
  /** Combat phases, attacks, blocks, damage */
  COMBAT: "combat",
  /** Card play, draw, discard, gain */
  CARDS: "cards",
  /** Mana dice, crystals, tokens */
  MANA: "mana",
  /** Wounds and healing */
  HEALTH: "health",
  /** Fame, reputation, levels, skills */
  PROGRESSION: "progression",
  /** Unit recruitment, activation, wounds */
  UNITS: "units",
  /** Offer (market) interactions */
  OFFERS: "offers",
  /** Undo operations */
  UNDO: "undo",
  /** Effect choices requiring player input */
  CHOICE: "choice",
  /** Site interactions and rewards */
  SITES: "sites",
  /** Invalid action notifications */
  VALIDATION: "validation",
} as const;

export type EventCategory = (typeof EVENT_CATEGORY)[keyof typeof EVENT_CATEGORY];

// ============================================================================
// EVENT TYPE CONSTANTS BY CATEGORY
// ============================================================================

/**
 * All lifecycle event type constants.
 * These events mark major game state transitions.
 */
export const LIFECYCLE_EVENTS = [
  "GAME_STARTED",
  "ROUND_STARTED",
  "TURN_STARTED",
  "TURN_ENDED",
  "ROUND_ENDED",
  "GAME_ENDED",
  "SCENARIO_END_TRIGGERED",
  "END_OF_ROUND_ANNOUNCED",
  "NEW_ROUND_STARTED",
  "TIME_OF_DAY_CHANGED",
  "MANA_SOURCE_RESET",
] as const;

/**
 * All tactics event type constants.
 * These events relate to the tactics selection phase each round.
 */
export const TACTICS_EVENTS = [
  "TACTIC_SELECTED",
  "DUMMY_TACTIC_SELECTED",
  "TACTICS_PHASE_ENDED",
  "TACTIC_ACTIVATED",
  "TACTIC_DECISION_RESOLVED",
  "SOURCE_DICE_REROLLED",
  "DECKS_RESHUFFLED",
  "PLAYER_RESTED",
  "REST_UNDONE",
] as const;

/**
 * All movement event type constants.
 * These events track player position and map exploration.
 */
export const MOVEMENT_EVENTS = [
  "PLAYER_MOVED",
  "TILE_REVEALED",
  "TILE_EXPLORED",
] as const;

/**
 * All combat event type constants.
 * These events cover the complete combat lifecycle.
 */
export const COMBAT_EVENTS = [
  "COMBAT_STARTED",
  "COMBAT_PHASE_CHANGED",
  "ENEMY_BLOCKED",
  "BLOCK_FAILED",
  "BLOCK_ASSIGNED",
  "BLOCK_UNASSIGNED",
  "ENEMY_DEFEATED",
  "ATTACK_FAILED",
  "DAMAGE_ASSIGNED",
  "COMBAT_ENDED",
  "COMBAT_EXITED",
  "PLAYER_KNOCKED_OUT",
  "PARALYZE_HAND_DISCARDED",
  "COMBAT_TRIGGERED",
  "PLAYER_WITHDREW",
] as const;

/**
 * All card event type constants.
 * These events track card state changes.
 */
export const CARD_EVENTS = [
  "CARD_PLAYED",
  "CARD_DRAWN",
  "CARD_DISCARDED",
  "CARD_GAINED",
] as const;

/**
 * All mana event type constants.
 * These events track mana resource changes.
 */
export const MANA_EVENTS = [
  "MANA_DIE_TAKEN",
  "MANA_DIE_RETURNED",
  "CRYSTAL_CONVERTED",
  "MANA_DIE_USED",
  "CRYSTAL_USED",
  "CRYSTAL_GAINED",
  "MANA_TOKEN_USED",
] as const;

/**
 * All health event type constants.
 * These events track wounds and healing.
 */
export const HEALTH_EVENTS = ["WOUND_RECEIVED", "WOUND_HEALED"] as const;

/**
 * All progression event type constants.
 * These events track player advancement.
 */
export const PROGRESSION_EVENTS = [
  "FAME_GAINED",
  "FAME_LOST",
  "REPUTATION_CHANGED",
  "LEVEL_UP",
  "LEVEL_UP_REWARDS_PENDING",
  "ADVANCED_ACTION_GAINED",
  "COMMAND_SLOT_GAINED",
  "SKILL_USED",
  "SKILL_GAINED",
  "MANA_OVERLOAD_TRIGGERED",
] as const;

/**
 * All unit event type constants.
 * These events track unit lifecycle and state.
 */
export const UNIT_EVENTS = [
  "UNIT_RECRUITED",
  "UNIT_DISBANDED",
  "UNIT_ACTIVATED",
  "UNIT_WOUNDED",
  "UNIT_HEALED",
  "UNIT_READIED",
  "UNITS_READIED",
  "UNIT_DESTROYED",
  "UNIT_MAINTENANCE_PAID",
] as const;

/**
 * All offer event type constants.
 * These events track market/offer interactions.
 */
export const OFFER_EVENTS = ["OFFER_REFRESHED", "OFFER_CARD_TAKEN"] as const;

/**
 * All undo event type constants.
 * These events track undo operations.
 */
export const UNDO_EVENTS = [
  "CARD_PLAY_UNDONE",
  "MOVE_UNDONE",
  "UNDO_FAILED",
  "UNDO_CHECKPOINT_SET",
] as const;

/**
 * All choice event type constants.
 * These events track player choices during effect resolution.
 */
export const CHOICE_EVENTS = ["CHOICE_REQUIRED", "CHOICE_RESOLVED"] as const;

/**
 * All site event type constants.
 * These events track site interactions and rewards.
 */
export const SITE_EVENTS = [
  "SITE_CONQUERED",
  "SITE_ENTERED",
  "ENEMIES_DRAWN_FOR_SITE",
  "ENEMIES_REVEALED",
  "SHIELD_TOKEN_PLACED",
  "REWARD_QUEUED",
  "REWARD_SELECTED",
  "INTERACTION_STARTED",
  "HEALING_PURCHASED",
  "INTERACTION_COMPLETED",
  "GLADE_WOUND_DISCARDED",
  "GLADE_WOUND_SKIPPED",
  "GLADE_MANA_GAINED",
  "DEEP_MINE_CRYSTAL_GAINED",
] as const;

/**
 * All validation event type constants.
 * These events notify of invalid actions.
 */
export const VALIDATION_EVENTS = ["INVALID_ACTION"] as const;

// ============================================================================
// EVENT METADATA
// ============================================================================

/**
 * Events that create an undo checkpoint (irreversible operations).
 * After these events, undo is blocked until the next turn.
 *
 * @example
 * if (CHECKPOINT_EVENTS.includes(event.type)) {
 *   console.log("This action cannot be undone");
 * }
 */
export const CHECKPOINT_EVENTS = [
  "TILE_EXPLORED",
  "COMBAT_STARTED",
  "ENEMIES_REVEALED",
  "SITE_CONQUERED",
  "UNDO_CHECKPOINT_SET",
] as const;

/**
 * Events that indicate pending player input is required.
 * The game cannot proceed until the player responds.
 *
 * @example
 * if (PENDING_INPUT_EVENTS.includes(event.type)) {
 *   promptPlayerForInput(event);
 * }
 */
export const PENDING_INPUT_EVENTS = [
  "CHOICE_REQUIRED",
  "LEVEL_UP_REWARDS_PENDING",
  "REWARD_QUEUED",
] as const;

/**
 * Map of event types to their categories.
 * Use this for event filtering and routing.
 *
 * @example
 * const category = EVENT_TYPE_TO_CATEGORY[event.type];
 * if (category === EVENT_CATEGORY.COMBAT) {
 *   updateCombatUI(event);
 * }
 */
export const EVENT_TYPE_TO_CATEGORY: Record<string, EventCategory> = {
  // Lifecycle
  GAME_STARTED: EVENT_CATEGORY.LIFECYCLE,
  ROUND_STARTED: EVENT_CATEGORY.LIFECYCLE,
  TURN_STARTED: EVENT_CATEGORY.LIFECYCLE,
  TURN_ENDED: EVENT_CATEGORY.LIFECYCLE,
  ROUND_ENDED: EVENT_CATEGORY.LIFECYCLE,
  GAME_ENDED: EVENT_CATEGORY.LIFECYCLE,
  SCENARIO_END_TRIGGERED: EVENT_CATEGORY.LIFECYCLE,
  END_OF_ROUND_ANNOUNCED: EVENT_CATEGORY.LIFECYCLE,
  NEW_ROUND_STARTED: EVENT_CATEGORY.LIFECYCLE,
  TIME_OF_DAY_CHANGED: EVENT_CATEGORY.LIFECYCLE,
  MANA_SOURCE_RESET: EVENT_CATEGORY.LIFECYCLE,
  // Tactics
  TACTIC_SELECTED: EVENT_CATEGORY.TACTICS,
  DUMMY_TACTIC_SELECTED: EVENT_CATEGORY.TACTICS,
  TACTICS_PHASE_ENDED: EVENT_CATEGORY.TACTICS,
  TACTIC_ACTIVATED: EVENT_CATEGORY.TACTICS,
  TACTIC_DECISION_RESOLVED: EVENT_CATEGORY.TACTICS,
  SOURCE_DICE_REROLLED: EVENT_CATEGORY.TACTICS,
  DECKS_RESHUFFLED: EVENT_CATEGORY.TACTICS,
  PLAYER_RESTED: EVENT_CATEGORY.TACTICS,
  REST_UNDONE: EVENT_CATEGORY.TACTICS,
  // Movement
  PLAYER_MOVED: EVENT_CATEGORY.MOVEMENT,
  TILE_REVEALED: EVENT_CATEGORY.MOVEMENT,
  TILE_EXPLORED: EVENT_CATEGORY.MOVEMENT,
  // Combat
  COMBAT_STARTED: EVENT_CATEGORY.COMBAT,
  COMBAT_PHASE_CHANGED: EVENT_CATEGORY.COMBAT,
  ENEMY_BLOCKED: EVENT_CATEGORY.COMBAT,
  BLOCK_FAILED: EVENT_CATEGORY.COMBAT,
  BLOCK_ASSIGNED: EVENT_CATEGORY.COMBAT,
  BLOCK_UNASSIGNED: EVENT_CATEGORY.COMBAT,
  ENEMY_DEFEATED: EVENT_CATEGORY.COMBAT,
  ATTACK_FAILED: EVENT_CATEGORY.COMBAT,
  DAMAGE_ASSIGNED: EVENT_CATEGORY.COMBAT,
  COMBAT_ENDED: EVENT_CATEGORY.COMBAT,
  COMBAT_EXITED: EVENT_CATEGORY.COMBAT,
  PLAYER_KNOCKED_OUT: EVENT_CATEGORY.COMBAT,
  PARALYZE_HAND_DISCARDED: EVENT_CATEGORY.COMBAT,
  COMBAT_TRIGGERED: EVENT_CATEGORY.COMBAT,
  PLAYER_WITHDREW: EVENT_CATEGORY.COMBAT,
  // Cards
  CARD_PLAYED: EVENT_CATEGORY.CARDS,
  CARD_DRAWN: EVENT_CATEGORY.CARDS,
  CARD_DISCARDED: EVENT_CATEGORY.CARDS,
  CARD_GAINED: EVENT_CATEGORY.CARDS,
  // Mana
  MANA_DIE_TAKEN: EVENT_CATEGORY.MANA,
  MANA_DIE_RETURNED: EVENT_CATEGORY.MANA,
  CRYSTAL_CONVERTED: EVENT_CATEGORY.MANA,
  MANA_DIE_USED: EVENT_CATEGORY.MANA,
  CRYSTAL_USED: EVENT_CATEGORY.MANA,
  CRYSTAL_GAINED: EVENT_CATEGORY.MANA,
  MANA_TOKEN_USED: EVENT_CATEGORY.MANA,
  // Health
  WOUND_RECEIVED: EVENT_CATEGORY.HEALTH,
  WOUND_HEALED: EVENT_CATEGORY.HEALTH,
  // Progression
  FAME_GAINED: EVENT_CATEGORY.PROGRESSION,
  FAME_LOST: EVENT_CATEGORY.PROGRESSION,
  REPUTATION_CHANGED: EVENT_CATEGORY.PROGRESSION,
  LEVEL_UP: EVENT_CATEGORY.PROGRESSION,
  LEVEL_UP_REWARDS_PENDING: EVENT_CATEGORY.PROGRESSION,
  ADVANCED_ACTION_GAINED: EVENT_CATEGORY.PROGRESSION,
  COMMAND_SLOT_GAINED: EVENT_CATEGORY.PROGRESSION,
  SKILL_USED: EVENT_CATEGORY.PROGRESSION,
  SKILL_GAINED: EVENT_CATEGORY.PROGRESSION,
  MANA_OVERLOAD_TRIGGERED: EVENT_CATEGORY.PROGRESSION,
  // Units
  UNIT_RECRUITED: EVENT_CATEGORY.UNITS,
  UNIT_DISBANDED: EVENT_CATEGORY.UNITS,
  UNIT_MAINTENANCE_PAID: EVENT_CATEGORY.UNITS,
  UNIT_ACTIVATED: EVENT_CATEGORY.UNITS,
  UNIT_WOUNDED: EVENT_CATEGORY.UNITS,
  UNIT_HEALED: EVENT_CATEGORY.UNITS,
  UNIT_READIED: EVENT_CATEGORY.UNITS,
  UNITS_READIED: EVENT_CATEGORY.UNITS,
  UNIT_DESTROYED: EVENT_CATEGORY.UNITS,
  // Offers
  OFFER_REFRESHED: EVENT_CATEGORY.OFFERS,
  OFFER_CARD_TAKEN: EVENT_CATEGORY.OFFERS,
  // Undo
  CARD_PLAY_UNDONE: EVENT_CATEGORY.UNDO,
  MOVE_UNDONE: EVENT_CATEGORY.UNDO,
  UNDO_FAILED: EVENT_CATEGORY.UNDO,
  UNDO_CHECKPOINT_SET: EVENT_CATEGORY.UNDO,
  // Choice
  CHOICE_REQUIRED: EVENT_CATEGORY.CHOICE,
  CHOICE_RESOLVED: EVENT_CATEGORY.CHOICE,
  // Sites
  SITE_CONQUERED: EVENT_CATEGORY.SITES,
  SITE_ENTERED: EVENT_CATEGORY.SITES,
  ENEMIES_DRAWN_FOR_SITE: EVENT_CATEGORY.SITES,
  ENEMIES_REVEALED: EVENT_CATEGORY.SITES,
  SHIELD_TOKEN_PLACED: EVENT_CATEGORY.SITES,
  REWARD_QUEUED: EVENT_CATEGORY.SITES,
  REWARD_SELECTED: EVENT_CATEGORY.SITES,
  INTERACTION_STARTED: EVENT_CATEGORY.SITES,
  HEALING_PURCHASED: EVENT_CATEGORY.SITES,
  INTERACTION_COMPLETED: EVENT_CATEGORY.SITES,
  GLADE_WOUND_DISCARDED: EVENT_CATEGORY.SITES,
  GLADE_WOUND_SKIPPED: EVENT_CATEGORY.SITES,
  GLADE_MANA_GAINED: EVENT_CATEGORY.SITES,
  DEEP_MINE_CRYSTAL_GAINED: EVENT_CATEGORY.SITES,
  // Validation
  INVALID_ACTION: EVENT_CATEGORY.VALIDATION,
  // Dummy player
  DUMMY_PLAYER_CREATED: EVENT_CATEGORY.LIFECYCLE,
  DUMMY_TURN_EXECUTED: EVENT_CATEGORY.LIFECYCLE,
  DUMMY_END_OF_ROUND_ANNOUNCED: EVENT_CATEGORY.LIFECYCLE,
  DUMMY_GAINED_CARD: EVENT_CATEGORY.OFFERS,
  DUMMY_GAINED_CRYSTAL: EVENT_CATEGORY.MANA,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the category for an event type.
 *
 * @param eventType - The event type constant (e.g., "PLAYER_MOVED")
 * @returns The event category, or undefined if not found
 *
 * @example
 * const category = getEventCategory("PLAYER_MOVED");
 * // Returns: "movement"
 */
export function getEventCategory(eventType: string): EventCategory | undefined {
  return EVENT_TYPE_TO_CATEGORY[eventType];
}

/**
 * Check if an event type belongs to a specific category.
 *
 * @param eventType - The event type constant
 * @param category - The category to check against
 * @returns True if the event belongs to the category
 *
 * @example
 * if (isEventInCategory("COMBAT_STARTED", EVENT_CATEGORY.COMBAT)) {
 *   initializeCombatUI();
 * }
 */
export function isEventInCategory(
  eventType: string,
  category: EventCategory
): boolean {
  return EVENT_TYPE_TO_CATEGORY[eventType] === category;
}

/**
 * Check if an event creates an undo checkpoint.
 *
 * @param eventType - The event type constant
 * @returns True if the event prevents undo
 *
 * @example
 * if (isCheckpointEvent(event.type)) {
 *   disableUndoButton();
 * }
 */
export function isCheckpointEvent(eventType: string): boolean {
  return (CHECKPOINT_EVENTS as readonly string[]).includes(eventType);
}

/**
 * Check if an event indicates pending player input is required.
 *
 * @param eventType - The event type constant
 * @returns True if player input is needed
 *
 * @example
 * if (requiresPlayerInput(event.type)) {
 *   showInputPrompt(event);
 * }
 */
export function requiresPlayerInput(eventType: string): boolean {
  return (PENDING_INPUT_EVENTS as readonly string[]).includes(eventType);
}
