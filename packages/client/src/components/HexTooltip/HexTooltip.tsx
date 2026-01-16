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

import { useEffect, useState, useMemo } from "react";
import type { HexCoord, ClientHexState, ClientSite } from "@mage-knight/shared";
import { SiteTooltipContent } from "./SiteTooltipContent";
import { EnemyTooltipContent } from "./EnemyTooltipContent";
import "./HexTooltip.css";

/**
 * Count how many animated lines the site tooltip will have.
 * Used to chain enemy tooltip animation after site content.
 */
function countSiteLines(site: ClientSite): number {
  // Header + divider = 2 lines always
  let count = 2;

  // Count based on site type (simplified - matches SiteTooltipContent logic)
  // fight, reward, interaction each add 1 if present
  // special rules add 1 each
  const type = site.type;

  // Adventure sites typically have: fight + reward + special rules
  if (["dungeon", "tomb"].includes(type)) {
    count += 4; // fight + reward + 2 special
  } else if (["monster_den", "spawning_grounds"].includes(type)) {
    count += 3; // fight + reward + 1 special
  } else if (type === "ancient_ruins") {
    count += 3; // fight + reward + 1 special
  } else if (type === "village") {
    count += 2; // interaction + 1 special
  } else if (type === "monastery") {
    count += 2; // interaction + 1 special
  } else if (type === "keep") {
    count += site.isConquered ? 2 : 2; // interaction/fight + special
  } else if (type === "mage_tower") {
    count += site.isConquered ? 1 : 3; // interaction OR fight + reward + special
  } else if (type === "city") {
    count += site.isConquered ? 1 : 2; // interaction OR fight + special
  } else if (["mine", "magical_glade", "deep_mine"].includes(type)) {
    count += 1; // just interaction
  } else if (["maze", "labyrinth"].includes(type)) {
    count += 4; // fight + reward + 2 special
  } else {
    count += 1; // fallback
  }

  return count;
}

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

  // Calculate starting index for enemy content (after site lines)
  const enemyStartIndex = hasSite && hex.site ? countSiteLines(hex.site) : 0;

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
            startIndex={enemyStartIndex}
          />
        )}
      </div>
    </div>
  );
}
