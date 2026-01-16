/**
 * HexTooltip - Unified tooltip for hex information (sites, enemies)
 *
 * Disney animation principles:
 * - Page unfold/flip reveal
 * - Staggered line appearance (typewriter feel)
 * - Subtle settle at end
 *
 * Settings-ready: accepts showSite/showEnemies props that can be
 * controlled by user settings later.
 */

import { useEffect, useState } from "react";
import type { HexCoord, ClientHexState } from "@mage-knight/shared";
import { SiteTooltipContent } from "./SiteTooltipContent";
import { EnemyTooltipContent } from "./EnemyTooltipContent";
import "./HexTooltip.css";

export interface HexTooltipProps {
  /** The hex to show info for */
  hex: ClientHexState | null;
  /** Hex coordinate (for key/identity) */
  coord: HexCoord | null;
  /** Screen position for tooltip */
  position: { x: number; y: number } | null;
  /** Whether tooltip should be visible (after hover delay) */
  isVisible: boolean;
  /** Show site information (default true) */
  showSite?: boolean;
  /** Show enemy information (default true) */
  showEnemies?: boolean;
}

export function HexTooltip({
  hex,
  coord,
  position,
  isVisible,
  showSite = true,
  showEnemies = true,
}: HexTooltipProps) {
  // Track animation state for staggered reveals
  const [isAnimating, setIsAnimating] = useState(false);

  // Reset animation when tooltip becomes visible
  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
    }
  }, [isVisible, coord?.q, coord?.r]);

  // Don't render if no data or not visible
  if (!hex || !position || !isVisible) {
    return null;
  }

  const hasSite = showSite && !!hex.site;
  const hasEnemies = showEnemies && hex.enemies && hex.enemies.length > 0;

  // Don't show empty tooltip
  if (!hasSite && !hasEnemies) {
    return null;
  }

  // Position tooltip near cursor but offset to not cover the hex
  // Also ensure it stays on screen
  const tooltipStyle: React.CSSProperties = {
    left: position.x + 20,
    top: position.y - 10,
  };

  return (
    <div
      className={`hex-tooltip ${isAnimating ? "hex-tooltip--animating" : ""}`}
      style={tooltipStyle}
    >
      <div className="hex-tooltip__content">
        {hasSite && hex.site && (
          <SiteTooltipContent site={hex.site} isAnimating={isAnimating} />
        )}
        {hasEnemies && hex.enemies && hex.enemies.length > 0 && (
          <EnemyTooltipContent
            enemies={hex.enemies}
            isAnimating={isAnimating}
            showHeader={hasSite}
          />
        )}
      </div>
    </div>
  );
}
