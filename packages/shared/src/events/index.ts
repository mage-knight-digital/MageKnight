/**
 * Game Events Module
 *
 * This module provides a complete, well-documented event system for the
 * Mage Knight game engine. Events are the primary communication mechanism
 * between the game engine and clients.
 *
 * ## Architecture
 *
 * Events are organized into category-based modules for better discoverability
 * and maintainability. Each module contains:
 * - Event type constants (e.g., `GAME_STARTED`)
 * - Event interfaces (e.g., `GameStartedEvent`)
 * - Factory functions (e.g., `createGameStartedEvent`)
 * - Type guards (e.g., `isGameStartedEvent`)
 *
 * ## Event Categories
 *
 * | Category | Module | Description |
 * |----------|--------|-------------|
 * | Lifecycle | `lifecycle.ts` | Game, round, and turn state |
 * | Tactics | `tactics.ts` | Tactic selection and effects |
 * | Movement | `movement.ts` | Player movement and exploration |
 * | Combat | `combat.ts` | Combat phases and resolution |
 * | Cards | `cards.ts` | Card play, draw, discard |
 * | Mana | `mana.ts` | Mana dice, crystals, tokens |
 * | Health | `health.ts` | Wounds and healing |
 * | Progression | `progression.ts` | Fame, reputation, levels |
 * | Units | `units.ts` | Unit recruitment and activation |
 * | Offers | `offers.ts` | Market interactions |
 * | Undo | `undo.ts` | Undo operations |
 * | Choice | `choice.ts` | Player choices during effects |
 * | Sites | `sites.ts` | Site interactions and rewards |
 * | Validation | `validation.ts` | Invalid action notifications |
 *
 * ## Usage Examples
 *
 * ### Handling Events
 * ```typescript
 * import { GameEvent, isCombatEvent, isChoiceRequiredEvent } from './events';
 *
 * function handleEvent(event: GameEvent) {
 *   if (isCombatEvent(event)) {
 *     updateCombatUI(event);
 *   } else if (isChoiceRequiredEvent(event)) {
 *     showChoiceDialog(event);
 *   }
 * }
 * ```
 *
 * ### Creating Events
 * ```typescript
 * import { createPlayerMovedEvent, createFameGainedEvent } from './events';
 *
 * const moveEvent = createPlayerMovedEvent("player1", { q: 0, r: 0 }, { q: 1, r: 0 });
 * const fameEvent = createFameGainedEvent("player1", 5, 25, "defeated_orc");
 * ```
 *
 * ### Filtering by Category
 * ```typescript
 * import { getEventCategory, EVENT_CATEGORY } from './events';
 *
 * function routeEvent(event: GameEvent) {
 *   const category = getEventCategory(event.type);
 *   switch (category) {
 *     case EVENT_CATEGORY.COMBAT:
 *       return combatHandler(event);
 *     case EVENT_CATEGORY.PROGRESSION:
 *       return progressionHandler(event);
 *   }
 * }
 * ```
 *
 * @module events
 */

// ============================================================================
// RE-EXPORT ALL MODULES
// ============================================================================

// Categories and metadata
export * from "./categories.js";

// Lifecycle events
export * from "./lifecycle.js";

// Tactics events
export * from "./tactics.js";

// Movement events
export * from "./movement.js";

// Combat events
export * from "./combat.js";

// Card events
export * from "./cards.js";

// Mana events
export * from "./mana.js";

// Health events
export * from "./health.js";

// Progression events
export * from "./progression.js";

// Unit events
export * from "./units.js";

// Offer events
export * from "./offers.js";

// Undo events
export * from "./undo.js";

// Choice events
export * from "./choice.js";

// Site events
export * from "./sites.js";

// Validation events
export * from "./validation.js";

// ============================================================================
// IMPORT FOR UNION TYPE
// ============================================================================

import type {
  GameStartedEvent,
  RoundStartedEvent,
  TurnStartedEvent,
  TurnEndedEvent,
  RoundEndedEvent,
  GameEndedEvent,
  ScenarioEndTriggeredEvent,
  EndOfRoundAnnouncedEvent,
  NewRoundStartedEvent,
  TimeOfDayChangedEvent,
  ManaSourceResetEvent,
} from "./lifecycle.js";

import type {
  TacticSelectedEvent,
  DummyTacticSelectedEvent,
  TacticsPhaseEndedEvent,
  TacticActivatedEvent,
  TacticDecisionResolvedEvent,
  SourceDiceRerolledEvent,
  DecksReshuffledEvent,
  PlayerRestedEvent,
  RestUndoneEvent,
} from "./tactics.js";

import type {
  PlayerMovedEvent,
  TileRevealedEvent,
  TileExploredEvent,
} from "./movement.js";

