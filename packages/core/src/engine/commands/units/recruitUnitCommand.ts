/**
 * Recruit unit command
 *
 * Handles recruiting a unit from the offer:
 * - Deducts influence points from the player
 * - Removes the unit from the offer (does NOT replenish until next round)
 * - Adds the unit to the player's units
 */

import type { Command, CommandResult } from "../types.js";
import type { GameState } from "../../../state/GameState.js";
import type { ActiveModifier } from "../../../types/modifiers.js";
import type { UnitId, GameEvent, BasicManaColor, ManaSourceInfo } from "@mage-knight/shared";
import { UNIT_RECRUITED } from "@mage-knight/shared";
import { createPlayerUnit } from "../../../types/unit.js";
import { removeUnitFromOffer } from "../../../data/unitDeckSetup.js";
import {
  getActiveRecruitDiscount,
  getActiveRecruitDiscountModifierId,
  getActiveRecruitmentBonus,
  getActiveInteractionBonus,
  getActiveInteractionBonusModifierIds,
} from "../../rules/unitRecruitment.js";
import { isBondsSlotEmpty } from "../../rules/bondsOfLoyalty.js";
import { applyChangeReputation, applyGainFame } from "../../effects/atomicEffects.js";
import {
  consumeManaForAbility,
  restoreManaForAbility,
} from "./helpers/manaConsumptionHelpers.js";

export const RECRUIT_UNIT_COMMAND = "RECRUIT_UNIT" as const;

export interface RecruitUnitCommandParams {
  readonly playerId: string;
  readonly unitId: UnitId;
  readonly influenceSpent: number;
  /** Mana source for Magic Familiars mana payment */
  readonly manaSource?: ManaSourceInfo;
  /** Basic mana color for the token placed on Magic Familiars */
  readonly manaTokenColor?: BasicManaColor;
}

let unitInstanceCounter = 0;

/**
 * Reset the instance counter (for testing)
 */
export function resetUnitInstanceCounter(): void {
  unitInstanceCounter = 0;
}

