/**
 * PixiUnitCarousel - PixiJS-based unit card rendering
 *
 * Renders player units using the shared PixiJS Application via PixiAppContext.
 * The container is added to the overlayLayer for screen-space rendering.
 *
 * Features:
 * - Uses shared PixiJS app (no separate WebGL context)
 * - Screen-space overlay (not affected by camera pan/zoom)
 * - Side-by-side layout (no fan arc/rotation like cards)
 * - Status glow effects (ready=green, spent=gray, wounded=red, elite=gold)
 * - Ghost slot rendering for open command slots
 * - Hover effects (lift)
 * - View mode support (board/ready/focus)
 * - Click infrastructure ready for future unit activation UI (#76)
 */

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Sprite, Graphics, Container, Text, type Texture } from "pixi.js";
import {
  UNITS,
  UNIT_TYPE_ELITE,
  UNIT_STATE_READY,
  type ClientPlayerUnit,
  type UnitId,
  type ActivatableUnit,
} from "@mage-knight/shared";
import { getUnitTexture, getPlaceholderTexture } from "../../utils/pixiTextureLoader";
import { loadAtlas } from "../../utils/cardAtlas";
import { playSound } from "../../utils/audioManager";
import { usePixiApp } from "../../contexts/PixiAppContext";
import { AnimationManager, Easing } from "../GameBoard/pixi/animations";
import { PIXI_Z_INDEX } from "../../utils/pixiLayers";
import { STANDARD_VIEW_MODE_OFFSETS, VIEW_MODE_TRANSITION_MS } from "../../utils/carouselViewModes";
import { CARD_FAN_HOVER, type CardFanViewMode } from "../../utils/cardFanLayout";

// Animation timing constants - synced with hand/tactic carousels
const HOVER_LIFT_DURATION_MS = CARD_FAN_HOVER.durationSec * 1000; // ~265ms synced to audio

// Unit card scale (% of viewport height)
const UNIT_BASE_SCALE = 0.18;

// Unit card aspect ratio (1000:1400 in atlas = 0.714)
const UNIT_ASPECT_RATIO = 0.714;

// Status glow colors
const STATUS_COLORS = {
  ready: 0x2ecc71, // Green
  readyElite: 0xf39c12, // Gold for elite ready
  exhausted: 0x808080, // Gray
  wounded: 0xe74c3c, // Red
  activatable: 0x00ffff, // Cyan - indicates unit can be activated
} as const;

// Use shared view mode offsets (same as hand)
const VIEW_MODE_OFFSETS = STANDARD_VIEW_MODE_OFFSETS;

// Command slots unlock at odd levels: 1@L1, 2@L3, 3@L5, 4@L7, 5@L9
const COMMAND_SLOT_LEVELS = [1, 3, 5, 7, 9] as const;
const MAX_COMMAND_SLOTS = 5;

function getNextCommandSlotLevel(currentSlots: number): number | null {
  if (currentSlots >= MAX_COMMAND_SLOTS) return null;
  return COMMAND_SLOT_LEVELS[currentSlots] ?? null;
}

// Info passed when a unit is clicked
export interface UnitClickInfo {
  unitIndex: number;
  unitInstanceId: string;
  rect: DOMRect;
}

interface PixiUnitCarouselProps {
  units: readonly ClientPlayerUnit[];
  viewMode: CardFanViewMode;
  commandTokens: number;
  /** Whether this pane is active in the carousel (controls visibility) */
  isActive?: boolean;
  /** Activatable unit data from validActions (undefined = no activation possible) */
  activatableUnits?: readonly ActivatableUnit[];
  /** Callback when a unit with activatable abilities is clicked */
  onUnitClick?: (info: UnitClickInfo) => void;
  /** Index of currently selected unit (for menu state) */
  selectedIndex?: number | null;
}

/**
 * Calculate unit position - no overlap, units sit side by side like on the table
 * Units are centered, ghost is off to the right
 */
