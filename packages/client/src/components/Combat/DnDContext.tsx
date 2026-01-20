/**
 * DnD Context for Combat - provides drag-and-drop functionality
 * for damage and block allocation in combat phases.
 */

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  useDndMonitor,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent, DragOverEvent, DragMoveEvent } from "@dnd-kit/core";
import type { AttackType, AttackElement } from "@mage-knight/shared";

// ============================================================================
// Types
// ============================================================================

export interface DamageChipData {
  id: string;
  attackType: AttackType;
  element: AttackElement;
  amount: number;
  poolType: "attack" | "block";
}

export interface BlockChipData {
  id: string;
  element: AttackElement;
  amount: number;
  poolType: "block";
}

export type ChipData = DamageChipData | BlockChipData;

interface Position {
  x: number;
  y: number;
}

interface DragState {
  activeChip: ChipData | null;
  overEnemyId: string | null;
  startPosition: Position | null;
  currentPosition: Position | null;
}

interface CombatDnDContextValue {
  dragState: DragState;
  isDragging: boolean;
}

// ============================================================================
// Power Line Component - Visual connection while dragging
// ============================================================================

function PowerLine({ start, end, element }: { start: Position; end: Position; element?: AttackElement }) {
  // Element-specific colors
  const colors: Record<AttackElement, { primary: string; glow: string }> = {
    physical: { primary: "#95a5a6", glow: "rgba(149, 165, 166, 0.6)" },
    fire: { primary: "#e74c3c", glow: "rgba(231, 76, 60, 0.8)" },
    ice: { primary: "#3498db", glow: "rgba(52, 152, 219, 0.8)" },
    coldFire: { primary: "#9b59b6", glow: "rgba(155, 89, 182, 0.8)" },
  };

  const { primary, glow } = colors[element ?? "physical"];

  // Calculate line properties
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return (
    <svg
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      <defs>
        <linearGradient id="powerLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={primary} stopOpacity="0.3" />
          <stop offset="50%" stopColor={primary} stopOpacity="1" />
          <stop offset="100%" stopColor={primary} stopOpacity="0.8" />
        </linearGradient>
        <filter id="powerLineGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer glow */}
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={glow}
        strokeWidth="8"
        strokeLinecap="round"
        filter="url(#powerLineGlow)"
        opacity="0.5"
      />

      {/* Main line */}
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="url(#powerLineGradient)"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Animated particles along the line */}
      <circle r="4" fill={primary} filter="url(#powerLineGlow)">
        <animateMotion
          dur="0.5s"
          repeatCount="indefinite"
          path={`M${start.x},${start.y} L${end.x},${end.y}`}
        />
      </circle>
      <circle r="3" fill="#fff" opacity="0.8">
        <animateMotion
          dur="0.5s"
          repeatCount="indefinite"
          begin="0.15s"
          path={`M${start.x},${start.y} L${end.x},${end.y}`}
        />
      </circle>
      <circle r="2" fill={primary} filter="url(#powerLineGlow)">
        <animateMotion
          dur="0.5s"
          repeatCount="indefinite"
          begin="0.3s"
          path={`M${start.x},${start.y} L${end.x},${end.y}`}
        />
      </circle>

      {/* Pulsing origin point */}
      <circle cx={start.x} cy={start.y} r="6" fill={primary} opacity="0.6">
        <animate attributeName="r" values="6;10;6" dur="0.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0.3;0.6" dur="0.8s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

// ============================================================================
// Context
// ============================================================================

const CombatDnDContext = createContext<CombatDnDContextValue | null>(null);

export function useCombatDnD() {
  const ctx = useContext(CombatDnDContext);
  if (!ctx) {
    throw new Error("useCombatDnD must be used within CombatDnDProvider");
  }
  return ctx;
}

// ============================================================================
// Provider
// ============================================================================

interface CombatDnDProviderProps {
  children: ReactNode;
  onDragEnd: (chip: ChipData, enemyInstanceId: string) => void;
  renderDragOverlay?: (chip: ChipData) => ReactNode;
}

export function CombatDnDProvider({
  children,
  onDragEnd,
  renderDragOverlay,
}: CombatDnDProviderProps) {
  const [dragState, setDragState] = useState<DragState>({
    activeChip: null,
    overEnemyId: null,
    startPosition: null,
    currentPosition: null,
  });

  // Track mouse position during drag for power line
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragState.activeChip) {
      setDragState((prev) => ({
        ...prev,
        currentPosition: { x: e.clientX, y: e.clientY },
      }));
    }
  }, [dragState.activeChip]);

  useEffect(() => {
    if (dragState.activeChip) {
      window.addEventListener("mousemove", handleMouseMove);
      return () => window.removeEventListener("mousemove", handleMouseMove);
    }
  }, [dragState.activeChip, handleMouseMove]);

  // Configure sensors - pointer for mouse/touch, keyboard for a11y
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8, // 8px movement to start drag (prevents accidental drags)
    },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, keyboardSensor);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const chipData = event.active.data.current as ChipData;
    // Get the initial position from the active element's rect
    const rect = event.active.rect.current.initial;
    const startPos = rect ? {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    } : null;

    setDragState({
      activeChip: chipData,
      overEnemyId: null,
      startPosition: startPos,
      currentPosition: startPos,
    });
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (over && typeof over.id === "string" && over.id.startsWith("enemy-drop-")) {
      const enemyId = over.id.replace("enemy-drop-", "");
      setDragState((prev) => ({ ...prev, overEnemyId: enemyId }));
    } else {
      setDragState((prev) => ({ ...prev, overEnemyId: null }));
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const chipData = active.data.current as ChipData;

      if (over && typeof over.id === "string" && over.id.startsWith("enemy-drop-")) {
        const enemyId = over.id.replace("enemy-drop-", "");
        onDragEnd(chipData, enemyId);
      }

      // Reset drag state
      setDragState({
        activeChip: null,
        overEnemyId: null,
        startPosition: null,
        currentPosition: null,
      });
    },
    [onDragEnd]
  );

  const handleDragCancel = useCallback(() => {
    setDragState({
      activeChip: null,
      overEnemyId: null,
      startPosition: null,
      currentPosition: null,
    });
  }, []);

  const contextValue: CombatDnDContextValue = {
    dragState,
    isDragging: dragState.activeChip !== null,
  };

  // Get element for power line color
  const activeElement = dragState.activeChip?.element;

  return (
    <CombatDnDContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}

        {/* Power line visual while dragging */}
        {dragState.startPosition && dragState.currentPosition && (
          <PowerLine
            start={dragState.startPosition}
            end={dragState.currentPosition}
            element={activeElement}
          />
        )}

        <DragOverlay dropAnimation={null}>
          {dragState.activeChip && renderDragOverlay
            ? renderDragOverlay(dragState.activeChip)
            : null}
        </DragOverlay>
      </DndContext>
    </CombatDnDContext.Provider>
  );
}
