/**
 * PixiAttackPool - PixiJS-based draggable attack damage chips
 *
 * Renders attack pool chips using PixiJS Graphics and Sprites.
 * Chips are draggable to enemy tokens for damage assignment.
 *
 * Features:
 * - Element-colored chips (physical, fire, ice, coldFire)
 * - Attack type labels (R/S/M for ranged/siege/melee)
 * - Drag with 8px threshold
 * - Integration with CombatDragContext for state coordination
 */

import { useEffect, useRef, useCallback, useState, useId } from "react";
import {
  Container,
  Graphics,
  Sprite,
  Text,
  Texture,
  Assets,
  FederatedPointerEvent,
} from "pixi.js";
import type {
  AvailableAttackPool,
  AttackType,
  AttackElement,
} from "@mage-knight/shared";
import { usePixiApp } from "../../contexts/PixiAppContext";
import { useCombatDrag, type DamageChipData } from "../../contexts/CombatDragContext";
import { AnimationManager, Easing } from "../GameBoard/pixi/animations";
import { PIXI_Z_INDEX } from "../../utils/pixiLayers";

// ============================================================================
// Constants
// ============================================================================

const DRAG_THRESHOLD = 8; // pixels before drag starts

// Element icon paths
const ELEMENT_ICONS: Record<AttackElement, string> = {
  physical: "/assets/icons/attack.png",
  fire: "/assets/icons/fire_attack.png",
  ice: "/assets/icons/ice_attack.png",
  coldFire: "/assets/icons/cold_fire_attack.png",
};

// Attack type labels
const TYPE_LABELS: Record<AttackType, string> = {
  ranged: "R",
  siege: "S",
  melee: "M",
};

// Colors matching CSS palette
const COLORS = {
  // Background colors by element (RGB values for PixiJS)
  CHIP_BG: {
    physical: 0x323037,
    fire: 0x46231e,
    ice: 0x233246,
    coldFire: 0x32233c,
  },
  // Border colors by element
  CHIP_BORDER: {
    physical: 0x78736e,
    fire: 0xa04030,
    ice: 0x4a7090,
    coldFire: 0x6a4a8a,
  },
  // Pool container
  POOL_BG: 0x1a1d2e,
  POOL_BORDER: 0xb87333, // Bronze
  // Text
  TEXT_PRIMARY: 0xffffff,
  TEXT_SECONDARY: 0xb0a090,
  TEXT_MUTED: 0x999999,
};

// Chip dimensions
const CHIP_WIDTH = 70;
const CHIP_HEIGHT = 32;
const CHIP_RADIUS = 6;
const CHIP_GAP = 6;

// Pool layout
const SECTION_GAP = 16;
const POOL_PADDING = 12;

// ============================================================================
// Types
// ============================================================================

interface PixiAttackPoolProps {
  availableAttack: AvailableAttackPool;
  /** Whether this is ranged/siege phase (shows ranged+siege) or attack phase (shows melee) */
  isRangedSiegePhase?: boolean;
  /** Whether to show siege warning */
  showSiegeWarning?: boolean;
}

interface ChipRenderData {
  attackType: AttackType;
  element: AttackElement;
  amount: number;
}

