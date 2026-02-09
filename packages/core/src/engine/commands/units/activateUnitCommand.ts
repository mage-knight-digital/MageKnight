/**
 * Activate unit command
 *
 * Activates a unit's ability in combat, marking it as spent.
 * Unit abilities contribute to combat (attack/block values) and
 * must match the current combat phase.
 *
 * For effect-based abilities (type="effect"), the command looks up the
 * effect definition from the unit ability effects registry and resolves it
 * using the standard card effect system. This supports complex abilities
 * like Sorcerers' fortification/resistance stripping + ranged attack combos.
 */

import type { Command, CommandResult } from "../types.js";
import type { GameState } from "../../../state/GameState.js";
import type { ActiveModifier } from "../../../types/modifiers.js";
import type { GameEvent, ManaSourceInfo, CardId, UnitAbility } from "@mage-knight/shared";
import type { PlayerUnit } from "../../../types/unit.js";
import {
  UNIT_ACTIVATED,
  getUnit,
  UNIT_STATE_SPENT,
  UNIT_STATE_READY,
  ELEMENT_PHYSICAL,
  UNIT_ABILITY_EFFECT,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_RANGED_ATTACK,
  UNIT_ABILITY_SIEGE_ATTACK,
} from "@mage-knight/shared";
import { getUnitAttackBonus, getUnitBlockBonus, getBannerGloryFameTracker, getModifiersForPlayer, getLeadershipBonusModifier } from "../../modifiers/index.js";
import { removeModifier } from "../../modifiers/lifecycle.js";
import {
  getBannerAttackTackOn,
  getBannerBlockTackOn,
  shouldBannerGrantFame,
} from "../../rules/banners.js";
import { EFFECT_BANNER_GLORY_FAME_TRACKING, EFFECT_TRANSFORM_ATTACKS_COLD_FIRE, EFFECT_ADD_SIEGE_TO_ATTACKS, LEADERSHIP_BONUS_BLOCK, LEADERSHIP_BONUS_ATTACK, LEADERSHIP_BONUS_RANGED_ATTACK } from "../../../types/modifierConstants.js";
import type { BannerGloryFameTrackingModifier } from "../../../types/modifiers.js";
import { COMBAT_PHASE_ATTACK } from "../../../types/combat.js";
import { ELEMENT_COLD_FIRE } from "@mage-knight/shared";
import {
  addAbilityToAccumulator,
  removeAbilityFromAccumulator,
} from "./helpers/combatAccumulatorHelpers.js";
import { applyNonCombatAbility } from "./helpers/nonCombatAbilityHelpers.js";
import { applyTerrainModifiers } from "./helpers/terrainModifierHelpers.js";
import {
  consumeManaForAbility,
  restoreManaForAbility,
} from "./helpers/manaConsumptionHelpers.js";
import { getUnitAbilityEffect } from "../../../data/unitAbilityEffects.js";
import { resolveEffect, reverseEffect } from "../../effects/index.js";
import { checkManaCurseWound } from "../../effects/manaClaimEffects.js";
import { EFFECT_COMPOUND, EFFECT_SELECT_COMBAT_ENEMY, EFFECT_CHOICE, EFFECT_WOUND_ACTIVATING_UNIT } from "../../../types/effectTypes.js";
import type { CardEffect, CompoundEffect, SelectCombatEnemyEffect, ChoiceEffect, WoundActivatingUnitEffect } from "../../../types/cards.js";
import type { Player } from "../../../types/player.js";
import {
  applyChoiceOutcome,
  buildChoiceRequiredEvent,
  getChoiceOptionsFromEffect,
  type PendingChoiceSource,
} from "../choice/choiceResolution.js";
import { markDuelingUnitInvolvementFromAbility } from "../../combat/duelingHelpers.js";

export const ACTIVATE_UNIT_COMMAND = "ACTIVATE_UNIT" as const;