function getUnitLayout(
  index: number,
  totalUnits: number,
  unitWidth: number,
  isGhost: boolean = false
): { spreadX: number } {
  const centerIndex = (totalUnits - 1) / 2;
  const scaleFactor = unitWidth / 100;
  const gap = 10 * scaleFactor;
  const spreadDistance = unitWidth + gap;

  if (isGhost) {
    if (totalUnits === 0) {
      return { spreadX: 0 };
    }
    const lastUnitOffset = totalUnits - 1 - centerIndex;
    const spreadX = (lastUnitOffset + 1) * spreadDistance;
    return { spreadX };
  }

  const offsetFromCenter = index - centerIndex;
  const spreadX = offsetFromCenter * spreadDistance;
  return { spreadX };
}

export function PixiUnitCarousel({
  units,
  viewMode,
  commandTokens,
  isActive = true,
  activatableUnits,
  onUnitClick,
  selectedIndex: _selectedIndex = null, // Reserved for future selection highlight
}: PixiUnitCarouselProps) {
  void _selectedIndex; // Suppress unused warning until selection highlight is implemented
  const { app, overlayLayer } = usePixiApp();

  // PixiJS object refs
  const containerRef = useRef<Container | null>(null);
  const unitContainersRef = useRef<Map<number, Container>>(new Map());
  const glowGraphicsRef = useRef<Map<number, Graphics>>(new Map());
  const animationManagerRef = useRef<AnimationManager | null>(null);

  // State
  const [atlasLoaded, setAtlasLoaded] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [screenDimensions, setScreenDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Track previous view mode for transitions
  const prevViewModeRef = useRef<CardFanViewMode>(viewMode);

  // App is ready when we have both the shared app and overlay layer
  const isAppReady = !!(app && overlayLayer);

  // Unit dimensions based on viewport
  const unitHeight = useMemo(() => {
    return Math.round(screenDimensions.height * UNIT_BASE_SCALE);
  }, [screenDimensions.height]);
  const unitWidth = Math.round(unitHeight * UNIT_ASPECT_RATIO);

  // Ghost logic
  const hasOpenSlot = units.length < commandTokens;
  const atCapacity = units.length === commandTokens;
  const nextLevel = getNextCommandSlotLevel(commandTokens);
  const hasNoUnits = units.length === 0;

  type GhostType = "open-slot" | "level-up" | null;
  let ghostType: GhostType = null;
  if (hasOpenSlot) {
    ghostType = "open-slot";
  } else if (atCapacity && nextLevel !== null) {
    ghostType = "level-up";
  }
  const showGhost = ghostType !== null;

  // Calculate container dimensions
  const containerWidth = useMemo(() => {
    const scaleFactor = unitWidth / 100;
    const gap = 10 * scaleFactor;
    const spreadDistance = unitWidth + gap;
    const unitsWidth = units.length > 0 ? (units.length - 1) * spreadDistance + unitWidth : 0;
    const ghostWidth = showGhost ? spreadDistance + unitWidth : 0;
    return Math.max(unitWidth, unitsWidth + ghostWidth) + 100;
  }, [units.length, unitWidth, showGhost]);

  const containerHeight = unitHeight + 80; // Extra space for hover lift

  // Unit positions - only depends on count, not unit IDs
  const unitPositions = useMemo(() => {
    return units.map((_, index) => {
      const { spreadX } = getUnitLayout(index, units.length, unitWidth);
      return {
        x: containerWidth / 2 + spreadX,
        y: containerHeight - 20, // Bottom-aligned
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- positions only depend on count, not IDs
  }, [units.length, unitWidth, containerWidth, containerHeight]);

  // Build a map of unit instance IDs to activatable info for quick lookup
  const activatableMap = useMemo(() => {
    const map = new Map<string, ActivatableUnit>();
    if (activatableUnits) {
      for (const au of activatableUnits) {
        map.set(au.unitInstanceId, au);
      }
    }
    return map;
  }, [activatableUnits]);

  // Load atlas on mount
  useEffect(() => {
    loadAtlas().then(() => setAtlasLoaded(true));
  }, []);

  // Track screen resize
  useEffect(() => {
    const handleResize = () => {
      setScreenDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Helper to find which unit index is at a given local position
  const findUnitAtPosition = useCallback(
    (localX: number, localY: number): number | null => {
      // Check units from back to front (higher index = on top for side-by-side)
      for (let i = units.length - 1; i >= 0; i--) {
        const pos = unitPositions[i];
        if (!pos) continue;

        // Unit bounds (pivot is at bottom center)
        const left = pos.x - unitWidth / 2;
        const right = pos.x + unitWidth / 2;
        const top = pos.y - unitHeight;
        const bottom = pos.y;

        // Check if point is inside unit bounds (with tolerance for lift area)
        const liftTolerance = CARD_FAN_HOVER.liftY * 1.5;
        if (localX >= left && localX <= right && localY >= top - liftTolerance && localY <= bottom) {
          return i;
        }
      }
      return null;
    },
    [unitPositions, unitWidth, unitHeight, units.length]
  );

  // Create container on the shared overlay layer
  useEffect(() => {
    if (!app || !overlayLayer) return;

    const unitContainer = new Container();
    unitContainer.label = "unit-carousel";
    unitContainer.sortableChildren = true;
    unitContainer.zIndex = PIXI_Z_INDEX.UNITS;
    unitContainer.eventMode = "none"; // Events handled via DOM
    unitContainer.interactiveChildren = false;
    unitContainer.visible = false; // Start hidden

    overlayLayer.addChild(unitContainer);
    overlayLayer.sortChildren();
    containerRef.current = unitContainer;

    // Create and attach animation manager
    const animManager = new AnimationManager();
    animManager.attach(app.ticker);
    animationManagerRef.current = animManager;

    // Capture refs for cleanup
    const unitContainers = unitContainersRef.current;
    const glowGraphics = glowGraphicsRef.current;

    return () => {
      if (animationManagerRef.current) {
        animationManagerRef.current.cancelAll();
        animationManagerRef.current.detach();
        animationManagerRef.current = null;
      }

      if (containerRef.current) {
        if (containerRef.current.parent) {
          containerRef.current.parent.removeChild(containerRef.current);
        }
        containerRef.current.destroy({ children: true });
        containerRef.current = null;
      }

      unitContainers.clear();
      glowGraphics.clear();
    };
  }, [app, overlayLayer]);

  // Update sprites when units change
  useEffect(() => {
    const unitContainer = containerRef.current;
    if (!unitContainer || !isAppReady || !atlasLoaded) return;

    const updateSprites = async () => {
      unitContainer.removeChildren();
      unitContainersRef.current.clear();
      glowGraphicsRef.current.clear();

      // Preload all textures
      const textures: Texture[] = await Promise.all(
        units.map((unit) =>
          unit ? getUnitTexture(unit.unitId as UnitId) : Promise.resolve(getPlaceholderTexture())
        )
      );

      // Render each unit
      for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        if (!unit) continue;

        const pos = unitPositions[i];
        if (!pos) continue;

        const texture = textures[i];
        const unitDef = UNITS[unit.unitId];
        const isElite = unitDef?.type === UNIT_TYPE_ELITE;
        const isReady = unit.state === UNIT_STATE_READY;
        const isWounded = unit.wounded;

        // Check if this unit has any activatable abilities
        const activatableInfo = activatableMap.get(unit.instanceId);
        const hasActivatableAbility = activatableInfo?.abilities.some(a => a.canActivate) ?? false;

        // Determine glow color based on status
        // Priority: wounded > exhausted > activatable > ready
        let glowColor: number;
        if (isWounded) {
          glowColor = STATUS_COLORS.wounded;
        } else if (!isReady) {
          glowColor = STATUS_COLORS.exhausted;
        } else if (hasActivatableAbility) {
          glowColor = STATUS_COLORS.activatable;
        } else {
          glowColor = isElite ? STATUS_COLORS.readyElite : STATUS_COLORS.ready;
        }

        // Create container for unit
        const cardContainer = new Container();
        cardContainer.x = pos.x;
        cardContainer.y = pos.y;
        cardContainer.pivot.set(unitWidth / 2, unitHeight); // Pivot at bottom center

        // Status glow effect
        const glow = new Graphics();
        // Outer glow layer
        glow.roundRect(-6, -6, unitWidth + 12, unitHeight + 12, unitWidth * 0.04 + 6);
        glow.fill({ color: glowColor, alpha: 0.15 });
        // Middle glow layer
        glow.roundRect(-4, -4, unitWidth + 8, unitHeight + 8, unitWidth * 0.04 + 4);
        glow.fill({ color: glowColor, alpha: 0.2 });
        // Inner glow layer
        glow.roundRect(-2, -2, unitWidth + 4, unitHeight + 4, unitWidth * 0.04 + 2);
        glow.fill({ color: glowColor, alpha: 0.25 });

        // Pulsing effect for ready units
        if (isReady && !isWounded) {
          glow.alpha = 1;
        } else if (isWounded) {
          glow.alpha = 1.2; // More prominent for wounded
        } else {
          glow.alpha = 0.5; // Dim for exhausted
        }

        cardContainer.addChild(glow);
        glowGraphicsRef.current.set(i, glow);

        // Unit sprite
        const sprite = new Sprite(texture);
        sprite.width = unitWidth;
        sprite.height = unitHeight;

        // Dim exhausted units
        if (!isReady && !isWounded) {
          sprite.tint = 0x666666;
          sprite.alpha = 0.7;
        }

        cardContainer.addChild(sprite);

        // Border
        const border = new Graphics();
        border.setStrokeStyle({ width: 2, color: 0x333333 });
        border.roundRect(0, 0, unitWidth, unitHeight, unitWidth * 0.04);
        border.stroke();
        cardContainer.addChild(border);

        // Status badge for wounded/exhausted
        if (isWounded || !isReady) {
          const badgeText = isWounded ? "Wounded" : "Exhausted";
          const badgeBg = new Graphics();
          const badgeColor = isWounded ? STATUS_COLORS.wounded : STATUS_COLORS.exhausted;

          const badge = new Text({
            text: badgeText,
            style: {
              fontSize: Math.round(unitHeight * 0.06),
              fontWeight: "700",
              fill: isWounded ? 0xffffff : 0xaaaaaa,
              fontFamily: "sans-serif",
            },
          });
          badge.anchor.set(0.5);
          badge.x = unitWidth / 2;
          badge.y = unitHeight - Math.round(unitHeight * 0.08);

          // Badge background
          const badgePadding = 4;
          badgeBg.roundRect(
            badge.x - badge.width / 2 - badgePadding,
            badge.y - badge.height / 2 - badgePadding / 2,
            badge.width + badgePadding * 2,
            badge.height + badgePadding,
            4
          );
          badgeBg.fill({ color: badgeColor, alpha: 0.9 });

          cardContainer.addChild(badgeBg);
          cardContainer.addChild(badge);
        }

        // Elite crown indicator
        if (isElite) {
          const crown = new Text({
            text: "★",
            style: {
              fontSize: Math.round(unitHeight * 0.1),
              fill: 0xf39c12,
              fontFamily: "sans-serif",
            },
          });
          crown.anchor.set(0.5, 0);
          crown.x = unitWidth - Math.round(unitWidth * 0.15);
          crown.y = -Math.round(unitHeight * 0.02);
          cardContainer.addChild(crown);
        }

        // Enable for future click handling (#76)
        cardContainer.eventMode = "none";
        cardContainer.zIndex = 50 + i; // Simple z-order (no fan overlap)

        unitContainer.addChild(cardContainer);
        unitContainersRef.current.set(i, cardContainer);
      }

      // Render ghost slot if needed
      if (showGhost) {
        const ghostIndex = units.length;
        const { spreadX } = getUnitLayout(ghostIndex, units.length, unitWidth, true);
        const ghostX = containerWidth / 2 + spreadX;
        const ghostY = containerHeight - 20;

        const ghostContainer = new Container();
        ghostContainer.x = ghostX;
        ghostContainer.y = ghostY;
        ghostContainer.pivot.set(unitWidth / 2, unitHeight);
        ghostContainer.zIndex = 40; // Below units

        // Ghost card background
        const ghostBg = new Graphics();
        ghostBg.setStrokeStyle({ width: 2, color: 0xffffff, alpha: 0.5 });
        ghostBg.roundRect(0, 0, unitWidth, unitHeight, 8);
        ghostBg.stroke();
        ghostBg.fill({
          color: 0x191928,
          alpha: 0.8,
        });
        ghostContainer.addChild(ghostBg);

        // Ghost text
        if (ghostType === "open-slot") {
          if (hasNoUnits) {
            const hint1 = new Text({
              text: "Recruit at",
              style: {
                fontSize: Math.round(unitHeight * 0.06),
                fill: 0xffffff,
                fontFamily: "sans-serif",
              },
            });
            hint1.anchor.set(0.5);
            hint1.x = unitWidth / 2;
            hint1.y = unitHeight / 2 - Math.round(unitHeight * 0.04);
            hint1.alpha = 0.6;
            ghostContainer.addChild(hint1);

            const hint2 = new Text({
              text: "Village or Monastery",
              style: {
                fontSize: Math.round(unitHeight * 0.06),
                fill: 0xffffff,
                fontFamily: "sans-serif",
              },
            });
            hint2.anchor.set(0.5);
            hint2.x = unitWidth / 2;
            hint2.y = unitHeight / 2 + Math.round(unitHeight * 0.04);
            hint2.alpha = 0.6;
            ghostContainer.addChild(hint2);
          } else {
            const hint = new Text({
              text: "Open Slot",
              style: {
                fontSize: Math.round(unitHeight * 0.07),
                fill: 0xffffff,
                fontFamily: "sans-serif",
              },
            });
            hint.anchor.set(0.5);
            hint.x = unitWidth / 2;
            hint.y = unitHeight / 2;
            hint.alpha = 0.6;
            ghostContainer.addChild(hint);
          }
        } else if (ghostType === "level-up") {
          const levelText = new Text({
            text: `Level ${nextLevel}`,
            style: {
              fontSize: Math.round(unitHeight * 0.07),
              fontWeight: "700",
              fill: 0xffffff,
              fontFamily: "sans-serif",
            },
          });
          levelText.anchor.set(0.5);
          levelText.x = unitWidth / 2;
          levelText.y = unitHeight / 2;
          levelText.alpha = 0.7;
          ghostContainer.addChild(levelText);
        }

        unitContainer.addChild(ghostContainer);
      }

      // Add capacity indicator
      const capacityContainer = new Container();
      capacityContainer.y = -40;
      capacityContainer.x = containerWidth / 2;

      const capacityBg = new Graphics();
      capacityBg.roundRect(-50, -20, 100, 40, 8);
      capacityBg.fill({ color: 0x000000, alpha: 0.7 });
      capacityContainer.addChild(capacityBg);

      const capacityLabel = new Text({
        text: "Units",
        style: {
          fontSize: 10,
          fill: 0x888888,
          fontFamily: "sans-serif",
          letterSpacing: 1,
        },
      });
      capacityLabel.anchor.set(0.5);
      capacityLabel.y = -8;
      capacityContainer.addChild(capacityLabel);

      const capacityCount = new Text({
        text: `${units.length} / ${commandTokens}`,
        style: {
          fontSize: 16,
          fontWeight: "700",
          fill: 0xffffff,
          fontFamily: "sans-serif",
        },
      });
      capacityCount.anchor.set(0.5);
      capacityCount.y = 8;
      capacityContainer.addChild(capacityCount);

      unitContainer.addChild(capacityContainer);
      unitContainer.sortChildren();
    };

    updateSprites();
  }, [
    units,
    unitPositions,
    unitWidth,
    unitHeight,
    isAppReady,
    atlasLoaded,
    containerWidth,
    containerHeight,
    showGhost,
    ghostType,
    hasNoUnits,
    nextLevel,
    commandTokens,
    activatableMap,
  ]);

  // Handle hover detection using DOM events
  useEffect(() => {
    const unitContainer = containerRef.current;
    if (!unitContainer || !isAppReady || !isActive) return;

    let lastHoveredIndex: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (viewMode === "board") return;

      const localPos = unitContainer.toLocal({ x: e.clientX, y: e.clientY });
      const unitIndex = findUnitAtPosition(localPos.x, localPos.y);

      if (unitIndex !== lastHoveredIndex) {
        if (unitIndex !== null) {
          setHoveredIndex(unitIndex);
          if (lastHoveredIndex === null) {
            playSound("cardHover");
          }
        } else {
          setHoveredIndex(null);
        }
        lastHoveredIndex = unitIndex;
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, [isAppReady, viewMode, findUnitAtPosition, isActive]);

  // Handle unit clicks via DOM events
  useEffect(() => {
    const unitContainer = containerRef.current;
    if (!unitContainer || !isAppReady || !isActive || !onUnitClick) return;

    const handleClick = (e: MouseEvent) => {
      if (viewMode === "board") return;

      // Check if click target is an interactive element - let those clicks through
      const target = e.target as HTMLElement | null;
      if (target) {
        const interactiveSelector =
          'button, [role="button"], input, select, a, [data-interactive="true"]';
        if (target.closest(interactiveSelector)) {
          return;
        }
      }

      const localPos = unitContainer.toLocal({ x: e.clientX, y: e.clientY });
      const unitIndex = findUnitAtPosition(localPos.x, localPos.y);

      if (unitIndex !== null) {
        const unit = units[unitIndex];
        if (!unit) return;

        // Check if this unit has any activatable abilities
        const activatableInfo = activatableMap.get(unit.instanceId);
        const hasActivatableAbility = activatableInfo?.abilities.some(a => a.canActivate);

        if (hasActivatableAbility) {
          e.stopPropagation();
          e.preventDefault();

          playSound("cardPlay");

          // Get the unit container's global position for menu placement
          const container = unitContainersRef.current.get(unitIndex);
          if (container) {
            const globalPos = container.getGlobalPosition();
            const viewConfig = VIEW_MODE_OFFSETS[viewMode];
            const scale = viewConfig.scale;
            const unitRect = new DOMRect(
              globalPos.x - (unitWidth * scale) / 2,
              globalPos.y - (unitHeight * scale),
              unitWidth * scale,
              unitHeight * scale
            );
            onUnitClick({
              unitIndex,
              unitInstanceId: unit.instanceId,
              rect: unitRect,
            });
          }
        }
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [isAppReady, viewMode, findUnitAtPosition, isActive, units, activatableMap, onUnitClick, unitWidth, unitHeight]);

  // Track previous hovered index for animation
  const prevHoveredIndexRef = useRef<number | null>(null);

  // Handle hover animation
  useEffect(() => {
    const containers = unitContainersRef.current;
    const animManager = animationManagerRef.current;
    const prevHovered = prevHoveredIndexRef.current;

    // Animate previously hovered unit back down
    if (prevHovered !== null && prevHovered !== hoveredIndex) {
      const prevContainer = containers.get(prevHovered);
      const prevPos = unitPositions[prevHovered];
      if (prevContainer && prevPos) {
        if (animManager) {
          animManager.animate(`unit-hover-${prevHovered}`, prevContainer, {
            endY: prevPos.y,
            duration: HOVER_LIFT_DURATION_MS,
            easing: Easing.easeOutCubic,
          });
        } else {
          prevContainer.y = prevPos.y;
        }
      }
    }

    // Animate newly hovered unit up
    if (hoveredIndex !== null && viewMode !== "board") {
      const container = containers.get(hoveredIndex);
      const pos = unitPositions[hoveredIndex];
      if (container && pos) {
        const liftY = CARD_FAN_HOVER.liftY * 0.25; // Minimal lift (7.5px) - matches hand
        const targetY = pos.y - liftY;
        if (animManager) {
          animManager.animate(`unit-hover-${hoveredIndex}`, container, {
            endY: targetY,
            duration: HOVER_LIFT_DURATION_MS,
            easing: Easing.easeOutCubic,
          });
        } else {
          container.y = targetY;
        }
        // Bring hovered unit to front
        container.zIndex = 100;
        containerRef.current?.sortChildren();
      }
    }

    // Reset z-index when hover ends
    if (prevHovered !== null && hoveredIndex === null) {
      const prevContainer = containers.get(prevHovered);
      if (prevContainer) {
        prevContainer.zIndex = 50 + prevHovered;
        containerRef.current?.sortChildren();
      }
    }

    prevHoveredIndexRef.current = hoveredIndex;
  }, [hoveredIndex, unitPositions, viewMode]);

  // Update position, scale, and visibility based on view mode
  useEffect(() => {
    const unitContainer = containerRef.current;
    if (!unitContainer) return;

    const viewConfig = VIEW_MODE_OFFSETS[viewMode];
    const animManager = animationManagerRef.current;
    const prevViewMode = prevViewModeRef.current;
    const isViewModeChange = prevViewMode !== viewMode;

    // Set pivot at bottom center
    unitContainer.pivot.set(containerWidth / 2, containerHeight);

    // Base position: horizontally centered, bottom of screen
    const baseX = screenDimensions.width / 2;
    const baseY = screenDimensions.height;

    const yOffset = viewConfig.yOffset * screenDimensions.height;
    const targetX = baseX;
    const targetY = baseY + yOffset;
    let targetScale: number = viewConfig.scale;

    // Constrain scale for focus mode
    if (viewMode === "focus") {
      const horizontalPadding = 40;
      const maxScaledWidth = screenDimensions.width - horizontalPadding;
      const maxHorizontalScale = maxScaledWidth / containerWidth;

      const verticalPadding = 60;
      const availableHeight = screenDimensions.height - verticalPadding;
      const maxVerticalScale = availableHeight / containerHeight;

      targetScale = Math.min(viewConfig.scale, maxHorizontalScale, maxVerticalScale);
    }

    // Show/hide based on active state and view config
    const shouldBeVisible = isActive && viewConfig.visible;

    if (shouldBeVisible) {
      unitContainer.visible = true;
      unitContainer.eventMode = "static";
    }

    if (isViewModeChange && animManager && shouldBeVisible) {
      animManager.animate("unit-view-mode", unitContainer, {
        endX: targetX,
        endY: targetY,
        endScale: targetScale,
        duration: VIEW_MODE_TRANSITION_MS,
        easing: Easing.easeOutCubic,
        onComplete: () => {
          if (!viewConfig.visible || !isActive) {
            unitContainer.visible = false;
            unitContainer.eventMode = "none";
          }
        },
      });
    } else {
      unitContainer.x = targetX;
      unitContainer.y = targetY;
      unitContainer.scale.set(targetScale);
      unitContainer.visible = shouldBeVisible;
      unitContainer.eventMode = shouldBeVisible ? "static" : "none";
    }

    prevViewModeRef.current = viewMode;
  }, [viewMode, screenDimensions.width, screenDimensions.height, containerWidth, containerHeight, isActive]);

  // Hide/show based on isActive (carousel pane visibility)
  useEffect(() => {
    const unitContainer = containerRef.current;
    if (!unitContainer) return;

    if (!isActive) {
      unitContainer.visible = false;
      unitContainer.eventMode = "none";
    } else {
      // When becoming active, ensure position is correct and respect view mode's visibility
      const viewConfig = VIEW_MODE_OFFSETS[viewMode];

      // Set pivot for bottom-center origin
      unitContainer.pivot.set(containerWidth / 2, containerHeight);

      // Calculate correct position
      const baseX = screenDimensions.width / 2;
      const baseY = screenDimensions.height;
      const yOffset = viewConfig.yOffset * screenDimensions.height;

      let targetScale: number = viewConfig.scale;
      if (viewMode === "focus") {
        const horizontalPadding = 40;
        const maxScaledWidth = screenDimensions.width - horizontalPadding;
        const maxHorizontalScale = maxScaledWidth / containerWidth;
        const verticalPadding = 60;
        const availableHeight = screenDimensions.height - verticalPadding;
        const maxVerticalScale = availableHeight / containerHeight;
        targetScale = Math.min(viewConfig.scale, maxHorizontalScale, maxVerticalScale);
      }

      // Apply position immediately
      unitContainer.x = baseX;
      unitContainer.y = baseY + yOffset;
      unitContainer.scale.set(targetScale);
      unitContainer.visible = viewConfig.visible;
      unitContainer.eventMode = viewConfig.visible ? "static" : "none";
    }
  }, [isActive, viewMode, screenDimensions.width, screenDimensions.height, containerWidth, containerHeight]);

  // No DOM element needed - renders to PixiJS overlay layer
  return null;
}
