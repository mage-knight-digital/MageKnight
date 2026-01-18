/**
 * Site Reward Events
 *
 * Events for queuing and selecting site conquest rewards.
 *
 * @module events/sites/rewards
 */

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

/**
 * Type guard for RewardQueuedEvent.
 */
export function isRewardQueuedEvent(event: {
  type: string;
}): event is RewardQueuedEvent {
  return event.type === REWARD_QUEUED;
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
