/**
 * Game board selectors hook
 *
 * Memoized selectors for move targets, reachable hexes, explore targets, and path preview.
 * Derives all data from Rust engine legalActions.
 */

import { useMemo } from "react";
import type { HexCoord, HexDirection, MoveTarget, ReachableHex } from "@mage-knight/shared";
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
  state: import("@mage-knight/shared").ClientGameState | null;
  hoveredHex: HexCoord | null;
  playerPosition: HexCoord | null;
  legalActions?: LegalAction[];
}

interface UseGameBoardSelectorsReturn {
  validMoveTargets: readonly MoveTarget[];
  reachableHexes: readonly ReachableHex[];
  challengeTargetHexes: readonly HexCoord[];
  hexCostReductionTargets: readonly HexCoord[];
  exploreTargets: ExploreTarget[];
  pathPreview: HexCoord[];
  isPathTerminal: boolean;
  /** Maps hex key "q,r" to the LegalAction for that move. */
  rustMoveActions: Map<string, LegalAction>;
  /** Maps direction to the LegalAction for that explore. */
  rustExploreActions: Map<string, LegalAction>;
  /** Maps hex key "q,r" to the LegalAction for that challenge. */
  rustChallengeActions: Map<string, LegalAction>;
}

export function useGameBoardSelectors({
  state,
  hoveredHex,
  playerPosition,
  legalActions = [],
}: UseGameBoardSelectorsParams): UseGameBoardSelectorsReturn {
  // Derive move targets from legalActions
  const moveOptions = useMemo(
    () => extractMoveTargets(legalActions),
    [legalActions]
  );

  const exploreOptions = useMemo(
    () => extractExploreDirections(legalActions),
    [legalActions]
  );

  const challengeOptions = useMemo(
    () => extractChallengeTargets(legalActions),
    [legalActions]
  );

  // Memoized valid move targets
  const validMoveTargets = useMemo<readonly MoveTarget[]>(() => {
    return moveOptions.map(opt => ({
      hex: opt.hex,
      cost: opt.cost,
    }));
  }, [moveOptions]);

  // TODO: Phase 2 — Rust doesn't provide multi-hop reachability yet
  const reachableHexes = useMemo<readonly ReachableHex[]>(() => {
    return [];
  }, []);

  // Challenge target hexes
  const challengeTargetHexes = useMemo<readonly HexCoord[]>(() => {
    return challengeOptions.map(opt => opt.hex);
  }, [challengeOptions]);

  // TODO: Phase 2 — derive from legalActions when Rust provides hex cost reduction actions
  const hexCostReductionTargets = useMemo<readonly HexCoord[]>(() => {
    return [];
  }, []);

  const exploreTargets = useMemo<ExploreTarget[]>(() => {
    if (!playerPosition || !state?.map?.tiles) return [];

    const tiles = state.map.tiles;
    const tileCenters: HexCoord[] = Array.isArray(tiles)
      ? tiles.map((t: { centerCoord: HexCoord }) => t.centerCoord)
      : Object.values(tiles).map((t: unknown) =>
          (t as { centerCoord: HexCoord }).centerCoord);

    const fromTileCoord = findTileCenterForHex(playerPosition, tileCenters)
      ?? playerPosition;

    return exploreOptions.map(opt => ({
      coord: calculateTilePlacementPosition(fromTileCoord, opt.direction as HexDirection),
      direction: opt.direction as HexDirection,
      fromTileCoord,
    }));
  }, [exploreOptions, state?.map?.tiles, playerPosition]);

  // Maps for action dispatch
  const rustMoveActions = useMemo(() => {
    const map = new Map<string, LegalAction>();
    for (const opt of moveOptions) {
      map.set(`${opt.hex.q},${opt.hex.r}`, opt.action);
    }
    return map;
  }, [moveOptions]);

  const rustExploreActions = useMemo(() => {
    const map = new Map<string, LegalAction>();
    for (const opt of exploreOptions) {
      map.set(opt.direction, opt.action);
    }
    return map;
  }, [exploreOptions]);

  const rustChallengeActions = useMemo(() => {
    const map = new Map<string, LegalAction>();
    for (const opt of challengeOptions) {
      map.set(`${opt.hex.q},${opt.hex.r}`, opt.action);
    }
    return map;
  }, [challengeOptions]);

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
