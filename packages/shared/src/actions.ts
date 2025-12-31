/**
 * Player action types - discriminated union for all actions a player can take
 */

import type { HexCoord } from "./hex.js";

export interface MoveAction {
  readonly type: "MOVE";
  readonly target: HexCoord;
}

export interface ExploreAction {
  readonly type: "EXPLORE";
  readonly direction: HexCoord;
}

export interface EndTurnAction {
  readonly type: "END_TURN";
}

export interface RestAction {
  readonly type: "REST";
}

export type PlayerAction =
  | MoveAction
  | ExploreAction
  | EndTurnAction
  | RestAction;

export type PlayerActionType = PlayerAction["type"];
