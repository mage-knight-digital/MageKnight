/**
 * Game Lifecycle Events
 *
 * Events that mark major game state transitions: game start/end, rounds, turns,
 * and time of day changes. These events structure the game flow and determine
 * when players can take actions.
 *
 * @module events/lifecycle
 *
 * @example Event Flow
 * ```
 * GAME_STARTED
 *   └─► ROUND_STARTED (round 1, isDay: true)
 *         ├─► TURN_STARTED (player 0)
 *         │     └─► ... player actions ...
 *         │     └─► TURN_ENDED
 *         ├─► TURN_STARTED (player 1)
 *         │     └─► ... player actions ...
 *         │     └─► END_OF_ROUND_ANNOUNCED (optional)
 *         │     └─► TURN_ENDED
 *         └─► ROUND_ENDED
 *               └─► TIME_OF_DAY_CHANGED (if applicable)
 *               └─► MANA_SOURCE_RESET
 *   └─► ROUND_STARTED (round 2, isDay: false)
 *         └─► ... more turns ...
 *   └─► SCENARIO_END_TRIGGERED
 *   └─► GAME_ENDED
 * ```
 */

import type { TimeOfDay } from "../stateConstants.js";

// ============================================================================
// GAME_STARTED
// ============================================================================

/**
 * Event type constant for game initialization.
 * @see GameStartedEvent
 */
export const GAME_STARTED = "GAME_STARTED" as const;

/**
 * Emitted when a new game is initialized.
 *
 * This is always the first event in any game session. It provides the initial
 * game configuration that clients need to set up their UI.
 *
 * @remarks
 * - Emitted exactly once per game
 * - Precedes all other game events
 * - Triggers: Game initialization via server
 *
 * @example Handling game start
 * ```typescript
 * if (event.type === GAME_STARTED) {
 *   initializeGameUI(event.playerCount, event.scenario);
 * }
 * ```
 */
export interface GameStartedEvent {
  readonly type: typeof GAME_STARTED;
  /** Number of players in this game (1-4) */
  readonly playerCount: number;
  /** Scenario identifier (e.g., "first_reconnaissance", "solo_conquest") */
  readonly scenario: string;
}

/**
 * Creates a GameStartedEvent.
 *
 * @param playerCount - Number of players (1-4)
 * @param scenario - Scenario identifier string
 * @returns A new GameStartedEvent
 *
 * @example
 * const event = createGameStartedEvent(2, "first_reconnaissance");
 */
export function createGameStartedEvent(
  playerCount: number,
  scenario: string
): GameStartedEvent {
  return {
    type: GAME_STARTED,
    playerCount,
    scenario,
  };
}

// ============================================================================
// ROUND_STARTED
// ============================================================================

/**
 * Event type constant for round start.
 * @see RoundStartedEvent
 */
export const ROUND_STARTED = "ROUND_STARTED" as const;

/**
 * Emitted when a new round begins.
 *
 * Rounds alternate between day and night, affecting mana availability
 * and certain card effects.
 *
 * @remarks
 * - Precedes all TURN_STARTED events for this round
 * - isDay affects: gold mana (day only), black mana (night only)
 * - Round count determines game length for scoring
 *
 * @example Updating UI for day/night
 * ```typescript
 * if (event.type === ROUND_STARTED) {
 *   setTimeOfDay(event.isDay ? "day" : "night");
 *   updateManaSourceDisplay(event.isDay);
 * }
 * ```
 */
export interface RoundStartedEvent {
  readonly type: typeof ROUND_STARTED;
  /** Current round number (1-indexed) */
  readonly round: number;
  /** True if day phase, false if night phase */
  readonly isDay: boolean;
}

/**
 * Creates a RoundStartedEvent.
 *
 * @param round - Round number (1-indexed)
 * @param isDay - True for day phase, false for night
 * @returns A new RoundStartedEvent
 */
export function createRoundStartedEvent(
  round: number,
  isDay: boolean
): RoundStartedEvent {
  return {
    type: ROUND_STARTED,
    round,
    isDay,
  };
}

