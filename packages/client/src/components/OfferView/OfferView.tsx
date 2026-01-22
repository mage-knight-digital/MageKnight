/**
 * OfferView - Full-screen offer display
 *
 * Activated with 1 from board view, dismissed with 2/S or clicking overlay.
 * Uses Q/W/E for direct pane selection: Units | Spells | Advanced Actions.
 *
 * Renders entirely in PixiJS via PixiOfferView for smooth performance
 * and to avoid DOM/Pixi coordination issues.
 */

import { PixiOfferView } from "./PixiOfferView";

// Offer pane types (exported for external use)
export type OfferPane = "units" | "spells" | "advancedActions";

export interface OfferViewProps {
  isVisible: boolean;
  onClose: () => void;
}

export function OfferView({ isVisible, onClose }: OfferViewProps) {
  // Delegate entirely to the Pixi implementation
  return <PixiOfferView isVisible={isVisible} onClose={onClose} />;
}
