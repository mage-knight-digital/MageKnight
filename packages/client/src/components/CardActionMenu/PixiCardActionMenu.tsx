/**
 * PixiCardActionMenu - Pie menu with card in center
 *
 * A juicy pie menu for card actions. The card (rendered by the hand) sits
 * on top of the center, with curved wedges arranged around it.
 *
 * Layout (clockwise from top):
 *   Basic (top) → Attack (right-top) → Block (right-bottom) →
 *   Powered (bottom) → Influence (left-bottom) → Move (left-top)
 */

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { Application, Container, Graphics, Text, BlurFilter } from "pixi.js";
import type { CardId, PlayableCard, SidewaysAs, ManaSourceInfo } from "@mage-knight/shared";
import {
  PLAY_SIDEWAYS_AS_MOVE,
  PLAY_SIDEWAYS_AS_INFLUENCE,
  PLAY_SIDEWAYS_AS_ATTACK,
  PLAY_SIDEWAYS_AS_BLOCK,
  MANA_SOURCE_DIE,
  MANA_SOURCE_CRYSTAL,
} from "@mage-knight/shared";
import { useRegisterOverlay } from "../../contexts/OverlayContext";
import { useCardMenuPosition } from "../../context/CardMenuPositionContext";
import { playSound } from "../../utils/audioManager";
import { AnimationManager, Easing } from "../GameBoard/pixi/animations";

// ============================================
// Types
// ============================================

export interface PixiCardActionMenuProps {
  cardId: CardId;
  playability: PlayableCard;
  isInCombat: boolean;
  sourceRect: DOMRect;
  manaSources: ManaSourceInfo[];
  sizeMultiplier?: number;
  onPlayBasic: () => void;
  onPlayPowered: (manaSource: ManaSourceInfo) => void;
  onPlaySideways: (as: SidewaysAs) => void;
  onCancel: () => void;
}

interface ActionOption {
  id: string;
  label: string;
  sublabel?: string;
  type: "basic" | "powered" | "sideways";
  sidewaysAs?: SidewaysAs;
  weight: number;
  disabled: boolean;
  color: number;
  hoverColor: number;
}

interface WedgeData extends ActionOption {
  startAngle: number;
  endAngle: number;
  midAngle: number;
}

type MenuState =
  | { type: "action-select" }
  | { type: "mana-select"; pendingManaColor: string };

// ============================================
// Constants
// ============================================

const COLORS = {
  BASIC: 0x3c3228,
  BASIC_HOVER: 0x554638,
  POWERED: 0x463250,
  POWERED_HOVER: 0x5f466e,
  SIDEWAYS: 0x2d3c4b,
  SIDEWAYS_HOVER: 0x3c5064,
  DISABLED: 0x232328,
  DISABLED_HOVER: 0x232328,
  STROKE: 0x5c4a3a,
  STROKE_HOVER: 0xb49664,
  TEXT: 0xf0e6d2,
  TEXT_DISABLED: 0x666666,
  GLOW: 0xffc864,
};

const MANA_COLORS: Record<string, { fill: number; hover: number; stroke: number }> = {
  red: { fill: 0x6e2d28, hover: 0x8c3c32, stroke: 0xe76450 },
  blue: { fill: 0x284164, hover: 0x325582, stroke: 0x5096dc },
  green: { fill: 0x285037, hover: 0x326946, stroke: 0x50c878 },
  white: { fill: 0x55555a, hover: 0x737378, stroke: 0xf0f0f5 },
  gold: { fill: 0x645528, hover: 0x826e32, stroke: 0xf1c432 },
  black: { fill: 0x282832, hover: 0x373746, stroke: 0x8c8ca0 },
};

// Card dimensions - must match PixiFloatingHand calculations
const CARD_ASPECT = 0.667;
const CARD_FAN_BASE_SCALE = 0.25; // From cardFanLayout.ts
const MENU_CARD_SCALE = 1.4; // Card scales up 40% when in menu

function polarToCartesian(radius: number, angle: number) {
  return {
    x: radius * Math.cos(angle),
    y: radius * Math.sin(angle),
  };
}

function getActionColors(type: "basic" | "powered" | "sideways", disabled: boolean): { color: number; hoverColor: number } {
  if (disabled) {
    return { color: COLORS.DISABLED, hoverColor: COLORS.DISABLED_HOVER };
  }
  switch (type) {
    case "basic":
      return { color: COLORS.BASIC, hoverColor: COLORS.BASIC_HOVER };
    case "powered":
      return { color: COLORS.POWERED, hoverColor: COLORS.POWERED_HOVER };
    case "sideways":
      return { color: COLORS.SIDEWAYS, hoverColor: COLORS.SIDEWAYS_HOVER };
  }
}

