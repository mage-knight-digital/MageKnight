import type { CardInteractionState } from "../CardInteraction/types";
import type { HandViewMode } from "./PixiFloatingHand";

interface HandClickGuardInput {
  readonly viewMode: HandViewMode;
  readonly isActive: boolean;
  readonly isOverlayActive: boolean;
  readonly inCombat: boolean;
  readonly cardInteractionType: CardInteractionState["type"];
}

export function shouldIgnoreHandClick({
  viewMode,
  isActive,
  isOverlayActive,
  inCombat,
  cardInteractionType,
}: HandClickGuardInput): boolean {
  if (viewMode === "board" || !isActive) return true;
  if (cardInteractionType !== "idle") return true;
  return isOverlayActive && viewMode !== "focus" && !inCombat;
}
