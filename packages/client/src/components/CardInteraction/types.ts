/**
 * CardInteraction State Machine Types
 *
 * Defines the state machine for unified card interaction flow:
 * idle → action-select → mana-select (optional) → completing → effect-choice (optional) → idle
 *
 * This replaces the fragmented MenuState in PlayerHand and integrates with
 * ChoiceSelection for a seamless card interaction experience.
 */

import type {
  CardId,
  ManaColor,
  ManaSourceInfo,
  PlayableCard,
  ClientPendingChoice,
  SidewaysAs,
} from "@mage-knight/shared";

// ============================================================================
// State Types
// ============================================================================

/**
 * Base properties shared across all active states (non-idle).
 */
interface CardInteractionBase {
  /** The card being interacted with */
  readonly cardId: CardId;
  /** Index of the card in hand (for positioning) */
  readonly cardIndex: number;
  /** Playability info from validActions */
  readonly playability: PlayableCard;
  /** Source rect for animation positioning */
  readonly sourceRect: DOMRect;
}

/**
 * Idle state - no interaction in progress.
 */
interface CardInteractionIdle {
  readonly type: "idle";
}

/**
 * Action selection state - showing basic/powered/sideways options.
 */
interface CardInteractionActionSelect extends CardInteractionBase {
  readonly type: "action-select";
}

/**
 * Mana source selection state - choosing which mana to use for powered effect.
 *
 * For spells, this has two steps:
 * 1. spellStep: "black" - selecting black mana source
 * 2. spellStep: "color" - selecting spell color mana source (blackSource is set)
 *
 * For action cards, spellStep is undefined (single selection).
 */
interface CardInteractionManaSelect extends CardInteractionBase {
  readonly type: "mana-select";
  /** The color of mana being selected (spell color or action's required color) */
  readonly requiredColor: ManaColor;
  /** Available mana sources to choose from */
  readonly availableSources: readonly ManaSourceInfo[];
  /** For spells: current step of two-step selection */
  readonly spellStep?: "black" | "color";
  /** For spells: already-selected black mana source (when in "color" step) */
  readonly blackSource?: ManaSourceInfo;
}

/**
 * Effect choice state - card was played and engine returned a choice.
 * This replaces ChoiceSelection overlay.
 */
interface CardInteractionEffectChoice extends CardInteractionBase {
  readonly type: "effect-choice";
  /** The pending choice from the engine */
  readonly pendingChoice: ClientPendingChoice;
}

/**
 * Completing state - action is being sent to server.
 * Short-lived transitional state.
 */
interface CardInteractionCompleting extends CardInteractionBase {
  readonly type: "completing";
}

/**
 * The discriminated union of all card interaction states.
 */
export type CardInteractionState =
  | CardInteractionIdle
  | CardInteractionActionSelect
  | CardInteractionManaSelect
  | CardInteractionEffectChoice
  | CardInteractionCompleting;

// ============================================================================
// Action Type Constants
// ============================================================================

export const CARD_INTERACTION_OPEN_MENU = "OPEN_MENU" as const;
export const CARD_INTERACTION_CLOSE_MENU = "CLOSE_MENU" as const;
export const CARD_INTERACTION_SELECT_BASIC = "SELECT_BASIC" as const;
export const CARD_INTERACTION_SELECT_POWERED = "SELECT_POWERED" as const;
export const CARD_INTERACTION_SELECT_SIDEWAYS = "SELECT_SIDEWAYS" as const;
export const CARD_INTERACTION_SELECT_MANA_SOURCE = "SELECT_MANA_SOURCE" as const;
export const CARD_INTERACTION_BACK_TO_ACTION_SELECT = "BACK_TO_ACTION_SELECT" as const;
export const CARD_INTERACTION_SELECT_CHOICE = "SELECT_CHOICE" as const;
export const CARD_INTERACTION_ENGINE_CHOICE_REQUIRED = "ENGINE_CHOICE_REQUIRED" as const;
export const CARD_INTERACTION_ACTION_COMPLETED = "ACTION_COMPLETED" as const;

