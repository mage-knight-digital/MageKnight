/**
 * Hex interaction hook for PixiJS hex grid
 *
 * Manages movement highlights and click handlers for hex interactions.
 * Uses Rust engine LegalAction dispatch exclusively.
 */

import { useCallback } from "react";
import type { HexCoord, MoveTarget, ReachableHex } from "@mage-knight/shared";
import type { MoveHighlight, ExploreTarget } from "../pixi/rendering";
import { findPath } from "../pixi/pathfinding";
import type { LegalAction } from "../../../rust/types";

interface UseHexInteractionParams {
  validMoveTargets: readonly MoveTarget[];
  reachableHexes: readonly ReachableHex[];
  challengeTargetHexes: readonly HexCoord[];
  hexCostReductionTargets: readonly HexCoord[];
  playerPosition: HexCoord | null;
  sendAction: (action: LegalAction) => void;
  isMyTurn: boolean;
  rustMoveActions?: Map<string, LegalAction>;
  rustExploreActions?: Map<string, LegalAction>;
  rustChallengeActions?: Map<string, LegalAction>;
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
  rustMoveActions,
  rustExploreActions,
  rustChallengeActions,
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

      // TODO: Phase 2 — hex cost reduction via legalActions
      if (!playerPosition) return;

      // Check for challenge action first
      const isChallengeTarget = challengeTargetHexes.some(
        (t) => t.q === coord.q && t.r === coord.r
      );

      if (isChallengeTarget) {
        const key = `${coord.q},${coord.r}`;
        const action = rustChallengeActions?.get(key);
        if (action) sendAction(action);
        return;
      }

      const isAdjacentTarget = validMoveTargets.some(
        (t) => t.hex.q === coord.q && t.hex.r === coord.r
      );

      if (isAdjacentTarget) {
        const key = `${coord.q},${coord.r}`;
        const action = rustMoveActions?.get(key);
        if (action) sendAction(action);
        return;
      }

      const isReachableTarget = reachableHexes.some(
        (r) => r.hex.q === coord.q && r.hex.r === coord.r
      );

      if (isReachableTarget) {
        const path = findPath(playerPosition, coord, reachableHexes, validMoveTargets);
        if (path.length > 1 && path[1]) {
          const key = `${path[1].q},${path[1].r}`;
          const action = rustMoveActions?.get(key);
          if (action) sendAction(action);
        }
      }
    },
    [isMyTurn, playerPosition, validMoveTargets, reachableHexes, challengeTargetHexes, sendAction, rustMoveActions, rustChallengeActions]
  );

  // Handle explore click
  const handleExploreClick = useCallback(
    (target: ExploreTarget) => {
      // Block interaction if not player's turn
      if (!isMyTurn) return;

      const action = rustExploreActions?.get(target.direction);
      if (action) sendAction(action);
    },
    [isMyTurn, sendAction, rustExploreActions]
  );

  return {
    getMoveHighlight,
    handleHexClick,
    handleExploreClick,
  };
}