// ============================================================================
// TURN_STARTED
// ============================================================================

/**
 * Event type constant for turn start.
 * @see TurnStartedEvent
 */
export const TURN_STARTED = "TURN_STARTED" as const;

/**
 * Emitted when a player's turn begins.
 *
 * The active player can now take actions: play cards, move, enter combat,
 * interact with sites, etc.
 *
 * @remarks
 * - Only one player is active at a time
 * - Turn order determined by tactics selection each round
 * - Triggers: Previous player's TURN_ENDED or ROUND_STARTED
 *
 * @example Updating active player indicator
 * ```typescript
 * if (event.type === TURN_STARTED) {
 *   highlightActivePlayer(event.playerIndex);
 *   enableActionsFor(event.playerIndex);
 * }
 * ```
 */
export interface TurnStartedEvent {
  readonly type: typeof TURN_STARTED;
  /** Index of the active player (0-indexed) */
  readonly playerIndex: number;
}

/**
 * Creates a TurnStartedEvent.
 *
 * @param playerIndex - Index of the player whose turn is starting
 * @returns A new TurnStartedEvent
 */
export function createTurnStartedEvent(playerIndex: number): TurnStartedEvent {
  return {
    type: TURN_STARTED,
    playerIndex,
  };
}

// ============================================================================
// TURN_ENDED
// ============================================================================

/**
 * Event type constant for turn end.
 * @see TurnEndedEvent
 */
export const TURN_ENDED = "TURN_ENDED" as const;

/**
 * Emitted when a player's turn ends.
 *
 * Includes cleanup information: cards moved from play area to discard,
 * and cards drawn up to hand limit.
 *
 * @remarks
 * - nextPlayerId is null if this was the last turn of the round
 * - Card cleanup happens automatically
 * - Triggers: END_TURN_ACTION from active player
 * - Related: May trigger ROUND_ENDED if last player in round
 *
 * @example Handling turn end
 * ```typescript
 * if (event.type === TURN_ENDED) {
 *   clearPlayArea(event.playerId);
 *   if (event.nextPlayerId) {
 *     showNextPlayerNotice(event.nextPlayerId);
 *   } else {
 *     showRoundEndNotice();
 *   }
 * }
 * ```
 */
export interface TurnEndedEvent {
  readonly type: typeof TURN_ENDED;
  /** ID of the player whose turn ended */
  readonly playerId: string;
  /** ID of next player, or null if round is ending */
  readonly nextPlayerId: string | null;
  /** Number of cards moved from play area to discard */
  readonly cardsDiscarded: number;
  /** Number of cards drawn up to hand limit */
  readonly cardsDrawn: number;
}

/**
 * Creates a TurnEndedEvent.
 *
 * @param playerId - ID of player whose turn ended
 * @param nextPlayerId - ID of next player, or null if round ending
 * @param cardsDiscarded - Cards moved to discard pile
 * @param cardsDrawn - Cards drawn to refill hand
 * @returns A new TurnEndedEvent
 */
export function createTurnEndedEvent(
  playerId: string,
  nextPlayerId: string | null,
  cardsDiscarded: number,
  cardsDrawn: number
): TurnEndedEvent {
  return {
    type: TURN_ENDED,
    playerId,
    nextPlayerId,
    cardsDiscarded,
    cardsDrawn,
  };
}

// ============================================================================
// ROUND_ENDED
// ============================================================================

/**
 * Event type constant for round end.
 * @see RoundEndedEvent
 */
export const ROUND_ENDED = "ROUND_ENDED" as const;

/**
 * Emitted when a round completes.
 *
 * All players have taken their turns. The game transitions to the next round
 * or ends if this was the final round.
 *
 * @remarks
 * - Follows the last TURN_ENDED of the round
 * - May precede TIME_OF_DAY_CHANGED and MANA_SOURCE_RESET
 * - Tactics selection begins for the next round
 *
 * @example
 * ```typescript
 * if (event.type === ROUND_ENDED) {
 *   showRoundSummary(event.round);
 *   prepareForTacticsPhase();
 * }
 * ```
 */