export interface ActivateUnitCommandParams {
  readonly playerId: string;
  readonly unitInstanceId: string;
  readonly abilityIndex: number;
  /**
   * Mana source used to pay for abilities with manaCost.
   * Required when the ability has a manaCost defined.
   */
  readonly manaSource?: ManaSourceInfo;
}

/**
 * Get the effective ability value considering the unit's mana token bonus.
 * If the ability has a bonusManaColor that matches the unit's manaToken,
 * use bonusValue instead of base value.
 */
function getEffectiveAbilityValue(ability: UnitAbility, unit: PlayerUnit): number {
  const baseValue = ability.value ?? 0;
  if (ability.bonusValue !== undefined && ability.bonusManaColor && unit.manaToken === ability.bonusManaColor) {
    return ability.bonusValue;
  }
  return baseValue;
}

/**
 * Apply mana token bonus to an effect-based ability's amounts.
 * Adjusts gain_move/gain_influence amounts in choice effects for Magic Familiars.
 */
function applyManaTokenBonusToEffect(effect: CardEffect, ability: UnitAbility, unit: PlayerUnit): CardEffect {
  if (ability.bonusValue === undefined || !ability.bonusManaColor || unit.manaToken !== ability.bonusManaColor) {
    return effect;
  }
  const bonusAmount = ability.bonusValue;
  // For choice effects, boost each option's amount
  if (effect.type === EFFECT_CHOICE) {
    const choiceEffect = effect as ChoiceEffect;
    const boostedOptions = choiceEffect.options.map((option) => {
      if ("amount" in option && typeof option.amount === "number") {
        return { ...option, amount: bonusAmount };
      }
      return option;
    });
    return { ...choiceEffect, options: boostedOptions };
  }
  // For simple effects with amount, boost directly
  if ("amount" in effect && typeof effect.amount === "number") {
    return { ...effect, amount: bonusAmount };
  }
  return effect;
}

