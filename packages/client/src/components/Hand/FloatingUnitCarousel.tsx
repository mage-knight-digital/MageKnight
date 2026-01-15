import { useState, useEffect, useCallback, useRef, memo, useMemo } from "react";
import {
  UNITS,
  UNIT_TYPE_ELITE,
  UNIT_STATE_READY,
  type ClientPlayerUnit,
} from "@mage-knight/shared";
import { getUnitSpriteStyle, isAtlasLoaded } from "../../utils/cardAtlas";
import type { HandViewMode } from "./FloatingHand";
import "./FloatingUnitCarousel.css";

// Unit card size multipliers for each view mode (% of viewport height)
const VIEW_UNIT_SCALE: Record<HandViewMode, number> = {
  board: 0.18,  // Hidden off screen anyway
  ready: 0.18,  // Ready stance - smaller than deed cards
  focus: 0.40,  // Focus mode - big enough to see details
};

// Hook to get responsive unit card dimensions based on view mode
// Unit cards are portrait (1000x1400 in atlas with even/odd layout = 0.714 aspect ratio)
function useUnitDimensions(viewMode: HandViewMode) {
  const [dimensions, setDimensions] = useState({ unitWidth: 100, unitHeight: 140 });

  useEffect(() => {
    const updateDimensions = () => {
      const scale = VIEW_UNIT_SCALE[viewMode];
      const unitHeight = Math.round(window.innerHeight * scale);
      const unitWidth = Math.round(unitHeight * 0.714); // 1000:1400 aspect ratio (portrait)
      setDimensions({ unitWidth, unitHeight });
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [viewMode]);

  return dimensions;
}

interface FloatingUnitProps {
  unit: ClientPlayerUnit;
  index: number;
  totalUnits: number;
  isHovered: boolean;
  unitWidth: number;
  unitHeight: number;
}

// Calculate unit position - no overlap, units sit side by side like on the table
function getUnitLayout(index: number, totalSlots: number, unitWidth: number) {
  const centerIndex = (totalSlots - 1) / 2;
  const offsetFromCenter = index - centerIndex;

  // Scale spacing relative to unit width
  const scaleFactor = unitWidth / 100;

  // Full card width + small gap (no overlap)
  const gap = 10 * scaleFactor;
  const spreadDistance = unitWidth + gap;
  const spreadX = offsetFromCenter * spreadDistance;

  return { spreadX };
}

const FloatingUnit = memo(function FloatingUnit({
  unit,
  index,
  totalUnits,
  isHovered,
  unitWidth,
  unitHeight,
}: FloatingUnitProps) {
  const unitRef = useRef<HTMLDivElement>(null);
  const unitDef = UNITS[unit.unitId];

  // Get sprite style for this unit
  const spriteStyle = useMemo(
    () => isAtlasLoaded() ? getUnitSpriteStyle(unit.unitId, unitHeight) : null,
    [unit.unitId, unitHeight]
  );

  const { spreadX } = getUnitLayout(index, totalUnits, unitWidth);

  // Z-index: hovered cards come to front
  const zIndex = isHovered ? 100 : 50;

  const isElite = unitDef?.type === UNIT_TYPE_ELITE;
  const isReady = unit.state === UNIT_STATE_READY;
  const isWounded = unit.wounded;

  // Status glow colors
  const getStatusGlow = () => {
    if (isWounded) return "rgba(231, 76, 60, 0.6)"; // Red for wounded
    if (!isReady) return "rgba(128, 128, 128, 0.4)"; // Gray for exhausted
    return isElite
      ? "rgba(243, 156, 18, 0.5)" // Gold for elite ready
      : "rgba(46, 204, 113, 0.5)"; // Green for regular ready
  };

  const classNames = [
    "floating-unit",
    isHovered ? "floating-unit--hovered" : "",
    isReady ? "floating-unit--ready" : "floating-unit--exhausted",
    isWounded ? "floating-unit--wounded" : "",
    isElite ? "floating-unit--elite" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Wrapper style - positioning (no rotation or arc, just side by side)
  const wrapperStyle: React.CSSProperties = {
    transform: `translateX(${spreadX}px)`,
    zIndex,
    width: unitWidth,
    height: unitHeight,
  };

  // Unit card style
  const unitStyle: React.CSSProperties = {
    ...spriteStyle,
    transform: isHovered ? "scale(1.1) translateY(-10px)" : "scale(1)",
    "--status-glow": getStatusGlow(),
  } as React.CSSProperties;

  return (
    <div
      className="floating-unit-wrapper"
      style={wrapperStyle}
      data-unit-index={index}
    >
      <div ref={unitRef} className={classNames} style={unitStyle}>
        {!spriteStyle && (
          <span className="floating-unit__fallback">
            {unitDef?.name ?? unit.unitId}
          </span>
        )}

        {/* Status indicator badge */}
        <div className="floating-unit__status">
          {isWounded && <span className="floating-unit__badge floating-unit__badge--wounded">Wounded</span>}
          {!isReady && !isWounded && <span className="floating-unit__badge floating-unit__badge--exhausted">Exhausted</span>}
        </div>

        {/* Elite indicator */}
        {isElite && <div className="floating-unit__elite-crown">★</div>}
      </div>
    </div>
  );
});

interface FloatingUnitCarouselProps {
  units: readonly ClientPlayerUnit[];
  viewMode: HandViewMode;
  commandTokens: number;
}

// Command slots unlock at odd levels: 1@L1, 2@L3, 3@L5, 4@L7, 5@L9
const COMMAND_SLOT_LEVELS = [1, 3, 5, 7, 9] as const;
const MAX_COMMAND_SLOTS = 5;

function getNextCommandSlotLevel(currentSlots: number): number | null {
  if (currentSlots >= MAX_COMMAND_SLOTS) return null;
  return COMMAND_SLOT_LEVELS[currentSlots] ?? null;
}

export function FloatingUnitCarousel({
  units,
  viewMode,
  commandTokens,
}: FloatingUnitCarouselProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { unitWidth, unitHeight } = useUnitDimensions(viewMode);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle mouse movement for hover detection
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (viewMode === "board" || !containerRef.current) {
        if (hoveredIndex !== null) setHoveredIndex(null);
        return;
      }

      const containerRect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - containerRect.left - containerRect.width / 2;

      // Find which unit we're hovering (check from top to bottom in z-order)
      let hitIndex: number | null = null;
      for (let i = units.length - 1; i >= 0; i--) {
        const { spreadX } = getUnitLayout(i, units.length, unitWidth);
        const cardLeft = spreadX - unitWidth / 2;
        const cardRight = spreadX + unitWidth / 2;
        if (mouseX >= cardLeft && mouseX <= cardRight) {
          hitIndex = i;
          break;
        }
      }

      if (hitIndex !== hoveredIndex) {
        setHoveredIndex(hitIndex);
      }
    },
    [viewMode, units.length, unitWidth, hoveredIndex]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  // Ghost logic:
  // - Open slot (units < commandTokens): show empty slot where next unit goes
  // - At capacity but can level up: show "Level X" tease
  // - Maxed out (5/5): no ghost
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
  // Total slots to lay out = units + 1 ghost if showing
  const totalSlots = units.length + (showGhost ? 1 : 0);
  // Ghost goes in the last position (rightmost)
  const ghostIndex = units.length;

  // CSS classes based on view mode
  const carouselClassName = [
    "floating-unit-carousel",
    `floating-unit-carousel--${viewMode}`,
    units.length === 0 ? "floating-unit-carousel--empty" : "",
  ].filter(Boolean).join(" ");

  // Calculate container width (no overlap - full card width + gap)
  const scaleFactor = unitWidth / 100;
  const gap = 10 * scaleFactor;
  const spreadDistance = unitWidth + gap;
  const carouselWidth = Math.max(unitWidth, (totalSlots - 1) * spreadDistance + unitWidth) + 50;

  return (
    <div
      className={carouselClassName}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      ref={containerRef}
    >
      {/* Command token indicator */}
      <div className="floating-unit-carousel__capacity">
        <span className="floating-unit-carousel__capacity-label">Units</span>
        <span className="floating-unit-carousel__capacity-count">
          {units.length} / {commandTokens}
        </span>
      </div>

      <div
        className="floating-unit-carousel__units"
        style={{ width: carouselWidth }}
      >
        {units.map((unit, index) => (
          <FloatingUnit
            key={`${unit.unitId}-${index}`}
            unit={unit}
            index={index}
            totalUnits={totalSlots}
            isHovered={index === hoveredIndex}
            unitWidth={unitWidth}
            unitHeight={unitHeight}
          />
        ))}
        {showGhost && (
          <div
            className={`floating-unit-ghost floating-unit-ghost--${ghostType}`}
            style={{
              ...(() => {
                const { spreadX } = getUnitLayout(ghostIndex, totalSlots, unitWidth);
                return {
                  transform: `translateX(${spreadX}px)`,
                  width: unitWidth,
                  height: unitHeight,
                  zIndex: 40,
                };
              })(),
            }}
          >
            <div className="floating-unit-ghost__card">
              {ghostType === "open-slot" ? (
                hasNoUnits ? (
                  <>
                    <span className="floating-unit-ghost__hint">Recruit at</span>
                    <span className="floating-unit-ghost__hint">Village or Monastery</span>
                  </>
                ) : (
                  <span className="floating-unit-ghost__hint">Open Slot</span>
                )
              ) : (
                <span className="floating-unit-ghost__level">Level {nextLevel}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
