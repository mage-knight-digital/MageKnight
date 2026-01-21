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
  exploreTargets: ExploreTarget[];
  pathPreview: HexCoord[];
  isPathTerminal: boolean;
}

export function useGameBoardSelectors({
  state,
  hoveredHex,
  playerPosition,
}: UseGameBoardSelectorsParams): UseGameBoardSelectorsReturn {
  // Memoized valid move targets
  const validMoveTargets = useMemo<readonly MoveTarget[]>(
    () => state?.validActions.move?.targets ?? [],
    [state?.validActions.move?.targets]
  );

  const reachableHexes = useMemo<readonly ReachableHex[]>(
    () => state?.validActions.move?.reachable ?? [],
    [state?.validActions.move?.reachable]
  );

  const exploreTargets = useMemo<ExploreTarget[]>(() => {
    if (!state?.validActions.explore) return [];
    return state.validActions.explore.directions.map((dir) => ({
      coord: dir.targetCoord,
      direction: dir.direction,
      fromTileCoord: dir.fromTileCoord,
    }));
  }, [state?.validActions.explore]);

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
    exploreTargets,
    pathPreview,
    isPathTerminal,
  };
}
