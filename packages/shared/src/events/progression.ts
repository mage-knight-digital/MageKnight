/**
 * Progression Events
 *
 * Events related to player advancement: fame, reputation, levels, and skills.
 * These track the player's growth throughout the game.
 *
 * @module events/progression
 *
 * @remarks Progression System Overview
 * - **Fame**: Primary scoring metric, gained from combat and exploration
 * - **Reputation**: Affects unit costs, gained/lost from interactions
 * - **Levels**: Unlock skills and command slots, based on fame thresholds
 * - **Skills**: Permanent abilities gained at level up
 *
 * @example Progression Flow
 * ```
 * Combat Victory:
 *   ENEMY_DEFEATED
 *     └─► FAME_GAINED
 *           └─► If fame crosses threshold:
 *                 └─► LEVEL_UP
 *                 └─► LEVEL_UP_REWARDS_PENDING
 *                       └─► Player selects rewards
 *                       └─► SKILL_GAINED
 *                       └─► ADVANCED_ACTION_GAINED or COMMAND_SLOT_GAINED
 *
 * Site Interaction:
 *   SITE_CONQUERED
 *     └─► REPUTATION_CHANGED (may increase or decrease)
 * ```
 */

import type { CardId, SkillId } from "../ids.js";
import type { LevelUpType } from "../levels.js";
import type { ReputationChangeReason } from "../valueConstants.js";

// ============================================================================
// FAME_GAINED
// ============================================================================

/**
 * Event type constant for gaining fame.
 * @see FameGainedEvent
 */
export const FAME_GAINED = "FAME_GAINED" as const;

/**
 * Emitted when a player gains fame points.
 *
 * Fame is the primary scoring metric and determines level ups.
 *
 * @remarks
 * - amount is the fame gained
 * - newTotal is the player's new fame total
 * - source indicates what granted the fame
 * - Common sources: defeating enemies, conquering sites, exploration
 *
 * @example
 * ```typescript
 * if (event.type === FAME_GAINED) {
 *   animateFameGain(event.amount);
 *   updateFameDisplay(event.newTotal);
 *   checkForLevelUp(event.playerId, event.newTotal);
 * }
 * ```
 */
export interface FameGainedEvent {
  readonly type: typeof FAME_GAINED;
  /** ID of the player who gained fame */
  readonly playerId: string;
  /** Amount of fame gained */
  readonly amount: number;
  /** New fame total */
  readonly newTotal: number;
  /** Source of the fame (e.g., "defeated_orc", "conquered_keep") */
  readonly source: string;
}

/**
 * Creates a FameGainedEvent.
 */
export function createFameGainedEvent(
  playerId: string,
  amount: number,
  newTotal: number,
  source: string
): FameGainedEvent {
  return {
    type: FAME_GAINED,
    playerId,
    amount,
    newTotal,
    source,
  };
}

// ============================================================================
// FAME_LOST
// ============================================================================

/**
 * Event type constant for losing fame.
 * @see FameLostEvent
 */
export const FAME_LOST = "FAME_LOST" as const;

/**
 * Emitted when a player loses fame points.
 *
 * Fame loss is rare but can occur from certain negative events.
 *
 * @remarks
 * - amount is the fame lost (positive number)
 * - newTotal is the player's new fame total
 * - Cannot go below 0
 *
 * @example
 * ```typescript
 * if (event.type === FAME_LOST) {
 *   animateFameLoss(event.amount);
 *   updateFameDisplay(event.newTotal);
 * }
 * ```
 */
export interface FameLostEvent {
  readonly type: typeof FAME_LOST;
  /** ID of the player who lost fame */
  readonly playerId: string;
  /** Amount of fame lost */
  readonly amount: number;
  /** New fame total */
  readonly newTotal: number;
  /** Reason for fame loss */
  readonly source: string;
}

/**
 * Creates a FameLostEvent.
 */
export function createFameLostEvent(
  playerId: string,
  amount: number,
  newTotal: number,
  source: string
): FameLostEvent {
  return {
    type: FAME_LOST,
    playerId,
    amount,
    newTotal,
    source,
  };
}

// ============================================================================
// REPUTATION_CHANGED
// ============================================================================

/**
 * Event type constant for reputation change.
 * @see ReputationChangedEvent
 */
export const REPUTATION_CHANGED = "REPUTATION_CHANGED" as const;

