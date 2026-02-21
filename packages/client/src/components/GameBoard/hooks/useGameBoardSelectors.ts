/**
 * Game board selectors hook
 *
 * Memoized selectors for move targets, reachable hexes, explore targets, and path preview.
 * Supports both TS engine (validActions) and Rust engine (legalActions) modes.
 */

import { useMemo } from "react";
import type { HexCoord, HexDirection, MoveTarget, ReachableHex, ClientGameState } from "@mage-knight/shared";
import { findTileCenterForHex, calculateTilePlacementPosition } from "@mage-knight/shared";
import type { ExploreTarget } from "../pixi/rendering";
import { findPath } from "../pixi/pathfinding";
import type { LegalAction } from "../../../rust/types";
import {
  extractMoveTargets,
  extractExploreDirections,
  extractChallengeTargets,
} from "../../../rust/legalActionUtils";

interface UseGameBoardSelectorsParams {
  state: ClientGameState | null;
  hoveredHex: HexCoord | null;
  playerPosition: HexCoord | null;
  legalActions?: LegalAction[];
  isRustMode?: boolean;
}

interface UseGameBoardSelectorsReturn {
  validMoveTargets: readonly MoveTarget[];
  reachableHexes: readonly ReachableHex[];
  challengeTargetHexes: readonly HexCoord[];
  hexCostReductionTargets: readonly HexCoord[];
  exploreTargets: ExploreTarget[];
  pathPreview: HexCoord[];
  isPathTerminal: boolean;
  /** In Rust mode, maps hex key "q,r" to the LegalAction for that move. */
  rustMoveActions: Map<string, LegalAction>;
  /** In Rust mode, maps direction to the LegalAction for that explore. */
  rustExploreActions: Map<string, LegalAction>;
  /** In Rust mode, maps hex key "q,r" to the LegalAction for that challenge. */
  rustChallengeActions: Map<string, LegalAction>;
}

export function useGameBoardSelectors({
  state,
  hoveredHex,
  playerPosition,
  legalActions = [],
  isRustMode = false,
}: UseGameBoardSelectorsParams): UseGameBoardSelectorsReturn {
  // Rust mode: derive move targets from legalActions
  const rustMoveOptions = useMemo(
    () => isRustMode ? extractMoveTargets(legalActions) : [],
    [isRustMode, legalActions]
  );

  const rustExploreOptions = useMemo(
    () => isRustMode ? extractExploreDirections(legalActions) : [],
    [isRustMode, legalActions]
  );

  const rustChallengeOptions = useMemo(
    () => isRustMode ? extractChallengeTargets(legalActions) : [],
    [isRustMode, legalActions]
  );

  // Memoized valid move targets
  const validMoveTargets = useMemo<readonly MoveTarget[]>(() => {
    if (isRustMode) {
      return rustMoveOptions.map(opt => ({
        hex: opt.hex,
        cost: opt.cost,
        // Rust doesn't provide isTerminal yet — default false
      }));
    }
    const va = state?.validActions;
    return va?.mode === "normal_turn" ? (va.move?.targets ?? []) : [];
  }, [isRustMode, rustMoveOptions, state?.validActions]);

  const reachableHexes = useMemo<readonly ReachableHex[]>(() => {
    if (isRustMode) return []; // Rust doesn't provide multi-hop reachability yet
    const va = state?.validActions;
    return va?.mode === "normal_turn" ? (va.move?.reachable ?? []) : [];
  }, [isRustMode, state?.validActions]);

  // Challenge target hexes
  const challengeTargetHexes = useMemo<readonly HexCoord[]>(() => {
    if (isRustMode) {
      return rustChallengeOptions.map(opt => opt.hex);
    }
    const va = state?.validActions;
    return va?.mode === "normal_turn" ? (va.challenge?.targetHexes ?? []) : [];
  }, [isRustMode, rustChallengeOptions, state?.validActions]);

  // Hex cost reduction targets (only in pending_hex_cost_reduction)
  const hexCostReductionTargets = useMemo<readonly HexCoord[]>(() => {
    if (isRustMode) return []; // Not yet supported in Rust mode
    const va = state?.validActions;
    return va?.mode === "pending_hex_cost_reduction" ? va.hexCostReduction.availableCoordinates : [];
  }, [isRustMode, state?.validActions]);

  const exploreTargets = useMemo<ExploreTarget[]>(() => {
    if (isRustMode) {
      if (!playerPosition || !state?.map?.tiles) return [];

      const tiles = state.map.tiles;
      const tileCenters: HexCoord[] = Array.isArray(tiles)
        ? tiles.map((t: { centerCoord: HexCoord }) => t.centerCoord)
        : Object.values(tiles).map((t: unknown) =>
            (t as { centerCoord: HexCoord }).centerCoord);

      const fromTileCoord = findTileCenterForHex(playerPosition, tileCenters)
        ?? playerPosition;

      return rustExploreOptions.map(opt => ({
        coord: calculateTilePlacementPosition(fromTileCoord, opt.direction as HexDirection),
        direction: opt.direction as HexDirection,
        fromTileCoord,
      }));
    }
    const va = state?.validActions;
    if (va?.mode !== "normal_turn" || !va.explore) return [];
    return va.explore.directions.map((dir) => ({
      coord: dir.targetCoord,
      direction: dir.direction,
      fromTileCoord: dir.fromTileCoord,
    }));
  }, [isRustMode, rustExploreOptions, state?.validActions, state?.map?.tiles, playerPosition]);

  // Maps for Rust mode action dispatch
  const rustMoveActions = useMemo(() => {
    const map = new Map<string, LegalAction>();
    for (const opt of rustMoveOptions) {
      map.set(`${opt.hex.q},${opt.hex.r}`, opt.action);
    }
    return map;
  }, [rustMoveOptions]);

  const rustExploreActions = useMemo(() => {
    const map = new Map<string, LegalAction>();
    for (const opt of rustExploreOptions) {
      map.set(opt.direction, opt.action);
    }
    return map;
  }, [rustExploreOptions]);

  const rustChallengeActions = useMemo(() => {
    const map = new Map<string, LegalAction>();
    for (const opt of rustChallengeOptions) {
      map.set(`${opt.hex.q},${opt.hex.r}`, opt.action);
    }
    return map;
  }, [rustChallengeOptions]);

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
    hexCostReductionTargets,
    exploreTargets,
    pathPreview,
    isPathTerminal,
    rustMoveActions,
    rustExploreActions,
    rustChallengeActions,
  };
}
