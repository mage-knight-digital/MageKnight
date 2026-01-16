/**
 * HexContextMenu - Context menu for site interactions
 *
 * Appears when player is on a hex with actionable site options.
 * Uses PieMenu component for consistent UI with card actions.
 */

import { useMemo, useCallback, useEffect } from "react";
import { ENTER_SITE_ACTION, END_TURN_ACTION } from "@mage-knight/shared";
import type { SiteOptions } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { PieMenu, type PieMenuItem } from "../CardActionMenu";
import "./HexContextMenu.css";

interface HexContextMenuProps {
  /** Site options from validActions */
  siteOptions: SiteOptions;
  /** Screen position for the menu center */
  position: { x: number; y: number };
  /** Called when menu should close */
  onClose: () => void;
}

/**
 * Get icon for site type
 */
function getSiteIcon(siteType: string): string {
  const icons: Record<string, string> = {
    dungeon: "🏚️",
    tomb: "⚰️",
    monster_den: "🕳️",
    spawning_grounds: "🪺",
    ancient_ruins: "🏛️",
    village: "🏘️",
    monastery: "⛪",
    keep: "🏰",
    mage_tower: "🗼",
    mine: "⛏️",
    deep_mine: "⛏️",
    magical_glade: "🌳",
    city: "🏙️",
    maze: "🌀",
    labyrinth: "🌀",
    refugee_camp: "⛺",
    portal: "🌀",
  };
  return icons[siteType] ?? "📍";
}

/**
 * Get color for menu item based on action type
 */
function getActionColor(actionType: string): string {
  switch (actionType) {
    case "enter":
      return "rgba(180, 60, 60, 0.95)"; // Combat red
    case "recruit":
      return "rgba(60, 120, 180, 0.95)"; // Unit blue
    case "heal":
      return "rgba(60, 160, 60, 0.95)"; // Healing green
    case "buy-spell":
      return "rgba(120, 60, 180, 0.95)"; // Spell purple
    case "buy-aa":
      return "rgba(180, 120, 60, 0.95)"; // AA orange
    case "reward-info":
      return "rgba(180, 150, 50, 0.7)"; // Gold (info)
    case "end-turn":
      return "rgba(60, 60, 70, 0.95)"; // Neutral dark
    case "stay":
    default:
      return "rgba(80, 80, 90, 0.95)"; // Neutral gray
  }
}

export function HexContextMenu({
  siteOptions,
  position,
  onClose,
}: HexContextMenuProps) {
  const { state, sendAction } = useGame();

  // Build menu items from site options
  const menuItems = useMemo<PieMenuItem[]>(() => {
    const items: PieMenuItem[] = [];

    // Enter site action (adventure sites)
    if (siteOptions.canEnter) {
      let sublabel = siteOptions.enterDescription ?? "";
      const restrictions = siteOptions.enterRestrictions;
      if (restrictions) {
        const parts: string[] = [];
        if (restrictions.nightManaRules) parts.push("Night rules");
        if (!restrictions.unitsAllowed) parts.push("No units");
        if (parts.length > 0) {
          sublabel += sublabel ? ` (${parts.join(", ")})` : parts.join(", ");
        }
      }

      items.push({
        id: "enter",
        label: `Enter ${siteOptions.siteName}`,
        sublabel: sublabel || undefined,
        icon: "⚔️",
        color: getActionColor("enter"),
      });

      // Show reward as separate info item (disabled)
      if (siteOptions.conquestReward && !siteOptions.isConquered) {
        items.push({
          id: "reward-info",
          label: "Reward",
          sublabel: siteOptions.conquestReward,
          icon: "🏆",
          color: getActionColor("reward-info"),
          disabled: true,
        });
      }
    }

    // Interact options (inhabited sites)
    if (siteOptions.canInteract && siteOptions.interactOptions) {
      const opts = siteOptions.interactOptions;

      if (opts.canRecruit) {
        items.push({
          id: "recruit",
          label: "Recruit",
          sublabel: "View available units",
          icon: "👥",
          color: getActionColor("recruit"),
        });
      }

      if (opts.canHeal && opts.healCost) {
        items.push({
          id: "heal",
          label: "Heal",
          sublabel: `${opts.healCost} Influence per wound`,
          icon: "💚",
          color: getActionColor("heal"),
        });
      }

      if (opts.canBuySpells) {
        items.push({
          id: "buy-spell",
          label: "Buy Spell",
          sublabel: `${opts.spellCost ?? 7} Influence + mana`,
          icon: "✨",
          color: getActionColor("buy-spell"),
        });
      }

      if (opts.canBuyAdvancedActions) {
        items.push({
          id: "buy-aa",
          label: "Buy Training",
          sublabel: `${opts.advancedActionCost ?? 6} Influence`,
          icon: "📜",
          color: getActionColor("buy-aa"),
        });
      }
    }

    // End Turn option (if valid and has passive effect)
    const canEndTurn = state?.validActions.turn?.canEndTurn ?? false;
    if (canEndTurn && siteOptions.endOfTurnEffect) {
      items.push({
        id: "end-turn",
        label: "End Turn",
        sublabel: siteOptions.endOfTurnEffect,
        icon: "⏭️",
        color: getActionColor("end-turn"),
      });
    }

    // Always show "Stay Here" / dismiss option
    items.push({
      id: "stay",
      label: "Dismiss",
      icon: "✕",
      color: getActionColor("stay"),
    });

    return items;
  }, [siteOptions, state?.validActions.turn?.canEndTurn]);

  const handleSelect = useCallback(
    (id: string) => {
      switch (id) {
        case "enter":
          sendAction({ type: ENTER_SITE_ACTION });
          break;
        case "recruit":
          // TODO: Open offers view to units tab
          console.log("Recruit action - open offers view");
          break;
        case "heal":
          // TODO: Implement healing UI
          console.log("Heal action - not yet implemented");
          break;
        case "buy-spell":
          // TODO: Open offers view to spells tab
          console.log("Buy spell action - open offers view");
          break;
        case "buy-aa":
          // TODO: Open offers view to AA tab
          console.log("Buy AA action - open offers view");
          break;
        case "end-turn":
          sendAction({ type: END_TURN_ACTION });
          break;
        case "stay":
        default:
          // Just close the menu
          break;
      }
      onClose();
    },
    [sendAction, onClose]
  );

  // Handle ESC key to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Don't render if no actionable items (only "stay")
  if (menuItems.length <= 1) {
    return null;
  }

  // Center content shows site info
  const centerContent = (
    <div className="hex-context-menu__center">
      <div className="hex-context-menu__site-icon">
        {getSiteIcon(siteOptions.siteType)}
      </div>
      <div className="hex-context-menu__site-name">{siteOptions.siteName}</div>
      {siteOptions.isConquered && (
        <div className="hex-context-menu__conquered">Conquered</div>
      )}
    </div>
  );

  return (
    <div className="hex-context-menu__overlay" onClick={onClose}>
      <div
        className="hex-context-menu__container"
        style={{
          left: position.x,
          top: position.y,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <PieMenu
          items={menuItems}
          onSelect={handleSelect}
          onCancel={onClose}
          centerContent={centerContent}
          size={380}
          innerRadius={0.38}
        />
      </div>
    </div>
  );
}