import type {
  CombatStartedEvent,
  CombatPhaseChangedEvent,
  EnemyBlockedEvent,
  BlockFailedEvent,
  BlockAssignedEvent,
  BlockUnassignedEvent,
  EnemyDefeatedEvent,
  AttackFailedEvent,
  AttackAssignedEvent,
  AttackUnassignedEvent,
  DamageAssignedEvent,
  CombatEndedEvent,
  CombatExitedEvent,
  PlayerKnockedOutEvent,
  ParalyzeHandDiscardedEvent,
  CombatTriggeredEvent,
  PlayerWithdrewEvent,
} from "./combat.js";

import type {
  CardPlayedEvent,
  CardDrawnEvent,
  CardDiscardedEvent,
  CardGainedEvent,
  CardDestroyedEvent,
} from "./cards.js";

import type {
  ManaDieTakenEvent,
  ManaDieReturnedEvent,
  CrystalConvertedEvent,
  ManaDieUsedEvent,
  CrystalUsedEvent,
  CrystalGainedEvent,
  ManaTokenUsedEvent,
} from "./mana.js";

import type { WoundReceivedEvent, WoundHealedEvent } from "./health.js";

import type {
  FameGainedEvent,
  FameLostEvent,
  ReputationChangedEvent,
  LevelUpEvent,
  LevelUpRewardsPendingEvent,
  AdvancedActionGainedEvent,
  CommandSlotGainedEvent,
  SkillUsedEvent,
  SkillGainedEvent,
} from "./progression.js";

import type {
  UnitRecruitedEvent,
  UnitDisbandedEvent,
  UnitActivatedEvent,
  UnitWoundedEvent,
  UnitHealedEvent,
  UnitReadiedEvent,
  UnitsReadiedEvent,
  UnitDestroyedEvent,
} from "./units.js";

import type {
  OfferRefreshedEvent,
  OfferCardTakenEvent,
  MonasteryAARevealedEvent,
} from "./offers.js";

import type {
  CardPlayUndoneEvent,
  MoveUndoneEvent,
  UndoFailedEvent,
  UndoCheckpointSetEvent,
} from "./undo.js";

import type { ChoiceRequiredEvent, ChoiceResolvedEvent } from "./choice.js";

import type {
  SiteConqueredEvent,
  SiteEnteredEvent,
  EnemiesDrawnForSiteEvent,
  EnemiesRevealedEvent,
  ShieldTokenPlacedEvent,
  RewardQueuedEvent,
  RewardSelectedEvent,
  InteractionStartedEvent,
  HealingPurchasedEvent,
  InteractionCompletedEvent,
  GladeWoundDiscardedEvent,
  GladeWoundSkippedEvent,
  GladeManaGainedEvent,
  DeepMineCrystalGainedEvent,
} from "./sites.js";

import type { InvalidActionEvent } from "./validation.js";

// ============================================================================
// GAME EVENT UNION TYPE
// ============================================================================

/**
 * Union type of all possible game events.
 *
 * This discriminated union allows type-safe event handling using the
 * `type` field as a discriminator.
 *
 * @example Type narrowing with switch
 * ```typescript
 * function handleEvent(event: GameEvent) {
 *   switch (event.type) {
 *     case "GAME_STARTED":
 *       // TypeScript knows event is GameStartedEvent
 *       console.log(`Game started with ${event.playerCount} players`);
 *       break;
 *     case "PLAYER_MOVED":
 *       // TypeScript knows event is PlayerMovedEvent
 *       console.log(`Player moved from ${event.from} to ${event.to}`);
 *       break;
 *   }
 * }
 * ```
 *
 * @example Type narrowing with type guards
 * ```typescript
 * if (isGameStartedEvent(event)) {
 *   // event is GameStartedEvent
 * }
 * ```
 */
