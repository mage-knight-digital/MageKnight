import { useState, useCallback, useMemo, useEffect } from "react";
import type { CardId, PlayableCard, SidewaysAs, ManaSourceInfo } from "@mage-knight/shared";
import {
  PLAY_SIDEWAYS_AS_MOVE,
  PLAY_SIDEWAYS_AS_INFLUENCE,
  PLAY_SIDEWAYS_AS_ATTACK,
  PLAY_SIDEWAYS_AS_BLOCK,
  MANA_SOURCE_DIE,
  MANA_SOURCE_CRYSTAL,
  MANA_SOURCE_TOKEN,
} from "@mage-knight/shared";
import { getCardSpriteStyle } from "../../utils/cardAtlas";
import { useCardMenuPosition } from "../../context/CardMenuPositionContext";
import { PieMenu, type PieMenuItem } from "./PieMenu";
import "./CardActionMenu.css";

export interface CardActionMenuProps {
  cardId: CardId;
  playability: PlayableCard;
  isInCombat: boolean;
  sourceRect: DOMRect; // Where the card was clicked in the hand
  manaSources: ManaSourceInfo[]; // Available mana sources for powered play
  onPlayBasic: () => void;
  onPlayPowered: (manaSource: ManaSourceInfo) => void;
  onPlaySideways: (as: SidewaysAs) => void;
  onCancel: () => void;
}

type MenuState =
  | { type: "action-select" }
  | { type: "mana-select"; pendingManaColor: string };

interface ActionOption {
  id: string;
  label: string;
  sublabel?: string;
  type: "basic" | "powered" | "sideways";
  sidewaysAs?: SidewaysAs;
}

