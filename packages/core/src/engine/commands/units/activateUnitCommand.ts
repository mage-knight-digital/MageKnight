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
import type { GameEvent, ManaSourceInfo, CardId } from "@mage-knight/shared";
import {
  UNIT_ACTIVATED,
  getUnit,
  UNIT_STATE_SPENT,
  UNIT_STATE_READY,
  ELEMENT_PHYSICAL,
  UNIT_ABILITY_EFFECT,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_RANGED_ATTACK,
  UNIT_ABILITY_SIEGE_ATTACK,
} from "@mage-knight/shared";
import { getUnitAttackBonus } from "../../modifiers/index.js";
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
import { EFFECT_COMPOUND, EFFECT_SELECT_COMBAT_ENEMY } from "../../../types/effectTypes.js";
import type { CardEffect, CompoundEffect, SelectCombatEnemyEffect } from "../../../types/cards.js";
import type { Player } from "../../../types/player.js";
import {
  applyChoiceOutcome,
  buildChoiceRequiredEvent,
  getChoiceOptionsFromEffect,
  type PendingChoiceSource,
} from "../choice/choiceResolution.js";

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

  // Store count of terrain modifiers added for undo
  let terrainModifiersAdded = 0;

  // Store whether this was an effect-based ability (for undo)
  let wasEffectBasedAbility = false;
  // Store the resolved effect for undo (only set for immediate compound effects)
  let resolvedEffect: CardEffect | null = null;

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

      // Store previous state for undo
      previousMovePoints = player.movePoints;
      previousInfluencePoints = player.influencePoints;
      previousHand = player.hand;
      previousWoundPileCount = state.woundPileCount;

      // Mark unit as spent
      const updatedUnits = [...player.units];
      updatedUnits[unitIndex] = {
        ...unit,
        state: UNIT_STATE_SPENT,
      };

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

        // Build intermediate state with unit marked as spent
        const playerWithSpentUnit: Player = {
          ...player,
          units: updatedUnits,
        };
        const players = [...state.players];
        players[playerIndex] = playerWithSpentUnit;

        const intermediateState: GameState = {
          ...state,
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
      // Apply unit attack bonus from Coordinated Fire for attack abilities
      let abilityValue = ability.value ?? 0;
      const isAttackAbility =
        ability.type === UNIT_ABILITY_ATTACK ||
        ability.type === UNIT_ABILITY_RANGED_ATTACK ||
        ability.type === UNIT_ABILITY_SIEGE_ATTACK;
      if (isAttackAbility && abilityValue > 0) {
        const attackBonus = getUnitAttackBonus(state, params.playerId);
        abilityValue += attackBonus;
      }

      // Update combat accumulator (for combat abilities)
      const updatedAccumulator = addAbilityToAccumulator(
        player.combatAccumulator,
        ability.type,
        abilityValue,
        ability.element,
        ability.countsTwiceAgainstSwift
      );

      // Apply non-combat ability effects (heal, move, influence)
      const nonCombatResult = applyNonCombatAbility(
        { ...player, units: updatedUnits, combatAccumulator: updatedAccumulator },
        ability.type,
        abilityValue
      );

      const updatedPlayer = nonCombatResult.player;

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      // Update wound pile if healing occurred
      const newWoundPileCount =
        state.woundPileCount === null
          ? null
          : state.woundPileCount + nonCombatResult.woundPileCountDelta;

      // Build intermediate state with player and wound updates
      let updatedState: GameState = {
        ...state,
        players,
        woundPileCount: newWoundPileCount,
      };

      // Apply terrain modifiers if the ability has them (e.g., Foresters)
      if (ability.terrainModifiers && ability.terrainModifiers.length > 0) {
        terrainModifiersAdded = ability.terrainModifiers.length;
        updatedState = applyTerrainModifiers(
          updatedState,
          params.playerId,
          unitIndex,
          ability.terrainModifiers
        );
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
      const abilityValue = ability?.value ?? 0;

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

      // Restore unit to ready
      const updatedUnits = [...player.units];
      updatedUnits[unitIndex] = {
        ...unit,
        state: UNIT_STATE_READY,
      };

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
      // Remove ability from combat accumulator
      const updatedAccumulator = ability
        ? removeAbilityFromAccumulator(
            player.combatAccumulator,
            ability.type,
            abilityValue,
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
      };

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      // Restore wound pile count
      const restoredWoundPileCount =
        previousWoundPileCount !== null
          ? previousWoundPileCount
          : state.woundPileCount;

      // Remove terrain modifiers that were added
      const restoredModifiers =
        terrainModifiersAdded > 0
          ? state.activeModifiers.slice(0, -terrainModifiersAdded)
          : state.activeModifiers;

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
 * Used by Shocktroops' Taunt ability to set damage redirect target.
 *
 * Only replaces in SelectCombatEnemyEffect.template.setDamageRedirectFromUnit
 * and CompoundEffect sub-effects (for compound abilities containing targeting).
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

  if (effect.type === EFFECT_COMPOUND) {
    const compoundEffect = effect as CompoundEffect;
    const replaced = compoundEffect.effects.map(e => replaceActivatingUnitPlaceholder(e, unitInstanceId));
    // Only create a new object if something actually changed
    if (replaced.some((e, i) => e !== compoundEffect.effects[i])) {
      return { ...compoundEffect, effects: replaced };
    }
    return effect;
  }

  return effect;
}
