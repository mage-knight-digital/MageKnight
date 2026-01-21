/**
 * Hex interaction hook for PixiJS hex grid
 *
 * Manages movement highlights and click handlers for hex interactions.
 */

import { useCallback } from "react";
import type { HexCoord, MoveTarget, ReachableHex, PlayerAction } from "@mage-knight/shared";
import { MOVE_ACTION, EXPLORE_ACTION } from "@mage-knight/shared";
import type { MoveHighlight, ExploreTarget } from "../pixi/rendering";
import { findPath } from "../pixi/pathfinding";

interface UseHexInteractionParams {
  validMoveTargets: readonly MoveTarget[];
  reachableHexes: readonly ReachableHex[];
  playerPosition: HexCoord | null;
  sendAction: (action: PlayerAction) => void;
}

interface UseHexInteractionReturn {
  getMoveHighlight: (coord: HexCoord) => MoveHighlight;
  handleHexClick: (coord: HexCoord) => void;
  handleExploreClick: (target: ExploreTarget) => void;
}

export function useHexInteraction({
  validMoveTargets,
  reachableHexes,
  playerPosition,
  sendAction,
}: UseHexInteractionParams): UseHexInteractionReturn {
  // Movement highlight getter
  const getMoveHighlight = useCallback(
    (coord: HexCoord): MoveHighlight => {
      const adjacentTarget = validMoveTargets.find(
        (t) => t.hex.q === coord.q && t.hex.r === coord.r
      );
      if (adjacentTarget) {
        if (adjacentTarget.isTerminal) {
          return { type: "terminal", cost: adjacentTarget.cost };
        }
        return { type: "adjacent", cost: adjacentTarget.cost };
      }

      const reachable = reachableHexes.find(
        (r) => r.hex.q === coord.q && r.hex.r === coord.r
      );
      if (reachable) {
        if (reachable.isTerminal) {
          return { type: "terminal", cost: reachable.totalCost };
        }
        return { type: "reachable", cost: reachable.totalCost };
      }

      return { type: "none" };
    },
    [validMoveTargets, reachableHexes]
  );

  // Handle hex click for movement
  const handleHexClick = useCallback(
    (coord: HexCoord) => {
      if (!playerPosition) return;

      const isAdjacentTarget = validMoveTargets.some(
        (t) => t.hex.q === coord.q && t.hex.r === coord.r
      );

      if (isAdjacentTarget) {
        sendAction({ type: MOVE_ACTION, target: coord });
        return;
      }

      const isReachableTarget = reachableHexes.some(
        (r) => r.hex.q === coord.q && r.hex.r === coord.r
      );

      if (isReachableTarget) {
        const path = findPath(playerPosition, coord, reachableHexes, validMoveTargets);
        if (path.length > 1 && path[1]) {
          sendAction({ type: MOVE_ACTION, target: path[1] });
        }
      }
    },
    [playerPosition, validMoveTargets, reachableHexes, sendAction]
  );

  // Handle explore click
  const handleExploreClick = useCallback(
    (target: ExploreTarget) => {
      sendAction({
        type: EXPLORE_ACTION,
        direction: target.direction,
        fromTileCoord: target.fromTileCoord,
      });
    },
    [sendAction]
  );

  return {
    getMoveHighlight,
    handleHexClick,
    handleExploreClick,
  };
}