export interface RoundEndedEvent {
  readonly type: typeof ROUND_ENDED;
  /** The round number that just ended */
  readonly round: number;
}

/**
 * Creates a RoundEndedEvent.
 *
 * @param round - The round number that ended
 * @returns A new RoundEndedEvent
 */
export function createRoundEndedEvent(round: number): RoundEndedEvent {
  return {
    type: ROUND_ENDED,
    round,
  };
}

// ============================================================================
// GAME_ENDED
// ============================================================================

/**
 * Event type constant for game end.
 * @see GameEndedEvent
 */
export const GAME_ENDED = "GAME_ENDED" as const;

/**
 * Emitted when the game concludes.
 *
 * Includes final scoring information for all players.
 *
 * @remarks
 * - This is always the last event in a game
 * - winningPlayerId may be null in case of a tie
 * - Triggers: SCENARIO_END_TRIGGERED conditions met, or all rounds completed
 *
 * @example Showing final scores
 * ```typescript
 * if (event.type === GAME_ENDED) {
 *   showFinalScoreboard(event.finalScores);
 *   highlightWinner(event.winningPlayerId);
 * }
 * ```
 */
export interface GameEndedEvent {
  readonly type: typeof GAME_ENDED;
  /** ID of the winning player, or null for a tie */
  readonly winningPlayerId: string | null;
  /** Final scores for all players, sorted by score descending */
  readonly finalScores: readonly {
    readonly playerId: string;
    readonly score: number;
  }[];
}

/**
 * Creates a GameEndedEvent.
 *
 * @param winningPlayerId - ID of winner, or null for tie
 * @param finalScores - Array of player IDs and their scores
 * @returns A new GameEndedEvent
 */
export function createGameEndedEvent(
  winningPlayerId: string | null,
  finalScores: readonly { readonly playerId: string; readonly score: number }[]
): GameEndedEvent {
  return {
    type: GAME_ENDED,
    winningPlayerId,
    finalScores,
  };
}

// ============================================================================
// SCENARIO_END_TRIGGERED
// ============================================================================

/**
 * Event type constant for scenario end trigger.
 * @see ScenarioEndTriggeredEvent
 */
export const SCENARIO_END_TRIGGERED = "SCENARIO_END_TRIGGERED" as const;

/**
 * Emitted when a scenario victory/end condition is triggered.
 *
 * Different scenarios have different end conditions (e.g., conquering cities,
 * defeating bosses, etc.).
 *
 * @remarks
 * - The game may continue for remaining players after this
 * - Multiple players may trigger end conditions
 * - Precedes GAME_ENDED
 *
 * @example
 * ```typescript
 * if (event.type === SCENARIO_END_TRIGGERED) {
 *   showVictoryAnimation(event.playerId, event.trigger);
 * }
 * ```
 */
export interface ScenarioEndTriggeredEvent {
  readonly type: typeof SCENARIO_END_TRIGGERED;
  /** ID of the player who triggered the end condition */
  readonly playerId: string;
  /** Description of what triggered the end (e.g., "conquered_city") */
  readonly trigger: string;
}

/**
 * Creates a ScenarioEndTriggeredEvent.
 *
 * @param playerId - ID of player who triggered the condition
 * @param trigger - Description of the trigger
 * @returns A new ScenarioEndTriggeredEvent
 */
export function createScenarioEndTriggeredEvent(
  playerId: string,
  trigger: string
): ScenarioEndTriggeredEvent {
  return {
    type: SCENARIO_END_TRIGGERED,
    playerId,
    trigger,
  };
}

// ============================================================================
// END_OF_ROUND_ANNOUNCED
// ============================================================================

/**
 * Event type constant for end of round announcement.
 * @see EndOfRoundAnnouncedEvent
 */
export const END_OF_ROUND_ANNOUNCED = "END_OF_ROUND_ANNOUNCED" as const;

