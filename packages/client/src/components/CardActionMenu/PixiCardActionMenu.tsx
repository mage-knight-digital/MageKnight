/**
 * PixiCardActionMenu - Full PixiJS card action menu with max juice
 *
 * A juicy, particle-filled pie menu for card actions, fully rendered in PixiJS.
 * Features:
 * - Particle effects (ambient, hover, selection bursts)
 * - Smooth tweened animations
 * - Shader-like glow effects
 * - Satisfying hover and selection feedback
 */

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { Application, Container, Graphics, Text, Sprite, BlurFilter } from "pixi.js";
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
import { getCardTexture } from "../../utils/pixiTextureLoader";
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
  path: number[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  alpha: number;
  graphics: Graphics;
}

type MenuState =
  | { type: "action-select" }
  | { type: "mana-select"; pendingManaColor: string };

// ============================================
// Constants
// ============================================

const ANIMATION_DURATION = {
  ENTRY: 400,
  EXIT: 200,
  HOVER: 150,
  SELECTION: 300,
  WEDGE_STAGGER: 50,
};

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
  CENTER: 0x231c16,
  CENTER_HOVER: 0x502d28,
  TEXT: 0xf0e6d2,
  TEXT_SHADOW: 0x000000,
  GLOW: 0xffc864,
  PARTICLE: 0xffd080,
};

const MANA_COLORS: Record<string, { fill: number; hover: number; stroke: number }> = {
  red: { fill: 0x6e2d28, hover: 0x8c3c32, stroke: 0xe76450 },
  blue: { fill: 0x284164, hover: 0x325582, stroke: 0x5096dc },
  green: { fill: 0x285037, hover: 0x326946, stroke: 0x50c878 },
  white: { fill: 0x55555a, hover: 0x737378, stroke: 0xf0f0f5 },
  gold: { fill: 0x645528, hover: 0x826e32, stroke: 0xf1c432 },
  black: { fill: 0x282832, hover: 0x373746, stroke: 0x8c8ca0 },
};