export function createActivateUnitCommand(
  params: ActivateUnitCommandParams
): Command {
  // Store mana consumption info for undo
  let consumedManaSource: ManaSourceInfo | null = null;

  // Store previous state for undo of non-combat abilities
  let previousMovePoints: number | null = null;
  let previousInfluencePoints: number | null = null;
  let previousHand: readonly CardId[] | null = null;
  let previousWoundPileCount: number | null = null;
  let previousFame: number | null = null;
  let previousActiveModifiers: GameState["activeModifiers"] | null = null;

  // Store whether this was an effect-based ability (for undo)
  let wasEffectBasedAbility = false;
  // Store the resolved effect for undo (only set for immediate compound effects)
  let resolvedEffect: CardEffect | null = null;

  // Store consumed Leadership modifier for undo (full modifier to restore)
  let consumedLeadershipModifier: ActiveModifier | null = null;
  let leadershipBonusApplied = 0;

  return {
    type: ACTIVATE_UNIT_COMMAND,
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

      const unitIndex = player.units.findIndex(
        (u) => u.instanceId === params.unitInstanceId
      );
      if (unitIndex === -1) {
        throw new Error(`Unit not found: ${params.unitInstanceId}`);
      }

      const unit = player.units[unitIndex];
      if (!unit) {
        throw new Error(`Unit not found: ${params.unitInstanceId}`);
      }

      const unitDef = getUnit(unit.unitId);
      const ability = unitDef.abilities[params.abilityIndex];
      if (!ability) {
        throw new Error(`Invalid ability index: ${params.abilityIndex}`);
      }

      // Track source updates (for die usage)
      let updatedSource = state.source;

      // Handle mana consumption if ability has mana cost
      if (ability.manaCost && params.manaSource) {
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

      // Check for Mana Curse wounds after mana consumption
      let curseUpdatedState = state;
      if (ability.manaCost && params.manaSource) {
        // Build a temporary state with the updated player and source to check curse
        const tempPlayers = [...state.players];
        tempPlayers[playerIndex] = player;
        const tempState: GameState = { ...state, players: tempPlayers, source: updatedSource };
        curseUpdatedState = checkManaCurseWound(tempState, params.playerId, params.manaSource.color);
        // If curse added a wound, update our working player copy
        const cursePlayer = curseUpdatedState.players[playerIndex];
        if (cursePlayer) {
          player = cursePlayer;
        }
      }

      // Store previous state for undo
      previousMovePoints = player.movePoints;
      previousInfluencePoints = player.influencePoints;
      previousHand = player.hand;
      previousWoundPileCount = curseUpdatedState.woundPileCount;
      previousFame = player.fame;
      previousActiveModifiers = curseUpdatedState.activeModifiers;

      // Mark unit as spent (or track used ability for multi-ability units)
      const updatedUnits = [...player.units];
      if (unitDef.multiAbility) {
        // Multi-ability units stay ready; track which ability index was used
        const usedIndices = unit.usedAbilityIndices ?? [];
        updatedUnits[unitIndex] = {
          ...unit,
          usedAbilityIndices: [...usedIndices, params.abilityIndex],
        };
      } else {
        updatedUnits[unitIndex] = {
          ...unit,
          state: UNIT_STATE_SPENT,
        };
      }

      // ============================================================
      // EFFECT-BASED ABILITY HANDLING
      // ============================================================
      if (ability.type === UNIT_ABILITY_EFFECT && ability.effectId) {
        wasEffectBasedAbility = true;

        // Look up the effect from the registry
        let effect = getUnitAbilityEffect(ability.effectId);
        if (!effect) {
          throw new Error(`Effect not found for effectId: ${ability.effectId}`);
        }

        // Replace __ACTIVATING_UNIT__ placeholder with actual unit instance ID
        // Used by Shocktroops' Taunt to set damage redirect target
        effect = replaceActivatingUnitPlaceholder(effect, params.unitInstanceId);

        // Apply mana token bonus for Magic Familiars
        effect = applyManaTokenBonusToEffect(effect, ability, unit);

        // Build intermediate state with unit marked as spent
        const playerWithSpentUnit: Player = {
          ...player,
          units: updatedUnits,
        };
        const players = [...curseUpdatedState.players];
        players[playerIndex] = playerWithSpentUnit;

        const intermediateState: GameState = {
          ...curseUpdatedState,
          players,
          source: updatedSource,
        };

        // Resolve the effect
        const effectResult = resolveEffect(
          intermediateState,
          params.playerId,
          effect,
          undefined // No source card for unit abilities
        );

        // Build events list
        const events: GameEvent[] = [
          {
            type: UNIT_ACTIVATED,
            playerId: params.playerId,
            unitInstanceId: params.unitInstanceId,
            abilityUsed: ability.type,
            abilityValue: 0, // Effect-based abilities don't have simple values
            element: ability.element ?? ELEMENT_PHYSICAL,
          },
        ];

        if (effectResult.requiresChoice) {
          const choiceInfo = getChoiceOptionsFromEffect(effectResult, effect);
          if (choiceInfo) {
            const source: PendingChoiceSource = {
              cardId: null,
              skillId: null,
              unitInstanceId: params.unitInstanceId,
            };

            const resolveRemainingEffects = (
              currentState: GameState,
              remainingEffects: readonly CardEffect[] | undefined
            ): CommandResult => {
              if (!remainingEffects || remainingEffects.length === 0) {
                return {
                  state: currentState,
                  events,
                };
              }

              const compoundEffect: CompoundEffect = {
                type: EFFECT_COMPOUND,
                effects: remainingEffects,
              };
              const compoundResult = resolveEffect(
                currentState,
                params.playerId,
                compoundEffect
              );

              if (compoundResult.requiresChoice) {
                const nextChoiceInfo = getChoiceOptionsFromEffect(
                  compoundResult,
                  compoundEffect
                );

                if (nextChoiceInfo) {
                  return applyChoiceOutcome({
                    state: compoundResult.state,
                    playerId: params.playerId,
                    playerIndex,
                    options: nextChoiceInfo.options,
                    source,
                    remainingEffects: nextChoiceInfo.remainingEffects,
                    resolveEffect: (state, id, effect) =>
                      resolveEffect(state, id, effect),
                    handlers: {
                      onNoOptions: (state) =>
                        resolveRemainingEffects(
                          state,
                          nextChoiceInfo.remainingEffects
                        ),
                      onAutoResolved: (autoResult) =>
                        resolveRemainingEffects(
                          autoResult.state,
                          nextChoiceInfo.remainingEffects
                        ),
                      onPendingChoice: (stateWithChoice, options) => ({
                        state: stateWithChoice,
                        events: [
                          ...events,
                          buildChoiceRequiredEvent(
                            params.playerId,
                            source,
                            options
                          ),
                        ],
                      }),
                    },
                  });
                }
              }

              return {
                state: compoundResult.state,
                events,
              };
            };

            return applyChoiceOutcome({
              state: effectResult.state,
              playerId: params.playerId,
              playerIndex,
              options: choiceInfo.options,
              source,
              remainingEffects: choiceInfo.remainingEffects,
              resolveEffect: (state, id, effect) =>
                resolveEffect(state, id, effect),
              handlers: {
                onNoOptions: (state) =>
                  resolveRemainingEffects(state, choiceInfo.remainingEffects),
                onAutoResolved: (autoResult) =>
                  resolveRemainingEffects(
                    autoResult.state,
                    choiceInfo.remainingEffects
                  ),
                onPendingChoice: (stateWithChoice, options) => ({
                  state: stateWithChoice,
                  events: [
                    ...events,
                    buildChoiceRequiredEvent(params.playerId, source, options),
                  ],
                }),
              },
            });
          }
        }

        // Effect resolved completely - capture effect for undo
        resolvedEffect = effect;
        return {
          state: effectResult.state,
          events,
        };
      }

      // ============================================================
      // STANDARD (VALUE-BASED) ABILITY HANDLING
      // ============================================================

      // Get the ability value (default to 0 for abilities without values)
      // Apply mana token bonus (Magic Familiars) if applicable
      // Apply unit attack bonus from Coordinated Fire / Into the Heat for attack abilities
      // Apply unit block bonus from Into the Heat / Banner of Glory for block abilities
      let abilityValue = getEffectiveAbilityValue(ability, unit);
      const isAttackAbility =
        ability.type === UNIT_ABILITY_ATTACK ||
        ability.type === UNIT_ABILITY_RANGED_ATTACK ||
        ability.type === UNIT_ABILITY_SIEGE_ATTACK;
      const isBlockAbility = ability.type === UNIT_ABILITY_BLOCK;
      if (isAttackAbility && abilityValue > 0) {
        const attackBonus = getUnitAttackBonus(state, params.playerId);
        abilityValue += attackBonus;
        abilityValue += getBannerAttackTackOn(player, unit);
      }
      if (isBlockAbility && abilityValue > 0) {
        const blockBonus = getUnitBlockBonus(state, params.playerId);
        abilityValue += blockBonus;
        abilityValue += getBannerBlockTackOn(player, unit);
      }

      // Apply Leadership bonus if active and matching ability type.
      // Leadership is consumed (one unit per turn) after applying to a unit.
      let stateAfterLeadership = curseUpdatedState;
      const leadershipResult = getLeadershipBonusModifier(curseUpdatedState, params.playerId);
      if (leadershipResult) {
        const { modifier: leadershipMod, activeModifier } = leadershipResult;
        let applies = false;
        if (leadershipMod.bonusType === LEADERSHIP_BONUS_BLOCK && ability.type === UNIT_ABILITY_BLOCK) {
          applies = true;
        } else if (leadershipMod.bonusType === LEADERSHIP_BONUS_ATTACK) {
          // Attack bonus applies to melee Attack abilities, and also to Siege/Ranged in Attack phase (FAQ S2)
          if (ability.type === UNIT_ABILITY_ATTACK) {
            applies = true;
          } else if (
            (ability.type === UNIT_ABILITY_SIEGE_ATTACK || ability.type === UNIT_ABILITY_RANGED_ATTACK) &&
            curseUpdatedState.combat?.phase === COMBAT_PHASE_ATTACK
          ) {
            applies = true;
          }
        } else if (leadershipMod.bonusType === LEADERSHIP_BONUS_RANGED_ATTACK && ability.type === UNIT_ABILITY_RANGED_ATTACK) {
          applies = true;
        }

        if (applies) {
          abilityValue += leadershipMod.amount;
          leadershipBonusApplied = leadershipMod.amount;

          // Consume the modifier (one unit per turn, only when bonus applies)
          consumedLeadershipModifier = activeModifier;
          stateAfterLeadership = removeModifier(curseUpdatedState, activeModifier.id);
        }
      }
      // Apply Altem Mages attack modifiers to unit ability element/type
      let effectiveElement = ability.element;
      const playerModifiers = getModifiersForPlayer(state, params.playerId);
      const hasColdFireTransform = isAttackAbility &&
        playerModifiers.some((m) => m.effect.type === EFFECT_TRANSFORM_ATTACKS_COLD_FIRE);
      const hasAddSiege = isAttackAbility &&
        playerModifiers.some((m) => m.effect.type === EFFECT_ADD_SIEGE_TO_ATTACKS);

      if (hasColdFireTransform) {
        effectiveElement = ELEMENT_COLD_FIRE;
      }

      // Update combat accumulator (for combat abilities)
      let updatedAccumulator = addAbilityToAccumulator(
        player.combatAccumulator,
        ability.type,
        abilityValue,
        effectiveElement,
        ability.countsTwiceAgainstSwift
      );

      // Add Siege modifier: also add attack to siege pool for non-siege attacks
      if (hasAddSiege && ability.type !== UNIT_ABILITY_SIEGE_ATTACK) {
        updatedAccumulator = addAbilityToAccumulator(
          updatedAccumulator,
          UNIT_ABILITY_SIEGE_ATTACK,
          abilityValue,
          effectiveElement,
          ability.countsTwiceAgainstSwift
        );
      }

      // Apply non-combat ability effects (heal, move, influence)
      const nonCombatResult = applyNonCombatAbility(
        { ...player, units: updatedUnits, combatAccumulator: updatedAccumulator },
        ability.type,
        abilityValue
      );

      const updatedPlayer = nonCombatResult.player;

      const players = [...stateAfterLeadership.players];
      players[playerIndex] = updatedPlayer;

      // Update wound pile if healing occurred
      const newWoundPileCount =
        stateAfterLeadership.woundPileCount === null
          ? null
          : stateAfterLeadership.woundPileCount + nonCombatResult.woundPileCountDelta;

      // Build intermediate state with player and wound updates
      let updatedState: GameState = {
        ...stateAfterLeadership,
        players,
        woundPileCount: newWoundPileCount,
      };

      // Apply terrain modifiers if the ability has them (e.g., Foresters)
      if (ability.terrainModifiers && ability.terrainModifiers.length > 0) {
        updatedState = applyTerrainModifiers(
          updatedState,
          params.playerId,
          unitIndex,
          ability.terrainModifiers
        );
      }

      // Banner of Glory fame bonuses when unit attacks or blocks
      if (isAttackAbility || isBlockAbility) {
        let fameGain = 0;

        // Attached banner: +1 fame when the attached unit attacks or blocks
        if (shouldBannerGrantFame(player, params.unitInstanceId)) {
          fameGain += 1;
        }

        // Powered modifier: +1 fame per unit that attacks or blocks this turn
        // (each unit only counted once via tracking)
        const fameTracker = getBannerGloryFameTracker(updatedState, params.playerId);
        if (fameTracker && !fameTracker.unitInstanceIdsAwarded.includes(params.unitInstanceId)) {
          fameGain += 1;
          // Update the tracking modifier to record this unit
          updatedState = {
            ...updatedState,
            activeModifiers: updatedState.activeModifiers.map((m) =>
              m.effect.type === EFFECT_BANNER_GLORY_FAME_TRACKING && m.createdByPlayerId === params.playerId
                ? {
                    ...m,
                    effect: {
                      ...m.effect,
                      unitInstanceIdsAwarded: [
                        ...(m.effect as BannerGloryFameTrackingModifier).unitInstanceIdsAwarded,
                        params.unitInstanceId,
                      ],
                    },
                  }
                : m
            ),
          };
        }

        if (fameGain > 0) {
          updatedState = {
            ...updatedState,
            players: updatedState.players.map((p) =>
              p.id === params.playerId ? { ...p, fame: p.fame + fameGain } : p
            ),
          };
        }
      }

      // Mark Dueling unit involvement when a unit combat ability is used
      if (isAttackAbility || isBlockAbility) {
        updatedState = markDuelingUnitInvolvementFromAbility(updatedState, params.playerId);
      }

      const events: GameEvent[] = [
        {
          type: UNIT_ACTIVATED,
          playerId: params.playerId,
          unitInstanceId: params.unitInstanceId,
          abilityUsed: ability.type,
          abilityValue,
          element: ability.element ?? ELEMENT_PHYSICAL,
        },
      ];

      return {
        state: { ...updatedState, source: updatedSource },
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

      const unitIndex = player.units.findIndex(
        (u) => u.instanceId === params.unitInstanceId
      );
      if (unitIndex === -1) {
        throw new Error(`Unit not found: ${params.unitInstanceId}`);
      }

      const unit = player.units[unitIndex];
      if (!unit) {
        throw new Error(`Unit not found: ${params.unitInstanceId}`);
      }

      const unitDef = getUnit(unit.unitId);
      const ability = unitDef.abilities[params.abilityIndex];
      // Use effective value (with mana token bonus) for undo accumulator
      const abilityValue = ability ? getEffectiveAbilityValue(ability, unit) : 0;

      // Track source updates (for die restoration)
      let updatedSource = state.source;

      // Restore mana if it was consumed
      if (consumedManaSource) {
        const manaResult = restoreManaForAbility(
          player,
          state.source,
          consumedManaSource
        );
        player = manaResult.player;
        updatedSource = manaResult.source;
      }

      // Restore unit state
      const updatedUnits = [...player.units];
      if (unitDef.multiAbility) {
        // Remove the ability index from usedAbilityIndices
        const usedIndices = unit.usedAbilityIndices ?? [];
        const restored = usedIndices.filter((idx) => idx !== params.abilityIndex);
        updatedUnits[unitIndex] = {
          ...unit,
          usedAbilityIndices: restored.length > 0 ? restored : undefined,
        };
      } else {
        updatedUnits[unitIndex] = {
          ...unit,
          state: UNIT_STATE_READY,
        };
      }

      // For effect-based abilities, we need to:
      // 1. Restore unit state and mana (done above)
      // 2. Clear any pending choice that was set
      // 3. Reverse immediately-resolved effects (e.g., compound effects like
      //    Thugs Attack 3 + Rep -1). Effects that created a pendingChoice
      //    are handled by resolveChoiceCommand undo instead.
      if (wasEffectBasedAbility) {
        let updatedPlayer: Player = {
          ...player,
          units: updatedUnits,
          pendingChoice: null, // Clear any pending choice from this activation
        };

        // Reverse immediately-resolved effects (captured during execute)
        if (resolvedEffect) {
          updatedPlayer = reverseEffect(updatedPlayer, resolvedEffect);
        }

        const players = [...state.players];
        players[playerIndex] = updatedPlayer;

        return {
          state: {
            ...state,
            players,
            source: updatedSource,
          },
          events: [],
        };
      }

      // Standard ability undo
      // Remove ability from combat accumulator (including Leadership bonus if applied)
      const undoAbilityValue = abilityValue + leadershipBonusApplied;
      const updatedAccumulator = ability
        ? removeAbilityFromAccumulator(
            player.combatAccumulator,
            ability.type,
            undoAbilityValue,
            ability.element,
            ability.countsTwiceAgainstSwift
          )
        : player.combatAccumulator;

      // Restore non-combat ability effects
      const updatedPlayer = {
        ...player,
        units: updatedUnits,
        combatAccumulator: updatedAccumulator,
        movePoints: previousMovePoints ?? player.movePoints,
        influencePoints: previousInfluencePoints ?? player.influencePoints,
        hand: previousHand ?? player.hand,
        fame: previousFame ?? player.fame,
      };

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      // Restore wound pile count
      const restoredWoundPileCount =
        previousWoundPileCount !== null
          ? previousWoundPileCount
          : state.woundPileCount;

      // Restore active modifiers (reverts terrain modifiers, fame tracking changes, and Leadership consumption)
      let restoredModifiers = previousActiveModifiers ?? state.activeModifiers;

      // Restore consumed Leadership modifier
      if (consumedLeadershipModifier) {
        restoredModifiers = [...restoredModifiers, consumedLeadershipModifier];
      }

      return {
        state: {
          ...state,
          players,
          source: updatedSource,
          woundPileCount: restoredWoundPileCount,
          activeModifiers: restoredModifiers,
        },
        events: [],
      };
    },
  };
}

/**
 * Replace __ACTIVATING_UNIT__ placeholder in effect definitions with actual unit instance ID.
 * Used by Shocktroops' Taunt ability to set damage redirect target and
 * Utem Swordsmen's self-wound ability.
 *
 * Handles:
 * - SelectCombatEnemyEffect.template.setDamageRedirectFromUnit
 * - WoundActivatingUnitEffect.unitInstanceId
 * - Recursion into CompoundEffect and ChoiceEffect sub-effects
 */
function replaceActivatingUnitPlaceholder(effect: CardEffect, unitInstanceId: string): CardEffect {
  if (effect.type === EFFECT_SELECT_COMBAT_ENEMY) {
    const selectEffect = effect as SelectCombatEnemyEffect;
    if (selectEffect.template.setDamageRedirectFromUnit === "__ACTIVATING_UNIT__") {
      return {
        ...selectEffect,
        template: {
          ...selectEffect.template,
          setDamageRedirectFromUnit: unitInstanceId,
        },
      };
    }
    return effect;
  }

  if (effect.type === EFFECT_WOUND_ACTIVATING_UNIT) {
    const woundEffect = effect as WoundActivatingUnitEffect;
    if (woundEffect.unitInstanceId === "__ACTIVATING_UNIT__") {
      return {
        ...woundEffect,
        unitInstanceId,
      };
    }
    return effect;
  }

  if (effect.type === EFFECT_COMPOUND) {
    const compoundEffect = effect as CompoundEffect;
    const replaced = compoundEffect.effects.map(e => replaceActivatingUnitPlaceholder(e, unitInstanceId));
    if (replaced.some((e, i) => e !== compoundEffect.effects[i])) {
      return { ...compoundEffect, effects: replaced };
    }
    return effect;
  }

  if (effect.type === EFFECT_CHOICE) {
    const choiceEffect = effect as ChoiceEffect;
    const replaced = choiceEffect.options.map(e => replaceActivatingUnitPlaceholder(e, unitInstanceId));
    if (replaced.some((e, i) => e !== choiceEffect.options[i])) {
      return { ...choiceEffect, options: replaced };
    }
    return effect;
  }

  return effect;
}