export function CardActionMenu({
  cardId,
  playability,
  isInCombat,
  sourceRect,
  manaSources,
  onPlayBasic,
  onPlayPowered,
  onPlaySideways,
  onCancel,
}: CardActionMenuProps) {
  const [menuState, setMenuState] = useState<MenuState>({ type: "action-select" });
  const { setPosition } = useCardMenuPosition();

  // Calculate responsive sizes based on viewport
  const [sizes, setSizes] = useState(() => calculateSizes());

  useEffect(() => {
    const handleResize = () => setSizes(calculateSizes());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const spriteStyle = useMemo(() => getCardSpriteStyle(cardId, sizes.cardHeight), [cardId, sizes.cardHeight]);

  // Build action options based on playability and context
  // Order matters for spatial alignment with card:
  // - Basic at top (12 o'clock) - aligns with top half of card
  // - Sideways on sides
  // - Powered at bottom (6 o'clock) - aligns with bottom half of card
  const actionOptions = useMemo((): ActionOption[] => {
    const basic: ActionOption | null = playability.canPlayBasic
      ? { id: "basic", label: "Basic", type: "basic" }
      : null;

    const powered: ActionOption | null = playability.canPlayPowered
      ? {
          id: "powered",
          label: "Powered",
          sublabel: playability.requiredMana ? `(${playability.requiredMana})` : undefined,
          type: "powered",
        }
      : null;

    const sideways: ActionOption[] = [];
    if (playability.canPlaySideways) {
      const sidewaysOptions = playability.sidewaysOptions ?? [];

      if (sidewaysOptions.length > 0) {
        for (const opt of sidewaysOptions) {
          sideways.push({
            id: `sideways-${opt.as}`,
            label: `+${opt.value}`,
            sublabel: getSidewaysLabel(opt.as, isInCombat),
            type: "sideways",
            sidewaysAs: opt.as,
          });
        }
      } else if (!isInCombat) {
        sideways.push({
          id: "sideways-move",
          label: "+1",
          sublabel: "Move",
          type: "sideways",
          sidewaysAs: PLAY_SIDEWAYS_AS_MOVE,
        });
        sideways.push({
          id: "sideways-influence",
          label: "+1",
          sublabel: "Influence",
          type: "sideways",
          sidewaysAs: PLAY_SIDEWAYS_AS_INFLUENCE,
        });
      }
    }

    // Arrange: Basic (top), sideways split on sides, Powered (bottom)
    // The pie menu starts at top and goes clockwise
    //
    // For consistent positioning, we always want 4 slots when we have both
    // sideways options, so Powered stays at the bottom (180°):
    //   - Top (0°): Basic
    //   - Right (90°): Move
    //   - Bottom (180°): Powered
    //   - Left (270°): Influence
    //
    // If Basic is unavailable, we still need 4 slots to keep Powered at bottom,
    // so we add a disabled placeholder.

    const options: ActionOption[] = [];

    // Always include Basic slot (even if disabled) when we have 2 sideways options
    // This keeps the 4-way layout consistent
    if (basic) {
      options.push(basic);
    } else if (sideways.length >= 2 && powered) {
      // Add disabled placeholder to maintain positioning
      options.push({
        id: "basic-disabled",
        label: "Basic",
        type: "basic",
        // Mark as disabled - we'll handle this in the pie item conversion
      });
    }

    // Split sideways: first half on right side, second half on left side
    const midpoint = Math.ceil(sideways.length / 2);
    const rightSideways = sideways.slice(0, midpoint);
    const leftSideways = sideways.slice(midpoint);

    options.push(...rightSideways);
    if (powered) options.push(powered);
    options.push(...leftSideways);

    return options;
  }, [playability, isInCombat]);

  // Convert action options to pie menu items
  const actionPieItems = useMemo((): PieMenuItem[] => {
    return actionOptions.map((opt) => ({
      id: opt.id,
      label: opt.label,
      sublabel: opt.sublabel,
      color: getActionColor(opt.type),
      disabled: opt.id === "basic-disabled",
    }));
  }, [actionOptions]);

  // Convert mana sources to pie menu items
  const manaPieItems = useMemo((): PieMenuItem[] => {
    return manaSources.map((source, index) => ({
      id: `${source.type}-${source.color}-${index}`,
      label: getManaSourceLabel(source),
      sublabel: getManaSourceTypeLabel(source),
      icon: getManaSourceIcon(source),
      color: getManaColor(source.color),
    }));
  }, [manaSources]);

  const handleActionSelect = useCallback((id: string) => {
    const option = actionOptions.find((o) => o.id === id);
    if (!option) return;

    if (option.type === "basic") {
      onPlayBasic();
    } else if (option.type === "powered") {
      // If only one mana source, auto-select it
      if (manaSources.length === 1 && manaSources[0]) {
        onPlayPowered(manaSources[0]);
      } else {
        // Transition to mana selection
        setMenuState({
          type: "mana-select",
          pendingManaColor: playability.requiredMana ?? "any"
        });
      }
    } else if (option.type === "sideways" && option.sidewaysAs) {
      onPlaySideways(option.sidewaysAs);
    }
  }, [actionOptions, onPlayBasic, onPlayPowered, onPlaySideways, manaSources, playability.requiredMana]);

  const handleManaSelect = useCallback((id: string) => {
    // Parse the ID to find the source
    const index = manaSources.findIndex((source, idx) =>
      `${source.type}-${source.color}-${idx}` === id
    );
    const source = manaSources[index];
    if (source) {
      onPlayPowered(source);
    }
  }, [manaSources, onPlayPowered]);

  const handleBackToActions = useCallback(() => {
    setMenuState({ type: "action-select" });
  }, []);

  // Calculate menu position - centered on the card's current position
  // The card shouldn't move much - the pie menu appears around it
  const menuPosition = useMemo(() => {
    const padding = sizes.pieSize / 2 + 20;

    // Center on the card
    let menuX = sourceRect.left + sourceRect.width / 2;
    let menuY = sourceRect.top + sourceRect.height / 2;

    // Clamp to keep menu fully on screen
    menuX = Math.max(padding, Math.min(window.innerWidth - padding, menuX));
    menuY = Math.max(padding, Math.min(window.innerHeight - padding, menuY));

    return { x: menuX, y: menuY };
  }, [sourceRect, sizes.pieSize]);

  // Store menu position in context so subsequent overlays (like ChoiceSelection)
  // can appear at the same location, maintaining spatial continuity
  // Note: We intentionally don't clear on unmount - the next overlay needs this position
  useEffect(() => {
    setPosition(menuPosition);
  }, [menuPosition, setPosition]);

  // Calculate the animation starting position relative to menu position
  const animationVars = useMemo(() => {
    // Center of the source card in the hand
    const sourceX = sourceRect.left + sourceRect.width / 2;
    const sourceY = sourceRect.top + sourceRect.height / 2;

    // Offset from menu center (where the card needs to start)
    const startOffsetX = sourceX - menuPosition.x;
    const startOffsetY = sourceY - menuPosition.y;

    // Scale: source card size vs final card size
    const startScale = sourceRect.height / sizes.cardHeight;

    return {
      "--start-x": `${startOffsetX}px`,
      "--start-y": `${startOffsetY}px`,
      "--start-scale": startScale,
    } as React.CSSProperties;
  }, [sourceRect, sizes.cardHeight, menuPosition]);

  // Card style for the center preview
  const cardStyle: React.CSSProperties = {
    ...spriteStyle,
    ...animationVars,
  };

  // Position the menu container
  const menuContainerStyle: React.CSSProperties = {
    left: menuPosition.x,
    top: menuPosition.y,
  };

  return (
    <div className="card-action-menu-overlay" onClick={onCancel}>
      <div className="card-action-menu" style={menuContainerStyle} onClick={(e) => e.stopPropagation()}>
        {/* The card itself - animates from hand position to center */}
        <div className="card-action-menu__card" style={cardStyle}>
          {menuState.type === "mana-select" && (
            <div className="card-action-menu__charging-indicator" />
          )}
        </div>

        {/* Pie menu wrapper - positioned around the card */}
        <div className="card-action-menu__pie-wrapper">
          {menuState.type === "action-select" && (
            <PieMenu
              items={actionPieItems}
              onSelect={handleActionSelect}
              onCancel={onCancel}
              size={sizes.pieSize}
              innerRadius={0.42}
              centerContent={<span>Cancel</span>}
            />
          )}

          {menuState.type === "mana-select" && (
            <PieMenu
              items={manaPieItems}
              onSelect={handleManaSelect}
              onCancel={handleBackToActions}
              size={sizes.pieSize}
              innerRadius={0.42}
              centerContent={<span>Back</span>}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function getSidewaysLabel(as: SidewaysAs, isInCombat: boolean): string {
  if (!isInCombat) {
    switch (as) {
      case PLAY_SIDEWAYS_AS_MOVE:
        return "Move";
      case PLAY_SIDEWAYS_AS_INFLUENCE:
        return "Influence";
      default:
        return "";
    }
  }
  switch (as) {
    case PLAY_SIDEWAYS_AS_ATTACK:
      return "Attack";
    case PLAY_SIDEWAYS_AS_BLOCK:
      return "Block";
    default:
      return "";
  }
}

function getActionColor(type: "basic" | "powered" | "sideways"): string {
  switch (type) {
    case "basic":
      return "rgba(80, 80, 90, 0.95)";
    case "powered":
      return "rgba(90, 60, 130, 0.95)";
    case "sideways":
      return "rgba(60, 90, 130, 0.95)";
  }
}

function getManaColor(color: string): string {
  switch (color) {
    case "red":
      return "rgba(140, 50, 50, 0.95)";
    case "blue":
      return "rgba(40, 80, 130, 0.95)";
    case "green":
      return "rgba(40, 100, 60, 0.95)";
    case "white":
      return "rgba(100, 100, 110, 0.95)";
    case "gold":
      return "rgba(120, 100, 40, 0.95)";
    case "black":
      return "rgba(50, 50, 60, 0.95)";
    default:
      return "rgba(60, 60, 70, 0.95)";
  }
}

function getManaSourceIcon(source: ManaSourceInfo): string {
  switch (source.type) {
    case MANA_SOURCE_DIE:
      return "🎲";
    case MANA_SOURCE_CRYSTAL:
      return "💎";
    case MANA_SOURCE_TOKEN:
      return "●";
    default:
      return "?";
  }
}

function getManaSourceLabel(source: ManaSourceInfo): string {
  return source.color.charAt(0).toUpperCase() + source.color.slice(1);
}

function getManaSourceTypeLabel(source: ManaSourceInfo): string {
  switch (source.type) {
    case MANA_SOURCE_DIE:
      return "Die";
    case MANA_SOURCE_CRYSTAL:
      return "Crystal";
    case MANA_SOURCE_TOKEN:
      return "Token";
    default:
      return "";
  }
}

/**
 * Calculate responsive sizes based on viewport dimensions.
 * Uses the smaller of width/height (vmin-like behavior) to ensure
 * the menu fits on screen regardless of aspect ratio.
 */
function calculateSizes() {
  const vmin = Math.min(window.innerWidth, window.innerHeight);

  // Pie menu takes up ~50% of the smaller viewport dimension
  // Clamp between 300px (minimum usable) and 600px (maximum comfortable)
  const pieSize = Math.max(300, Math.min(600, vmin * 0.5));

  // Card height is proportional to pie size
  // Inner radius is 0.42, so inner diameter is 0.84 * pieSize
  // Card should fit comfortably inside with some padding
  const innerDiameter = pieSize * 0.42 * 2;
  const cardHeight = Math.floor(innerDiameter * 0.7); // 70% of inner area

  return { pieSize, cardHeight };
}
