/**
 * CardSelectionOverlay - Reusable modal for selecting cards from hand
 *
 * Thin React wrapper that delegates all rendering to PixiCardSelectionOverlay.
 * Keeps the same props interface so consumers (DiscardCostOverlay,
 * RestCompletionOverlay, CrystalJoyReclaimDecision) need no changes.
 */

import type { CardId } from "@mage-knight/shared";
import { useRegisterOverlay } from "../../contexts/OverlayContext";
import { PixiCardSelectionOverlay } from "./PixiCardSelectionOverlay";

export interface CardSelectionOverlayProps {
  /** Cards available to select */
  cards: readonly CardId[];
  /** Instruction text (e.g., "Select a card to discard") */
  instruction: string;
  /** Minimum cards to select (default 1) */
  minSelect?: number;
  /** Maximum cards to select (default 1) */
  maxSelect?: number;
  /** Show skip button for optional selections */
  canSkip?: boolean;
  /** Text for skip button (default "Skip") */
  skipText?: string;
  /** Called when selection is confirmed with selected cards */
  onSelect: (cards: readonly CardId[]) => void;
  /** Called when skip is clicked */
  onSkip?: () => void;
  /** Called when undo/cancel is triggered */
  onUndo?: () => void;
  /** Optional filter for which cards can be selected (returns true if selectable) */
  cardFilter?: (cardId: CardId) => boolean;
  /** Optional message explaining why filtered cards can't be selected */
  filterMessage?: string;
}

export function CardSelectionOverlay(props: CardSelectionOverlayProps) {
  // Register this overlay to disable background interactions (hex tooltips, etc.)
  useRegisterOverlay(true);

  // All rendering handled by PixiJS — this component returns null
  return <PixiCardSelectionOverlay {...props} />;
}