interface DragStartState {
  pointerId: number;
  startX: number;
  startY: number;
  chipData: DamageChipData;
  chipContainer: Container;
  hasDragStarted: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function getAmount(
  pool: AvailableAttackPool,
  type: AttackType,
  element: AttackElement
): number {
  if (type === "ranged") {
    if (element === "physical") return pool.ranged;
    if (element === "fire") return pool.fireRanged;
    if (element === "ice") return pool.iceRanged;
    return 0;
  }
  if (type === "siege") {
    if (element === "physical") return pool.siege;
    if (element === "fire") return pool.fireSiege;
    if (element === "ice") return pool.iceSiege;
    return 0;
  }
  if (type === "melee") {
    if (element === "physical") return pool.melee;
    if (element === "fire") return pool.fireMelee;
    if (element === "ice") return pool.iceMelee;
    if (element === "coldFire") return pool.coldFireMelee;
    return 0;
  }
  return 0;
}

function getChipsForType(
  pool: AvailableAttackPool,
  type: AttackType
): ChipRenderData[] {
  const elements: AttackElement[] =
    type === "melee"
      ? ["physical", "fire", "ice", "coldFire"]
      : ["physical", "fire", "ice"];

  return elements
    .map((element) => ({
      attackType: type,
      element,
      amount: getAmount(pool, type, element),
    }))
    .filter((chip) => chip.amount > 0);
}

function getTypeTotal(pool: AvailableAttackPool, type: AttackType): number {
  if (type === "ranged") {
    return pool.ranged + pool.fireRanged + pool.iceRanged;
  }
  if (type === "siege") {
    return pool.siege + pool.fireSiege + pool.iceSiege;
  }
  if (type === "melee") {
    return pool.melee + pool.fireMelee + pool.iceMelee + pool.coldFireMelee;
  }
  return 0;
}

// ============================================================================
// Component
// ============================================================================

export function PixiAttackPool({
  availableAttack,
  isRangedSiegePhase = false,
  showSiegeWarning = false,
}: PixiAttackPoolProps) {
  const uniqueId = useId();
  const { app, overlayLayer } = usePixiApp();
  const { startDrag, updateDrag, endDrag, cancelDrag } = useCombatDrag();

  const rootContainerRef = useRef<Container | null>(null);
  const animManagerRef = useRef<AnimationManager | null>(null);
  const dragPreviewRef = useRef<Container | null>(null);
  const dragStartRef = useRef<DragStartState | null>(null);
  const isDestroyedRef = useRef(false);

  const [texturesLoaded, setTexturesLoaded] = useState(false);

  // Preload textures
  useEffect(() => {
    const loadTextures = async () => {
      const urls = Object.values(ELEMENT_ICONS);
      try {
        await Promise.all(
          urls.map((url) =>
            Assets.load(url).catch(() => {
              console.warn(`Failed to load attack icon: ${url}`);
            })
          )
        );
      } catch {
        // Continue anyway
      }
      setTexturesLoaded(true);
    };
    loadTextures();
  }, []);

  // Calculate pool position (centered horizontally, between enemies and hand)
  const getPoolPosition = useCallback(() => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    // Enemies at 38% from top, hand at bottom ~18%
    // Position pool at ~70% from top (between them)
    return {
      x: screenWidth / 2,
      y: screenHeight * 0.68,
    };
  }, []);

  // Create a single chip container
  const createChip = useCallback(
    (chipData: ChipRenderData): Container => {
      const { attackType, element, amount } = chipData;
      const container = new Container();
      container.label = `chip-${attackType}-${element}`;

      // Background
      const bg = new Graphics();
      bg.roundRect(0, 0, CHIP_WIDTH, CHIP_HEIGHT, CHIP_RADIUS);
      bg.fill({ color: COLORS.CHIP_BG[element], alpha: 0.92 });
      bg.stroke({ color: COLORS.CHIP_BORDER[element], width: 1.5, alpha: 0.55 });
      container.addChild(bg);

      // Element icon
      const iconPath = ELEMENT_ICONS[element];
      let texture: Texture;
      try {
        texture = Assets.get(iconPath) ?? Texture.EMPTY;
      } catch {
        texture = Texture.EMPTY;
      }

      const icon = new Sprite(texture);
      icon.width = 20;
      icon.height = 20;
      icon.anchor.set(0.5);
      icon.position.set(18, CHIP_HEIGHT / 2);
      container.addChild(icon);

      // Amount text
      const amountText = new Text({
        text: String(amount),
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: 16,
          fontWeight: "bold",
          fill: COLORS.TEXT_PRIMARY,
        },
      });
      amountText.anchor.set(0.5);
      amountText.position.set(CHIP_WIDTH / 2 + 4, CHIP_HEIGHT / 2);
      container.addChild(amountText);

      // Type label (R/S/M)
      const typeText = new Text({
        text: TYPE_LABELS[attackType],
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: 10,
          fontWeight: "600",
          fill: COLORS.TEXT_SECONDARY,
        },
      });
      typeText.anchor.set(0.5);
      typeText.position.set(CHIP_WIDTH - 12, CHIP_HEIGHT / 2);
      container.addChild(typeText);

      // Make interactive
      container.eventMode = "static";
      container.cursor = "grab";

