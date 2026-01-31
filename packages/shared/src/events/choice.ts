/**
 * Choice Events
 *
 * Events related to player choices during effect resolution.
 * Many card effects present options that the player must choose from.
 *
 * @module events/choice
 *
 * @remarks Choice System Overview
 * - Some effects require player input to resolve
 * - CHOICE_REQUIRED indicates pending input needed
 * - Game cannot proceed until choice is made
 * - CHOICE_RESOLVED confirms the selection
 *
 * @example Choice Flow
 * ```
 * Card with choice effect played:
 *   CARD_PLAYED
 *     └─► Effect resolves
 *           └─► CHOICE_REQUIRED (options presented)
 *                 └─► Player selects option
 *                 └─► CHOICE_RESOLVED (selection confirmed)
 *                       └─► Effect continues with chosen option
 * ```
 */

import type { CardId, SkillId } from "../ids.js";

// ============================================================================
// CHOICE_REQUIRED
// ============================================================================

/**
 * Event type constant for required choice.
 * @see ChoiceRequiredEvent
 */
export const CHOICE_REQUIRED = "CHOICE_REQUIRED" as const;

/**
 * Emitted when a player must make a choice to continue.
 *
 * The game is paused until the player selects an option.
 *
 * @remarks
 * - options are human-readable descriptions
 * - Player must send RESOLVE_CHOICE action with selected index
 * - Cannot take other actions until resolved
 * - Triggers: Card effects with ChoiceEffect
 *
 * @example
 * ```typescript
 * if (event.type === CHOICE_REQUIRED) {
 *   showChoiceDialog(event.cardId, event.options);
 *   disableOtherActions();
 * }
 * ```
 */
export interface ChoiceRequiredEvent {
  readonly type: typeof CHOICE_REQUIRED;
  /** ID of the player who must choose */
  readonly playerId: string;
  /** ID of the card that triggered the choice (null if skill-based) */
  readonly cardId: CardId | null;
  /** ID of the skill that triggered the choice (null if card-based) */
  readonly skillId: SkillId | null;
  /** Human-readable option descriptions */
  readonly options: readonly string[];
}

/**
 * Creates a ChoiceRequiredEvent.
 *
 * @param playerId - ID of the player
 * @param cardId - ID of the triggering card (null if skill-based)
 * @param skillId - ID of the triggering skill (null if card-based)
 * @param options - Array of option descriptions
 * @returns A new ChoiceRequiredEvent
 */
export function createChoiceRequiredEvent(
  playerId: string,
  cardId: CardId | null,
  skillId: SkillId | null,
  options: readonly string[]
): ChoiceRequiredEvent {
  return {
    type: CHOICE_REQUIRED,
    playerId,
    cardId,
    skillId,
    options,
  };
}

// ============================================================================
// CHOICE_RESOLVED
// ============================================================================

/**
 * Event type constant for resolved choice.
 * @see ChoiceResolvedEvent
 */
export const CHOICE_RESOLVED = "CHOICE_RESOLVED" as const;

/**
 * Emitted when a player's choice is resolved.
 *
 * Confirms which option was selected and what happened.
 *
 * @remarks
 * - chosenIndex matches the options array from CHOICE_REQUIRED
 * - effect describes what happened as a result
 * - Game can now continue
 * - Triggers: RESOLVE_CHOICE action
 *
 * @example
 * ```typescript
 * if (event.type === CHOICE_RESOLVED) {
 *   hideChoiceDialog();
 *   showEffectResult(event.effect);
 *   enableNormalActions();
 * }
 * ```
 */
export interface ChoiceResolvedEvent {
  readonly type: typeof CHOICE_RESOLVED;
  /** ID of the player who made the choice */
  readonly playerId: string;
  /** ID of the card the choice was for (null if skill-based) */
  readonly cardId: CardId | null;
  /** ID of the skill the choice was for (null if card-based) */
  readonly skillId: SkillId | null;
  /** Index of the chosen option (0-indexed) */
  readonly chosenIndex: number;
  /** Human-readable description of what happened */
  readonly effect: string;
}

/**
 * Creates a ChoiceResolvedEvent.
 *
 * @param playerId - ID of the player
 * @param cardId - ID of the card (null if skill-based)
 * @param skillId - ID of the skill (null if card-based)
 * @param chosenIndex - Index of selected option
 * @param effect - Description of result
 * @returns A new ChoiceResolvedEvent
 */
export function createChoiceResolvedEvent(
  playerId: string,
  cardId: CardId | null,
  skillId: SkillId | null,
  chosenIndex: number,
  effect: string
): ChoiceResolvedEvent {
  return {
    type: CHOICE_RESOLVED,
    playerId,
    cardId,
    skillId,
    chosenIndex,
    effect,
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for ChoiceRequiredEvent.
 */
export function isChoiceRequiredEvent(event: {
  type: string;
}): event is ChoiceRequiredEvent {
  return event.type === CHOICE_REQUIRED;
}

/**
 * Type guard for ChoiceResolvedEvent.
 */
export function isChoiceResolvedEvent(event: {
  type: string;
}): event is ChoiceResolvedEvent {
  return event.type === CHOICE_RESOLVED;
}

/**
 * Check if an event is any choice-related event.
 */
export function isChoiceEvent(event: { type: string }): boolean {
  return [CHOICE_REQUIRED, CHOICE_RESOLVED].includes(
    event.type as typeof CHOICE_REQUIRED
  );
}

/**
 * Check if an event indicates pending player input.
 *
 * When this returns true, the game is waiting for the player
 * to make a choice before continuing.
 */
export function isPendingChoiceEvent(event: { type: string }): boolean {
  return event.type === CHOICE_REQUIRED;
}
