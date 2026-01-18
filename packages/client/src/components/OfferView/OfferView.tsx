/**
 * OfferView - Full-screen offer display with Inscryption-style presentation
 *
 * Activated with 1 from board view, dismissed with 2/S or clicking overlay.
 * Uses Q/W/E for direct pane selection: Units | Spells | Advanced Actions.
 */

import { useState, useEffect, useCallback } from "react";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { useAnimationDispatcher } from "../../contexts/AnimationDispatcherContext";
import { OfferTray } from "./OfferTray";
import { UnitOfferPane } from "./UnitOfferPane";
import { SpellOfferPane } from "./SpellOfferPane";
import { AAOfferPane } from "./AAOfferPane";
import "./OfferView.css";

// Offer pane types
export type OfferPane = "units" | "spells" | "advancedActions";

export interface OfferViewProps {
  isVisible: boolean;
  onClose: () => void;
}

export function OfferView({ isVisible, onClose }: OfferViewProps) {
  const { state } = useGame();
  const player = useMyPlayer();
  const { emit } = useAnimationDispatcher();

  const [currentPane, setCurrentPane] = useState<OfferPane>("units");
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [isFullyVisible, setIsFullyVisible] = useState(false);

  // Handle enter animation
  useEffect(() => {
    if (isVisible && !isFullyVisible) {
      setIsAnimatingIn(true);
      setIsAnimatingOut(false);

      // Animation duration matches CSS (400ms)
      const timer = setTimeout(() => {
        setIsAnimatingIn(false);
        setIsFullyVisible(true);
        emit("offer-view-entered" as never);
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [isVisible, isFullyVisible, emit]);

  // Handle exit animation
  const handleClose = useCallback(() => {
    if (!isFullyVisible) return;

    setIsAnimatingOut(true);
    setIsFullyVisible(false);

    // Animation duration matches CSS (300ms)
    setTimeout(() => {
      setIsAnimatingOut(false);
      onClose();
    }, 300);
  }, [isFullyVisible, onClose]);

  // Reset state when hidden
  useEffect(() => {
    if (!isVisible) {
      setIsFullyVisible(false);
      setIsAnimatingIn(false);
      setIsAnimatingOut(false);
    }
  }, [isVisible]);

  // Q/W/E keyboard navigation for panes, 2/S/Escape to close
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();

      // Direct pane selection: Q=units, W=spells, E=advancedActions
      if (key === "q") {
        setCurrentPane("units");
      } else if (key === "w") {
        setCurrentPane("spells");
      } else if (key === "e") {
        setCurrentPane("advancedActions");
      } else if (key === "2" || key === "s" || key === "escape") {
        // Exit offer view (2=board view, S=legacy close, Escape=dismiss)
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, handleClose]);

  // Don't render if not visible and not animating
  if (!isVisible && !isAnimatingOut) {
    return null;
  }

  if (!state || !player) {
    return null;
  }

  const overlayClassName = [
    "offer-view__overlay",
    isAnimatingIn && "offer-view__overlay--entering",
    isAnimatingOut && "offer-view__overlay--exiting",
    isFullyVisible && "offer-view__overlay--visible",
  ]
    .filter(Boolean)
    .join(" ");

  const trayClassName = [
    "offer-view__tray-container",
    isAnimatingIn && "offer-view__tray-container--entering",
    isAnimatingOut && "offer-view__tray-container--exiting",
    isFullyVisible && "offer-view__tray-container--visible",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="offer-view">
      {/* Dark overlay */}
      <div className={overlayClassName} onClick={handleClose} />

      {/* Tray container */}
      <div className={trayClassName}>
        <OfferTray currentPane={currentPane} isAnimating={isAnimatingIn || isAnimatingOut}>
          {currentPane === "units" && <UnitOfferPane />}
          {currentPane === "spells" && <SpellOfferPane />}
          {currentPane === "advancedActions" && <AAOfferPane />}
        </OfferTray>

        {/* Pane indicator - reuses the same styling as hand carousel */}
        <div className="carousel-pane-indicator carousel-pane-indicator--offer">
          <span
            className={`carousel-pane-indicator__item ${currentPane === "units" ? "carousel-pane-indicator__item--active" : ""}`}
            onClick={() => setCurrentPane("units")}
          >
            Units
          </span>
          <span className="carousel-pane-indicator__divider">|</span>
          <span
            className={`carousel-pane-indicator__item ${currentPane === "spells" ? "carousel-pane-indicator__item--active" : ""}`}
            onClick={() => setCurrentPane("spells")}
          >
            Spells
          </span>
          <span className="carousel-pane-indicator__divider">|</span>
          <span
            className={`carousel-pane-indicator__item ${currentPane === "advancedActions" ? "carousel-pane-indicator__item--active" : ""}`}
            onClick={() => setCurrentPane("advancedActions")}
          >
            Advanced Actions
          </span>
        </div>

        {/* Navigation hint */}
        <div className="offer-view__nav-hint">
          <span>Q/W/E to switch</span>
          <span>2 to close</span>
        </div>
      </div>
    </div>
  );
}