      return container;
    },
    []
  );

  // Create drag preview (larger version of chip)
  const createDragPreview = useCallback(
    (chipData: DamageChipData): Container => {
      const container = new Container();
      container.label = "drag-preview";
      container.zIndex = PIXI_Z_INDEX.DRAG_PREVIEW;

      const scale = 1.5;
      const width = CHIP_WIDTH * scale;
      const height = CHIP_HEIGHT * scale;

      // Background with glow effect
      const glow = new Graphics();
      glow.roundRect(-4, -4, width + 8, height + 8, CHIP_RADIUS + 2);
      glow.fill({ color: COLORS.CHIP_BORDER[chipData.element], alpha: 0.3 });
      container.addChild(glow);

      const bg = new Graphics();
      bg.roundRect(0, 0, width, height, CHIP_RADIUS);
      bg.fill({ color: COLORS.CHIP_BG[chipData.element], alpha: 0.95 });
      bg.stroke({ color: COLORS.CHIP_BORDER[chipData.element], width: 2, alpha: 0.8 });
      container.addChild(bg);

      // Icon
      const iconPath = ELEMENT_ICONS[chipData.element];
      let texture: Texture;
      try {
        texture = Assets.get(iconPath) ?? Texture.EMPTY;
      } catch {
        texture = Texture.EMPTY;
      }

      const icon = new Sprite(texture);
      icon.width = 28;
      icon.height = 28;
      icon.anchor.set(0.5);
      icon.position.set(26, height / 2);
      container.addChild(icon);

      // Amount
      const amountText = new Text({
        text: String(chipData.amount),
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: 22,
          fontWeight: "bold",
          fill: COLORS.TEXT_PRIMARY,
        },
      });
      amountText.anchor.set(0.5);
      amountText.position.set(width / 2 + 6, height / 2);
      container.addChild(amountText);

      // Type label
      const typeText = new Text({
        text: TYPE_LABELS[chipData.attackType],
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: 14,
          fontWeight: "600",
          fill: COLORS.TEXT_SECONDARY,
        },
      });
      typeText.anchor.set(0.5);
      typeText.position.set(width - 16, height / 2);
      container.addChild(typeText);

      // Center the preview on cursor
      container.pivot.set(width / 2, height / 2);

      return container;
    },
    []
  );

  // Handle pointer events for dragging
  const setupDragHandlers = useCallback(
    (chip: Container, chipData: DamageChipData) => {
      chip.on("pointerdown", (event: FederatedPointerEvent) => {
        if (isDestroyedRef.current) return;

        dragStartRef.current = {
          pointerId: event.pointerId,
          startX: event.globalX,
          startY: event.globalY,
          chipData,
          chipContainer: chip,
          hasDragStarted: false,
        };

        // Change cursor
        chip.cursor = "grabbing";
      });
    },
    []
  );

  // Global pointer move handler (attached to stage)
  const handlePointerMove = useCallback(
    (event: FederatedPointerEvent) => {
      const dragStart = dragStartRef.current;
      if (!dragStart || isDestroyedRef.current) return;

      const dx = event.globalX - dragStart.startX;
      const dy = event.globalY - dragStart.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Check threshold
      if (!dragStart.hasDragStarted && distance >= DRAG_THRESHOLD) {
        dragStart.hasDragStarted = true;

        // Notify context
        startDrag(dragStart.chipData, {
          x: dragStart.startX,
          y: dragStart.startY,
        });

        // Dim the original chip (check if container still exists)
        if (dragStart.chipContainer.parent && !dragStart.chipContainer.destroyed) {
          dragStart.chipContainer.alpha = 0.4;
          dragStart.chipContainer.scale.set(0.95);
        }

        // Create drag preview
        if (overlayLayer && !dragPreviewRef.current) {
          const preview = createDragPreview(dragStart.chipData);
          preview.position.set(event.globalX, event.globalY);
          overlayLayer.addChild(preview);
          overlayLayer.sortChildren();
          dragPreviewRef.current = preview;
        }
      }

      if (dragStart.hasDragStarted) {
        // Update context
        updateDrag({ x: event.globalX, y: event.globalY });

        // Move preview
        if (dragPreviewRef.current) {
          dragPreviewRef.current.position.set(event.globalX, event.globalY);
        }
      }
    },
    [startDrag, updateDrag, createDragPreview, overlayLayer]
  );

  // Global pointer up handler
  const handlePointerUp = useCallback(
    (_event: FederatedPointerEvent) => {
      const dragStart = dragStartRef.current;
      if (!dragStart) return;

      // Restore chip appearance (check if container still exists)
      if (dragStart.chipContainer.parent && !dragStart.chipContainer.destroyed) {
        dragStart.chipContainer.alpha = 1;
        dragStart.chipContainer.scale.set(1);
        dragStart.chipContainer.cursor = "grab";
      }

      if (dragStart.hasDragStarted) {
        // End the drag (will call onAssign if valid drop)
        endDrag();
      }

      // Clean up preview
      if (dragPreviewRef.current) {
        dragPreviewRef.current.destroy({ children: true });
        dragPreviewRef.current = null;
      }

      dragStartRef.current = null;
    },
    [endDrag]
  );

  // Escape key cancellation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dragStartRef.current?.hasDragStarted) {
        e.preventDefault();

        // Restore chip
        if (dragStartRef.current) {
          dragStartRef.current.chipContainer.alpha = 1;
          dragStartRef.current.chipContainer.scale.set(1);
          dragStartRef.current.chipContainer.cursor = "grab";
        }

        // Clean up
        cancelDrag();

        if (dragPreviewRef.current) {
          dragPreviewRef.current.destroy({ children: true });
          dragPreviewRef.current = null;
        }

        dragStartRef.current = null;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cancelDrag]);

  // Build the pool UI
  useEffect(() => {
    if (!app || !overlayLayer || !texturesLoaded) return;
    isDestroyedRef.current = false;

    // Calculate which sections to show
    const showRanged = isRangedSiegePhase;
    const showSiege = isRangedSiegePhase;
    const showMelee = !isRangedSiegePhase;

    const sections: { type: AttackType; chips: ChipRenderData[]; total: number }[] = [];

    if (showRanged) {
      const chips = getChipsForType(availableAttack, "ranged");
      const total = getTypeTotal(availableAttack, "ranged");
      if (chips.length > 0 || total > 0) {
        sections.push({ type: "ranged", chips, total });
      }
    }
    if (showSiege) {
      const chips = getChipsForType(availableAttack, "siege");
      const total = getTypeTotal(availableAttack, "siege");
      if (chips.length > 0 || total > 0 || showSiegeWarning) {
        sections.push({ type: "siege", chips, total });
      }
    }
    if (showMelee) {
      const chips = getChipsForType(availableAttack, "melee");
      const total = getTypeTotal(availableAttack, "melee");
      if (chips.length > 0 || total > 0) {
        sections.push({ type: "melee", chips, total });
      }
    }

    // Don't render if no chips
    const totalChips = sections.reduce((sum, s) => sum + s.chips.length, 0);
    if (totalChips === 0 && !showSiegeWarning) return;

    // Create root container
    const rootContainer = new Container();
    rootContainer.label = `attack-pool-${uniqueId}`;
    rootContainer.zIndex = PIXI_Z_INDEX.ATTACK_POOL;
    rootContainer.sortableChildren = true;
    overlayLayer.addChild(rootContainer);
    overlayLayer.sortChildren();
    rootContainerRef.current = rootContainer;

    // Animation manager
    const animManager = new AnimationManager();
    animManager.attach(app.ticker);
    animManagerRef.current = animManager;

    // Calculate total width for centering
    let totalWidth = 0;
    sections.forEach((section, sectionIndex) => {
      const chipsWidth = section.chips.length * (CHIP_WIDTH + CHIP_GAP) - CHIP_GAP;
      const sectionWidth = Math.max(80, chipsWidth);
      totalWidth += sectionWidth;
      if (sectionIndex < sections.length - 1) {
        totalWidth += SECTION_GAP;
      }
    });
    totalWidth += POOL_PADDING * 2;

    // Pool background
    const poolHeight = CHIP_HEIGHT + 50 + POOL_PADDING * 2; // header + chips + padding
    const poolBg = new Graphics();
    poolBg.roundRect(0, 0, totalWidth, poolHeight, 12);
    poolBg.fill({ color: COLORS.POOL_BG, alpha: 0.92 });
    poolBg.stroke({ color: COLORS.POOL_BORDER, width: 2, alpha: 0.55 });
    rootContainer.addChild(poolBg);

    // Position pool
    const poolPos = getPoolPosition();
    rootContainer.position.set(poolPos.x - totalWidth / 2, poolPos.y);

    // Render sections
    let xOffset = POOL_PADDING;

    sections.forEach((section, sectionIndex) => {
      const sectionContainer = new Container();
      sectionContainer.label = `section-${section.type}`;
      sectionContainer.position.set(xOffset, POOL_PADDING);

      // Section header
      const titleText = new Text({
        text: section.type.charAt(0).toUpperCase() + section.type.slice(1),
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: 10,
          fontWeight: "600",
          fill: COLORS.TEXT_MUTED,
          letterSpacing: 1,
        },
      });
      titleText.anchor.set(0.5, 0);
      titleText.position.set(40, 0);
      sectionContainer.addChild(titleText);

      // Total
      const totalText = new Text({
        text: String(section.total),
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: 20,
          fontWeight: "bold",
          fill: COLORS.TEXT_PRIMARY,
        },
      });
      totalText.anchor.set(0.5, 0);
      totalText.position.set(40, 14);
      sectionContainer.addChild(totalText);

      // Chips
      const chipsContainer = new Container();
      chipsContainer.position.set(0, 42);

      section.chips.forEach((chipRenderData, chipIndex) => {
        const chipContainer = createChip(chipRenderData);
        chipContainer.position.set(chipIndex * (CHIP_WIDTH + CHIP_GAP), 0);

        // Create chip data for drag
        const chipData: DamageChipData = {
          id: `damage-${chipRenderData.attackType}-${chipRenderData.element}`,
          attackType: chipRenderData.attackType,
          element: chipRenderData.element,
          amount: chipRenderData.amount,
          poolType: "attack",
        };

        setupDragHandlers(chipContainer, chipData);
        chipsContainer.addChild(chipContainer);

        // Entry animation
        chipContainer.alpha = 0;
        chipContainer.scale.set(0.8);
        setTimeout(() => {
          if (isDestroyedRef.current || !chipContainer.parent) return;
          animManager.animate(`chip-entry-${section.type}-${chipIndex}`, chipContainer, {
            endAlpha: 1,
            endScale: 1,
            duration: 200,
            easing: Easing.easeOutBack,
          });
        }, 50 + chipIndex * 30);
      });

      sectionContainer.addChild(chipsContainer);
      rootContainer.addChild(sectionContainer);

      // Calculate section width
      const chipsWidth = section.chips.length * (CHIP_WIDTH + CHIP_GAP) - CHIP_GAP;
      const sectionWidth = Math.max(80, chipsWidth);
      xOffset += sectionWidth;

      // Section divider
      if (sectionIndex < sections.length - 1) {
        const divider = new Graphics();
        divider.moveTo(xOffset + SECTION_GAP / 2, 8);
        divider.lineTo(xOffset + SECTION_GAP / 2, poolHeight - 8);
        divider.stroke({ color: COLORS.POOL_BORDER, width: 1, alpha: 0.25 });
        rootContainer.addChild(divider);
        xOffset += SECTION_GAP;
      }
    });

    // Attach global pointer handlers to stage
    app.stage.eventMode = "static";
    app.stage.on("pointermove", handlePointerMove);
    app.stage.on("pointerup", handlePointerUp);
    app.stage.on("pointerupoutside", handlePointerUp);

    // Resize handler
    const handleResize = () => {
      if (isDestroyedRef.current || !rootContainer.parent) return;
      const newPos = getPoolPosition();
      rootContainer.position.set(newPos.x - totalWidth / 2, newPos.y);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      isDestroyedRef.current = true;
      window.removeEventListener("resize", handleResize);

      // Remove stage handlers
      app.stage.off("pointermove", handlePointerMove);
      app.stage.off("pointerup", handlePointerUp);
      app.stage.off("pointerupoutside", handlePointerUp);

      // Clean up animation manager
      if (animManagerRef.current) {
        animManagerRef.current.cancelAll();
        animManagerRef.current.detach();
        animManagerRef.current = null;
      }

      // Clean up drag preview
      if (dragPreviewRef.current) {
        dragPreviewRef.current.destroy({ children: true });
        dragPreviewRef.current = null;
      }

      // Remove root container
      if (rootContainerRef.current) {
        if (rootContainerRef.current.parent) {
          rootContainerRef.current.parent.removeChild(rootContainerRef.current);
        }
        rootContainerRef.current.destroy({ children: true });
        rootContainerRef.current = null;
      }
    };
  }, [
    app,
    overlayLayer,
    uniqueId,
    texturesLoaded,
    availableAttack,
    isRangedSiegePhase,
    showSiegeWarning,
    createChip,
    setupDragHandlers,
    handlePointerMove,
    handlePointerUp,
    getPoolPosition,
  ]);

  // This component renders to PixiJS canvas, not DOM
  return null;
}
