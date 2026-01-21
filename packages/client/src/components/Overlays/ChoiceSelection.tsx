import { useMemo, useCallback, useEffect } from "react";
import { RESOLVE_CHOICE_ACTION, UNDO_ACTION } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { useCardMenuPosition } from "../../context/CardMenuPositionContext";
import { useRegisterOverlay } from "../../contexts/OverlayContext";
import { PieMenu, type PieMenuItem } from "../CardActionMenu";
import { getCardSpriteStyle } from "../../utils/cardAtlas";
import "./ChoiceSelection.css";

// Format card ID for display (convert snake_case to Title Case)
function formatCardName(cardId: string): string {
  return cardId
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Map effect types to colors - using the fantasy/parchment palette
 * from CombatOverlay and CardActionMenu for visual consistency.
 *
 * Palette reference:
 * - Attack/Combat: Bronze #b87333, Copper #a06030
 * - Block/Defense: Verdigris #2e6b5a, Forest #1a4d3e
 * - Move: Earthy brown-green
 * - Influence: Dusty purple
 * - Heal: Moss green #8b9a6b
 * - Mana: Matches CardActionMenu's getManaColor
 */
function getEffectColor(type: string, description: string): string {
  const desc = description.toLowerCase();

  // Check for mana-related effects - match CardActionMenu palette
  if (desc.includes("red mana")) {
    return "rgba(110, 45, 40, 0.95)";  // Deep ruby
  }
  if (desc.includes("blue mana")) {
    return "rgba(40, 65, 100, 0.95)";  // Steel blue
  }
  if (desc.includes("green mana")) {
    return "rgba(40, 80, 55, 0.95)";   // Forest green
  }
  if (desc.includes("white mana")) {
    return "rgba(85, 85, 90, 0.95)";   // Ivory/silver
  }
  if (desc.includes("gold mana")) {
    return "rgba(100, 85, 40, 0.95)";  // Antique gold
  }
  if (desc.includes("black mana")) {
    return "rgba(40, 40, 50, 0.95)";   // Dark slate
  }

  // Check for combat effects - match CombatOverlay palette
  if (type.includes("attack") || desc.includes("attack")) {
    // Check for elemental attacks
    if (desc.includes("fire")) {
      return "rgba(160, 64, 48, 0.95)";  // Deep crimson
    }
    if (desc.includes("ice") || desc.includes("cold")) {
      return "rgba(74, 112, 144, 0.95)"; // Steel blue
    }
    // Default attack: Bronze/copper
    return "rgba(140, 90, 50, 0.95)";
  }
  if (type.includes("block") || desc.includes("block")) {
    // Check for elemental blocks
    if (desc.includes("fire")) {
      return "rgba(130, 70, 55, 0.95)";  // Burnt copper
    }
    // Default block: Verdigris/teal
    return "rgba(46, 90, 75, 0.95)";
  }

  // Check for movement - earthy brown-green
  if (type.includes("move") || desc.includes("move")) {
    return "rgba(70, 85, 55, 0.95)";
  }

  // Check for influence - dusty purple
  if (type.includes("influence") || desc.includes("influence")) {
    return "rgba(85, 65, 95, 0.95)";
  }

  // Check for healing - moss green
  if (type.includes("heal") || desc.includes("heal")) {
    return "rgba(100, 115, 75, 0.95)";
  }

  // Default - warm neutral brown (parchment theme)
  return "rgba(60, 55, 50, 0.95)";
}

// Get icon based on effect type/description
function getEffectIcon(type: string, description: string): string | undefined {
  const desc = description.toLowerCase();

  if (desc.includes("mana")) return "✦";
  if (desc.includes("attack")) return "⚔";
  if (desc.includes("block")) return "🛡";
  if (desc.includes("move")) return "→";
  if (desc.includes("influence")) return "★";
  if (desc.includes("heal")) return "♥";
  if (desc.includes("draw")) return "📜";

  return undefined;
}

// Format effect description into label + sublabel for pie menu
// E.g., "Gain blue mana" -> { label: "Blue", sublabel: "Mana" }
// E.g., "+3 Attack" -> { label: "+3", sublabel: "Attack" }
function formatEffectLabel(description: string): { label: string; sublabel?: string } {
  const desc = description.toLowerCase();

  // Mana effects: "Gain X mana"
  const manaMatch = desc.match(/gain (\w+) mana/);
  if (manaMatch && manaMatch[1]) {
    const color = manaMatch[1].charAt(0).toUpperCase() + manaMatch[1].slice(1);
    return { label: color, sublabel: "Mana" };
  }

  // Numeric effects: "+N Something" or "N Something"
  const numMatch = description.match(/^\+?(\d+)\s+(.+)$/);
  if (numMatch && numMatch[1] && numMatch[2]) {
    return { label: `+${numMatch[1]}`, sublabel: numMatch[2] };
  }

  // "Gain N Something"
  const gainMatch = description.match(/^Gain (\d+) (.+)$/i);
  if (gainMatch && gainMatch[1] && gainMatch[2]) {
    return { label: `+${gainMatch[1]}`, sublabel: gainMatch[2] };
  }

  // Short descriptions can just be the label
  if (description.length <= 12) {
    return { label: description };
  }

  // Fallback: first word as label, rest as sublabel
  const words = description.split(" ");
  if (words.length >= 2) {
    return { label: words[0] ?? description, sublabel: words.slice(1).join(" ") };
  }

  return { label: description };
}

// Calculate responsive pie size
function calculatePieSize(): number {
  const vmin = Math.min(window.innerWidth, window.innerHeight);
  return Math.max(280, Math.min(500, vmin * 0.45));
}

export function ChoiceSelection() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();
  const { position: savedPosition } = useCardMenuPosition();

  // Extract data before hooks (may be undefined if no pending choice)
  const pendingChoice = player?.pendingChoice;
  const cardId = pendingChoice?.cardId ?? "";
  const canUndo = state?.validActions.turn?.canUndo ?? false;
  const isInCombat = state?.combat !== null;

  // Register this component as an active overlay to disable background interactions
  // Must be called unconditionally - the hook handles the conditional registration
  useRegisterOverlay(!!pendingChoice);

  // All hooks must be called before any early returns
  const handleSelectChoice = useCallback((choiceIndex: number) => {
    sendAction({
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex,
    });
  }, [sendAction]);

  const handleUndo = useCallback(() => {
    sendAction({ type: UNDO_ACTION });
  }, [sendAction]);

  // Handle Escape key to undo (if available)
  useEffect(() => {
    if (!pendingChoice || !canUndo) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        sendAction({ type: UNDO_ACTION });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pendingChoice, canUndo, sendAction]);

  // Convert options to pie menu items
  const pieItems: PieMenuItem[] = useMemo(() => {
    const options = pendingChoice?.options ?? [];
    return options.map((option, index) => {
      // Try to create a short label with sublabel for longer descriptions
      const { label, sublabel } = formatEffectLabel(option.description);
      return {
        id: String(index),
        label,
        sublabel,
        icon: getEffectIcon(option.type, option.description),
        color: getEffectColor(option.type, option.description),
      };
    });
  }, [pendingChoice?.options]);

  const handlePieSelect = useCallback((id: string) => {
    const index = parseInt(id, 10);
    if (!isNaN(index)) {
      handleSelectChoice(index);
    }
  }, [handleSelectChoice]);

  const pieSize = useMemo(() => calculatePieSize(), []);
  const cardHeight = Math.floor(pieSize * 0.42 * 2 * 0.65);
  const cardStyle = useMemo(() => {
    if (!cardId) return null;
    return getCardSpriteStyle(cardId, cardHeight);
  }, [cardId, cardHeight]);

  // Don't render if no pending choice (after all hooks)
  if (!pendingChoice) {
    return null;
  }

  // Use saved position from CardActionMenu if available, otherwise center
  const menuStyle: React.CSSProperties = savedPosition
    ? { left: savedPosition.x, top: savedPosition.y }
    : {};

  const containerClass = savedPosition
    ? "choice-selection choice-selection--positioned"
    : "choice-selection choice-selection--centered";

  // Use a more subtle overlay when in combat so the combat scene stays visible
  const overlayClass = isInCombat
    ? "choice-selection-overlay choice-selection-overlay--combat"
    : "choice-selection-overlay";

  return (
    <div className={overlayClass} onClick={canUndo ? handleUndo : undefined}>
      <div className={containerClass} style={menuStyle} onClick={(e) => e.stopPropagation()}>
        {/* Card in center */}
        <div className="choice-selection__card" style={cardStyle ?? undefined} />

        {/* Title above the pie */}
        <div className="choice-selection__title">
          {formatCardName(cardId)}
        </div>

        {/* Pie menu around the card */}
        <div className="choice-selection__pie">
          <PieMenu
            items={pieItems}
            onSelect={handlePieSelect}
            onCancel={canUndo ? handleUndo : () => {}}
            size={pieSize}
            innerRadius={0.38}
            centerContent={canUndo ? <span>Undo</span> : undefined}
          />
        </div>
      </div>
    </div>
  );
}