// ============================================
// Component
// ============================================

export function PixiCardActionMenu({
  cardId: _cardId,
  playability,
  isInCombat,
  sourceRect: _sourceRect,
  manaSources,
  sizeMultiplier = 1,
  onPlayBasic,
  onPlayPowered,
  onPlaySideways,
  onCancel,
}: PixiCardActionMenuProps) {
  useRegisterOverlay(true);
  const { setPosition } = useCardMenuPosition();

  const [menuState, setMenuState] = useState<MenuState>({ type: "action-select" });

  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const animManagerRef = useRef<AnimationManager | null>(null);
  const isDestroyedRef = useRef(false);
  const hoveredWedgeRef = useRef<number | null>(null);
  const wedgeContainersRef = useRef<Container[]>([]);

  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  // Menu position: screen center
  const menuPosition = useMemo(() => {
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }, []);

  // Calculate sizes based on viewport and card
  // Must match PixiFloatingHand: cardHeight = screenHeight * CARD_FAN_BASE_SCALE * MENU_CARD_SCALE
  const sizes = useMemo(() => {
    const screenHeight = window.innerHeight;
    const screenWidth = window.innerWidth;
    const vmin = Math.min(screenWidth, screenHeight);
    // Card size matches the hand's scaled-up card in menu mode
    const cardHeight = Math.round(screenHeight * CARD_FAN_BASE_SCALE * MENU_CARD_SCALE * sizeMultiplier);
    const cardWidth = Math.round(cardHeight * CARD_ASPECT);
    // Inner radius: 0 for full pie slices, card sits on top covering the center
    const innerRadius = 0;
    // Card covers a circular area roughly equal to its half-diagonal
    const cardCoverRadius = Math.max(cardWidth, cardHeight) / 2;
    // Outer radius: extend past the card with visible wedge area
    const wedgeVisibleThickness = Math.max(90, vmin * 0.13);
    const outerRadius = cardCoverRadius + wedgeVisibleThickness;
    // Font sizes scale with viewport (vmin-based)
    // Base: ~18px on 1080p, ~24px on 1440p, ~36px on 4K
    const labelFontSize = Math.round(Math.max(16, vmin * 0.018));
    const sublabelFontSize = Math.round(Math.max(12, vmin * 0.012));
    return { cardWidth, cardHeight, innerRadius, outerRadius, cardCoverRadius, labelFontSize, sublabelFontSize };
  }, [sizeMultiplier]);

  useEffect(() => {
    setPosition(menuPosition);
  }, [menuPosition, setPosition]);

  // Escape key handler
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

  // Build action options (6 wedges)
  const actionOptions = useMemo((): ActionOption[] => {
    const sidewaysOptions = playability.sidewaysOptions ?? [];
    const getSidewaysValue = (type: SidewaysAs): number => {
      const opt = sidewaysOptions.find(o => o.as === type);
      return opt?.value ?? 1;
    };

    const canBasic = playability.canPlayBasic;
    const canPowered = playability.canPlayPowered;
    const canSideways = playability.canPlaySideways;
    const canAttack = canSideways && isInCombat;
    const canBlock = canSideways && isInCombat;
    const canMove = canSideways && !isInCombat;
    const canInfluence = canSideways && !isInCombat;

    // Order: Basic (top), Attack (right-top), Block (right-bottom),
    //        Powered (bottom), Influence (left-bottom), Move (left-top)
    return [
      {
        id: "basic",
        label: "Basic",
        type: "basic" as const,
        weight: 1.5, // Slightly larger
        disabled: !canBasic,
        ...getActionColors("basic", !canBasic),
      },
      {
        id: "sideways-attack",
        label: `+${getSidewaysValue(PLAY_SIDEWAYS_AS_ATTACK)}`,
        sublabel: "Attack",
        type: "sideways" as const,
        sidewaysAs: PLAY_SIDEWAYS_AS_ATTACK,
        weight: 1,
        disabled: !canAttack,
        ...getActionColors("sideways", !canAttack),
      },
      {
        id: "sideways-block",
        label: `+${getSidewaysValue(PLAY_SIDEWAYS_AS_BLOCK)}`,
        sublabel: "Block",
        type: "sideways" as const,
        sidewaysAs: PLAY_SIDEWAYS_AS_BLOCK,
        weight: 1,
        disabled: !canBlock,
        ...getActionColors("sideways", !canBlock),
      },
      {
        id: "powered",
        label: "Powered",
        sublabel: playability.requiredMana ? `(${playability.requiredMana})` : undefined,
        type: "powered" as const,
        weight: 1.5,
        disabled: !canPowered,
        ...getActionColors("powered", !canPowered),
      },
      {
        id: "sideways-influence",
        label: `+${getSidewaysValue(PLAY_SIDEWAYS_AS_INFLUENCE)}`,
        sublabel: "Influence",
        type: "sideways" as const,
        sidewaysAs: PLAY_SIDEWAYS_AS_INFLUENCE,
        weight: 1,
        disabled: !canInfluence,
        ...getActionColors("sideways", !canInfluence),
      },
      {
        id: "sideways-move",
        label: `+${getSidewaysValue(PLAY_SIDEWAYS_AS_MOVE)}`,
        sublabel: "Move",
        type: "sideways" as const,
        sidewaysAs: PLAY_SIDEWAYS_AS_MOVE,
        weight: 1,
        disabled: !canMove,
        ...getActionColors("sideways", !canMove),
      },
    ];
  }, [playability, isInCombat]);

  // Build mana options
  const manaOptions = useMemo((): ActionOption[] => {
    return manaSources.map((source, index) => {
      const colors = MANA_COLORS[source.color as keyof typeof MANA_COLORS] ?? MANA_COLORS["white"];
      const icon = source.type === MANA_SOURCE_DIE ? "Die" :
                   source.type === MANA_SOURCE_CRYSTAL ? "Crystal" : "Token";
      return {
        id: `${source.type}-${source.color}-${index}`,
        label: source.color.charAt(0).toUpperCase() + source.color.slice(1),
        sublabel: icon,
        type: "basic" as const,
        weight: 1,
        disabled: false,
        color: colors?.fill ?? 0x55555a,
        hoverColor: colors?.hover ?? 0x737378,
      };
    });
  }, [manaSources]);

  // Calculate wedge geometry
  const calculateWedges = useCallback((options: ActionOption[]): WedgeData[] => {
    if (options.length === 0) return [];

    const totalWeight = options.reduce((sum, item) => sum + item.weight, 0);
    // Start from top (-π/2), offset by half of first wedge so it centers at top
    const firstWeight = options[0]?.weight ?? 1;
    const firstAngle = (firstWeight / totalWeight) * (2 * Math.PI);
    let currentAngle = -Math.PI / 2 - firstAngle / 2;

    return options.map((option) => {
      const angleSpan = (option.weight / totalWeight) * (2 * Math.PI);
      const startAngle = currentAngle;
      const endAngle = currentAngle + angleSpan;
      const midAngle = (startAngle + endAngle) / 2;
      currentAngle = endAngle;

      return {
        ...option,
        startAngle,
        endAngle,
        midAngle,
      };
    });
  }, []);

  // Handle action selection
  const handleActionSelect = useCallback((id: string) => {
    const option = actionOptions.find(o => o.id === id);
    if (!option || option.disabled) return;

    playSound("cardPlay");

    if (option.type === "basic") {
      onPlayBasic();
    } else if (option.type === "powered") {
      if (manaSources.length === 0) {
        (onPlayPowered as () => void)();
      } else if (manaSources.length === 1 && manaSources[0]) {
        onPlayPowered(manaSources[0]);
      } else {
        setMenuState({ type: "mana-select", pendingManaColor: playability.requiredMana ?? "any" });
      }
    } else if (option.type === "sideways" && option.sidewaysAs) {
      onPlaySideways(option.sidewaysAs);
    }
  }, [actionOptions, onPlayBasic, onPlayPowered, onPlaySideways, manaSources, playability.requiredMana]);

  // Handle mana selection
  const handleManaSelect = useCallback((id: string) => {
    const index = manaSources.findIndex((source, idx) => `${source.type}-${source.color}-${idx}` === id);
    const source = manaSources[index];
    if (source) {
      playSound("cardPlay");
      onPlayPowered(source);
    }
  }, [manaSources, onPlayPowered]);

  // Draw a wedge path (full pie slice when innerR = 0, annular sector otherwise)
  const drawWedge = useCallback((
    graphics: Graphics,
    innerR: number,
    outerR: number,
    startAngle: number,
    endAngle: number,
    color: number,
    strokeColor: number,
    strokeWidth: number
  ) => {
    graphics.clear();

    if (innerR === 0) {
      // Full pie slice: start at center, arc at outer radius, back to center
      graphics.moveTo(0, 0);
      graphics.arc(0, 0, outerR, startAngle, endAngle);
      graphics.lineTo(0, 0);
    } else {
      // Annular sector (ring segment)
      const innerStart = polarToCartesian(innerR, startAngle);
      const outerEnd = polarToCartesian(outerR, endAngle);

      graphics.moveTo(innerStart.x, innerStart.y);
      graphics.arc(0, 0, innerR, startAngle, endAngle);
      graphics.lineTo(outerEnd.x, outerEnd.y);
      graphics.arc(0, 0, outerR, endAngle, startAngle, true);
      graphics.lineTo(innerStart.x, innerStart.y);
    }

    graphics.fill({ color, alpha: 0.95 });
    graphics.stroke({ color: strokeColor, width: strokeWidth });
  }, []);

  // Initialize PixiJS
  useEffect(() => {
    if (!containerRef.current) return;
    isDestroyedRef.current = false;
    wedgeContainersRef.current = [];

    let app: Application | null = null;

    const init = async () => {
      app = new Application();
      await app.init({
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (isDestroyedRef.current) {
        app.destroy(true, { children: true });
        return;
      }

      app.canvas.style.position = "absolute";
      app.canvas.style.top = "0";
      app.canvas.style.left = "0";
      app.canvas.style.width = "100%";
      app.canvas.style.height = "100%";
      app.canvas.style.pointerEvents = "auto";

      if (containerRef.current) {
        containerRef.current.appendChild(app.canvas);
      }
      appRef.current = app;

      const animManager = new AnimationManager();
      animManager.attach(app.ticker);
      animManagerRef.current = animManager;

      // Overlay background
      const overlay = new Graphics();
      overlay.rect(0, 0, window.innerWidth, window.innerHeight);
      overlay.fill({ color: 0x0a0805, alpha: 0.7 });
      overlay.eventMode = "static";
      overlay.cursor = "default";
      overlay.on("pointerdown", () => onCancelRef.current());
      overlay.alpha = 0;
      app.stage.addChild(overlay);

      animManager.animate("overlay-fade", overlay, {
        endAlpha: 1,
        duration: 200,
        easing: Easing.easeOutQuad,
      });

      // Menu container at screen center
      const menuContainer = new Container();
      menuContainer.sortableChildren = true; // Enable z-index sorting for hover effects
      menuContainer.position.set(menuPosition.x, menuPosition.y);
      app.stage.addChild(menuContainer);

      const { innerRadius, outerRadius } = sizes;
      const currentOptions = menuState.type === "action-select" ? actionOptions : manaOptions;
      const wedges = calculateWedges(currentOptions);

      // Render wedges
      wedges.forEach((wedge, index) => {
        const wedgeContainer = new Container();
        wedgeContainersRef.current.push(wedgeContainer);

        // Glow (behind)
        const glow = new Graphics();
        drawWedge(glow, Math.max(0, innerRadius - 5), outerRadius + 10, wedge.startAngle, wedge.endAngle, COLORS.GLOW, COLORS.GLOW, 0);
        glow.filters = [new BlurFilter({ strength: 15 })];
        glow.alpha = 0;
        wedgeContainer.addChild(glow);

        // Wedge shape
        const shape = new Graphics();
        drawWedge(shape, innerRadius, outerRadius, wedge.startAngle, wedge.endAngle, wedge.color, COLORS.STROKE, 2);
        wedgeContainer.addChild(shape);

        // Label position: in the outer half of the wedge, past the card
        const labelRadius = sizes.cardCoverRadius + (outerRadius - sizes.cardCoverRadius) * 0.5;
        const labelPos = polarToCartesian(labelRadius, wedge.midAngle);

        // Main label
        const labelOffset = wedge.sublabel ? sizes.sublabelFontSize * 0.7 : 0;
        const label = new Text({
          text: wedge.label,
          style: {
            fontFamily: "Arial, sans-serif",
            fontSize: sizes.labelFontSize,
            fontWeight: "bold",
            fill: wedge.disabled ? COLORS.TEXT_DISABLED : COLORS.TEXT,
            align: "center",
          },
        });
        label.anchor.set(0.5);
        label.position.set(labelPos.x, labelPos.y - labelOffset);
        wedgeContainer.addChild(label);

        // Sublabel
        if (wedge.sublabel) {
          const sublabel = new Text({
            text: wedge.sublabel,
            style: {
              fontFamily: "Arial, sans-serif",
              fontSize: sizes.sublabelFontSize,
              fill: wedge.disabled ? COLORS.TEXT_DISABLED : 0xb0a090,
              align: "center",
            },
          });
          sublabel.anchor.set(0.5);
          sublabel.position.set(labelPos.x, labelPos.y + sizes.sublabelFontSize * 0.9);
          wedgeContainer.addChild(sublabel);
        }

        if (wedge.disabled) {
          wedgeContainer.alpha = 0.5;
        }

        // Interactivity
        shape.eventMode = wedge.disabled ? "none" : "static";
        shape.cursor = wedge.disabled ? "not-allowed" : "pointer";

        shape.on("pointerenter", () => {
          if (wedge.disabled) return;
          hoveredWedgeRef.current = index;

          // Bring hovered wedge to front
          wedgeContainer.zIndex = 100;
          menuContainer.sortChildren();

          animManager.animate(`wedge-hover-${index}`, wedgeContainer, {
            endScale: 1.05,
            duration: 100,
            easing: Easing.easeOutQuad,
          });

          animManager.animate(`glow-${index}`, glow, {
            endAlpha: 0.6,
            duration: 100,
            easing: Easing.easeOutQuad,
          });

          drawWedge(shape, innerRadius, outerRadius, wedge.startAngle, wedge.endAngle, wedge.hoverColor, COLORS.STROKE_HOVER, 3);
        });

        shape.on("pointerleave", () => {
          if (wedge.disabled) return;
          hoveredWedgeRef.current = null;

          // Restore z-index
          wedgeContainer.zIndex = index;
          menuContainer.sortChildren();

          animManager.animate(`wedge-hover-${index}`, wedgeContainer, {
            endScale: 1,
            duration: 100,
            easing: Easing.easeOutQuad,
          });

          animManager.animate(`glow-${index}`, glow, {
            endAlpha: 0,
            duration: 100,
            easing: Easing.easeOutQuad,
          });

          drawWedge(shape, innerRadius, outerRadius, wedge.startAngle, wedge.endAngle, wedge.color, COLORS.STROKE, 2);
        });

        shape.on("pointerdown", () => {
          if (wedge.disabled) return;

          animManager.animate(`wedge-select-${index}`, wedgeContainer, {
            endScale: 1.1,
            duration: 80,
            easing: Easing.easeOutQuad,
            onComplete: () => {
              if (menuState.type === "action-select") {
                handleActionSelect(wedge.id);
              } else {
                handleManaSelect(wedge.id);
              }
            },
          });
        });

        // Set initial z-index based on wedge order
        wedgeContainer.zIndex = index;
        menuContainer.addChild(wedgeContainer);

        // Entry animation
        wedgeContainer.scale.set(0.5);
        wedgeContainer.alpha = 0;
        setTimeout(() => {
          if (isDestroyedRef.current) return;
          animManager.animate(`wedge-entry-${index}`, wedgeContainer, {
            endScale: 1,
            endAlpha: wedge.disabled ? 0.5 : 1,
            duration: 250,
            easing: Easing.easeOutBack,
          });
        }, 50 + index * 40);
      });

      // Subtle glow at center (behind where wedges meet)
      const centerGlow = new Graphics();
      centerGlow.circle(0, 0, 20);
      centerGlow.fill({ color: COLORS.GLOW, alpha: 0.3 });
      centerGlow.filters = [new BlurFilter({ strength: 15 })];
      centerGlow.alpha = 0;
      menuContainer.addChildAt(centerGlow, 0);

      setTimeout(() => {
        if (isDestroyedRef.current) return;
        animManager.animate("center-glow", centerGlow, {
          endAlpha: 0.8,
          duration: 300,
          easing: Easing.easeOutQuad,
        });
      }, 200);
    };

    init();

    return () => {
      isDestroyedRef.current = true;
      wedgeContainersRef.current = [];

      if (animManagerRef.current) {
        animManagerRef.current.cancelAll();
        animManagerRef.current.detach();
        animManagerRef.current = null;
      }

      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuState]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  }, [onCancel]);

  return (
    <div
      ref={containerRef}
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 250,
        pointerEvents: "auto",
      }}
    />
  );
}
