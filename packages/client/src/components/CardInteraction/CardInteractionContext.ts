/**
 * CardInteractionContext
 *
 * Context definition for card interaction state machine.
 * This file is intentionally separate from the provider to maintain
 * stable context identity during HMR updates.
 */

import { createContext, type Dispatch } from "react";
import type { CardInteractionState, CardInteractionAction } from "./types";

// ============================================================================
// Context Definition
// ============================================================================

export interface CardInteractionContextValue {
  readonly state: CardInteractionState;
  readonly dispatch: Dispatch<CardInteractionAction>;
}

export const CardInteractionContext = createContext<CardInteractionContextValue | null>(null);
