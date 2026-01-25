/**
 * CombatDragContext - Shared drag state for PixiJS combat DnD
 *
 * Provides drag state coordination between PixiJS components:
 * - PixiAttackPool / PixiBlockPool: initiate drags, render chips
 * - PixiEnemyTokens: register bounds, show drop highlighting
 * - PixiPowerLine: render connection line during drag
 *
 * Architecture:
 * - React state for drag coordination (isDragging, activeChip, positions)
 * - Enemy bounds registry for hit-testing drop targets
 * - Callbacks for drag lifecycle (start, update, end, cancel)
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { AttackType, AttackElement } from "@mage-knight/shared";

// ============================================================================
// Types
// ============================================================================

export interface DamageChipData {
  id: string;
  attackType: AttackType;
  element: AttackElement;
  amount: number;
  poolType: "attack";
}

export interface BlockChipData {
  id: string;
  element: AttackElement;
  amount: number;
  poolType: "block";
}

export type ChipData = DamageChipData | BlockChipData;

export interface Position {
  x: number;
  y: number;
}

export interface EnemyBounds {
  instanceId: string;
  x: number;
  y: number;
  radius: number;
}

export interface DragState {
  isDragging: boolean;
  activeChip: ChipData | null;
  startPosition: Position | null;
  currentPosition: Position | null;
  hoveredEnemyId: string | null;
}

interface CombatDragContextValue {
  /** Current drag state */
  dragState: DragState;

  /** Start a drag operation */
  startDrag: (chip: ChipData, position: Position) => void;

  /** Update drag position (call on pointermove) */
  updateDrag: (position: Position) => void;

  /** End drag and return result if valid drop, null otherwise */
  endDrag: () => { chip: ChipData; enemyId: string } | null;

  /** Cancel drag without executing action */
  cancelDrag: () => void;

  /** Register enemy bounds for hit-testing */
  registerEnemyBounds: (bounds: EnemyBounds) => void;

  /** Unregister enemy bounds */
  unregisterEnemyBounds: (instanceId: string) => void;

  /** Check if a position is over an enemy (for external use) */
  getHoveredEnemy: (position: Position) => string | null;
}

// ============================================================================
// Initial State
// ============================================================================

const INITIAL_DRAG_STATE: DragState = {
  isDragging: false,
  activeChip: null,
  startPosition: null,
  currentPosition: null,
  hoveredEnemyId: null,
};

// ============================================================================
// Context
// ============================================================================

const CombatDragContext = createContext<CombatDragContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface CombatDragProviderProps {
  children: ReactNode;
  /** Callback when damage/block is assigned to an enemy */
  onAssign?: (chip: ChipData, enemyInstanceId: string) => void;
}

export function CombatDragProvider({
  children,
  onAssign,
}: CombatDragProviderProps) {
  const [dragState, setDragState] = useState<DragState>(INITIAL_DRAG_STATE);

  // Use ref for enemy bounds to avoid re-renders on registration
  const enemyBoundsRef = useRef<Map<string, EnemyBounds>>(new Map());

  // Stable callback ref
  const onAssignRef = useRef(onAssign);
  onAssignRef.current = onAssign;

  // Hit-test a position against registered enemy bounds
  const getHoveredEnemy = useCallback((position: Position): string | null => {
    for (const [instanceId, bounds] of enemyBoundsRef.current) {
      const dx = position.x - bounds.x;
      const dy = position.y - bounds.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= bounds.radius) {
        return instanceId;
      }
    }
    return null;
  }, []);

  const startDrag = useCallback((chip: ChipData, position: Position) => {
    setDragState({
      isDragging: true,
      activeChip: chip,
      startPosition: position,
      currentPosition: position,
      hoveredEnemyId: null,
    });
  }, []);

  const updateDrag = useCallback(
    (position: Position) => {
      const hoveredEnemyId = getHoveredEnemy(position);

      setDragState((prev) => ({
        ...prev,
        currentPosition: position,
        hoveredEnemyId,
      }));
    },
    [getHoveredEnemy]
  );

  const endDrag = useCallback((): { chip: ChipData; enemyId: string } | null => {
    const { activeChip, hoveredEnemyId } = dragState;

    // Reset state first
    setDragState(INITIAL_DRAG_STATE);

    // Return result if valid drop
    if (activeChip && hoveredEnemyId) {
      // Call the assignment callback
      onAssignRef.current?.(activeChip, hoveredEnemyId);

      return {
        chip: activeChip,
        enemyId: hoveredEnemyId,
      };
    }

    return null;
  }, [dragState]);

  const cancelDrag = useCallback(() => {
    setDragState(INITIAL_DRAG_STATE);
  }, []);

  const registerEnemyBounds = useCallback((bounds: EnemyBounds) => {
    enemyBoundsRef.current.set(bounds.instanceId, bounds);
  }, []);

  const unregisterEnemyBounds = useCallback((instanceId: string) => {
    enemyBoundsRef.current.delete(instanceId);
  }, []);

  const value: CombatDragContextValue = {
    dragState,
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
    registerEnemyBounds,
    unregisterEnemyBounds,
    getHoveredEnemy,
  };

  return (
    <CombatDragContext.Provider value={value}>
      {children}
    </CombatDragContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useCombatDrag(): CombatDragContextValue {
  const context = useContext(CombatDragContext);
  if (!context) {
    throw new Error("useCombatDrag must be used within CombatDragProvider");
  }
  return context;
}

/**
 * Optional hook that returns null instead of throwing if used outside provider.
 * Useful for components that may or may not be in a combat context.
 */
export function useCombatDragOptional(): CombatDragContextValue | null {
  return useContext(CombatDragContext);
}
