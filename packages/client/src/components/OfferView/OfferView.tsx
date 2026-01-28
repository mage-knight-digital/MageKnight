/**
 * OfferView - Full-screen offer display
 *
 * Activated with 1 from board view, dismissed with 2/S or clicking overlay.
 * Uses Q/W/E for direct pane selection: Units | Spells | Advanced Actions.
 *
 * Renders entirely in PixiJS via PixiOfferView for smooth performance
 * and to avoid DOM/Pixi coordination issues.
 */

import { useRegisterOverlay } from "../../contexts/OverlayContext";
import { PixiOfferView } from "./PixiOfferView";

// Offer pane types (exported for external use)
export type OfferPane = "units" | "spells" | "advancedActions";

export interface OfferViewProps {
  isVisible: boolean;
  onClose: () => void;
  /** Optional initial tab to show when opening. Defaults to "units". */
  initialTab?: OfferPane;
}

export function OfferView({ isVisible, onClose, initialTab }: OfferViewProps) {
  // Register as overlay when visible to disable hex tooltips
  useRegisterOverlay(isVisible);

  // Delegate entirely to the Pixi implementation
  return <PixiOfferView isVisible={isVisible} onClose={onClose} initialTab={initialTab} />;
}
