import { useState, useCallback, useMemo, useEffect } from "react";
import { useRegisterOverlay } from "../../contexts/OverlayContext";
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
import { playSound } from "../../utils/audioManager";
import { PieMenu, type PieMenuItem } from "./PieMenu";
import "./CardActionMenu.css";

export interface CardActionMenuProps {
  cardId: CardId;
  playability: PlayableCard;
  isInCombat: boolean;
  sourceRect: DOMRect; // Where the card was clicked in the hand
  manaSources: ManaSourceInfo[]; // Available mana sources for powered play
  /** Scale multiplier for the menu (e.g., 1.5 for focus mode) */
  sizeMultiplier?: number;
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
  weight: number; // Relative wedge size (2 for main actions, 1 for sideways)
  disabled: boolean;
}

export function CardActionMenu({
  cardId,
  playability,
  isInCombat,
  sourceRect,
  manaSources,
  sizeMultiplier = 1,
  onPlayBasic,
  onPlayPowered,
  onPlaySideways,
  onCancel,
}: CardActionMenuProps) {
  // Register this component as an active overlay to disable background interactions
  useRegisterOverlay(true);

  const [menuState, setMenuState] = useState<MenuState>({ type: "action-select" });
  const { setPosition } = useCardMenuPosition();

  // Calculate responsive sizes based on viewport and size multiplier
  const [sizes, setSizes] = useState(() => calculateSizes(sizeMultiplier));

  useEffect(() => {
    const handleResize = () => setSizes(calculateSizes(sizeMultiplier));
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sizeMultiplier]);

  // Handle Escape key to dismiss the menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const spriteStyle = useMemo(() => getCardSpriteStyle(cardId, sizes.cardHeight), [cardId, sizes.cardHeight]);

  // Build action options - ALWAYS 6 fixed slots for consistent positioning
  // Clockwise from top:
  //   1. Basic (top, weight 2) - main action
  //   2. Attack (top-right, weight 1) - combat sideways
  //   3. Block (bottom-right, weight 1) - combat sideways
  //   4. Powered (bottom, weight 2) - main action
  //   5. Influence (bottom-left, weight 1) - exploration sideways
  //   6. Move (top-left, weight 1) - exploration sideways
  //
  // This creates consistent muscle memory:
  // - Main actions (Basic/Powered) are large wedges at top/bottom
  // - Combat options (Attack/Block) on right side
  // - Exploration options (Move/Influence) on left side
  // - Unavailable options are shown but disabled
  const actionOptions = useMemo((): ActionOption[] => {
    // Get sideways values from playability (may have modifiers like Pathfinding)
    const sidewaysOptions = playability.sidewaysOptions ?? [];
    const getSidewaysValue = (type: SidewaysAs): number => {
      const opt = sidewaysOptions.find(o => o.as === type);
      return opt?.value ?? 1;
    };

    // Check what's actually available
    const canBasic = playability.canPlayBasic;
    const canPowered = playability.canPlayPowered;
    const canSideways = playability.canPlaySideways;

    // Combat sideways (attack/block) only available in combat
    const canAttack = canSideways && isInCombat;
    const canBlock = canSideways && isInCombat;

    // Exploration sideways (move/influence) only available outside combat
    const canMove = canSideways && !isInCombat;
    const canInfluence = canSideways && !isInCombat;

    return [
      // 1. Basic (top)
      {
        id: "basic",
        label: "Basic",
        type: "basic" as const,
        weight: 2,
        disabled: !canBasic,
      },
      // 2. Attack (top-right)
      {
        id: "sideways-attack",
        label: `+${getSidewaysValue(PLAY_SIDEWAYS_AS_ATTACK)}`,
        sublabel: "Attack",
        type: "sideways" as const,
        sidewaysAs: PLAY_SIDEWAYS_AS_ATTACK,
        weight: 1,
        disabled: !canAttack,
      },
      // 3. Block (bottom-right)
      {
        id: "sideways-block",
        label: `+${getSidewaysValue(PLAY_SIDEWAYS_AS_BLOCK)}`,
        sublabel: "Block",
        type: "sideways" as const,
        sidewaysAs: PLAY_SIDEWAYS_AS_BLOCK,
        weight: 1,
        disabled: !canBlock,
      },
      // 4. Powered (bottom)
      {
        id: "powered",
        label: "Powered",
        sublabel: playability.requiredMana ? `(${playability.requiredMana})` : undefined,
        type: "powered" as const,
        weight: 2,
        disabled: !canPowered,
      },
      // 5. Influence (bottom-left)
      {
        id: "sideways-influence",
        label: `+${getSidewaysValue(PLAY_SIDEWAYS_AS_INFLUENCE)}`,
        sublabel: "Influence",
        type: "sideways" as const,
        sidewaysAs: PLAY_SIDEWAYS_AS_INFLUENCE,
        weight: 1,
        disabled: !canInfluence,
      },
      // 6. Move (top-left)
      {
        id: "sideways-move",
        label: `+${getSidewaysValue(PLAY_SIDEWAYS_AS_MOVE)}`,
        sublabel: "Move",
        type: "sideways" as const,
        sidewaysAs: PLAY_SIDEWAYS_AS_MOVE,
        weight: 1,
        disabled: !canMove,
      },
    ];
  }, [playability, isInCombat]);

  // Convert action options to pie menu items with weights
  const actionPieItems = useMemo((): PieMenuItem[] => {
    return actionOptions.map((opt) => ({
      id: opt.id,
      label: opt.label,
      sublabel: opt.sublabel,
      color: getActionColor(opt.type, opt.disabled),
      disabled: opt.disabled,
      weight: opt.weight,
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
    // Handle cancel option
    if (id === "cancel") {
      onCancel();
      return;
    }

    const option = actionOptions.find((o) => o.id === id);
    if (!option) return;

    // Play satisfying card play sound
    playSound("cardPlay");

    if (option.type === "basic") {
      onPlayBasic();
    } else if (option.type === "powered") {
      // If no mana sources provided, call onPlayPowered with no argument
      // This is used by spells which handle their own two-step mana selection
      if (manaSources.length === 0) {
        (onPlayPowered as () => void)();
      } else if (manaSources.length === 1 && manaSources[0]) {
        // If only one mana source, auto-select it
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
  }, [actionOptions, onPlayBasic, onPlayPowered, onPlaySideways, onCancel, manaSources, playability.requiredMana]);

  const handleManaSelect = useCallback((id: string) => {
    // Parse the ID to find the source
    const index = manaSources.findIndex((source, idx) =>
      `${source.type}-${source.color}-${idx}` === id
    );
    const source = manaSources[index];
    if (source) {
      // Play satisfying card play sound
      playSound("cardPlay");
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

function getActionColor(type: "basic" | "powered" | "sideways", disabled?: boolean): string {
  // Parchment/fantasy colors - warm browns with subtle color coding
  // Disabled items get a much darker, desaturated color
  if (disabled) {
    return "rgba(35, 35, 40, 0.85)";
  }

  switch (type) {
    case "basic":
      // Neutral warm brown - reliable, straightforward
      return "rgba(60, 50, 40, 0.95)";
    case "powered":
      // Rich purple - magical, powerful
      return "rgba(70, 50, 80, 0.95)";
    case "sideways":
      // Muted blue/teal - versatile, adaptive
      return "rgba(45, 60, 75, 0.95)";
  }
}

function getManaColor(color: string): string {
  // Parchment-style mana colors - richer, more saturated
  switch (color) {
    case "red":
      return "rgba(110, 45, 40, 0.95)";
    case "blue":
      return "rgba(40, 65, 100, 0.95)";
    case "green":
      return "rgba(40, 80, 55, 0.95)";
    case "white":
      return "rgba(85, 85, 90, 0.95)";
    case "gold":
      return "rgba(100, 85, 40, 0.95)";
    case "black":
      return "rgba(40, 40, 50, 0.95)";
    default:
      return "rgba(55, 45, 35, 0.95)";
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
 *
 * @param multiplier - Scale multiplier (e.g., 1.4 for focus mode)
 */
function calculateSizes(multiplier: number = 1) {
  const vmin = Math.min(window.innerWidth, window.innerHeight);

  // Base pie menu takes up ~50% of the smaller viewport dimension
  // Apply multiplier for focus mode (larger cards = larger menu)
  const baseSize = vmin * 0.5 * multiplier;

  // Clamp between 300px (minimum usable) and 750px (maximum comfortable)
  const pieSize = Math.max(300, Math.min(750, baseSize));

  // Card height is proportional to pie size
  // Inner radius is 0.42, so inner diameter is 0.84 * pieSize
  // Card should fit comfortably inside with some padding
  const innerDiameter = pieSize * 0.42 * 2;
  const cardHeight = Math.floor(innerDiameter * 0.7); // 70% of inner area

  return { pieSize, cardHeight };
}
