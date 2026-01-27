/**
 * SiteActionList - Compact action list for site interactions
 *
 * Appears when player presses Space at a site with available actions.
 * Shows available actions with keyboard shortcuts.
 *
 * Keyboard shortcuts:
 * - E: Enter site (combat)
 * - D: Details (open site panel)
 * - H: Heal
 * - R: Recruit
 * - Escape: Dismiss
 */

import { useEffect, useCallback } from "react";
import type { SiteOptions } from "@mage-knight/shared";
import "./SiteActionList.css";

export type SiteAction = "enter" | "details" | "heal" | "recruit" | "buySpell" | "buyAA" | "burn";

export interface SiteActionListProps {
  /** Site options from validActions */
  siteOptions: SiteOptions;
  /** Screen position for the list (near hero) */
  position: { x: number; y: number };
  /** Called when user selects an action */
  onAction: (action: SiteAction) => void;
  /** Called when list should close */
  onClose: () => void;
}

interface ActionItem {
  id: SiteAction;
  label: string;
  icon: string;
  shortcut: string;
  className: string;
}

/**
 * Build list of available actions from site options
 */
function buildActionItems(siteOptions: SiteOptions): ActionItem[] {
  const items: ActionItem[] = [];

  // Enter site (adventure sites)
  if (siteOptions.canEnter) {
    items.push({
      id: "enter",
      label: `Enter ${siteOptions.siteName}`,
      icon: "\u2694\uFE0F", // Crossed swords emoji
      shortcut: "E",
      className: "site-action-list__item--enter",
    });
  }

  // Interact options (inhabited sites)
  if (siteOptions.canInteract && siteOptions.interactOptions) {
    const opts = siteOptions.interactOptions;

    if (opts.canHeal && opts.healCost) {
      items.push({
        id: "heal",
        label: `Heal (${opts.healCost} Inf/wound)`,
        icon: "\u{1F49A}", // Green heart emoji
        shortcut: "H",
        className: "site-action-list__item--heal",
      });
    }

    if (opts.canRecruit) {
      items.push({
        id: "recruit",
        label: "Recruit Unit",
        icon: "\u{1F6E1}\uFE0F", // Shield emoji
        shortcut: "R",
        className: "site-action-list__item--recruit",
      });
    }

    if (opts.canBuySpells) {
      items.push({
        id: "buySpell",
        label: `Buy Spell (${opts.spellCost ?? 7} Inf)`,
        icon: "\u{1F4DC}", // Scroll emoji
        shortcut: "S",
        className: "site-action-list__item--buy-spell",
      });
    }

    if (opts.canBuyAdvancedActions) {
      items.push({
        id: "buyAA",
        label: `Training (${opts.advancedActionCost ?? 6} Inf)`,
        icon: "\u{1F4DA}", // Books emoji
        shortcut: "T",
        className: "site-action-list__item--buy-aa",
      });
    }

    if (opts.canBurnMonastery) {
      items.push({
        id: "burn",
        label: "Burn Monastery",
        icon: "\u{1F525}", // Fire emoji
        shortcut: "B",
        className: "site-action-list__item--burn",
      });
    }
  }

  // Always show Details option
  items.push({
    id: "details",
    label: "Details",
    icon: "\u{1F4CB}", // Clipboard emoji
    shortcut: "D",
    className: "site-action-list__item--details",
  });

  return items;
}

export function SiteActionList({
  siteOptions,
  position,
  onAction,
  onClose,
}: SiteActionListProps) {
  const actionItems = buildActionItems(siteOptions);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      switch (key) {
        case "escape":
          event.preventDefault();
          onClose();
          break;
        case "e":
          if (siteOptions.canEnter) {
            event.preventDefault();
            onAction("enter");
          }
          break;
        case "d":
          event.preventDefault();
          onAction("details");
          break;
        case "h":
          if (siteOptions.canInteract && siteOptions.interactOptions?.canHeal) {
            event.preventDefault();
            onAction("heal");
          }
          break;
        case "r":
          if (siteOptions.canInteract && siteOptions.interactOptions?.canRecruit) {
            event.preventDefault();
            onAction("recruit");
          }
          break;
        case "s":
          if (siteOptions.canInteract && siteOptions.interactOptions?.canBuySpells) {
            event.preventDefault();
            onAction("buySpell");
          }
          break;
        case "t":
          if (siteOptions.canInteract && siteOptions.interactOptions?.canBuyAdvancedActions) {
            event.preventDefault();
            onAction("buyAA");
          }
          break;
        case "b":
          if (siteOptions.canInteract && siteOptions.interactOptions?.canBurnMonastery) {
            event.preventDefault();
            onAction("burn");
          }
          break;
        case " ": // Space toggles off
          event.preventDefault();
          onClose();
          break;
      }
    },
    [siteOptions, onAction, onClose]
  );

  // Attach keyboard listener
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  // Handle click on action item
  const handleItemClick = useCallback(
    (actionId: SiteAction) => {
      onAction(actionId);
    },
    [onAction]
  );

  // Position list near hero - vertically centered
  const listStyle: React.CSSProperties = {
    left: position.x,
    top: position.y,
  };

  return (
    <>
      {/* Click-away backdrop */}
      <div className="site-action-list__backdrop" onClick={onClose} />

      {/* Action list */}
      <div className="site-action-list" style={listStyle}>
        <div className="site-action-list__content">
          {actionItems.map((item, index) => (
            <div key={item.id}>
              {/* Add divider before Details */}
              {item.id === "details" && index > 0 && (
                <div className="site-action-list__divider" />
              )}
              <div
                className={`site-action-list__item ${item.className}`}
                onClick={() => handleItemClick(item.id)}
              >
                <span className="site-action-list__item-icon">{item.icon}</span>
                <span className="site-action-list__item-label">{item.label}</span>
                <span className="site-action-list__item-shortcut">{item.shortcut}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