/**
 * Emitted when a player announces the end of round (typically via rest).
 *
 * Once announced, remaining players get one more turn each before
 * the round ends.
 *
 * @remarks
 * - Usually triggered by PLAYER_RESTED with announcedEndOfRound: true
 * - Other players know the round is about to end
 * - Cannot be undone once announced
 *
 * @example
 * ```typescript
 * if (event.type === END_OF_ROUND_ANNOUNCED) {
 *   showEndOfRoundWarning();
 *   highlightLastTurnIndicator();
 * }
 * ```
 */
export interface EndOfRoundAnnouncedEvent {
  readonly type: typeof END_OF_ROUND_ANNOUNCED;
  /** ID of the player who announced the end */
  readonly playerId: string;
}

/**
 * Creates an EndOfRoundAnnouncedEvent.
 *
 * @param playerId - ID of player who announced
 * @returns A new EndOfRoundAnnouncedEvent
 */
export function createEndOfRoundAnnouncedEvent(
  playerId: string
): EndOfRoundAnnouncedEvent {
  return {
    type: END_OF_ROUND_ANNOUNCED,
    playerId,
  };
}

// ============================================================================
// NEW_ROUND_STARTED
// ============================================================================

/**
 * Event type constant for new round initialization.
 * @see NewRoundStartedEvent
 */
export const NEW_ROUND_STARTED = "NEW_ROUND_STARTED" as const;

/**
 * Emitted when a new round begins after the previous round's cleanup.
 *
 * Similar to ROUND_STARTED but includes TimeOfDay type information.
 *
 * @remarks
 * - Follows ROUND_ENDED from previous round
 * - Includes full TimeOfDay enum value, not just boolean
 *
 * @example
 * ```typescript
 * if (event.type === NEW_ROUND_STARTED) {
 *   updateRoundCounter(event.roundNumber);
 *   setTimeOfDay(event.timeOfDay);
 * }
 * ```
 */
export interface NewRoundStartedEvent {
  readonly type: typeof NEW_ROUND_STARTED;
  /** The new round number */
  readonly roundNumber: number;
  /** Time of day for the new round */
  readonly timeOfDay: TimeOfDay;
}

/**
 * Creates a NewRoundStartedEvent.
 *
 * @param roundNumber - The new round number
 * @param timeOfDay - Time of day value
 * @returns A new NewRoundStartedEvent
 */
export function createNewRoundStartedEvent(
  roundNumber: number,
  timeOfDay: TimeOfDay
): NewRoundStartedEvent {
  return {
    type: NEW_ROUND_STARTED,
    roundNumber,
    timeOfDay,
  };
}

// ============================================================================
// TIME_OF_DAY_CHANGED
// ============================================================================

/**
 * Event type constant for time of day changes.
 * @see TimeOfDayChangedEvent
 */
export const TIME_OF_DAY_CHANGED = "TIME_OF_DAY_CHANGED" as const;

/**
 * Emitted when time of day transitions between day and night.
 *
 * This affects mana availability and certain card effects.
 *
 * @remarks
 * - Typically occurs between rounds
 * - Day: Gold mana available, black mana depleted
 * - Night: Black mana available, gold mana depleted
 *
 * @example
 * ```typescript
 * if (event.type === TIME_OF_DAY_CHANGED) {
 *   playTransitionAnimation(event.from, event.to);
 *   updateManaSourceVisibility(event.to);
 * }
 * ```
 */
export interface TimeOfDayChangedEvent {
  readonly type: typeof TIME_OF_DAY_CHANGED;
  /** Previous time of day */
  readonly from: TimeOfDay;
  /** New time of day */
  readonly to: TimeOfDay;
}

/**
 * Creates a TimeOfDayChangedEvent.
 *
 * @param from - Previous time of day
 * @param to - New time of day
 * @returns A new TimeOfDayChangedEvent
 */
export function createTimeOfDayChangedEvent(
  from: TimeOfDay,
  to: TimeOfDay
): TimeOfDayChangedEvent {
  return {
    type: TIME_OF_DAY_CHANGED,
    from,
    to,
  };
}

// ============================================================================
// MANA_SOURCE_RESET
// ============================================================================

