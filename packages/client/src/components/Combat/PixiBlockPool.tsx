/**
 * PixiBlockPool - PixiJS-based draggable block chips
 *
 * Renders block pool chips using PixiJS Graphics and Sprites.
 * Chips are draggable to enemy tokens for block assignment.
 *
 * Simpler than AttackPool - just one section with element types.
 *
 * Features:
 * - Element-colored chips (physical, fire, ice, coldFire)
 * - Verdigris/teal color scheme
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
import "@pixi/layout"; // Side-effect import for layout types on Container
import type { AvailableBlockPool, AttackElement } from "@mage-knight/shared";
import { usePixiApp } from "../../contexts/PixiAppContext";
import { useCombatDrag, type BlockChipData } from "../../contexts/CombatDragContext";
import { AnimationManager, Easing } from "../GameBoard/pixi/animations";
import { PIXI_Z_INDEX } from "../../utils/pixiLayers";
import { chipRowLayout } from "../../utils/pixiLayout";

// ============================================================================
// Constants
// ============================================================================

const DRAG_THRESHOLD = 8; // pixels before drag starts

// Block icon paths
const BLOCK_ICONS: Record<AttackElement, string> = {
  physical: "/assets/icons/block.png",
  fire: "/assets/icons/fire_attack.png",
  ice: "/assets/icons/ice_attack.png",
  coldFire: "/assets/icons/cold_fire_attack.png",
};

// All block elements in display order
const BLOCK_ELEMENTS: AttackElement[] = ["physical", "fire", "ice", "coldFire"];

// Colors - verdigris/teal palette for block
const COLORS = {
  // Background colors by element (verdigris base with element tint)
  CHIP_BG: {
    physical: 0x263730,
    fire: 0x3c2d28,
    ice: 0x263744,
    coldFire: 0x322a3c,
  },
  // Border colors by element
  CHIP_BORDER: {
    physical: 0x2e6b5a,
    fire: 0xa04030,
    ice: 0x4a7090,
    coldFire: 0x6a4a8a,
  },
  // Pool container - verdigris accent
  POOL_BG: 0x1a1d2e,
  POOL_BORDER: 0x2e6b5a, // Verdigris
  // Text
  TEXT_PRIMARY: 0xffffff,
  TEXT_SECONDARY: 0xb0a090,
  TEXT_MUTED: 0x999999,
};

// Chip dimensions
const CHIP_WIDTH = 60;
const CHIP_HEIGHT = 32;
const CHIP_RADIUS = 6;
const CHIP_GAP = 6;

// Pool layout
const POOL_PADDING = 12;

// ============================================================================
// Types
// ============================================================================

interface PixiBlockPoolProps {
  availableBlock: AvailableBlockPool;
}

interface ChipRenderData {
  element: AttackElement;
  amount: number;
}

interface DragStartState {
  pointerId: number;
  startX: number;
  startY: number;
  chipData: BlockChipData;
  chipContainer: Container;
  hasDragStarted: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function getAmount(pool: AvailableBlockPool, element: AttackElement): number {
  return pool[element] ?? 0;
}

function getTotal(pool: AvailableBlockPool): number {
  return BLOCK_ELEMENTS.reduce((sum, el) => sum + getAmount(pool, el), 0);
}

function getActiveChips(pool: AvailableBlockPool): ChipRenderData[] {
  return BLOCK_ELEMENTS.map((element) => ({
    element,
    amount: getAmount(pool, element),
  })).filter((chip) => chip.amount > 0);
}

// ============================================================================
// Component
// ============================================================================

export function PixiBlockPool({ availableBlock }: PixiBlockPoolProps) {
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
      const urls = Object.values(BLOCK_ICONS);
      try {
        await Promise.all(
          urls.map((url) =>
            Assets.load(url).catch(() => {
              console.warn(`Failed to load block icon: ${url}`);
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
  // Note: Chip internal layout still uses manual positioning for background/icon/text
  // The parent chipsContainer uses @pixi/layout for horizontal arrangement
  const createChip = useCallback((chipData: ChipRenderData): Container => {
    const { element, amount } = chipData;
    const container = new Container();
    container.label = `block-chip-${element}`;

    // Enable layout participation - parent will handle positioning
    // Fixed dimensions so parent layout knows the size
    container.layout = {
      width: CHIP_WIDTH,
      height: CHIP_HEIGHT,
    };

    // Background
    const bg = new Graphics();
    bg.roundRect(0, 0, CHIP_WIDTH, CHIP_HEIGHT, CHIP_RADIUS);
    bg.fill({ color: COLORS.CHIP_BG[element], alpha: 0.92 });
    bg.stroke({ color: COLORS.CHIP_BORDER[element], width: 1.5, alpha: 0.55 });
    container.addChild(bg);

    // Element icon
    const iconPath = BLOCK_ICONS[element];
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
    amountText.position.set(CHIP_WIDTH - 16, CHIP_HEIGHT / 2);
    container.addChild(amountText);

    // Make interactive
    container.eventMode = "static";
    container.cursor = "grab";

    return container;
  }, []);

  // Create drag preview (larger version of chip)
  const createDragPreview = useCallback((chipData: BlockChipData): Container => {
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
    const iconPath = BLOCK_ICONS[chipData.element];
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
    amountText.position.set(width - 22, height / 2);
    container.addChild(amountText);

    // Center the preview on cursor
    container.pivot.set(width / 2, height / 2);

    return container;
  }, []);

  // Handle pointer events for dragging
  const setupDragHandlers = useCallback(
    (chip: Container, chipData: BlockChipData) => {
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

    const chips = getActiveChips(availableBlock);
    const total = getTotal(availableBlock);

    // Don't render if no chips
    if (chips.length === 0) return;

    // Create root container
    const rootContainer = new Container();
    rootContainer.label = `block-pool-${uniqueId}`;
    rootContainer.zIndex = PIXI_Z_INDEX.BLOCK_POOL;
    rootContainer.sortableChildren = true;
    overlayLayer.addChild(rootContainer);
    overlayLayer.sortChildren();
    rootContainerRef.current = rootContainer;

    // Animation manager
    const animManager = new AnimationManager();
    animManager.attach(app.ticker);
    animManagerRef.current = animManager;

    // Calculate dimensions
    const chipsWidth = chips.length * (CHIP_WIDTH + CHIP_GAP) - CHIP_GAP;
    const totalWidth = Math.max(100, chipsWidth) + POOL_PADDING * 2;
    const poolHeight = CHIP_HEIGHT + 50 + POOL_PADDING * 2; // header + chips + padding

    // Pool background
    const poolBg = new Graphics();
    poolBg.roundRect(0, 0, totalWidth, poolHeight, 12);
    poolBg.fill({ color: COLORS.POOL_BG, alpha: 0.92 });
    poolBg.stroke({ color: COLORS.POOL_BORDER, width: 2, alpha: 0.55 });
    rootContainer.addChild(poolBg);

    // Position pool
    const poolPos = getPoolPosition();
    rootContainer.position.set(poolPos.x - totalWidth / 2, poolPos.y);

    // Section container
    const sectionContainer = new Container();
    sectionContainer.label = "block-section";
    sectionContainer.position.set(POOL_PADDING, POOL_PADDING);

    // Header - "Block" title
    const titleText = new Text({
      text: "Block",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 10,
        fontWeight: "600",
        fill: COLORS.TEXT_MUTED,
        letterSpacing: 1,
      },
    });
    titleText.anchor.set(0.5, 0);
    titleText.position.set((totalWidth - POOL_PADDING * 2) / 2, 0);
    sectionContainer.addChild(titleText);

    // Total
    const totalText = new Text({
      text: String(total),
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 20,
        fontWeight: "bold",
        fill: COLORS.TEXT_PRIMARY,
      },
    });
    totalText.anchor.set(0.5, 0);
    totalText.position.set((totalWidth - POOL_PADDING * 2) / 2, 14);
    sectionContainer.addChild(totalText);

    // Chips container - uses @pixi/layout for horizontal arrangement
    const chipsContainer = new Container();
    chipsContainer.label = "chips-row";
    chipsContainer.layout = chipRowLayout(); // flexDirection: row, gap: CHIP_GAP
    // Center the chips row within the section
    const sectionWidth = totalWidth - POOL_PADDING * 2;
    chipsContainer.position.set((sectionWidth - chipsWidth) / 2, 42);

    chips.forEach((chipRenderData, chipIndex) => {
      const chipContainer = createChip(chipRenderData);
      // No manual position.set needed - layout handles horizontal spacing

      // Create chip data for drag
      const chipData: BlockChipData = {
        id: `block-${chipRenderData.element}`,
        element: chipRenderData.element,
        amount: chipRenderData.amount,
        poolType: "block",
      };

      setupDragHandlers(chipContainer, chipData);
      chipsContainer.addChild(chipContainer);

      // Entry animation
      chipContainer.alpha = 0;
      chipContainer.scale.set(0.8);
      setTimeout(() => {
        if (isDestroyedRef.current || !chipContainer.parent) return;
        animManager.animate(`chip-entry-${chipIndex}`, chipContainer, {
          endAlpha: 1,
          endScale: 1,
          duration: 200,
          easing: Easing.easeOutBack,
        });
      }, 50 + chipIndex * 30);
    });

    sectionContainer.addChild(chipsContainer);
    rootContainer.addChild(sectionContainer);

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
    availableBlock,
    createChip,
    setupDragHandlers,
    handlePointerMove,
    handlePointerUp,
    getPoolPosition,
  ]);

  // This component renders to PixiJS canvas, not DOM
  return null;
}
