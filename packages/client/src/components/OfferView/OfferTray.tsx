/**
 * OfferTray - The wooden tray container for offer cards
 *
 * Handles the tray slide animation and contains the card display.
 */

import type { ReactNode } from "react";
import type { OfferPane } from "./OfferView";

export interface OfferTrayProps {
  currentPane: OfferPane;
  isAnimating: boolean;
  children: ReactNode;
}

export function OfferTray({ children, isAnimating }: OfferTrayProps) {
  const trayClassName = [
    "offer-tray",
    isAnimating && "offer-tray--animating",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={trayClassName}>
      <div className="offer-tray__content">
        <div className="offer-tray__pane">
          {children}
        </div>
      </div>
    </div>
  );
}
