/**
 * useCardInteraction Hook
 *
 * Consumer hook for accessing card interaction state and dispatch.
 * Provides a clean API for components that need to interact with the
 * card interaction state machine.
 */

import { useContext } from "react";
import { CardInteractionContext } from "./CardInteractionContext";
import type { CardInteractionState, CardInteractionAction } from "./types";

interface UseCardInteractionResult {
  /** Current state of the card interaction state machine */
  readonly state: CardInteractionState;
  /** Dispatch function for sending actions to the state machine */
  readonly dispatch: React.Dispatch<CardInteractionAction>;
  /** Whether any menu is currently open (not idle) */
  readonly isMenuOpen: boolean;
  /** Whether in action selection state */
  readonly isActionSelect: boolean;
  /** Whether in mana selection state */
  readonly isManaSelect: boolean;
  /** Whether in effect choice state */
  readonly isEffectChoice: boolean;
  /** Whether in completing state (action being sent) */
  readonly isCompleting: boolean;
}

/**
 * Hook to access card interaction state and dispatch.
 * Must be used within a CardInteractionProvider.
 *
 * @throws Error if used outside of CardInteractionProvider
 */
export function useCardInteraction(): UseCardInteractionResult {
  const context = useContext(CardInteractionContext);

  if (context === null) {
    throw new Error(
      "useCardInteraction must be used within a CardInteractionProvider"
    );
  }

  const { state, dispatch } = context;

  return {
    state,
    dispatch,
    isMenuOpen: state.type !== "idle",
    isActionSelect: state.type === "action-select",
    isManaSelect: state.type === "mana-select",
    isEffectChoice: state.type === "effect-choice",
    isCompleting: state.type === "completing",
  };
}

/**
 * Optional hook that returns null if used outside provider.
 * Useful for components that may or may not be within the provider context.
 */
export function useCardInteractionOptional(): UseCardInteractionResult | null {
  const context = useContext(CardInteractionContext);

  if (context === null) {
    return null;
  }

  const { state, dispatch } = context;

  return {
    state,
    dispatch,
    isMenuOpen: state.type !== "idle",
    isActionSelect: state.type === "action-select",
    isManaSelect: state.type === "mana-select",
    isEffectChoice: state.type === "effect-choice",
    isCompleting: state.type === "completing",
  };
}