// ============================================
// Utility Functions
// ============================================

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function calculateSizes(multiplier: number = 1) {
  const vmin = Math.min(window.innerWidth, window.innerHeight);
  const baseSize = vmin * 0.5 * multiplier;
  const pieSize = Math.max(300, Math.min(750, baseSize));
  const innerDiameter = pieSize * 0.42 * 2;
  const cardHeight = Math.floor(innerDiameter * 0.7);
  return { pieSize, cardHeight };
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
}: PixiCardActionMenuProps) {
  // Register as overlay
  useRegisterOverlay(true);
  const { setPosition } = useCardMenuPosition();

  // State
  const [menuState, setMenuState] = useState<MenuState>({ type: "action-select" });
  const [sizes, setSizes] = useState(() => calculateSizes(sizeMultiplier));

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const animManagerRef = useRef<AnimationManager | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const hoveredIndexRef = useRef<number | null>(null);
  const wedgeContainersRef = useRef<Container[]>([]);
  const glowGraphicsRef = useRef<Graphics[]>([]);
  const menuContainerRef = useRef<Container | null>(null);
  const cardContainerRef = useRef<Container | null>(null);
  const isDestroyedRef = useRef(false);

  // Store callbacks in refs to avoid stale closure issues
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  // Resize handler
  useEffect(() => {
    const handleResize = () => setSizes(calculateSizes(sizeMultiplier));
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sizeMultiplier]);

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

  // Calculate menu position
  const menuPosition = useMemo(() => {
    const padding = sizes.pieSize / 2 + 20;
    let menuX = sourceRect.left + sourceRect.width / 2;
    let menuY = sourceRect.top + sourceRect.height / 2;
    menuX = Math.max(padding, Math.min(window.innerWidth - padding, menuX));
    menuY = Math.max(padding, Math.min(window.innerHeight - padding, menuY));
    return { x: menuX, y: menuY };
  }, [sourceRect, sizes.pieSize]);

  // Store position for other overlays
  useEffect(() => {
    setPosition(menuPosition);
  }, [menuPosition, setPosition]);

  // Build action options
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

    return [
      {
        id: "basic",
        label: "Basic",
        type: "basic" as const,
        weight: 2,
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
        weight: 2,
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

  // Calculate wedge geometry - centered at origin (0, 0)
  const calculateWedges = useCallback((options: ActionOption[], outerRadius: number, innerRadius: number): WedgeData[] => {
    if (options.length === 0) return [];

    const totalWeight = options.reduce((sum, item) => sum + item.weight, 0);
    const firstWeight = options[0]?.weight ?? 1;
    const firstAngle = (firstWeight / totalWeight) * (2 * Math.PI);
    let currentAngle = -Math.PI / 2 - firstAngle / 2;

    return options.map((option) => {
      const angleSpan = (option.weight / totalWeight) * (2 * Math.PI);
      const startAngle = currentAngle;
      const endAngle = currentAngle + angleSpan;
      currentAngle = endAngle;

      const midAngle = (startAngle + endAngle) / 2;

      // Build path points for wedge - centered at origin
      const cx = 0;
      const cy = 0;
      const inner = innerRadius;
      const outer = outerRadius - 2;

      const path: number[] = [];
      const segments = 32;

      // Outer arc
      for (let i = 0; i <= segments; i++) {
        const angle = startAngle + (endAngle - startAngle) * (i / segments);
        const p = polarToCartesian(cx, cy, outer, angle);
        path.push(p.x, p.y);
      }

      // Inner arc (reversed)
      for (let i = segments; i >= 0; i--) {
        const angle = startAngle + (endAngle - startAngle) * (i / segments);
        const p = polarToCartesian(cx, cy, inner, angle);
        path.push(p.x, p.y);
      }

      return {
        ...option,
        startAngle,
        endAngle,
        midAngle,
        path,
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

  // Handle back to actions
  const handleBackToActions = useCallback(() => {
    setMenuState({ type: "action-select" });
  }, []);

  // Spawn particle
  const spawnParticle = useCallback((
    container: Container,
    x: number,
    y: number,
    color: number = COLORS.PARTICLE,
    velocity?: { vx: number; vy: number }
  ) => {
    const particle: Particle = {
      x,
      y,
      vx: velocity?.vx ?? (Math.random() - 0.5) * 2,
      vy: velocity?.vy ?? (Math.random() - 0.5) * 2 - 1,
      life: 1,
      maxLife: 1,
      size: 2 + Math.random() * 3,
      color,
      alpha: 0.8 + Math.random() * 0.2,
      graphics: new Graphics(),
    };

    particle.graphics.circle(0, 0, particle.size);
    particle.graphics.fill({ color: particle.color, alpha: particle.alpha });
    particle.graphics.position.set(x, y);
    container.addChild(particle.graphics);
    particlesRef.current.push(particle);
  }, []);

  // Spawn selection burst
  const spawnSelectionBurst = useCallback((container: Container, x: number, y: number, color: number) => {
    const particleCount = 20;
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 3 + Math.random() * 4;
      spawnParticle(container, x, y, color, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      });
    }
  }, [spawnParticle]);

  // Initialize PixiJS
  useEffect(() => {
    if (!containerRef.current) return;
    isDestroyedRef.current = false;

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

      // Style canvas - position absolute within the container
      app.canvas.style.position = "absolute";
      app.canvas.style.top = "0";
      app.canvas.style.left = "0";
      app.canvas.style.width = "100%";
      app.canvas.style.height = "100%";
      app.canvas.style.pointerEvents = "auto";

      // Append to our container div (not document.body) for proper event layering
      if (containerRef.current) {
        containerRef.current.appendChild(app.canvas);
      }
      appRef.current = app;

      // Create animation manager
      const animManager = new AnimationManager();
      animManager.attach(app.ticker);
      animManagerRef.current = animManager;

      // Create overlay background - catches clicks outside the menu
      const overlay = new Graphics();
      overlay.rect(0, 0, window.innerWidth, window.innerHeight);
      overlay.fill({ color: 0x0a0805, alpha: 0.6 });
      overlay.eventMode = "static";
      overlay.cursor = "default";
      overlay.on("pointerdown", () => onCancelRef.current());
      app.stage.addChild(overlay);

      // Create main menu container
      const menuContainer = new Container();
      menuContainer.position.set(menuPosition.x, menuPosition.y);
      menuContainer.alpha = 0;
      menuContainer.scale.set(0.8);
      app.stage.addChild(menuContainer);
      menuContainerRef.current = menuContainer;

      // Create particle container (behind everything)
      const particleContainer = new Container();
      particleContainer.label = "particles";
      menuContainer.addChild(particleContainer);

      // Load card texture for later use
      const cardTexture = await getCardTexture(cardId);
      const cardHeight = sizes.cardHeight;
      const cardWidth = cardHeight * 0.667;

      // Calculate start position for card animation
      const startX = sourceRect.left + sourceRect.width / 2 - menuPosition.x;
      const startY = sourceRect.top + sourceRect.height / 2 - menuPosition.y;
      const startScale = sourceRect.height / cardHeight;

      // Build and render wedges FIRST (so card renders on top)
      const outerRadius = sizes.pieSize / 2;
      const innerRadius = outerRadius * 0.42;
      const currentOptions = menuState.type === "action-select" ? actionOptions : manaOptions;
      const wedges = calculateWedges(currentOptions, outerRadius, innerRadius);

      const wedgeContainer = new Container();
      wedgeContainer.label = "wedges";
      menuContainer.addChild(wedgeContainer);

      wedgeContainersRef.current = [];
      glowGraphicsRef.current = [];

      wedges.forEach((wedge, index) => {
        const container = new Container();
        // No pivot needed - wedges are already centered at origin

        // Glow layer (initially hidden)
        const glow = new Graphics();
        glow.poly(wedge.path);
        glow.fill({ color: COLORS.GLOW, alpha: 0.3 });
        glow.alpha = 0;
        const wedgeBlur = new BlurFilter({ strength: 8 });
        glow.filters = [wedgeBlur];
        container.addChild(glow);
        glowGraphicsRef.current.push(glow);

        // Wedge fill
        const fill = new Graphics();
        fill.poly(wedge.path);
        fill.fill({ color: wedge.color, alpha: 0.95 });
        fill.stroke({ color: COLORS.STROKE, width: 2 });
        container.addChild(fill);

        // Labels - centered at origin
        const labelRadius = (innerRadius + outerRadius) / 2;
        const labelPos = polarToCartesian(0, 0, labelRadius, wedge.midAngle);

        // Main label
        const label = new Text({
          text: wedge.label,
          style: {
            fontFamily: "Arial, sans-serif",
            fontSize: 15,
            fontWeight: "bold",
            fill: COLORS.TEXT,
            align: "center",
            dropShadow: {
              color: COLORS.TEXT_SHADOW,
              blur: 2,
              distance: 1,
            },
          },
        });
        label.anchor.set(0.5);
        label.position.set(labelPos.x, labelPos.y - (wedge.sublabel ? 6 : 0));
        container.addChild(label);

        // Sublabel
        if (wedge.sublabel) {
          const sublabel = new Text({
            text: wedge.sublabel,
            style: {
              fontFamily: "Arial, sans-serif",
              fontSize: 11,
              fill: 0xd4c4a8,
              align: "center",
              dropShadow: {
                color: COLORS.TEXT_SHADOW,
                blur: 1,
                distance: 1,
              },
            },
          });
          sublabel.anchor.set(0.5);
          sublabel.position.set(labelPos.x, labelPos.y + 10);
          container.addChild(sublabel);
        }

        // Dim if disabled
        if (wedge.disabled) {
          container.alpha = 0.4;
        }

        // Interactivity
        fill.eventMode = wedge.disabled ? "none" : "static";
        fill.cursor = wedge.disabled ? "not-allowed" : "pointer";

        fill.on("pointerenter", () => {
          if (wedge.disabled) return;
          hoveredIndexRef.current = index;

          // Animate wedge
          animManager.animate(`wedge-hover-${index}`, container, {
            endScale: 1.03,
            duration: ANIMATION_DURATION.HOVER,
            easing: Easing.easeOutBack,
          });

          // Show glow
          animManager.animate(`glow-${index}`, glow, {
            endAlpha: 1,
            duration: ANIMATION_DURATION.HOVER,
            easing: Easing.easeOutQuad,
          });

          // Update fill color
          fill.clear();
          fill.poly(wedge.path);
          fill.fill({ color: wedge.hoverColor, alpha: 0.98 });
          fill.stroke({ color: COLORS.STROKE_HOVER, width: 2.5 });

          // Spawn hover particles
          for (let i = 0; i < 3; i++) {
            const angle = wedge.startAngle + Math.random() * (wedge.endAngle - wedge.startAngle);
            const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
            const pos = polarToCartesian(0, 0, radius, angle);
            spawnParticle(particleContainer, pos.x, pos.y, COLORS.PARTICLE);
          }
        });

        fill.on("pointerleave", () => {
          if (wedge.disabled) return;
          hoveredIndexRef.current = null;

          animManager.animate(`wedge-hover-${index}`, container, {
            endScale: 1,
            duration: ANIMATION_DURATION.HOVER,
            easing: Easing.easeOutQuad,
          });

          animManager.animate(`glow-${index}`, glow, {
            endAlpha: 0,
            duration: ANIMATION_DURATION.HOVER,
            easing: Easing.easeOutQuad,
          });

          fill.clear();
          fill.poly(wedge.path);
          fill.fill({ color: wedge.color, alpha: 0.95 });
          fill.stroke({ color: COLORS.STROKE, width: 2 });
        });

        fill.on("pointerdown", () => {
          if (wedge.disabled) return;

          // Selection burst
          const burstPos = polarToCartesian(0, 0, labelRadius, wedge.midAngle);
          spawnSelectionBurst(particleContainer, burstPos.x, burstPos.y, wedge.hoverColor);

          // Flash effect
          animManager.animate(`wedge-select-${index}`, container, {
            endScale: 1.1,
            duration: 100,
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

        wedgeContainer.addChild(container);
        wedgeContainersRef.current.push(container);

        // Staggered entry animation
        container.scale.set(0);
        container.alpha = 0;
        setTimeout(() => {
          if (isDestroyedRef.current) return;
          animManager.animate(`wedge-entry-${index}`, container, {
            endScale: 1,
            endAlpha: wedge.disabled ? 0.4 : 1,
            duration: ANIMATION_DURATION.ENTRY,
            easing: Easing.easeOutBack,
          });
        }, index * ANIMATION_DURATION.WEDGE_STAGGER);
      });

      // Center circle - at origin
      const center = new Graphics();
      center.circle(0, 0, innerRadius - 4);
      center.fill({ color: COLORS.CENTER, alpha: 0.95 });
      center.stroke({ color: COLORS.STROKE, width: 3 });
      center.eventMode = "static";
      center.cursor = "pointer";

      center.on("pointerenter", () => {
        center.clear();
        center.circle(0, 0, innerRadius - 4);
        center.fill({ color: COLORS.CENTER_HOVER, alpha: 0.95 });
        center.stroke({ color: 0xb46450, width: 3 });
      });

      center.on("pointerleave", () => {
        center.clear();
        center.circle(0, 0, innerRadius - 4);
        center.fill({ color: COLORS.CENTER, alpha: 0.95 });
        center.stroke({ color: COLORS.STROKE, width: 3 });
      });

      center.on("pointerdown", () => {
        if (menuState.type === "mana-select") {
          handleBackToActions();
        } else {
          onCancel();
        }
      });

      wedgeContainer.addChild(center);

      // Center label - at origin
      const centerLabel = new Text({
        text: menuState.type === "mana-select" ? "Back" : "Cancel",
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: 12,
          fontWeight: "bold",
          fill: 0xd4c4a8,
          align: "center",
        },
      });
      centerLabel.anchor.set(0.5);
      centerLabel.position.set(0, 0);
      centerLabel.eventMode = "none";
      wedgeContainer.addChild(centerLabel);

      // wedgeContainer is already centered at origin, no offset needed

      // Card container - added AFTER wedges so it renders on top (in the center hole)
      const cardContainer = new Container();
      cardContainer.label = "card";
      cardContainerRef.current = cardContainer;

      // Card glow (behind card)
      const cardGlow = new Graphics();
      cardGlow.circle(0, 0, cardWidth * 0.8);
      cardGlow.fill({ color: COLORS.GLOW, alpha: 0.3 });
      const blurFilter = new BlurFilter({ strength: 20 });
      cardGlow.filters = [blurFilter];
      cardContainer.addChild(cardGlow);

      // Card sprite
      const cardSprite = new Sprite(cardTexture);
      cardSprite.anchor.set(0.5);
      cardSprite.width = cardWidth;
      cardSprite.height = cardHeight;
      cardContainer.addChild(cardSprite);

      // Card border
      const cardBorder = new Graphics();
      cardBorder.roundRect(-cardWidth / 2 - 3, -cardHeight / 2 - 3, cardWidth + 6, cardHeight + 6, 8);
      cardBorder.stroke({ color: 0x5c4a3a, width: 3 });
      cardBorder.roundRect(-cardWidth / 2 - 5, -cardHeight / 2 - 5, cardWidth + 10, cardHeight + 10, 10);
      cardBorder.stroke({ color: 0x2d241c, width: 2 });
      cardContainer.addChild(cardBorder);

      menuContainer.addChild(cardContainer);

      // Set card's initial position for animation
      cardContainer.position.set(startX, startY);
      cardContainer.scale.set(startScale);

      // Entry animations
      animManager.animate("menu-entry", menuContainer, {
        endAlpha: 1,
        endScale: 1,
        duration: ANIMATION_DURATION.ENTRY,
        easing: Easing.easeOutBack,
      });

      // Card pull-up animation
      animManager.animate("card-entry", cardContainer, {
        endX: 0,
        endY: 0,
        endScale: 1,
        duration: ANIMATION_DURATION.ENTRY + 100,
        easing: Easing.easeOutCubic,
      });

      // Particle update loop
      app.ticker.add(() => {
        if (isDestroyedRef.current) return;

        const particles = particlesRef.current;
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          if (!p) continue;

          p.life -= 0.02;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.05; // Gravity
          p.vx *= 0.98; // Drag
          p.vy *= 0.98;

          p.graphics.position.set(p.x, p.y);
          p.graphics.alpha = p.life * p.alpha;
          p.graphics.scale.set(p.life);

          if (p.life <= 0) {
            p.graphics.destroy();
            particles.splice(i, 1);
          }
        }

        // Ambient particles
        if (Math.random() < 0.1) {
          const angle = Math.random() * Math.PI * 2;
          const radius = innerRadius + Math.random() * (outerRadius - innerRadius) * 0.8;
          const pos = polarToCartesian(0, 0, radius, angle);
          spawnParticle(particleContainer, pos.x, pos.y, COLORS.PARTICLE);
        }
      });
    };

    init();

    return () => {
      isDestroyedRef.current = true;

      // Clean up particles
      particlesRef.current.forEach(p => p.graphics.destroy());
      particlesRef.current = [];

      if (animManagerRef.current) {
        animManagerRef.current.cancelAll();
        animManagerRef.current.detach();
        animManagerRef.current = null;
      }

      if (appRef.current) {
        // Canvas is a child of containerRef, will be cleaned up automatically
        // but we still destroy the PixiJS app
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  // We intentionally only run this once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle menu state changes (action-select <-> mana-select)
  useEffect(() => {
    const menuContainer = menuContainerRef.current;
    const animManager = animManagerRef.current;
    if (!menuContainer || !animManager || isDestroyedRef.current) return;

    // Rebuild wedges when menu state changes
    // This would need more complex logic to handle the transition
    // For now, we handle this in the main init effect
  }, [menuState]);

  // Handle click on DOM overlay (backup for PixiJS overlay)
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    // Only cancel if clicking the overlay itself, not its children
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
        pointerEvents: "auto", // Block events from reaching elements below
      }}
    />
  );
}
