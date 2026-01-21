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

// Map effect types to colors for visual distinction
function getEffectColor(type: string, description: string): string {
  // Check for mana-related effects
  if (description.toLowerCase().includes("red mana")) {
    return "rgba(140, 50, 50, 0.95)";
  }
  if (description.toLowerCase().includes("blue mana")) {
    return "rgba(40, 80, 130, 0.95)";
  }
  if (description.toLowerCase().includes("green mana")) {
    return "rgba(40, 100, 60, 0.95)";
  }
  if (description.toLowerCase().includes("white mana")) {
    return "rgba(100, 100, 110, 0.95)";
  }
  if (description.toLowerCase().includes("gold mana")) {
    return "rgba(120, 100, 40, 0.95)";
  }
  if (description.toLowerCase().includes("black mana")) {
    return "rgba(50, 50, 60, 0.95)";
  }

  // Check for combat effects
  if (type.includes("attack") || description.toLowerCase().includes("attack")) {
    return "rgba(180, 60, 60, 0.95)";
  }
  if (type.includes("block") || description.toLowerCase().includes("block")) {
    return "rgba(60, 100, 180, 0.95)";
  }

  // Check for movement/influence
  if (type.includes("move") || description.toLowerCase().includes("move")) {
    return "rgba(100, 140, 80, 0.95)";
  }
  if (type.includes("influence") || description.toLowerCase().includes("influence")) {
    return "rgba(140, 100, 160, 0.95)";
  }

  // Check for healing
  if (type.includes("heal") || description.toLowerCase().includes("heal")) {
    return "rgba(80, 160, 80, 0.95)";
  }

  // Default
  return "rgba(70, 70, 80, 0.95)";
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