/**
 * Event type constant for mana source reset.
 * @see ManaSourceResetEvent
 */
export const MANA_SOURCE_RESET = "MANA_SOURCE_RESET" as const;

/**
 * Emitted when the mana source (shared dice pool) is reset.
 *
 * This typically happens at the start of each round.
 *
 * @remarks
 * - Dice are re-rolled and made available
 * - diceCount = number of players + 2
 * - Related: Follows NEW_ROUND_STARTED or ROUND_STARTED
 *
 * @example
 * ```typescript
 * if (event.type === MANA_SOURCE_RESET) {
 *   resetManaPoolDisplay(event.diceCount);
 * }
 * ```
 */
export interface ManaSourceResetEvent {
  readonly type: typeof MANA_SOURCE_RESET;
  /** Number of dice in the mana source */
  readonly diceCount: number;
}

/**
 * Creates a ManaSourceResetEvent.
 *
 * @param diceCount - Number of dice available
 * @returns A new ManaSourceResetEvent
 */
export function createManaSourceResetEvent(
  diceCount: number
): ManaSourceResetEvent {
  return {
    type: MANA_SOURCE_RESET,
    diceCount,
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for GameStartedEvent.
 *
 * @param event - Any game event
 * @returns True if the event is a GameStartedEvent
 */
export function isGameStartedEvent(event: {
  type: string;
}): event is GameStartedEvent {
  return event.type === GAME_STARTED;
}

/**
 * Type guard for RoundStartedEvent.
 *
 * @param event - Any game event
 * @returns True if the event is a RoundStartedEvent
 */
export function isRoundStartedEvent(event: {
  type: string;
}): event is RoundStartedEvent {
  return event.type === ROUND_STARTED;
}

/**
 * Type guard for TurnStartedEvent.
 *
 * @param event - Any game event
 * @returns True if the event is a TurnStartedEvent
 */
export function isTurnStartedEvent(event: {
  type: string;
}): event is TurnStartedEvent {
  return event.type === TURN_STARTED;
}

/**
 * Type guard for TurnEndedEvent.
 *
 * @param event - Any game event
 * @returns True if the event is a TurnEndedEvent
 */
export function isTurnEndedEvent(event: {
  type: string;
}): event is TurnEndedEvent {
  return event.type === TURN_ENDED;
}

/**
 * Type guard for RoundEndedEvent.
 *
 * @param event - Any game event
 * @returns True if the event is a RoundEndedEvent
 */
export function isRoundEndedEvent(event: {
  type: string;
}): event is RoundEndedEvent {
  return event.type === ROUND_ENDED;
}

/**
 * Type guard for GameEndedEvent.
 *
 * @param event - Any game event
 * @returns True if the event is a GameEndedEvent
 */
export function isGameEndedEvent(event: {
  type: string;
}): event is GameEndedEvent {
  return event.type === GAME_ENDED;
}

/**
 * Type guard for TimeOfDayChangedEvent.
 *
 * @param event - Any game event
 * @returns True if the event is a TimeOfDayChangedEvent
 */
export function isTimeOfDayChangedEvent(event: {
  type: string;
}): event is TimeOfDayChangedEvent {
  return event.type === TIME_OF_DAY_CHANGED;
}

/**
 * Check if an event is any lifecycle event.
 *
 * @param event - Any game event
 * @returns True if the event is a lifecycle event
 *
 * @example
 * ```typescript
 * if (isLifecycleEvent(event)) {
 *   updateGamePhaseIndicator(event);
 * }
 * ```
 */
export function isLifecycleEvent(event: { type: string }): boolean {
  return [
    GAME_STARTED,
    ROUND_STARTED,
    TURN_STARTED,
    TURN_ENDED,
    ROUND_ENDED,
    GAME_ENDED,
    SCENARIO_END_TRIGGERED,
    END_OF_ROUND_ANNOUNCED,
    NEW_ROUND_STARTED,
    TIME_OF_DAY_CHANGED,
    MANA_SOURCE_RESET,
  ].includes(event.type as typeof GAME_STARTED);
}
