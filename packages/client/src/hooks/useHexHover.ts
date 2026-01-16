/**
 * useHexHover - Hook for managing hex hover state with configurable delay
 *
 * Designed to be settings-ready:
 * - delay: time before tooltip appears (experienced players want faster/none)
 * - Future: can inject settings to control behavior per content type
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { HexCoord } from "@mage-knight/shared";

export interface UseHexHoverOptions {
  /** Delay in ms before tooltip appears (default 300) */
  delay?: number;
  /** Callback when hover state changes */
  onHoverChange?: (coord: HexCoord | null) => void;
}

export interface HexHoverState {
  /** Currently hovered hex coordinate (null if none) */
  hoveredHex: HexCoord | null;
  /** Screen position for tooltip (near cursor) */
  tooltipPosition: { x: number; y: number } | null;
  /** Whether tooltip should be visible (after delay) */
  isTooltipVisible: boolean;
  /** Handler to attach to hex elements */
  handleHexMouseEnter: (coord: HexCoord, screenPos: { x: number; y: number }) => void;
  /** Handler for mouse leave */
  handleHexMouseLeave: () => void;
  /** Handler for mouse move (updates tooltip position) */
  handleHexMouseMove: (screenPos: { x: number; y: number }) => void;
}

export function useHexHover(options: UseHexHoverOptions = {}): HexHoverState {
  const { delay = 300, onHoverChange } = options;

  const [hoveredHex, setHoveredHex] = useState<HexCoord | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  const delayTimerRef = useRef<number | null>(null);
  const currentHexRef = useRef<HexCoord | null>(null);

  // Clear any pending timer
  const clearDelayTimer = useCallback(() => {
    if (delayTimerRef.current !== null) {
      window.clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearDelayTimer();
  }, [clearDelayTimer]);

  const handleHexMouseEnter = useCallback(
    (coord: HexCoord, screenPos: { x: number; y: number }) => {
      // If same hex, don't restart timer
      if (
        currentHexRef.current &&
        currentHexRef.current.q === coord.q &&
        currentHexRef.current.r === coord.r
      ) {
        return;
      }

      clearDelayTimer();
      currentHexRef.current = coord;
      setHoveredHex(coord);
      setTooltipPosition(screenPos);
      setIsTooltipVisible(false);

      onHoverChange?.(coord);

      // Start delay timer for tooltip visibility
      if (delay > 0) {
        delayTimerRef.current = window.setTimeout(() => {
          setIsTooltipVisible(true);
        }, delay);
      } else {
        setIsTooltipVisible(true);
      }
    },
    [delay, clearDelayTimer, onHoverChange]
  );

  const handleHexMouseLeave = useCallback(() => {
    clearDelayTimer();
    currentHexRef.current = null;
    setHoveredHex(null);
    setTooltipPosition(null);
    setIsTooltipVisible(false);
    onHoverChange?.(null);
  }, [clearDelayTimer, onHoverChange]);

  const handleHexMouseMove = useCallback((screenPos: { x: number; y: number }) => {
    setTooltipPosition(screenPos);
  }, []);

  return {
    hoveredHex,
    tooltipPosition,
    isTooltipVisible,
    handleHexMouseEnter,
    handleHexMouseLeave,
    handleHexMouseMove,
  };
}
