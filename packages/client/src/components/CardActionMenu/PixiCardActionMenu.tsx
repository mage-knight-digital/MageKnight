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
  type: "ambient" | "orbit" | "trail" | "burst";
  // Orbit-specific properties
  angle?: number;
  orbitRadius?: number;
  orbitSpeed?: number;
  // Trail-specific properties
  targetRadius?: number;
  // Fairy dust properties
  wobblePhase?: number;    // Phase offset for sine wobble
  wobbleAmount?: number;   // How much it wobbles perpendicular to travel
  twinkleSpeed?: number;   // How fast opacity fluctuates
  shape?: "circle" | "star" | "streak";  // Visual shape
  rotation?: number;       // Current rotation for non-circular shapes
  rotationSpeed?: number;  // How fast it spins
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
  // Action-themed particle colors
  PARTICLE_BASIC: 0xd4a574,      // Warm brown/tan
  PARTICLE_POWERED: 0xb088d0,    // Soft purple
  PARTICLE_SIDEWAYS: 0x7aaccf,   // Cool blue
  PARTICLE_ORBIT: 0xffe4b5,      // Soft golden
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
  cardId: _cardId, // Card is now rendered by the hand component, not here
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
  const hoveredWedgeTypeRef = useRef<"basic" | "powered" | "sideways" | null>(null);
  const wedgeContainersRef = useRef<Container[]>([]);
  const glowGraphicsRef = useRef<Graphics[]>([]);
  const menuContainerRef = useRef<Container | null>(null);
  const centerGlowRef = useRef<Graphics | null>(null);
  const tickerTimeRef = useRef<number>(0);
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

  // Get particle color based on wedge type
  const getParticleColor = useCallback((wedgeType: "basic" | "powered" | "sideways" | null): number => {
    switch (wedgeType) {
      case "basic": return COLORS.PARTICLE_BASIC;
      case "powered": return COLORS.PARTICLE_POWERED;
      case "sideways": return COLORS.PARTICLE_SIDEWAYS;
      default: return COLORS.PARTICLE_ORBIT;
    }
  }, []);

  // Spawn a basic ambient particle (drifting, gravity-affected)
  const spawnAmbientParticle = useCallback((
    container: Container,
    x: number,
    y: number,
    color: number = COLORS.PARTICLE
  ) => {
    const particle: Particle = {
      x,
      y,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5 - 0.5,
      life: 1,
      maxLife: 1,
      size: 1.5 + Math.random() * 2,
      color,
      alpha: 0.6 + Math.random() * 0.3,
      graphics: new Graphics(),
      type: "ambient",
    };

    particle.graphics.circle(0, 0, particle.size);
    particle.graphics.fill({ color: particle.color, alpha: particle.alpha });
    particle.graphics.position.set(x, y);
    container.addChild(particle.graphics);
    particlesRef.current.push(particle);
  }, []);

  // Spawn an orbiting particle (circles around center)
  const spawnOrbitParticle = useCallback((
    container: Container,
    orbitRadius: number,
    color: number = COLORS.PARTICLE_ORBIT
  ) => {
    const startAngle = Math.random() * Math.PI * 2;
    const pos = polarToCartesian(0, 0, orbitRadius, startAngle);

    const particle: Particle = {
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      life: 1,
      maxLife: 1,
      size: 1.5 + Math.random() * 1.5,
      color,
      alpha: 0.5 + Math.random() * 0.3,
      graphics: new Graphics(),
      type: "orbit",
      angle: startAngle,
      orbitRadius,
      orbitSpeed: (0.008 + Math.random() * 0.006) * (Math.random() > 0.5 ? 1 : -1), // Variable speed, random direction
    };

    particle.graphics.circle(0, 0, particle.size);
    particle.graphics.fill({ color: particle.color, alpha: particle.alpha });
    particle.graphics.position.set(pos.x, pos.y);
    container.addChild(particle.graphics);
    particlesRef.current.push(particle);
  }, []);

  // Draw a particle shape (star, streak, or circle)
  const drawParticleShape = useCallback((graphics: Graphics, shape: "circle" | "star" | "streak", size: number, color: number, alpha: number) => {
    graphics.clear();

    if (shape === "star") {
      // 4-pointed star / sparkle
      const outer = size;
      const inner = size * 0.3;
      graphics.moveTo(0, -outer);
      graphics.lineTo(inner * 0.5, -inner * 0.5);
      graphics.lineTo(outer, 0);
      graphics.lineTo(inner * 0.5, inner * 0.5);
      graphics.lineTo(0, outer);
      graphics.lineTo(-inner * 0.5, inner * 0.5);
      graphics.lineTo(-outer, 0);
      graphics.lineTo(-inner * 0.5, -inner * 0.5);
      graphics.closePath();
      graphics.fill({ color, alpha });
    } else if (shape === "streak") {
      // Elongated ellipse / comet tail
      graphics.ellipse(0, 0, size * 0.4, size * 1.5);
      graphics.fill({ color, alpha });
    } else {
      // Simple circle
      graphics.circle(0, 0, size);
      graphics.fill({ color, alpha });
    }
  }, []);

  // Spawn fairy dust trail particle (organic, varied, magical)
  const spawnTrailParticle = useCallback((
    container: Container,
    startRadius: number,
    targetRadius: number,
    angle: number,
    color: number
  ) => {
    // Scatter the origin - don't all come from the same point
    const radiusJitter = (Math.random() - 0.5) * 40;
    const angleJitter = (Math.random() - 0.5) * 0.4;
    const actualStartRadius = startRadius + radiusJitter;
    const actualAngle = angle + angleJitter;

    const pos = polarToCartesian(0, 0, actualStartRadius, actualAngle);
    const targetPos = polarToCartesian(0, 0, targetRadius, angle); // Target stays on the wedge

    // Varied speeds - some lazy drifters, some zippy
    const speed = 0.8 + Math.random() * 2.5;
    const dx = targetPos.x - pos.x;
    const dy = targetPos.y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Pick a random shape
    const shapes: Array<"circle" | "star" | "streak"> = ["circle", "star", "streak", "star", "circle"];
    const shape = shapes[Math.floor(Math.random() * shapes.length)] ?? "circle";

    // Varied sizes - mostly small with occasional larger sparkles
    const sizeRoll = Math.random();
    const size = sizeRoll < 0.7 ? 1 + Math.random() * 1.5 : 2.5 + Math.random() * 2;

    const particle: Particle = {
      x: pos.x,
      y: pos.y,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      life: 1,
      maxLife: 1,
      size,
      color,
      alpha: 0.5 + Math.random() * 0.5,
      graphics: new Graphics(),
      type: "trail",
      targetRadius,
      // Fairy dust properties
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleAmount: 0.3 + Math.random() * 0.7,
      twinkleSpeed: 3 + Math.random() * 5,
      shape,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
    };

    drawParticleShape(particle.graphics, shape, size, color, particle.alpha);
    particle.graphics.position.set(pos.x, pos.y);
    if (shape !== "circle") {
      particle.graphics.rotation = particle.rotation ?? 0;
    }
    container.addChild(particle.graphics);
    particlesRef.current.push(particle);
  }, [drawParticleShape]);

  // Spawn selection burst (radial explosion)
  const spawnSelectionBurst = useCallback((container: Container, x: number, y: number, color: number) => {
    const particleCount = 24;
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + Math.random() * 0.2;
      const speed = 4 + Math.random() * 5;

      const particle: Particle = {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        size: 2.5 + Math.random() * 2.5,
        color,
        alpha: 0.9,
        graphics: new Graphics(),
        type: "burst",
      };

      particle.graphics.circle(0, 0, particle.size);
      particle.graphics.fill({ color: particle.color, alpha: particle.alpha });
      particle.graphics.position.set(x, y);
      container.addChild(particle.graphics);
      particlesRef.current.push(particle);
    }
  }, []);

  // Initialize PixiJS - card is rendered by the hand, we only render wedges
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

      // Create overlay background - starts transparent, fades in
      const overlay = new Graphics();
      overlay.rect(0, 0, window.innerWidth, window.innerHeight);
      overlay.fill({ color: 0x0a0805, alpha: 0.6 });
      overlay.eventMode = "static";
      overlay.cursor = "default";
      overlay.on("pointerdown", () => onCancelRef.current());
      overlay.alpha = 0; // Start invisible
      app.stage.addChild(overlay);

      // Create main menu container - starts visible but wedges will animate in
      const menuContainer = new Container();
      menuContainer.position.set(menuPosition.x, menuPosition.y);
      app.stage.addChild(menuContainer);
      menuContainerRef.current = menuContainer;

      // Create particle containers for proper layering:
      // - backParticles: orbiting particles that circle behind the wedges (in the donut hole)
      // - frontParticles: trail/burst particles that appear ON TOP of wedges
      const backParticleContainer = new Container();
      backParticleContainer.label = "back-particles";
      menuContainer.addChild(backParticleContainer);

      // Placeholder for wedgeContainer (added next)
      // frontParticleContainer will be added AFTER wedgeContainer

      // Animation timing constants for sequencing
      const OVERLAY_FADE_DELAY = 150;
      const OVERLAY_FADE_DURATION = 200;
      const WEDGE_START_DELAY = 200;
      const WEDGE_STAGGER = 40;

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
          hoveredWedgeTypeRef.current = wedge.type;

          // Animate wedge with slight scale and "lean" toward center
          animManager.animate(`wedge-hover-${index}`, container, {
            endScale: 1.05,
            duration: ANIMATION_DURATION.HOVER,
            easing: Easing.easeOutBack,
          });

          // Show glow with pulsing intensity
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

          // Spawn themed hover particles (trail from center outward) - on TOP of wedges
          const particleColor = getParticleColor(wedge.type);
          for (let i = 0; i < 5; i++) {
            const angle = wedge.startAngle + Math.random() * (wedge.endAngle - wedge.startAngle);
            spawnTrailParticle(frontParticleContainer, innerRadius * 0.8, (innerRadius + outerRadius) / 2, angle, particleColor);
          }
        });

        fill.on("pointerleave", () => {
          if (wedge.disabled) return;
          hoveredIndexRef.current = null;
          hoveredWedgeTypeRef.current = null;

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

          // Selection burst - on TOP of everything
          const burstPos = polarToCartesian(0, 0, labelRadius, wedge.midAngle);
          spawnSelectionBurst(frontParticleContainer, burstPos.x, burstPos.y, wedge.hoverColor);

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

        // Staggered entry animation - delayed until card is lifting
        container.scale.set(0);
        container.alpha = 0;
        setTimeout(() => {
          if (isDestroyedRef.current) return;
          animManager.animate(`wedge-entry-${index}`, container, {
            endScale: 1,
            endAlpha: wedge.disabled ? 0.4 : 1,
            duration: 300,
            easing: Easing.easeOutBack,
          });
        }, WEDGE_START_DELAY + index * WEDGE_STAGGER);
      });

      // Center glow (pulsing, behind center circle)
      const centerGlow = new Graphics();
      centerGlow.circle(0, 0, innerRadius * 0.9);
      centerGlow.fill({ color: COLORS.GLOW, alpha: 0.2 });
      const centerGlowBlur = new BlurFilter({ strength: 15 });
      centerGlow.filters = [centerGlowBlur];
      centerGlow.alpha = 0;
      wedgeContainer.addChild(centerGlow);
      centerGlowRef.current = centerGlow;

      // Center circle - at origin, starts hidden
      const center = new Graphics();
      center.circle(0, 0, innerRadius - 4);
      center.fill({ color: COLORS.CENTER, alpha: 0.95 });
      center.stroke({ color: COLORS.STROKE, width: 3 });
      center.eventMode = "static";
      center.cursor = "pointer";
      center.scale.set(0);
      center.alpha = 0;

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
          onCancelRef.current();
        }
      });

      wedgeContainer.addChild(center);

      // Center label - at origin, starts hidden
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
      centerLabel.alpha = 0;
      wedgeContainer.addChild(centerLabel);

      // Front particle container - added AFTER wedges so trails/bursts render on top
      const frontParticleContainer = new Container();
      frontParticleContainer.label = "front-particles";
      menuContainer.addChild(frontParticleContainer);

      // Animate center circle, glow, and label in with wedges
      const centerDelay = WEDGE_START_DELAY + wedges.length * WEDGE_STAGGER;
      setTimeout(() => {
        if (isDestroyedRef.current) return;
        animManager.animate("center-entry", center, {
          endScale: 1,
          endAlpha: 1,
          duration: 250,
          easing: Easing.easeOutBack,
        });
        animManager.animate("center-glow-entry", centerGlow, {
          endAlpha: 0.6,
          duration: 400,
          easing: Easing.easeOutQuad,
        });
        animManager.animate("center-label-entry", centerLabel, {
          endAlpha: 1,
          duration: 200,
          easing: Easing.easeOutQuad,
        });

        // Spawn initial orbiting particles once menu is ready (behind wedges)
        const orbitRadiusInner = innerRadius * 0.7;
        const orbitRadiusOuter = innerRadius * 0.95;
        for (let i = 0; i < 8; i++) {
          const radius = orbitRadiusInner + Math.random() * (orbitRadiusOuter - orbitRadiusInner);
          spawnOrbitParticle(backParticleContainer, radius, COLORS.PARTICLE_ORBIT);
        }
      }, centerDelay);

      // wedgeContainer is already centered at origin, no offset needed
      // Card is rendered by the hand component - it animates up to menuPosition

      // ========================================
      // ANIMATION FLOW (card handled by hand)
      // ========================================

      // Overlay fades in
      setTimeout(() => {
        if (isDestroyedRef.current) return;
        animManager.animate("overlay-fade", overlay, {
          endAlpha: 1,
          duration: OVERLAY_FADE_DURATION,
          easing: Easing.easeOutQuad,
        });
      }, OVERLAY_FADE_DELAY);

      // Phase 3: Wedges animate in (handled above with WEDGE_START_DELAY)

      // Particle update loop with type-specific behavior
      app.ticker.add((ticker) => {
        if (isDestroyedRef.current) return;

        // Track time for pulsing effects
        tickerTimeRef.current += ticker.deltaMS / 1000;
        const time = tickerTimeRef.current;

        // Pulse the center glow (breathing effect)
        const centerGlowRef_ = centerGlowRef.current;
        if (centerGlowRef_) {
          const breathe = 0.5 + 0.15 * Math.sin(time * 2); // Slow breathe
          centerGlowRef_.alpha = breathe;
        }

        // Pulse wedge glows when hovered (subtle shimmer)
        const hoveredIdx = hoveredIndexRef.current;
        if (hoveredIdx !== null) {
          const hoveredGlow = glowGraphicsRef.current[hoveredIdx];
          if (hoveredGlow) {
            const shimmer = 0.85 + 0.15 * Math.sin(time * 6); // Faster shimmer
            hoveredGlow.alpha = shimmer;
          }
        }

        const particles = particlesRef.current;
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          if (!p) continue;

          // Type-specific update logic
          switch (p.type) {
            case "orbit":
              // Orbit around center - no gravity, slow fade
              if (p.angle !== undefined && p.orbitRadius !== undefined && p.orbitSpeed !== undefined) {
                p.angle += p.orbitSpeed;
                const newPos = polarToCartesian(0, 0, p.orbitRadius, p.angle);
                p.x = newPos.x;
                p.y = newPos.y;
              }
              p.life -= 0.003; // Very slow fade
              p.graphics.position.set(p.x, p.y);
              p.graphics.alpha = p.life * p.alpha * (0.7 + 0.3 * Math.sin(time * 4 + i)); // Twinkle
              p.graphics.scale.set(0.8 + 0.4 * p.life);
              break;

            case "trail": {
              // Fairy dust movement with wobble
              const wobblePhase = p.wobblePhase ?? 0;
              const wobbleAmount = p.wobbleAmount ?? 0;
              const twinkleSpeed = p.twinkleSpeed ?? 4;

              // Calculate perpendicular direction for wobble
              const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
              const perpX = -p.vy / speed;
              const perpY = p.vx / speed;

              // Wobble offset (sine wave perpendicular to travel direction)
              const wobbleOffset = Math.sin(time * 8 + wobblePhase) * wobbleAmount * 2;

              p.x += p.vx + perpX * wobbleOffset * 0.1;
              p.y += p.vy + perpY * wobbleOffset * 0.1;
              p.life -= 0.02;

              // Twinkle effect
              const twinkle = 0.6 + 0.4 * Math.sin(time * twinkleSpeed + wobblePhase);

              p.graphics.position.set(p.x, p.y);
              p.graphics.alpha = p.life * p.alpha * twinkle;
              p.graphics.scale.set(0.7 + p.life * 0.5);

              // Rotate non-circular shapes
              if (p.shape !== "circle" && p.rotationSpeed !== undefined) {
                p.rotation = (p.rotation ?? 0) + p.rotationSpeed;
                p.graphics.rotation = p.rotation;
              }
              break;
            }

            case "burst":
              // Explode outward, strong drag, fast fade
              p.x += p.vx;
              p.y += p.vy;
              p.vx *= 0.92;
              p.vy *= 0.92;
              p.life -= 0.035;
              p.graphics.position.set(p.x, p.y);
              p.graphics.alpha = p.life * p.alpha;
              p.graphics.scale.set(0.5 + p.life * 0.8);
              break;

            case "ambient":
            default:
              // Gentle drift with slight gravity
              p.x += p.vx;
              p.y += p.vy;
              p.vy += 0.02; // Light gravity
              p.vx *= 0.99;
              p.vy *= 0.99;
              p.life -= 0.015;
              p.graphics.position.set(p.x, p.y);
              p.graphics.alpha = p.life * p.alpha;
              p.graphics.scale.set(p.life);
              break;
          }

          // Remove dead particles
          if (p.life <= 0) {
            p.graphics.destroy();
            particles.splice(i, 1);
          }
        }

        // ========================================
        // IDLE PARTICLE SPAWNING (always moving)
        // ========================================

        // Maintain orbiting particles (replenish when they fade) - BEHIND wedges
        const orbitCount = particles.filter(p => p.type === "orbit").length;
        if (orbitCount < 10 && Math.random() < 0.05) {
          const orbitRadiusInner = innerRadius * 0.7;
          const orbitRadiusOuter = innerRadius * 0.95;
          const radius = orbitRadiusInner + Math.random() * (orbitRadiusOuter - orbitRadiusInner);
          spawnOrbitParticle(backParticleContainer, radius, COLORS.PARTICLE_ORBIT);
        }

        // Occasional ambient particles in the wedge area - on TOP so they're visible
        if (Math.random() < 0.03) {
          const angle = Math.random() * Math.PI * 2;
          const radius = innerRadius + Math.random() * (outerRadius - innerRadius) * 0.7;
          const pos = polarToCartesian(0, 0, radius, angle);
          const color = getParticleColor(hoveredWedgeTypeRef.current);
          spawnAmbientParticle(frontParticleContainer, pos.x, pos.y, color);
        }

        // When hovering a wedge, spawn more trail particles toward it - on TOP
        if (hoveredIdx !== null && Math.random() < 0.08) {
          const hoveredWedge = wedges[hoveredIdx];
          if (hoveredWedge && !hoveredWedge.disabled) {
            const angle = hoveredWedge.startAngle + Math.random() * (hoveredWedge.endAngle - hoveredWedge.startAngle);
            const color = getParticleColor(hoveredWedge.type);
            spawnTrailParticle(frontParticleContainer, innerRadius * 0.6, (innerRadius + outerRadius) / 2, angle, color);
          }
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
  // Run once on mount - card is handled by hand component
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
