/**
 * SiteActionList - Compact action list for site interactions
 *
 * Derives available actions from Rust engine legal actions.
 * Shows when player presses Space at a site with available actions.
 *
 * Two-phase flow:
 * 1. BeginInteraction available → show "Interact" to start site services
 * 2. Commerce actions available → show heal/buy/recruit options
 *
 * Keyboard shortcuts:
 * - I: Begin interaction
 * - E: Enter site (combat)
 * - H: Heal
 * - R: Recruit
 * - S: Buy Spell
 * - T: Training (Buy AA)
 * - B: Burn Monastery
 * - A: Buy Artifact
 * - D: Details (open site panel)
 * - Escape/Space: Dismiss
 */

import { useEffect, useCallback } from "react";
import type { SiteActionInfo } from "../../rust/legalActionUtils";
import type { LegalAction } from "../../rust/types";
import "./SiteActionList.css";

export type SiteAction =
  | { kind: "legalAction"; action: LegalAction }
  | { kind: "openDetails" }
  | { kind: "openSpellOffer" }
  | { kind: "openAAOffer" }
  | { kind: "openUnitOffer" };

interface ActionItem {
  id: string;
  label: string;
  icon: string;
  shortcut: string;
  className: string;
  onActivate: () => SiteAction;
}

/**
 * Build list of available actions from site action info (derived from legal actions)
 */
function buildActionItems(info: SiteActionInfo): ActionItem[] {
  const items: ActionItem[] = [];

  // Begin Interaction (inhabited sites — phase 1)
  if (info.canBeginInteraction && info.beginInteractionAction) {
    const action = info.beginInteractionAction;
    items.push({
      id: "interact",
      label: "Interact with Site",
      icon: "\u{1F91D}", // Handshake
      shortcut: "I",
      className: "site-action-list__item--interact",
      onActivate: () => ({ kind: "legalAction", action }),
    });
  }

  // Enter site (adventure sites)
  if (info.canEnter && info.enterAction) {
    const action = info.enterAction;
    items.push({
      id: "enter",
      label: "Enter Site",
      icon: "\u2694\uFE0F", // Crossed swords
      shortcut: "E",
      className: "site-action-list__item--enter",
      onActivate: () => ({ kind: "legalAction", action }),
    });
  }

  // Healing options — show max available
  if (info.healOptions.length > 0) {
    const maxHeal = info.healOptions[info.healOptions.length - 1]!;
    items.push({
      id: "heal",
      label: `Heal (up to ${maxHeal.healing} wound${maxHeal.healing > 1 ? "s" : ""})`,
      icon: "\u{1F49A}", // Green heart
      shortcut: "H",
      className: "site-action-list__item--heal",
      onActivate: () => ({ kind: "legalAction", action: maxHeal.action }),
    });
  }

  // Recruit (if recruit actions available, open unit offer)
  if (info.recruitActions.length > 0) {
    items.push({
      id: "recruit",
      label: "Recruit Unit",
      icon: "\u{1F6E1}\uFE0F", // Shield
      shortcut: "R",
      className: "site-action-list__item--recruit",
      onActivate: () => ({ kind: "openUnitOffer" }),
    });
  }

  // Buy Spell (open spell offer for selection)
  if (info.buySpellActions.length > 0) {
    items.push({
      id: "buySpell",
      label: `Buy Spell (${info.buySpellActions.length} available)`,
      icon: "\u{1F4DC}", // Scroll
      shortcut: "S",
      className: "site-action-list__item--buy-spell",
      onActivate: () => ({ kind: "openSpellOffer" }),
    });
  }

  // Learn AA at Monastery
  if (info.learnAAActions.length > 0) {
    items.push({
      id: "learnAA",
      label: `Training (${info.learnAAActions.length} available)`,
      icon: "\u{1F4DA}", // Books
      shortcut: "T",
      className: "site-action-list__item--buy-aa",
      onActivate: () => ({ kind: "openAAOffer" }),
    });
  }

  // Buy City AA (Green City)
  if (info.buyCityAAActions.length > 0 || info.canBuyCityAAFromDeck) {
    items.push({
      id: "buyCityAA",
      label: "Buy Advanced Action",
      icon: "\u{1F4DA}", // Books
      shortcut: "T",
      className: "site-action-list__item--buy-aa",
      onActivate: () => ({ kind: "openAAOffer" }),
    });
  }

  // Buy Artifact (Red City)
  if (info.canBuyArtifact && info.buyArtifactAction) {
    const action = info.buyArtifactAction;
    items.push({
      id: "buyArtifact",
      label: "Buy Artifact (12 Inf)",
      icon: "\u{2728}", // Sparkles
      shortcut: "A",
      className: "site-action-list__item--buy-artifact",
      onActivate: () => ({ kind: "legalAction", action }),
    });
  }

  // Add Elite to Offer (White City)
  if (info.canAddElite && info.addEliteAction) {
    const action = info.addEliteAction;
    items.push({
      id: "addElite",
      label: "Add Elite to Offer (2 Inf)",
      icon: "\u{1F6E1}\uFE0F", // Shield
      shortcut: "U",
      className: "site-action-list__item--recruit",
      onActivate: () => ({ kind: "legalAction", action }),
    });
  }

  // Burn Monastery
  if (info.canBurnMonastery && info.burnAction) {
    const action = info.burnAction;
    items.push({
      id: "burn",
      label: "Burn Monastery",
      icon: "\u{1F525}", // Fire
      shortcut: "B",
      className: "site-action-list__item--burn",
      onActivate: () => ({ kind: "legalAction", action }),
    });
  }

  // Plunder
  if (info.canPlunder && info.plunderAction) {
    const action = info.plunderAction;
    items.push({
      id: "plunder",
      label: "Plunder Village",
      icon: "\u{1F4B0}", // Money bag
      shortcut: "P",
      className: "site-action-list__item--plunder",
      onActivate: () => ({ kind: "legalAction", action }),
    });
  }

  // Always show Details option
  items.push({
    id: "details",
    label: "Details",
    icon: "\u{1F4CB}", // Clipboard
    shortcut: "D",
    className: "site-action-list__item--details",
    onActivate: () => ({ kind: "openDetails" }),
  });

  return items;
}

export interface SiteActionListProps {
  /** Site action info derived from legal actions */
  siteInfo: SiteActionInfo;
  /** Screen position for the list (near hero) */
  position: { x: number; y: number };
  /** Called when user selects an action */
  onAction: (action: SiteAction) => void;
  /** Called when list should close */
  onClose: () => void;
}

export function SiteActionList({
  siteInfo,
  position,
  onAction,
  onClose,
}: SiteActionListProps) {
  const actionItems = buildActionItems(siteInfo);

  // Build shortcut map for keyboard handler
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (key === "escape" || key === " ") {
        event.preventDefault();
        onClose();
        return;
      }

      // Find matching action by shortcut key
      const match = actionItems.find(
        (item) => item.shortcut.toLowerCase() === key
      );
      if (match) {
        event.preventDefault();
        onAction(match.onActivate());
      }
    },
    [actionItems, onAction, onClose]
  );

  // Attach keyboard listener
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  // Position list near hero
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
                onClick={() => onAction(item.onActivate())}
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