export type GameEvent =
  // Game lifecycle
  | GameStartedEvent
  | RoundStartedEvent
  | TurnStartedEvent
  | TurnEndedEvent
  | RoundEndedEvent
  | GameEndedEvent
  | ScenarioEndTriggeredEvent
  | EndOfRoundAnnouncedEvent
  | NewRoundStartedEvent
  | TimeOfDayChangedEvent
  | ManaSourceResetEvent
  // Tactics
  | TacticSelectedEvent
  | DummyTacticSelectedEvent
  | TacticsPhaseEndedEvent
  | TacticActivatedEvent
  | TacticDecisionResolvedEvent
  | SourceDiceRerolledEvent
  | DecksReshuffledEvent
  | PlayerRestedEvent
  | RestUndoneEvent
  // Movement
  | PlayerMovedEvent
  | TileRevealedEvent
  | TileExploredEvent
  // Combat
  | CombatStartedEvent
  | CombatPhaseChangedEvent
  | EnemyBlockedEvent
  | BlockFailedEvent
  | BlockAssignedEvent
  | BlockUnassignedEvent
  | EnemyDefeatedEvent
  | AttackFailedEvent
  | AttackAssignedEvent
  | AttackUnassignedEvent
  | DamageAssignedEvent
  | CombatEndedEvent
  | CombatExitedEvent
  | PlayerKnockedOutEvent
  | ParalyzeHandDiscardedEvent
  | CombatTriggeredEvent
  | PlayerWithdrewEvent
  // Cards
  | CardPlayedEvent
  | CardDrawnEvent
  | CardDiscardedEvent
  | CardGainedEvent
  | CardDestroyedEvent
  // Mana
  | ManaDieTakenEvent
  | ManaDieReturnedEvent
  | CrystalConvertedEvent
  | ManaDieUsedEvent
  | CrystalUsedEvent
  | CrystalGainedEvent
  | ManaTokenUsedEvent
  // Health/damage
  | WoundReceivedEvent
  | WoundHealedEvent
  // Progression
  | FameGainedEvent
  | FameLostEvent
  | ReputationChangedEvent
  | LevelUpEvent
  | LevelUpRewardsPendingEvent
  | AdvancedActionGainedEvent
  | CommandSlotGainedEvent
  | SkillUsedEvent
  | SkillGainedEvent
  // Units
  | UnitRecruitedEvent
  | UnitDisbandedEvent
  | UnitActivatedEvent
  | UnitWoundedEvent
  | UnitHealedEvent
  | UnitReadiedEvent
  | UnitsReadiedEvent
  | UnitDestroyedEvent
  // Offers
  | OfferRefreshedEvent
  | OfferCardTakenEvent
  | MonasteryAARevealedEvent
  // Undo
  | CardPlayUndoneEvent
  | MoveUndoneEvent
  | UndoFailedEvent
  | UndoCheckpointSetEvent
  // Choice
  | ChoiceRequiredEvent
  | ChoiceResolvedEvent
  // Validation
  | InvalidActionEvent
  // Interaction
  | InteractionStartedEvent
  | HealingPurchasedEvent
  | InteractionCompletedEvent
  // Conquest
  | SiteConqueredEvent
  | ShieldTokenPlacedEvent
  // Rewards
  | RewardQueuedEvent
  | RewardSelectedEvent
  // Adventure sites
  | SiteEnteredEvent
  | EnemiesDrawnForSiteEvent
  | EnemiesRevealedEvent
  // Magical Glade
  | GladeWoundDiscardedEvent
  | GladeWoundSkippedEvent
  | GladeManaGainedEvent
  // Deep Mine
  | DeepMineCrystalGainedEvent;

/**
 * Type of all game event type constants.
 *
 * Useful for creating maps or switch statements over event types.
 *
 * @example
 * ```typescript
 * const handlers: Record<GameEventType, (event: GameEvent) => void> = {
 *   GAME_STARTED: handleGameStarted,
 *   PLAYER_MOVED: handlePlayerMoved,
 *   // ... etc
 * };
 * ```
 */
export type GameEventType = GameEvent["type"];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a value is a valid GameEvent.
 *
 * @param value - Any value to check
 * @returns True if the value has a valid event type
 *
 * @example
 * ```typescript
 * if (isGameEvent(maybeEvent)) {
 *   handleEvent(maybeEvent);
 * }
 * ```
 */
export function isGameEvent(value: unknown): value is GameEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as { type: unknown }).type === "string"
  );
}

/**
 * Get a human-readable description of an event.
 *
 * Useful for logging and debugging.
 *
 * @param event - The event to describe
 * @returns A short description string
 *
 * @example
 * ```typescript
 * console.log(describeEvent(event));
 * // "PLAYER_MOVED: player1 moved from (0,0) to (1,0)"
 * ```
 */
export function describeEvent(event: GameEvent): string {
  switch (event.type) {
    case "GAME_STARTED":
      return `GAME_STARTED: ${event.playerCount} players, ${event.scenario}`;
    case "PLAYER_MOVED":
      return `PLAYER_MOVED: ${event.playerId} moved from (${event.from.q},${event.from.r}) to (${event.to.q},${event.to.r})`;
    case "CARD_PLAYED":
      return `CARD_PLAYED: ${event.playerId} played ${event.cardId}${event.powered ? " (powered)" : ""}`;
    case "ENEMY_DEFEATED":
      return `ENEMY_DEFEATED: ${event.enemyName} (+${event.fameGained} fame)`;
    case "FAME_GAINED":
      return `FAME_GAINED: ${event.playerId} +${event.amount} (total: ${event.newTotal})`;
    case "CHOICE_REQUIRED":
      return `CHOICE_REQUIRED: ${event.playerId} must choose from ${event.options.length} options`;
    case "INVALID_ACTION":
      return `INVALID_ACTION: ${event.actionType} - ${event.reason}`;
    default:
      return event.type;
  }
}