// ============================================================================
// Action Types
// ============================================================================

/**
 * Open the card action menu for a card.
 */
interface OpenMenuAction {
  readonly type: typeof CARD_INTERACTION_OPEN_MENU;
  readonly cardId: CardId;
  readonly cardIndex: number;
  readonly playability: PlayableCard;
  readonly sourceRect: DOMRect;
}

/**
 * Close the menu and return to idle.
 */
interface CloseMenuAction {
  readonly type: typeof CARD_INTERACTION_CLOSE_MENU;
}

/**
 * User selected to play the card's basic effect.
 */
interface SelectBasicAction {
  readonly type: typeof CARD_INTERACTION_SELECT_BASIC;
}

/**
 * User selected to play the card's powered effect.
 * May transition to mana-select or directly to completing.
 */
interface SelectPoweredAction {
  readonly type: typeof CARD_INTERACTION_SELECT_POWERED;
  /** Available mana sources for powered effect */
  readonly availableSources: readonly ManaSourceInfo[];
  /** For spells: available black mana sources */
  readonly blackSources?: readonly ManaSourceInfo[];
}

/**
 * User selected to play the card sideways.
 */
interface SelectSidewaysAction {
  readonly type: typeof CARD_INTERACTION_SELECT_SIDEWAYS;
  readonly as: SidewaysAs;
}

/**
 * User selected a mana source for powered effect.
 * For action cards: completes the action.
 * For spells in "black" step: transitions to "color" step.
 * For spells in "color" step: completes the action.
 */
interface SelectManaSourceAction {
  readonly type: typeof CARD_INTERACTION_SELECT_MANA_SOURCE;
  readonly source: ManaSourceInfo;
}

/**
 * Go back from mana selection to action selection.
 * For spells in "color" step: goes back to "black" step.
 * For spells in "black" step or action cards: goes back to action-select.
 */
interface BackToActionSelectAction {
  readonly type: typeof CARD_INTERACTION_BACK_TO_ACTION_SELECT;
}

/**
 * User selected a choice in the effect choice state.
 */
interface SelectChoiceAction {
  readonly type: typeof CARD_INTERACTION_SELECT_CHOICE;
  readonly choiceIndex: number;
}

/**
 * Engine returned a pending choice after card was played.
 * Transitions completing → effect-choice.
 */
interface EngineChoiceRequiredAction {
  readonly type: typeof CARD_INTERACTION_ENGINE_CHOICE_REQUIRED;
  readonly pendingChoice: ClientPendingChoice;
}

/**
 * Action completed (no choice required or choice resolved).
 * Transitions to idle.
 */
interface ActionCompletedAction {
  readonly type: typeof CARD_INTERACTION_ACTION_COMPLETED;
}

/**
 * The discriminated union of all card interaction actions.
 */
export type CardInteractionAction =
  | OpenMenuAction
  | CloseMenuAction
  | SelectBasicAction
  | SelectPoweredAction
  | SelectSidewaysAction
  | SelectManaSourceAction
  | BackToActionSelectAction
  | SelectChoiceAction
  | EngineChoiceRequiredAction
  | ActionCompletedAction;

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Type guard for checking if state is active (not idle).
 */
export function isActiveState(
  state: CardInteractionState
): state is Exclude<CardInteractionState, CardInteractionIdle> {
  return state.type !== "idle";
}

/**
 * Type guard for checking if state has source rect for positioning.
 */
export function hasSourceRect(
  state: CardInteractionState
): state is Exclude<CardInteractionState, CardInteractionIdle> {
  return state.type !== "idle";
}

/**
 * Initial state - idle, no interaction.
 */
export const INITIAL_STATE: CardInteractionState = { type: "idle" };
