/**
 * NavHints - Contextual navigation hints for 1/2/3/4 view switching
 *
 * Shows pulsing hints at screen edges to help users discover navigation:
 * - Board mode: "1 ▲ Offers" at top, "3 ▼ Hand" at bottom
 * - Ready mode: "2 ▲ Map" at top
 */

import { useState, useEffect } from "react";
import type { HandView } from "./PlayerHand";
import "./NavHints.css";

interface NavHintsProps {
  currentView: HandView;
  /** Delay before hints start pulsing (ms) */
  pulseDelay?: number;
}

export function NavHints({ currentView, pulseDelay = 5000 }: NavHintsProps) {
  const [shouldPulse, setShouldPulse] = useState(false);

  // Start pulsing after delay, reset on view change
  useEffect(() => {
    setShouldPulse(false);
    const timer = setTimeout(() => setShouldPulse(true), pulseDelay);
    return () => clearTimeout(timer);
  }, [currentView, pulseDelay]);

  // Don't show hints in offer or focus view
  if (currentView === "offer" || currentView === "focus") {
    return null;
  }

  const pulseClass = shouldPulse ? "nav-hint--pulse" : "";

  return (
    <>
      {/* Top hint */}
      <div className={`nav-hint nav-hint--top ${pulseClass}`}>
        <span className="nav-hint__key">{currentView === "board" ? "1" : "2"}</span>
        <span className="nav-hint__arrow">▲</span>
        <span className="nav-hint__label">
          {currentView === "board" ? "Offers" : "Map"}
        </span>
      </div>

      {/* Bottom hint - only in board mode */}
      {currentView === "board" && (
        <div className={`nav-hint nav-hint--bottom ${pulseClass}`}>
          <span className="nav-hint__label">Hand</span>
          <span className="nav-hint__arrow">▼</span>
          <span className="nav-hint__key">3</span>
        </div>
      )}
    </>
  );
}
