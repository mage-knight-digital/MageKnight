/**
 * Game board selectors hook
 *
 * Memoized selectors for move targets, reachable hexes, explore targets, and path preview.
 */

import { useMemo } from "react";
import type { HexCoord, MoveTarget, ReachableHex, ClientGameState } from "@mage-knight/shared";
import type { ExploreTarget } from "../pixi/rendering";
import { findPath } from "../pixi/pathfinding";

interface UseGameBoardSelectorsParams {
  state: ClientGameState | null;
  hoveredHex: HexCoord | null;
  playerPosition: HexCoord | null;
}

interface UseGameBoardSelectorsReturn {
  validMoveTargets: readonly MoveTarget[];
  reachableHexes: readonly ReachableHex[];
  challengeTargetHexes: readonly HexCoord[];
  exploreTargets: ExploreTarget[];
  pathPreview: HexCoord[];
  isPathTerminal: boolean;
}

export function useGameBoardSelectors({
  state,
  hoveredHex,
  playerPosition,
}: UseGameBoardSelectorsParams): UseGameBoardSelectorsReturn {
  // Memoized valid move targets (only in normal_turn)
  const validMoveTargets = useMemo<readonly MoveTarget[]>(() => {
    const va = state?.validActions;
    return va?.mode === "normal_turn" ? (va.move?.targets ?? []) : [];
  }, [state?.validActions]);

  const reachableHexes = useMemo<readonly ReachableHex[]>(() => {
    const va = state?.validActions;
    return va?.mode === "normal_turn" ? (va.move?.reachable ?? []) : [];
  }, [state?.validActions]);

  // Challenge target hexes (only in normal_turn)
  const challengeTargetHexes = useMemo<readonly HexCoord[]>(() => {
    const va = state?.validActions;
    return va?.mode === "normal_turn" ? (va.challenge?.targetHexes ?? []) : [];
  }, [state?.validActions]);

  const exploreTargets = useMemo<ExploreTarget[]>(() => {
    const va = state?.validActions;
    if (va?.mode !== "normal_turn" || !va.explore) return [];
    return va.explore.directions.map((dir) => ({
      coord: dir.targetCoord,
      direction: dir.direction,
      fromTileCoord: dir.fromTileCoord,
    }));
  }, [state?.validActions]);

  // Path preview computation
  const pathPreview = useMemo<HexCoord[]>(() => {
    if (!hoveredHex || !playerPosition) return [];

    const isAdjacent = validMoveTargets.some(
      (t) => t.hex.q === hoveredHex.q && t.hex.r === hoveredHex.r
    );
    const isReachable = reachableHexes.some(
      (r) => r.hex.q === hoveredHex.q && r.hex.r === hoveredHex.r
    );

    if (!isAdjacent && !isReachable) return [];

    return findPath(playerPosition, hoveredHex, reachableHexes, validMoveTargets);
  }, [hoveredHex, playerPosition, reachableHexes, validMoveTargets]);

  const isPathTerminal = useMemo(() => {
    if (pathPreview.length === 0) return false;
    const endHex = pathPreview[pathPreview.length - 1];
    if (!endHex) return false;
    const reachable = reachableHexes.find(
      (r) => r.hex.q === endHex.q && r.hex.r === endHex.r
    );
    const adjacent = validMoveTargets.find(
      (t) => t.hex.q === endHex.q && t.hex.r === endHex.r
    );
    return reachable?.isTerminal || adjacent?.isTerminal || false;
  }, [pathPreview, reachableHexes, validMoveTargets]);

  return {
    validMoveTargets,
    reachableHexes,
    challengeTargetHexes,
    exploreTargets,
    pathPreview,
    isPathTerminal,
  };
}
