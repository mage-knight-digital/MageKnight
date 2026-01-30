/**
 * HexContextMenu - Context menu for site interactions
 *
 * Appears when player is on a hex with actionable site options.
 * Uses PixiPieMenu component for consistent UI with card actions.
 */

import { useMemo, useCallback } from "react";
import { ENTER_SITE_ACTION, END_TURN_ACTION } from "@mage-knight/shared";
import type { SiteOptions } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useIsMyTurn } from "../../hooks/useIsMyTurn";
import { PixiPieMenu, type PixiPieMenuItem } from "../CardActionMenu";

interface HexContextMenuProps {
  /** Site options from validActions */
  siteOptions: SiteOptions;
  /** Screen position for the menu center */
  position: { x: number; y: number };
  /** Called when menu should close */
  onClose: () => void;
}

/**
 * Get colors for menu item based on action type (hex values for PixiJS)
 */
function getActionColors(actionType: string): { fill: number; hover: number } {
  switch (actionType) {
    case "enter":
      return { fill: 0xb43c3c, hover: 0xd04848 }; // Combat red
    case "recruit":
      return { fill: 0x3c78b4, hover: 0x4890d0 }; // Unit blue
    case "heal":
      return { fill: 0x3ca03c, hover: 0x48c048 }; // Healing green
    case "buy-spell":
      return { fill: 0x783cb4, hover: 0x9048d0 }; // Spell purple
    case "buy-aa":
      return { fill: 0xb4783c, hover: 0xd09048 }; // AA orange
    case "reward-info":
      return { fill: 0xb49632, hover: 0xd0b048 }; // Gold (info)
    case "end-turn":
      return { fill: 0x3c3c46, hover: 0x4e4e5a }; // Neutral dark
    case "stay":
    default:
      return { fill: 0x50505a, hover: 0x646470 }; // Neutral gray
  }
}

export function HexContextMenu({
  siteOptions,
  position,
  onClose,
}: HexContextMenuProps) {
  const { state, sendAction } = useGame();
  const isMyTurn = useIsMyTurn();

  // Build menu items from site options
  const menuItems = useMemo<PixiPieMenuItem[]>(() => {
    const items: PixiPieMenuItem[] = [];

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

      const enterColors = getActionColors("enter");
      items.push({
        id: "enter",
        label: `Enter`,
        sublabel: sublabel || siteOptions.siteName,
        color: enterColors.fill,
        hoverColor: enterColors.hover,
      });

      // Show reward as separate info item (disabled)
      if (siteOptions.conquestReward && !siteOptions.isConquered) {
        const rewardColors = getActionColors("reward-info");
        items.push({
          id: "reward-info",
          label: "Reward",
          sublabel: siteOptions.conquestReward,
          color: rewardColors.fill,
          hoverColor: rewardColors.hover,
          disabled: true,
        });
      }
    }

    // Interact options (inhabited sites)
    if (siteOptions.canInteract && siteOptions.interactOptions) {
      const opts = siteOptions.interactOptions;

      if (opts.canRecruit) {
        const recruitColors = getActionColors("recruit");
        items.push({
          id: "recruit",
          label: "Recruit",
          sublabel: "View units",
          color: recruitColors.fill,
          hoverColor: recruitColors.hover,
        });
      }

      if (opts.canHeal && opts.healCost) {
        const healColors = getActionColors("heal");
        items.push({
          id: "heal",
          label: "Heal",
          sublabel: `${opts.healCost} Inf/wound`,
          color: healColors.fill,
          hoverColor: healColors.hover,
        });
      }

      if (opts.canBuySpells) {
        const spellColors = getActionColors("buy-spell");
        items.push({
          id: "buy-spell",
          label: "Spell",
          sublabel: `${opts.spellCost ?? 7} Inf`,
          color: spellColors.fill,
          hoverColor: spellColors.hover,
        });
      }

      if (opts.canBuyAdvancedActions) {
        const aaColors = getActionColors("buy-aa");
        items.push({
          id: "buy-aa",
          label: "Training",
          sublabel: `${opts.advancedActionCost ?? 6} Inf`,
          color: aaColors.fill,
          hoverColor: aaColors.hover,
        });
      }
    }

    // End Turn option (if valid and has passive effect)
    const canEndTurn = state?.validActions.turn?.canEndTurn ?? false;
    if (canEndTurn && siteOptions.endOfTurnEffect) {
      const endColors = getActionColors("end-turn");
      items.push({
        id: "end-turn",
        label: "End Turn",
        sublabel: siteOptions.endOfTurnEffect,
        color: endColors.fill,
        hoverColor: endColors.hover,
      });
    }

    // Always show "Stay Here" / dismiss option
    const stayColors = getActionColors("stay");
    items.push({
      id: "stay",
      label: "Dismiss",
      color: stayColors.fill,
      hoverColor: stayColors.hover,
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

  // Don't show context menu if not player's turn
  if (!isMyTurn) {
    return null;
  }

  // Don't render if no actionable items (only "stay")
  if (menuItems.length <= 1) {
    return null;
  }

  const centerLabel = siteOptions.isConquered
    ? `${siteOptions.siteName} ✓`
    : siteOptions.siteName;

  return (
    <PixiPieMenu
      items={menuItems}
      onSelect={handleSelect}
      onCancel={onClose}
      position={position}
      centerLabel={centerLabel}
    />
  );
}
