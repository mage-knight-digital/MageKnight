/**
 * SitePanel - Detailed site information panel
 *
 * Shows comprehensive site info in a slide-in panel on the right side.
 * Used for:
 * - Scouting: Click into tooltip to see full details
 * - Arrival: Auto-opens when landing on an interactive site
 *
 * Phase 1: Basic structure with dark theme and slide-in animation
 */

import { useEffect, useState } from "react";
import type { SiteOptions } from "@mage-knight/shared";
import type { ClientHexState } from "@mage-knight/shared";
import "./SitePanel.css";

export interface SitePanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** The site options data */
  siteOptions: SiteOptions | null;
  /** The hex state (for enemy info) */
  hex: ClientHexState | null;
  /** Callback when panel is closed */
  onClose: () => void;
  /** Whether this is arrival mode (shows action buttons) vs scouting mode */
  isArrivalMode?: boolean;
}

// Helper to format site name from type when siteOptions not available
function formatSiteName(siteType: string, site?: { cityColor?: string; mineColor?: string } | null): string {
  // Handle special cases with colors
  if (siteType === "city" && site?.cityColor) {
    return `${capitalize(site.cityColor)} City`;
  }
  if (siteType === "mine" && site?.mineColor) {
    return `${capitalize(site.mineColor)} Mine`;
  }
  // Default: convert snake_case to Title Case
  return siteType
    .split("_")
    .map(capitalize)
    .join(" ");
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Site type to icon mapping (emoji placeholders for now)
const SITE_ICONS: Record<string, string> = {
  dungeon: "🏚️",
  tomb: "🪦",
  monster_den: "🕳️",
  spawning_grounds: "🥚",
  ancient_ruins: "🏛️",
  village: "🏘️",
  monastery: "⛪",
  keep: "🏰",
  mage_tower: "🗼",
  city: "🏙️",
  mine: "⛏️",
  magical_glade: "✨",
  deep_mine: "💎",
  maze: "🌀",
  labyrinth: "🔮",
};

export function SitePanel({
  isOpen,
  siteOptions,
  hex,
  onClose,
  isArrivalMode = false,
}: SitePanelProps) {
  // Track animation state
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Handle open/close animation
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Small delay to trigger CSS transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      // Wait for animation to finish before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300); // Match CSS transition duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Can render with either siteOptions (detailed) or hex.site (basic)
  const site = hex?.site;
  if (!shouldRender || (!siteOptions && !site)) {
    return null;
  }

  // Use siteOptions if available, otherwise fall back to basic site info
  const siteType = siteOptions?.siteType ?? site?.type ?? "unknown";
  const siteName = siteOptions?.siteName ?? formatSiteName(siteType, site);
  const isConquered = siteOptions?.isConquered ?? site?.isConquered ?? false;
  const siteIcon = SITE_ICONS[siteType] || "📍";

  return (
    <div className={`site-panel ${isAnimating ? "site-panel--open" : ""}`}>
      {/* Header */}
      <div className="site-panel__header">
        <div className="site-panel__title">
          <span className="site-panel__icon">{siteIcon}</span>
          <span className="site-panel__name">{siteName}</span>
          {isConquered && (
            <span className="site-panel__status">Conquered</span>
          )}
        </div>
        <button
          className="site-panel__close"
          onClick={onClose}
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="site-panel__content">
        {/* Site Artwork Placeholder */}
        <div className="site-panel__artwork">
          <div className="site-panel__artwork-placeholder">
            <span className="site-panel__artwork-icon">{siteIcon}</span>
            <span className="site-panel__artwork-text">Site Artwork</span>
          </div>
        </div>

        {/* Combat Section (for adventure sites) - only when siteOptions available */}
        {siteOptions?.canEnter && siteOptions.enterDescription && (
          <section className="site-panel__section">
            <h3 className="site-panel__section-title">
              <span className="site-panel__section-icon">⚔️</span>
              Combat
            </h3>
            <div className="site-panel__section-content">
              <p className="site-panel__description">
                {siteOptions.enterDescription}
              </p>
              {/* Enemy cards will go here in Phase 3 */}
              {hex?.enemies && hex.enemies.length > 0 && (
                <div className="site-panel__enemies-placeholder">
                  {hex.enemies.length} enemy token(s) present
                </div>
              )}
            </div>
          </section>
        )}

        {/* Enemies Section - show even without siteOptions if enemies present */}
        {!siteOptions?.canEnter && hex?.enemies && hex.enemies.length > 0 && (
          <section className="site-panel__section">
            <h3 className="site-panel__section-title">
              <span className="site-panel__section-icon">⚔️</span>
              Enemies
            </h3>
            <div className="site-panel__section-content">
              <div className="site-panel__enemies-placeholder">
                {hex.enemies.length} enemy token(s) present
              </div>
            </div>
          </section>
        )}

        {/* Restrictions Section */}
        {siteOptions?.enterRestrictions && (
          <section className="site-panel__section">
            <h3 className="site-panel__section-title">
              <span className="site-panel__section-icon">⚠️</span>
              Restrictions
            </h3>
            <div className="site-panel__section-content">
              {siteOptions.enterRestrictions.nightManaRules && (
                <div className="site-panel__restriction">
                  <span className="site-panel__restriction-icon">🌙</span>
                  <div className="site-panel__restriction-text">
                    <strong>Night Rules</strong>
                    <span>No gold mana, black mana available</span>
                  </div>
                </div>
              )}
              {siteOptions.enterRestrictions.unitsAllowed === false && (
                <div className="site-panel__restriction">
                  <span className="site-panel__restriction-icon">🚫</span>
                  <div className="site-panel__restriction-text">
                    <strong>No Units</strong>
                    <span>You must fight alone</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Rewards Section */}
        {siteOptions?.conquestReward && (
          <section className="site-panel__section">
            <h3 className="site-panel__section-title">
              <span className="site-panel__section-icon">🎁</span>
              Reward
            </h3>
            <div className="site-panel__section-content">
              <p className="site-panel__description">
                {siteOptions.conquestReward}
              </p>
            </div>
          </section>
        )}

        {/* Services Section (for inhabited sites) */}
        {siteOptions?.canInteract && siteOptions.interactOptions && (
          <section className="site-panel__section">
            <h3 className="site-panel__section-title">
              <span className="site-panel__section-icon">💬</span>
              Services
            </h3>
            <div className="site-panel__section-content">
              {siteOptions.interactOptions.canHeal && (
                <div className="site-panel__service">
                  <span className="site-panel__service-icon">❤️</span>
                  <div className="site-panel__service-text">
                    <strong>Healing</strong>
                    <span>
                      {siteOptions.interactOptions.healCost} Influence = 1 HP
                    </span>
                  </div>
                </div>
              )}
              {siteOptions.interactOptions.canRecruit && (
                <div className="site-panel__service">
                  <span className="site-panel__service-icon">🛡️</span>
                  <div className="site-panel__service-text">
                    <strong>Recruit Units</strong>
                    <span>Units available for hire</span>
                  </div>
                </div>
              )}
              {siteOptions.interactOptions.canBuySpells && (
                <div className="site-panel__service">
                  <span className="site-panel__service-icon">📜</span>
                  <div className="site-panel__service-text">
                    <strong>Buy Spells</strong>
                    <span>{siteOptions.interactOptions.spellCost ?? 7} Influence + matching mana</span>
                  </div>
                </div>
              )}
              {siteOptions.interactOptions.canBuyAdvancedActions && (
                <div className="site-panel__service">
                  <span className="site-panel__service-icon">⚡</span>
                  <div className="site-panel__service-text">
                    <strong>Buy Advanced Action</strong>
                    <span>{siteOptions.interactOptions.advancedActionCost ?? 6} Influence</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Passive Effects Section */}
        {(siteOptions?.endOfTurnEffect || siteOptions?.startOfTurnEffect) && (
          <section className="site-panel__section">
            <h3 className="site-panel__section-title">
              <span className="site-panel__section-icon">✨</span>
              Effects
            </h3>
            <div className="site-panel__section-content">
              {siteOptions.startOfTurnEffect && (
                <div className="site-panel__effect">
                  <span className="site-panel__effect-timing">Start of turn:</span>
                  <span>{siteOptions.startOfTurnEffect}</span>
                </div>
              )}
              {siteOptions.endOfTurnEffect && (
                <div className="site-panel__effect">
                  <span className="site-panel__effect-timing">End of turn:</span>
                  <span>{siteOptions.endOfTurnEffect}</span>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Footer with mode indicator (placeholder for action buttons) */}
      <div className="site-panel__footer">
        {isArrivalMode ? (
          <div className="site-panel__mode-indicator">
            Use radial menu to select action
          </div>
        ) : (
          <div className="site-panel__mode-indicator">
            Scouting mode - move here to interact
          </div>
        )}
      </div>
    </div>
  );
}
