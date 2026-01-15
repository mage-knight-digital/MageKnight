import { useState, useEffect, useCallback, useRef, memo, useMemo } from "react";
import {
  UNITS,
  UNIT_TYPE_ELITE,
  UNIT_STATE_READY,
  type UnitId,
  type ClientPlayerUnit,
} from "@mage-knight/shared";
import { getUnitSpriteStyle, isAtlasLoaded } from "../../utils/cardAtlas";
import type { HandViewMode } from "./FloatingHand";
import "./FloatingUnitCarousel.css";

// Unit card size multipliers for each view mode
const VIEW_UNIT_SCALE: Record<HandViewMode, number> = {
  board: 0.18,  // Hidden off screen anyway
  ready: 0.18,  // Ready stance - smaller than cards (units are landscape)
  focus: 0.40,  // Focus mode - big enough to see details
};

// Hook to get responsive unit card dimensions based on view mode
function useUnitDimensions(viewMode: HandViewMode) {
  const [dimensions, setDimensions] = useState({ unitWidth: 200, unitHeight: 140 });

  useEffect(() => {
    const updateDimensions = () => {
      const scale = VIEW_UNIT_SCALE[viewMode];
      const unitHeight = Math.round(window.innerHeight * scale);
      const unitWidth = Math.round(unitHeight * 1.43); // ~10:7 aspect ratio for unit cards
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
  selectedIndex: number;
  isSelected: boolean;
  isHovered: boolean;
  unitWidth: number;
  unitHeight: number;
  onUnitClick: (index: number) => void;
}

// Calculate unit position in the carousel
// Selected unit is centered, others fan out to sides with perspective
function getUnitLayout(
  index: number,
  totalUnits: number,
  selectedIndex: number,
  unitWidth: number
) {
  const offsetFromSelected = index - selectedIndex;

  // Scale spacing relative to unit width
  const scaleFactor = unitWidth / 200;

  // Base spread between cards - tighter than hand cards
  const baseSpread = 120 * scaleFactor;

  // Cards further from selection get pushed further apart (exponential feel)
  const spreadX = offsetFromSelected * baseSpread;

  // Depth effect: cards further from center recede back and down
  const absOffset = Math.abs(offsetFromSelected);
  const scaleZ = Math.max(0.6, 1 - absOffset * 0.15); // Scale down further cards
  const translateZ = -absOffset * 50; // Push back in Z
  const translateY = absOffset * 20 * scaleFactor; // Push down slightly

  // Rotation: cards tilt away from center
  const rotateY = offsetFromSelected * -15; // Tilt into the carousel

  return { spreadX, scaleZ, translateZ, translateY, rotateY };
}

const FloatingUnit = memo(function FloatingUnit({
  unit,
  index,
  totalUnits,
  selectedIndex,
  isSelected,
  isHovered,
  unitWidth,
  unitHeight,
  onUnitClick,
}: FloatingUnitProps) {
  const unitRef = useRef<HTMLDivElement>(null);
  const unitDef = UNITS[unit.unitId];

  // Get sprite style for this unit
  const spriteStyle = useMemo(
    () => isAtlasLoaded() ? getUnitSpriteStyle(unit.unitId, unitHeight) : null,
    [unit.unitId, unitHeight]
  );

  const handleClick = useCallback(() => {
    onUnitClick(index);
  }, [onUnitClick, index]);

  const { spreadX, scaleZ, translateZ, translateY, rotateY } = getUnitLayout(
    index,
    totalUnits,
    selectedIndex,
    unitWidth
  );

  // Z-index: selected unit on top, others based on distance from selection
  const distanceFromSelected = Math.abs(index - selectedIndex);
  const zIndex = isSelected ? 100 : isHovered ? 90 : 50 - distanceFromSelected;

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
    isSelected ? "floating-unit--selected" : "",
    isHovered ? "floating-unit--hovered" : "",
    isReady ? "floating-unit--ready" : "floating-unit--exhausted",
    isWounded ? "floating-unit--wounded" : "",
    isElite ? "floating-unit--elite" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Wrapper handles 3D positioning
  const wrapperStyle: React.CSSProperties = {
    transform: `
      translateX(${spreadX}px)
      translateY(${translateY}px)
      translateZ(${translateZ}px)
      rotateY(${rotateY}deg)
      scale(${scaleZ})
    `,
    zIndex,
    width: unitWidth,
    height: unitHeight,
  };

  // Unit card style
  const unitStyle: React.CSSProperties = {
    ...spriteStyle,
    "--status-glow": getStatusGlow(),
  } as React.CSSProperties;

  return (
    <div
      className="floating-unit-wrapper"
      style={wrapperStyle}
      onClick={handleClick}
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
  selectedIndex: number;
  onSelectUnit: (index: number) => void;
  onActivateUnit?: (index: number) => void;
  viewMode: HandViewMode;
  commandTokens: number;
  level: number;
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
  selectedIndex,
  onSelectUnit,
  viewMode,
  commandTokens,
  level,
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

      // Simple hover detection - find closest unit to mouse X
      const containerRect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - containerRect.left - containerRect.width / 2;

      // Find which unit we're hovering based on spread positions
      let closestIndex = selectedIndex;
      let closestDistance = Infinity;

      for (let i = 0; i < units.length; i++) {
        const { spreadX } = getUnitLayout(i, units.length, selectedIndex, unitWidth);
        const distance = Math.abs(mouseX - spreadX);
        if (distance < closestDistance && distance < unitWidth / 2) {
          closestDistance = distance;
          closestIndex = i;
        }
      }

      if (closestDistance < unitWidth / 2 && closestIndex !== hoveredIndex) {
        setHoveredIndex(closestIndex);
      } else if (closestDistance >= unitWidth / 2 && hoveredIndex !== null) {
        setHoveredIndex(null);
      }
    },
    [viewMode, selectedIndex, units.length, unitWidth, hoveredIndex]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  // CSS classes based on view mode
  const carouselClassName = [
    "floating-unit-carousel",
    `floating-unit-carousel--${viewMode}`,
    units.length === 0 ? "floating-unit-carousel--empty" : "",
  ].filter(Boolean).join(" ");

  // Calculate container width for centering
  const baseSpread = 120 * (unitWidth / 200);
  const carouselWidth = Math.max(unitWidth, (units.length - 1) * baseSpread + unitWidth) + 200;

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

      {(() => {
        const nextLevel = getNextCommandSlotLevel(commandTokens);
        const hasOpenSlots = units.length < commandTokens;
        const atCapacity = units.length === commandTokens;
        const hasNoUnits = units.length === 0;

        // Ghost logic:
        // 1. No units yet -> show "recruit" hint (educational)
        // 2. At capacity but can unlock more -> show "Level X" (aspirational)
        // 3. Has open slots -> no ghost (they know what to do, have room)
        // 4. Max slots -> no ghost (nothing to unlock)
        type GhostType = "recruit" | "level-up" | null;
        let ghostType: GhostType = null;

        if (hasNoUnits) {
          ghostType = "recruit";
        } else if (atCapacity && nextLevel !== null) {
          ghostType = "level-up";
        }

        const showGhost = ghostType !== null;
        // Total items = units + 1 ghost (if applicable)
        const totalItems = units.length + (showGhost ? 1 : 0);
        // Ghost is always at the end
        const ghostIndex = units.length;

        // Edge case: no units and nothing to show (shouldn't happen but handle gracefully)
        if (units.length === 0 && !showGhost) {
          return (
            <div className="floating-unit-carousel__empty-message">
              No units recruited
            </div>
          );
        }

        return (
          <div
            className="floating-unit-carousel__units"
            style={{ width: carouselWidth }}
          >
            {units.map((unit, index) => (
              <FloatingUnit
                key={`${unit.unitId}-${index}`}
                unit={unit}
                index={index}
                totalUnits={totalItems}
                selectedIndex={selectedIndex}
                isSelected={index === selectedIndex}
                isHovered={index === hoveredIndex}
                unitWidth={unitWidth}
                unitHeight={unitHeight}
                onUnitClick={onSelectUnit}
              />
            ))}
            {showGhost && (
              <div
                className={`floating-unit-ghost floating-unit-ghost--${ghostType}`}
                style={{
                  ...(() => {
                    const { spreadX, scaleZ, translateZ, translateY, rotateY } = getUnitLayout(
                      ghostIndex,
                      totalItems,
                      selectedIndex,
                      unitWidth
                    );
                    return {
                      transform: `
                        translateX(${spreadX}px)
                        translateY(${translateY}px)
                        translateZ(${translateZ}px)
                        rotateY(${rotateY}deg)
                        scale(${scaleZ})
                      `,
                      width: unitWidth,
                      height: unitHeight,
                    };
                  })(),
                }}
              >
                <div className="floating-unit-ghost__card" style={{ width: unitWidth, height: unitHeight }}>
                  {ghostType === "recruit" ? (
                    <>
                      <span className="floating-unit-ghost__hint">Recruit units at</span>
                      <span className="floating-unit-ghost__hint">Village or Monastery</span>
                    </>
                  ) : (
                    <span className="floating-unit-ghost__level">Level {nextLevel}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Navigation hints */}
      {units.length > 1 && (
        <div className="floating-unit-carousel__nav-hints">
          <span className="floating-unit-carousel__nav-hint floating-unit-carousel__nav-hint--left">
            ◀ A
          </span>
          <span className="floating-unit-carousel__nav-hint floating-unit-carousel__nav-hint--right">
            D ▶
          </span>
        </div>
      )}
    </div>
  );
}
