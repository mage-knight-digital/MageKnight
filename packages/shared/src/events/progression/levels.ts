/**
 * Level Up Events
 *
 * Events for leveling up and selecting level-up rewards.
 *
 * @module events/progression/levels
 */

import type { CardId } from "../../ids.js";
import type { LevelUpType } from "../../levels.js";

// ============================================================================
// LEVEL_UP
// ============================================================================

/**
 * Event type constant for level up.
 * @see LevelUpEvent
 */
export const LEVEL_UP = "LEVEL_UP" as const;

/**
 * Emitted when a player levels up.
 *
 * Level ups grant skills, advanced actions, or command slots.
 *
 * @remarks
 * - Triggered when fame crosses level thresholds
 * - levelUpType indicates what rewards are available
 * - Multiple level ups can be pending
 * - Followed by LEVEL_UP_REWARDS_PENDING
 *
 * @example
 * ```typescript
 * if (event.type === LEVEL_UP) {
 *   showLevelUpAnimation(event.newLevel);
 *   showRewardOptions(event.levelUpType);
 * }
 * ```
 */
export interface LevelUpEvent {
  readonly type: typeof LEVEL_UP;
  /** ID of the player who leveled up */
  readonly playerId: string;
  /** Previous level */
  readonly oldLevel: number;
  /** New level */
  readonly newLevel: number;
  /** Type of level up (determines rewards) */
  readonly levelUpType: LevelUpType;
}

/**
 * Creates a LevelUpEvent.
 */
export function createLevelUpEvent(
  playerId: string,
  oldLevel: number,
  newLevel: number,
  levelUpType: LevelUpType
): LevelUpEvent {
  return {
    type: LEVEL_UP,
    playerId,
    oldLevel,
    newLevel,
    levelUpType,
  };
}

/**
 * Type guard for LevelUpEvent.
 */
export function isLevelUpEvent(event: { type: string }): event is LevelUpEvent {
  return event.type === LEVEL_UP;
}

// ============================================================================
// LEVEL_UP_REWARDS_PENDING
// ============================================================================

/**
 * Event type constant for pending level up rewards.
 * @see LevelUpRewardsPendingEvent
 */
export const LEVEL_UP_REWARDS_PENDING = "LEVEL_UP_REWARDS_PENDING" as const;

/**
 * Emitted when level up rewards need to be selected.
 *
 * Player must choose their rewards before continuing.
 *
 * @remarks
 * - pendingLevels lists which levels need reward selection
 * - Player cannot end turn until rewards are selected
 * - Triggers pending player input
 *
 * @example
 * ```typescript
 * if (event.type === LEVEL_UP_REWARDS_PENDING) {
 *   showLevelUpRewardUI(event.pendingLevels);
 *   disableOtherActions();
 * }
 * ```
 */
export interface LevelUpRewardsPendingEvent {
  readonly type: typeof LEVEL_UP_REWARDS_PENDING;
  /** ID of the player with pending rewards */
  readonly playerId: string;
  /** Levels that need reward selection */
  readonly pendingLevels: readonly number[];
}

/**
 * Creates a LevelUpRewardsPendingEvent.
 */
export function createLevelUpRewardsPendingEvent(
  playerId: string,
  pendingLevels: readonly number[]
): LevelUpRewardsPendingEvent {
  return {
    type: LEVEL_UP_REWARDS_PENDING,
    playerId,
    pendingLevels,
  };
}

// ============================================================================
// ADVANCED_ACTION_GAINED
// ============================================================================

/**
 * Event type constant for gaining an advanced action.
 * @see AdvancedActionGainedEvent
 */
export const ADVANCED_ACTION_GAINED = "ADVANCED_ACTION_GAINED" as const;

/**
 * Emitted when a player gains an advanced action card.
 *
 * Advanced actions are powerful cards gained at level up.
 *
 * @remarks
 * - Card goes to top of deed deck (drawn next round)
 * - More powerful than basic action cards
 * - Triggered by level up reward selection
 *
 * @example
 * ```typescript
 * if (event.type === ADVANCED_ACTION_GAINED) {
 *   showNewCardAnimation(event.cardId);
 *   addCardToDeck(event.playerId, event.cardId);
 * }
 * ```
 */
export interface AdvancedActionGainedEvent {
  readonly type: typeof ADVANCED_ACTION_GAINED;
  /** ID of the player who gained the card */
  readonly playerId: string;
  /** ID of the advanced action card */
  readonly cardId: CardId;
}

/**
 * Creates an AdvancedActionGainedEvent.
 */
export function createAdvancedActionGainedEvent(
  playerId: string,
  cardId: CardId
): AdvancedActionGainedEvent {
  return {
    type: ADVANCED_ACTION_GAINED,
    playerId,
    cardId,
  };
}

// ============================================================================
// COMMAND_SLOT_GAINED
// ============================================================================

/**
 * Event type constant for gaining a command slot.
 * @see CommandSlotGainedEvent
 */
export const COMMAND_SLOT_GAINED = "COMMAND_SLOT_GAINED" as const;

/**
 * Emitted when a player gains a command slot.
 *
 * Command slots determine how many units can be commanded.
 *
 * @remarks
 * - Gained at certain level ups
 * - More slots = more units can participate
 * - Alternative to gaining advanced action at level up
 *
 * @example
 * ```typescript
 * if (event.type === COMMAND_SLOT_GAINED) {
 *   updateCommandSlotDisplay(event.newTotal);
 * }
 * ```
 */
export interface CommandSlotGainedEvent {
  readonly type: typeof COMMAND_SLOT_GAINED;
  /** ID of the player who gained the slot */
  readonly playerId: string;
  /** New total command slots */
  readonly newTotal: number;
}

/**
 * Creates a CommandSlotGainedEvent.
 */
export function createCommandSlotGainedEvent(
  playerId: string,
  newTotal: number
): CommandSlotGainedEvent {
  return {
    type: COMMAND_SLOT_GAINED,
    playerId,
    newTotal,
  };
}
