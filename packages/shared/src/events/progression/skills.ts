/**
 * Skill Events
 *
 * Events for gaining and using skills.
 *
 * @module events/progression/skills
 */

import type { SkillId } from "../../ids.js";

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

/**
 * Type guard for SkillGainedEvent.
 */
export function isSkillGainedEvent(event: {
  type: string;
}): event is SkillGainedEvent {
  return event.type === SKILL_GAINED;
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
// MANA_OVERLOAD_TRIGGERED
// ============================================================================

/**
 * Event type constant for Mana Overload trigger.
 * @see ManaOverloadTriggeredEvent
 */
export const MANA_OVERLOAD_TRIGGERED = "MANA_OVERLOAD_TRIGGERED" as const;

/**
 * Emitted when Mana Overload's center bonus is triggered.
 *
 * The triggering player powers a Deed card with the marked color
 * that provides Move/Influence/Attack/Block, gaining +4.
 * The skill returns to its owner face-down.
 */
export interface ManaOverloadTriggeredEvent {
  readonly type: typeof MANA_OVERLOAD_TRIGGERED;
  /** Player who triggered the bonus (may differ from owner) */
  readonly playerId: string;
  /** Player who owns the Mana Overload skill */
  readonly ownerId: string;
  /** The effect type that received the +4 bonus */
  readonly bonusType: string;
  /** The bonus amount applied */
  readonly bonusAmount: number;
}

/**
 * Creates a ManaOverloadTriggeredEvent.
 */
export function createManaOverloadTriggeredEvent(
  playerId: string,
  ownerId: string,
  bonusType: string,
  bonusAmount: number
): ManaOverloadTriggeredEvent {
  return {
    type: MANA_OVERLOAD_TRIGGERED,
    playerId,
    ownerId,
    bonusType,
    bonusAmount,
  };
}
