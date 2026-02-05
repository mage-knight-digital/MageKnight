/**
 * Hex interaction hook for PixiJS hex grid
 *
 * Manages movement highlights and click handlers for hex interactions.
 */

import { useCallback } from "react";
import type { HexCoord, MoveTarget, ReachableHex, PlayerAction } from "@mage-knight/shared";
import { MOVE_ACTION, EXPLORE_ACTION, CHALLENGE_RAMPAGING_ACTION, RESOLVE_HEX_COST_REDUCTION_ACTION } from "@mage-knight/shared";
import type { MoveHighlight, ExploreTarget } from "../pixi/rendering";
import { findPath } from "../pixi/pathfinding";

interface UseHexInteractionParams {
  validMoveTargets: readonly MoveTarget[];
  reachableHexes: readonly ReachableHex[];
  challengeTargetHexes: readonly HexCoord[];
  hexCostReductionTargets: readonly HexCoord[];
  playerPosition: HexCoord | null;
  sendAction: (action: PlayerAction) => void;
  isMyTurn: boolean;
}

interface UseHexInteractionReturn {
  getMoveHighlight: (coord: HexCoord) => MoveHighlight;
  handleHexClick: (coord: HexCoord) => void;
  handleExploreClick: (target: ExploreTarget) => void;
}

export function useHexInteraction({
  validMoveTargets,
  reachableHexes,
  challengeTargetHexes,
  hexCostReductionTargets,
  playerPosition,
  sendAction,
  isMyTurn,
}: UseHexInteractionParams): UseHexInteractionReturn {
  // Movement highlight getter
  const getMoveHighlight = useCallback(
    (coord: HexCoord): MoveHighlight => {
      // Check hex cost reduction targets first (takes precedence when in that mode)
      const isCostReductionTarget = hexCostReductionTargets.some(
        (t) => t.q === coord.q && t.r === coord.r
      );
      if (isCostReductionTarget) {
        return { type: "cost_reduction" };
      }

      // Check challenge targets first (takes precedence over movement)
      const isChallengeTarget = challengeTargetHexes.some(
        (t) => t.q === coord.q && t.r === coord.r
      );
      if (isChallengeTarget) {
        return { type: "challenge" };
      }

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
    [validMoveTargets, reachableHexes, challengeTargetHexes, hexCostReductionTargets]
  );

  // Handle hex click for movement or challenge
  const handleHexClick = useCallback(
    (coord: HexCoord) => {
      // Block interaction if not player's turn
      if (!isMyTurn) return;

      // Check for hex cost reduction first
      const isCostReductionTarget = hexCostReductionTargets.some(
        (t) => t.q === coord.q && t.r === coord.r
      );
      if (isCostReductionTarget) {
        sendAction({ type: RESOLVE_HEX_COST_REDUCTION_ACTION, coordinate: coord });
        return;
      }

      if (!playerPosition) return;

      // Check for challenge action first
      const isChallengeTarget = challengeTargetHexes.some(
        (t) => t.q === coord.q && t.r === coord.r
      );

      if (isChallengeTarget) {
        sendAction({ type: CHALLENGE_RAMPAGING_ACTION, targetHex: coord });
        return;
      }

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
    [isMyTurn, playerPosition, validMoveTargets, reachableHexes, challengeTargetHexes, hexCostReductionTargets, sendAction]
  );

  // Handle explore click
  const handleExploreClick = useCallback(
    (target: ExploreTarget) => {
      // Block interaction if not player's turn
      if (!isMyTurn) return;

      sendAction({
        type: EXPLORE_ACTION,
        direction: target.direction,
        fromTileCoord: target.fromTileCoord,
      });
    },
    [isMyTurn, sendAction]
  );

  return {
    getMoveHighlight,
    handleHexClick,
    handleExploreClick,
  };
}
