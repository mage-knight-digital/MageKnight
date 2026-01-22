/**
 * CardInteractionContext
 *
 * Provides state management for unified card interaction flow.
 * Uses useReducer for predictable state transitions following the state machine.
 */

/* eslint-disable no-restricted-syntax */
// Disabled: The no-restricted-syntax rule flags string literals in switch cases,
// expecting constants from @mage-knight/shared. However, these are LOCAL reducer
// action types, not shared protocol types. They're defined in ./types.ts.

import { createContext, useReducer, type ReactNode, type Dispatch } from "react";
import {
  type CardInteractionState,
  type CardInteractionAction,
  INITIAL_STATE,
} from "./types";
import { MANA_BLACK, type ManaColor } from "@mage-knight/shared";

// ============================================================================
// Context Definition
// ============================================================================

interface CardInteractionContextValue {
  readonly state: CardInteractionState;
  readonly dispatch: Dispatch<CardInteractionAction>;
}

export const CardInteractionContext = createContext<CardInteractionContextValue | null>(null);

// ============================================================================
// Reducer
// ============================================================================

function cardInteractionReducer(
  state: CardInteractionState,
  action: CardInteractionAction
): CardInteractionState {
  switch (action.type) {
    case "OPEN_MENU": {
      return {
        type: "action-select",
        cardId: action.cardId,
        cardIndex: action.cardIndex,
        playability: action.playability,
        sourceRect: action.sourceRect,
      };
    }

    case "CLOSE_MENU": {
      return INITIAL_STATE;
    }

    case "SELECT_BASIC": {
      if (state.type !== "action-select") {
        console.warn("[CardInteraction] SELECT_BASIC in wrong state:", state.type);
        return state;
      }
      return {
        type: "completing",
        cardId: state.cardId,
        cardIndex: state.cardIndex,
        playability: state.playability,
        sourceRect: state.sourceRect,
      };
    }

    case "SELECT_POWERED": {
      if (state.type !== "action-select") {
        console.warn("[CardInteraction] SELECT_POWERED in wrong state:", state.type);
        return state;
      }

      const isSpell = state.playability.isSpell;
      const requiredMana = state.playability.requiredMana;

      if (isSpell && action.blackSources && action.blackSources.length > 0) {
        // Spell: Start two-step mana selection with black mana first
        return {
          type: "mana-select",
          cardId: state.cardId,
          cardIndex: state.cardIndex,
          playability: state.playability,
          sourceRect: state.sourceRect,
          requiredColor: MANA_BLACK,
          availableSources: action.blackSources,
          spellStep: "black",
        };
      }

      if (action.availableSources.length === 0) {
        // No mana sources needed (shouldn't happen for powered, but handle gracefully)
        return {
          type: "completing",
          cardId: state.cardId,
          cardIndex: state.cardIndex,
          playability: state.playability,
          sourceRect: state.sourceRect,
        };
      }

      if (action.availableSources.length === 1 && !isSpell) {
        // Single source for non-spell: auto-select and go to completing
        // The selected source will be passed via the action handler
        return {
          type: "completing",
          cardId: state.cardId,
          cardIndex: state.cardIndex,
          playability: state.playability,
          sourceRect: state.sourceRect,
        };
      }

      // Multiple sources for action card: show mana selection
      return {
        type: "mana-select",
        cardId: state.cardId,
        cardIndex: state.cardIndex,
        playability: state.playability,
        sourceRect: state.sourceRect,
        requiredColor: requiredMana as ManaColor,
        availableSources: action.availableSources,
      };
    }

    case "SELECT_SIDEWAYS": {
      if (state.type !== "action-select") {
        console.warn("[CardInteraction] SELECT_SIDEWAYS in wrong state:", state.type);
        return state;
      }
      return {
        type: "completing",
        cardId: state.cardId,
        cardIndex: state.cardIndex,
        playability: state.playability,
        sourceRect: state.sourceRect,
      };
    }

    case "SELECT_MANA_SOURCE": {
      if (state.type !== "mana-select") {
        console.warn("[CardInteraction] SELECT_MANA_SOURCE in wrong state:", state.type);
        return state;
      }

      if (state.spellStep === "black") {
        // Spell: black mana selected, now need color mana
        // Note: availableSources for color step will be set by the component
        // that has access to game state. For now we transition but expect
        // the component to update availableSources.
        return {
          type: "mana-select",
          cardId: state.cardId,
          cardIndex: state.cardIndex,
          playability: state.playability,
          sourceRect: state.sourceRect,
          requiredColor: state.playability.requiredMana as ManaColor,
          availableSources: [], // Will be populated by component
          spellStep: "color",
          blackSource: action.source,
        };
      }

      // Either spell color step or action card: complete the selection
      return {
        type: "completing",
        cardId: state.cardId,
        cardIndex: state.cardIndex,
        playability: state.playability,
        sourceRect: state.sourceRect,
      };
    }

    case "BACK_TO_ACTION_SELECT": {
      if (state.type !== "mana-select") {
        console.warn("[CardInteraction] BACK_TO_ACTION_SELECT in wrong state:", state.type);
        return state;
      }

      if (state.spellStep === "color") {
        // Spell color step: go back to black step
        return {
          type: "mana-select",
          cardId: state.cardId,
          cardIndex: state.cardIndex,
          playability: state.playability,
          sourceRect: state.sourceRect,
          requiredColor: MANA_BLACK,
          availableSources: [], // Will be populated by component
          spellStep: "black",
        };
      }

      // Black step or action card: go back to action select
      return {
        type: "action-select",
        cardId: state.cardId,
        cardIndex: state.cardIndex,
        playability: state.playability,
        sourceRect: state.sourceRect,
      };
    }

    case "SELECT_CHOICE": {
      if (state.type !== "effect-choice") {
        console.warn("[CardInteraction] SELECT_CHOICE in wrong state:", state.type);
        return state;
      }
      return {
        type: "completing",
        cardId: state.cardId,
        cardIndex: state.cardIndex,
        playability: state.playability,
        sourceRect: state.sourceRect,
      };
    }

    case "ENGINE_CHOICE_REQUIRED": {
      if (state.type !== "completing") {
        console.warn("[CardInteraction] ENGINE_CHOICE_REQUIRED in wrong state:", state.type);
        return state;
      }
      return {
        type: "effect-choice",
        cardId: state.cardId,
        cardIndex: state.cardIndex,
        playability: state.playability,
        sourceRect: state.sourceRect,
        pendingChoice: action.pendingChoice,
      };
    }

    case "ACTION_COMPLETED": {
      return INITIAL_STATE;
    }

    default: {
      // TypeScript exhaustiveness check - void to suppress unused variable warning
      const exhaustiveCheck: never = action;
      void exhaustiveCheck;
      return state;
    }
  }
}

// ============================================================================
// Provider Component
// ============================================================================

interface CardInteractionProviderProps {
  readonly children: ReactNode;
}

export function CardInteractionProvider({ children }: CardInteractionProviderProps) {
  const [state, dispatch] = useReducer(cardInteractionReducer, INITIAL_STATE);

  return (
    <CardInteractionContext.Provider value={{ state, dispatch }}>
      {children}
    </CardInteractionContext.Provider>
  );
}