export function createRecruitUnitCommand(
  params: RecruitUnitCommandParams
): Command {
  // Capture the instance ID at creation time for undo support
  const instanceId = `unit_${++unitInstanceCounter}`;

  // Store previous state for undo
  let previousOffer: readonly UnitId[] = [];
  let previousInfluence = 0;
  let previousHasTakenAction = false;
  let previousHasRecruitedUnit = false;
  let previousUnitsRecruitedThisInteraction: readonly UnitId[] = [];
  let previousActiveModifiers: readonly ActiveModifier[] = [];
  let previousReputation = 0;
  let previousFame = 0;
  let previousPendingLevelUps: readonly number[] = [];
  let previousBondsUnitInstanceId: string | null = null;
  // Store mana source for undo (Magic Familiars mana payment)
  let consumedManaSource: ManaSourceInfo | null = null;

  return {
    type: RECRUIT_UNIT_COMMAND,
    playerId: params.playerId,
    isReversible: true,

    execute(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      let player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      // Store previous state for undo
      previousOffer = state.offers.units;
      previousInfluence = player.influencePoints;
      previousHasTakenAction = player.hasTakenActionThisTurn;
      previousHasRecruitedUnit = player.hasRecruitedUnitThisTurn;
      previousUnitsRecruitedThisInteraction = player.unitsRecruitedThisInteraction;
      previousActiveModifiers = state.activeModifiers;
      previousReputation = player.reputation;
      previousFame = player.fame;
      previousPendingLevelUps = player.pendingLevelUps;
      previousBondsUnitInstanceId = player.bondsOfLoyaltyUnitInstanceId;

      // Track source updates (for die usage)
      let updatedSource = state.source;

      // Handle mana payment for Magic Familiars
      if (params.manaSource && params.manaTokenColor) {
        consumedManaSource = params.manaSource;
        const manaResult = consumeManaForAbility(
          player,
          state.source,
          params.manaSource,
          params.playerId
        );
        player = manaResult.player;
        updatedSource = manaResult.source;
      }

      // Create new unit instance (with mana token for Magic Familiars)
      const newUnit = createPlayerUnit(params.unitId, instanceId, params.manaTokenColor);

      // If the Bonds slot is empty, this unit fills it
      const fillBondsSlot = isBondsSlotEmpty(player);

      // Update player: add unit, deduct influence, mark action taken
      // Note: Recruiting counts as an interaction (action), so player can't move afterward.
      // Multiple recruits in one turn are still allowed per rulebook rules.
      // Track the unit in unitsRecruitedThisInteraction for Heroes/Thugs exclusion check
      const updatedPlayer = {
        ...player,
        units: [...player.units, newUnit],
        bondsOfLoyaltyUnitInstanceId: fillBondsSlot ? instanceId : player.bondsOfLoyaltyUnitInstanceId,
        influencePoints: player.influencePoints - params.influenceSpent,
        hasTakenActionThisTurn: true,
        hasRecruitedUnitThisTurn: true,
        unitsRecruitedThisInteraction: [
          ...player.unitsRecruitedThisInteraction,
          params.unitId,
        ],
      };

      const players = state.players.map((p, i) =>
        i === playerIndex ? updatedPlayer : p
      );

      // Remove unit from offer (does NOT replenish until next round)
      const updatedOffer = removeUnitFromOffer(params.unitId, state.offers.units);
      const updatedOffers = {
        ...state.offers,
        units: updatedOffer,
      };

      let updatedState: GameState = { ...state, players, offers: updatedOffers, source: updatedSource };

      // Check for active recruit discount (Ruthless Coercion)
      // If a discount was active, consume it and apply the reputation change
      const discountMod = getActiveRecruitDiscount(state, params.playerId);
      if (discountMod) {
        const modifierId = getActiveRecruitDiscountModifierId(state, params.playerId);
        if (modifierId) {
          // Remove the discount modifier (consumed)
          updatedState = {
            ...updatedState,
            activeModifiers: updatedState.activeModifiers.filter(
              (m) => m.id !== modifierId
            ),
          };

          // Apply reputation change
          const repPlayerIndex = updatedState.players.findIndex(
            (p) => p.id === params.playerId
          );
          const repPlayer = updatedState.players[repPlayerIndex];
          if (repPlayer) {
            const repResult = applyChangeReputation(
              updatedState,
              repPlayerIndex,
              repPlayer,
              discountMod.reputationChange,
            );
            updatedState = repResult.state;
          }
        }
      }

      // Check for active recruitment bonus (Heroic Tale)
      // Unlike recruit discount, this is NOT consumed — it applies on every recruitment
      const recruitmentBonus = getActiveRecruitmentBonus(state, params.playerId);
      if (recruitmentBonus) {
        const bonusPlayerIndex = updatedState.players.findIndex(
          (p) => p.id === params.playerId
        );
        const bonusPlayer = updatedState.players[bonusPlayerIndex];
        if (bonusPlayer) {
          // Apply reputation bonus
          if (recruitmentBonus.reputationPerRecruit !== 0) {
            const repResult = applyChangeReputation(
              updatedState,
              bonusPlayerIndex,
              bonusPlayer,
              recruitmentBonus.reputationPerRecruit,
            );
            updatedState = repResult.state;
          }

          // Apply fame bonus
          if (recruitmentBonus.famePerRecruit > 0) {
            const famePlayer = updatedState.players[bonusPlayerIndex];
            if (famePlayer) {
              const fameResult = applyGainFame(
                updatedState,
                bonusPlayerIndex,
                famePlayer,
                recruitmentBonus.famePerRecruit,
              );
              updatedState = fameResult.state;
            }
          }
        }
      }

      // Check for active interaction bonus (Noble Manners)
      // Unlike recruitment bonus, this IS consumed — only triggers once
      const interactionBonus = getActiveInteractionBonus(updatedState, params.playerId);
      if (interactionBonus) {
        const modifierIds = getActiveInteractionBonusModifierIds(updatedState, params.playerId);

        // Remove the interaction bonus modifiers (consumed)
        updatedState = {
          ...updatedState,
          activeModifiers: updatedState.activeModifiers.filter(
            (m) => !modifierIds.includes(m.id)
          ),
        };

        const ibPlayerIndex = updatedState.players.findIndex(
          (p) => p.id === params.playerId
        );
        const ibPlayer = updatedState.players[ibPlayerIndex];
        if (ibPlayer) {
          // Apply fame bonus
          if (interactionBonus.fame > 0) {
            const fameResult = applyGainFame(
              updatedState,
              ibPlayerIndex,
              ibPlayer,
              interactionBonus.fame,
            );
            updatedState = fameResult.state;
          }

          // Apply reputation bonus
          if (interactionBonus.reputation !== 0) {
            const repPlayer = updatedState.players[ibPlayerIndex];
            if (repPlayer) {
              const repResult = applyChangeReputation(
                updatedState,
                ibPlayerIndex,
                repPlayer,
                interactionBonus.reputation,
              );
              updatedState = repResult.state;
            }
          }
        }
      }

      const events: GameEvent[] = [
        {
          type: UNIT_RECRUITED,
          playerId: params.playerId,
          unitId: params.unitId,
          unitInstanceId: instanceId,
          influenceSpent: params.influenceSpent,
        },
      ];

      return {
        state: updatedState,
        events,
      };
    },

    undo(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      let player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      // Track source updates for mana restoration
      let updatedSource = state.source;

      // Restore mana if it was consumed (Magic Familiars)
      if (consumedManaSource) {
        const manaResult = restoreManaForAbility(
          player,
          state.source,
          consumedManaSource
        );
        player = manaResult.player;
        updatedSource = manaResult.source;
      }

      // Remove the recruited unit (matching by instanceId for safety)
      const updatedUnits = player.units.filter(
        (u) => u.instanceId !== instanceId
      );

      // Restore previous state
      const updatedPlayer = {
        ...player,
        units: updatedUnits,
        influencePoints: previousInfluence,
        hasTakenActionThisTurn: previousHasTakenAction,
        hasRecruitedUnitThisTurn: previousHasRecruitedUnit,
        unitsRecruitedThisInteraction: previousUnitsRecruitedThisInteraction,
        reputation: previousReputation,
        fame: previousFame,
        pendingLevelUps: previousPendingLevelUps,
        bondsOfLoyaltyUnitInstanceId: previousBondsUnitInstanceId,
      };

      const players = state.players.map((p, i) =>
        i === playerIndex ? updatedPlayer : p
      );

      // Restore previous offer and modifiers
      const updatedOffers = {
        ...state.offers,
        units: previousOffer,
      };

      return {
        state: {
          ...state,
          players,
          offers: updatedOffers,
          activeModifiers: previousActiveModifiers,
          source: updatedSource,
        },
        events: [],
      };
    },
  };
}
