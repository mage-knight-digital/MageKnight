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
  /** If true, tooltip stays at initial position instead of following cursor (default true) */
  static?: boolean;
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
  /** Handler for when mouse enters the tooltip itself */
  handleTooltipMouseEnter: () => void;
  /** Handler for when mouse leaves the tooltip */
  handleTooltipMouseLeave: () => void;
}

export function useHexHover(options: UseHexHoverOptions = {}): HexHoverState {
  const { delay = 300, onHoverChange, static: isStatic = true } = options;

  const [hoveredHex, setHoveredHex] = useState<HexCoord | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  const delayTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const currentHexRef = useRef<HexCoord | null>(null);
  const isOverTooltipRef = useRef<boolean>(false);

  // Clear any pending timer
  const clearDelayTimer = useCallback(() => {
    if (delayTimerRef.current !== null) {
      window.clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
  }, []);

  // Clear close timer
  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearDelayTimer();
      clearCloseTimer();
    };
  }, [clearDelayTimer, clearCloseTimer]);

  const handleHexMouseEnter = useCallback(
    (coord: HexCoord, screenPos: { x: number; y: number }) => {
      // Cancel any pending close - we're on a hex
      clearCloseTimer();

      // If same hex, nothing more to do
      if (
        currentHexRef.current &&
        currentHexRef.current.q === coord.q &&
        currentHexRef.current.r === coord.r
      ) {
        return;
      }

      // If tooltip is already visible, just update to new hex instantly
      // This allows smooth transition when moving between hexes
      if (isTooltipVisible) {
        currentHexRef.current = coord;
        setHoveredHex(coord);
        setTooltipPosition(screenPos);
        onHoverChange?.(coord);
        return;
      }

      // New hover - start fresh
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
    [delay, clearDelayTimer, clearCloseTimer, onHoverChange, isTooltipVisible]
  );

  // Actually close the tooltip (called after delay or immediately)
  const doClose = useCallback(() => {
    currentHexRef.current = null;
    setHoveredHex(null);
    setTooltipPosition(null);
    setIsTooltipVisible(false);
    onHoverChange?.(null);
  }, [onHoverChange]);

  const handleHexMouseLeave = useCallback(() => {
    clearDelayTimer();

    // Don't close immediately - give time to move cursor to tooltip
    // Use a short delay to check if mouse entered the tooltip
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      // Only close if mouse is not over the tooltip
      if (!isOverTooltipRef.current) {
        doClose();
      }
    }, 100); // 100ms grace period to move to tooltip
  }, [clearDelayTimer, clearCloseTimer, doClose]);

  const handleHexMouseMove = useCallback((screenPos: { x: number; y: number }) => {
    // Only update position if not in static mode
    if (!isStatic) {
      setTooltipPosition(screenPos);
    }
  }, [isStatic]);

  // When mouse enters the tooltip, keep it open
  const handleTooltipMouseEnter = useCallback(() => {
    isOverTooltipRef.current = true;
    clearCloseTimer(); // Cancel any pending close
  }, [clearCloseTimer]);

  // When mouse leaves the tooltip, close it
  const handleTooltipMouseLeave = useCallback(() => {
    isOverTooltipRef.current = false;
    doClose();
  }, [doClose]);

  return {
    hoveredHex,
    tooltipPosition,
    isTooltipVisible,
    handleHexMouseEnter,
    handleHexMouseLeave,
    handleHexMouseMove,
    handleTooltipMouseEnter,
    handleTooltipMouseLeave,
  };
}