/**
 * Emitted when a player's reputation changes.
 *
 * Reputation affects unit recruitment costs and some interactions.
 *
 * @remarks
 * - delta can be positive or negative
 * - newValue is the new reputation (typically -7 to +7)
 * - reason explains why reputation changed
 * - Low reputation = higher unit costs, some sites hostile
 * - High reputation = lower unit costs, better interactions
 *
 * @example
 * ```typescript
 * if (event.type === REPUTATION_CHANGED) {
 *   updateReputationDisplay(event.newValue);
 *   if (event.delta < 0) {
 *     showReputationPenalty(event.reason);
 *   }
 * }
 * ```
 */
export interface ReputationChangedEvent {
  readonly type: typeof REPUTATION_CHANGED;
  /** ID of the player whose reputation changed */
  readonly playerId: string;
  /** Change in reputation (can be negative) */
  readonly delta: number;
  /** New reputation value */
  readonly newValue: number;
  /** Reason for the change */
  readonly reason: ReputationChangeReason;
}

/**
 * Creates a ReputationChangedEvent.
 */
export function createReputationChangedEvent(
  playerId: string,
  delta: number,
  newValue: number,
  reason: ReputationChangeReason
): ReputationChangedEvent {
  return {
    type: REPUTATION_CHANGED,
    playerId,
    delta,
    newValue,
    reason,
  };
}

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

// ============================================================================
// SKILL_GAINED
// ============================================================================

/**
 * Event type constant for gaining a skill.
 * @see SkillGainedEvent
 */
export const SKILL_GAINED = "SKILL_GAINED" as const;

/**
 * Emitted when a player gains a skill.
 *
 * Skills are permanent abilities gained at level up.
 *
 * @remarks
 * - Skills persist for the rest of the game
 * - Each skill has unique effects
 * - Gained at level up as reward
 *
 * @example
 * ```typescript
 * if (event.type === SKILL_GAINED) {
 *   addSkillToPlayer(event.playerId, event.skillId);
 *   showSkillGainedAnimation(event.skillId);
 * }
 * ```
 */
export interface SkillGainedEvent {
  readonly type: typeof SKILL_GAINED;
  /** ID of the player who gained the skill */
  readonly playerId: string;
  /** ID of the skill gained */
  readonly skillId: SkillId;
}

/**
 * Creates a SkillGainedEvent.
 */
export function createSkillGainedEvent(
  playerId: string,
  skillId: SkillId
): SkillGainedEvent {
  return {
    type: SKILL_GAINED,
    playerId,
    skillId,
  };
}

// ============================================================================
// SKILL_USED
// ============================================================================

/**
 * Event type constant for using a skill.
 * @see SkillUsedEvent
 */
export const SKILL_USED = "SKILL_USED" as const;

/**
 * Emitted when a player uses a skill.
 *
 * Skills provide various effects when activated.
 *
 * @remarks
 * - Some skills are once per turn
 * - Some skills are passive (no SKILL_USED event)
 * - Triggers: USE_SKILL_ACTION
 *
 * @example
 * ```typescript
 * if (event.type === SKILL_USED) {
 *   markSkillAsUsed(event.playerId, event.skillId);
 *   applySkillEffect(event.skillId);
 * }
 * ```
 */
export interface SkillUsedEvent {
  readonly type: typeof SKILL_USED;
  /** ID of the player who used the skill */
  readonly playerId: string;
  /** ID of the skill used */
  readonly skillId: SkillId;
}

/**
 * Creates a SkillUsedEvent.
 */
export function createSkillUsedEvent(
  playerId: string,
  skillId: SkillId
): SkillUsedEvent {
  return {
    type: SKILL_USED,
    playerId,
    skillId,
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for FameGainedEvent.
 */
export function isFameGainedEvent(event: {
  type: string;
}): event is FameGainedEvent {
  return event.type === FAME_GAINED;
}

/**
 * Type guard for LevelUpEvent.
 */
export function isLevelUpEvent(event: { type: string }): event is LevelUpEvent {
  return event.type === LEVEL_UP;
}

/**
 * Type guard for ReputationChangedEvent.
 */
export function isReputationChangedEvent(event: {
  type: string;
}): event is ReputationChangedEvent {
  return event.type === REPUTATION_CHANGED;
}

/**
 * Type guard for SkillGainedEvent.
 */
export function isSkillGainedEvent(event: {
  type: string;
}): event is SkillGainedEvent {
  return event.type === SKILL_GAINED;
}

/**
 * Check if an event is any progression-related event.
 */
export function isProgressionEvent(event: { type: string }): boolean {
  return [
    FAME_GAINED,
    FAME_LOST,
    REPUTATION_CHANGED,
    LEVEL_UP,
    LEVEL_UP_REWARDS_PENDING,
    ADVANCED_ACTION_GAINED,
    COMMAND_SLOT_GAINED,
    SKILL_USED,
    SKILL_GAINED,
  ].includes(event.type as typeof FAME_GAINED);
}
