/**
 * Assign Banner Command
 *
 * Assigns a banner artifact from hand to a unit.
 * If the unit already has a banner, the old one goes to discard.
 *
 * @module commands/banners/assignBannerCommand
 */

import type { Command, CommandResult } from "../types.js";
import type { GameState } from "../../../state/GameState.js";
import type { Player, BannerAttachment } from "../../../types/player.js";
import type { GameEvent, CardId } from "@mage-knight/shared";
import {
  BANNER_ASSIGNED,
  BANNER_DETACHED,
  BANNER_DETACH_REASON_REPLACED,
} from "@mage-knight/shared";

export const ASSIGN_BANNER_COMMAND = "ASSIGN_BANNER" as const;

export interface AssignBannerParams {
  readonly playerId: string;
  readonly bannerCardId: CardId;
  readonly targetUnitInstanceId: string;
}

export function createAssignBannerCommand(params: AssignBannerParams): Command {
  // Capture previous state for undo
  let previousHand: readonly CardId[];
  let previousDiscard: readonly CardId[];
  let previousAttachedBanners: readonly BannerAttachment[];

  return {
    type: ASSIGN_BANNER_COMMAND,
    playerId: params.playerId,
    isReversible: true,

    execute(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      const player = state.players[playerIndex];
      if (!player) throw new Error(`Player not found: ${params.playerId}`);

      // Capture for undo
      previousHand = player.hand;
      previousDiscard = player.discard;
      previousAttachedBanners = player.attachedBanners;

      const events: GameEvent[] = [];

      // Check if the target unit already has a banner
      const existingBanner = player.attachedBanners.find(
        (b) => b.unitInstanceId === params.targetUnitInstanceId
      );

      let updatedDiscard = [...player.discard];
      let updatedAttachedBanners = [...player.attachedBanners];

      if (existingBanner) {
        // Old banner goes to discard
        updatedDiscard.push(existingBanner.bannerId);
        updatedAttachedBanners = updatedAttachedBanners.filter(
          (b) => b.unitInstanceId !== params.targetUnitInstanceId
        );
        events.push({
          type: BANNER_DETACHED,
          playerId: params.playerId,
          bannerCardId: existingBanner.bannerId,
          unitInstanceId: params.targetUnitInstanceId,
          reason: BANNER_DETACH_REASON_REPLACED,
          destination: "discard",
        });
      }

      // Remove banner from hand
      const updatedHand = [...player.hand];
      const handIndex = updatedHand.indexOf(params.bannerCardId);
      if (handIndex !== -1) {
        updatedHand.splice(handIndex, 1);
      }

      // Add new banner attachment
      const newAttachment: BannerAttachment = {
        bannerId: params.bannerCardId,
        unitInstanceId: params.targetUnitInstanceId,
        isUsedThisRound: false,
      };
      updatedAttachedBanners.push(newAttachment);

      events.push({
        type: BANNER_ASSIGNED,
        playerId: params.playerId,
        bannerCardId: params.bannerCardId,
        unitInstanceId: params.targetUnitInstanceId,
      });

      const updatedPlayer: Player = {
        ...player,
        hand: updatedHand,
        discard: updatedDiscard,
        attachedBanners: updatedAttachedBanners,
      };

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      return {
        state: { ...state, players },
        events,
      };
    },

    undo(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      const player = state.players[playerIndex];
      if (!player) throw new Error(`Player not found: ${params.playerId}`);

      const updatedPlayer: Player = {
        ...player,
        hand: previousHand,
        discard: previousDiscard,
        attachedBanners: previousAttachedBanners,
      };

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      return {
        state: { ...state, players },
        events: [],
      };
    },
  };
}
