/**
 * Shield Bash armor reduction on-block-success handling.
 *
 * When a block succeeds while the Shield Bash armor reduction modifier is active:
 * - Calculate excess undoubled block (undoubled effective block - undoubled required block)
 * - Apply armor reduction equal to excess to the blocked enemy (minimum armor 1)
 * - Ice Resistant enemies are immune to armor reduction (blue card = ice element)
 * - Summoner enemies cannot have armor reduced via their summoned monster
 *
 * Per Vlaada's ruling (O3):
 * 1. Calculate effective undoubled block (pending block only, not the swift-doubled portion)
 * 2. Calculate undoubled required block (base attack, not Swift-doubled)
 * 3. Excess = undoubled effective block - undoubled required block
 * 4. Armor reduction = excess (cannot reduce below 1)
 */

import type { GameState } from "../../state/GameState.js";
import type { GameEvent, Element } from "@mage-knight/shared";
import { RESIST_ICE } from "@mage-knight/shared";
import type { CombatEnemy, PendingElementalDamage } from "../../types/combat.js";
import {
  EFFECT_SHIELD_BASH_ARMOR_REDUCTION,
  EFFECT_ENEMY_STAT,
  ENEMY_STAT_ARMOR,
  DURATION_COMBAT,
  SCOPE_ONE_ENEMY,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";
import { CARD_SHIELD_BASH } from "@mage-knight/shared";
import { getModifiersForPlayer } from "../modifiers/queries.js";
import { addModifier } from "../modifiers/lifecycle.js";
import { getCumbersomeReducedAttack } from "./cumbersomeHelpers.js";
import { getNaturesVengeanceAttackBonus } from "../modifiers/combat.js";
import { getEnemyAttacks } from "./enemyAttackHelpers.js";
import { getColdToughnessBlockBonus } from "./coldToughnessHelpers.js";
import { getFinalBlockValue } from "./elementalCalc.js";

/**
 * Convert PendingElementalDamage to BlockSource[] format.
 */
function pendingToSources(pending: PendingElementalDamage): readonly { element: Element; value: number }[] {
  const sources: { element: Element; value: number }[] = [];
  if (pending.physical > 0) sources.push({ element: "physical", value: pending.physical });
  if (pending.fire > 0) sources.push({ element: "fire", value: pending.fire });
  if (pending.ice > 0) sources.push({ element: "ice", value: pending.ice });
  if (pending.coldFire > 0) sources.push({ element: "cold_fire", value: pending.coldFire });
  return sources;
}

/**
 * Check for and apply Shield Bash armor reduction after a successful block.
 *
 * @param state - Current game state (BEFORE pending block is cleared)
 * @param playerId - Player who blocked
 * @param blockedEnemy - The enemy whose attack was blocked
 * @param attackIndex - Which attack was blocked (for multi-attack enemies)
 * @param pendingBlock - The pending block that was used for this block
 * @returns Updated state and events, or null if no Shield Bash armor reduction active
 */
export function applyShieldBashArmorReduction(
  state: GameState,
  playerId: string,
  blockedEnemy: CombatEnemy,
  attackIndex: number,
  pendingBlock: PendingElementalDamage
): { state: GameState; events: GameEvent[] } | null {
  // Find active Shield Bash armor reduction modifier
  const modifiers = getModifiersForPlayer(state, playerId);
  const shieldBashMod = modifiers.find(
    (m) => m.effect.type === EFFECT_SHIELD_BASH_ARMOR_REDUCTION
  );

  if (!shieldBashMod) {
    return null;
  }

  // Ice Resistant enemies are immune to armor reduction (blue card = ice element per S7)
  if (blockedEnemy.definition.resistances.includes(RESIST_ICE)) {
    return null;
  }

  // Cannot reduce Summoner armor via summoned monster (Q6)
  // If the blocked enemy is a summoned monster, skip armor reduction
  if (blockedEnemy.summonedByInstanceId !== undefined) {
    return null;
  }

  // Get the attack being blocked
  const attacks = getEnemyAttacks(blockedEnemy);
  const attack = attacks[attackIndex];
  if (!attack) {
    return null;
  }

  // Calculate undoubled block (pending block without the swift-doubled portion)
  const baseSources = pendingToSources(pendingBlock);

  // Add Cold Toughness bonus (same as in declareBlockCommand)
  const coldToughnessBonus = getColdToughnessBlockBonus(state, playerId, blockedEnemy);
  const sourcesWithBonus = coldToughnessBonus > 0
    ? [...baseSources, { element: "ice" as Element, value: coldToughnessBonus }]
    : baseSources;

  // Calculate undoubled effective block (using elemental efficiency against attack element)
  const undoubledEffectiveBlock = getFinalBlockValue(
    sourcesWithBonus,
    attack.element,
    state,
    playerId
  );

  // Calculate undoubled required block (base attack without Swift doubling)
  let undoubledRequired = attack.damage;
  undoubledRequired += getNaturesVengeanceAttackBonus(state, playerId);
  undoubledRequired = getCumbersomeReducedAttack(state, playerId, blockedEnemy, undoubledRequired);

  // Excess = undoubled block - undoubled required
  const excess = undoubledEffectiveBlock - undoubledRequired;

  if (excess <= 0) {
    return null;
  }

  // Apply armor reduction modifier to the blocked enemy
  const updatedState = addModifier(state, {
    source: { type: SOURCE_CARD, cardId: CARD_SHIELD_BASH, playerId },
    duration: DURATION_COMBAT,
    scope: { type: SCOPE_ONE_ENEMY, enemyId: blockedEnemy.instanceId },
    effect: {
      type: EFFECT_ENEMY_STAT,
      stat: ENEMY_STAT_ARMOR,
      amount: -excess,
      minimum: 1,
    },
    createdAtRound: state.round,
    createdByPlayerId: playerId,
  });

  return {
    state: updatedState,
    events: [],
  };
}
