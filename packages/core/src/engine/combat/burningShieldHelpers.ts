/**
 * Burning Shield / Exploding Shield on-block-success handling.
 *
 * When a block succeeds while the Burning Shield modifier is active:
 * - Basic (mode "attack"): Grants Fire Attack 4 in Attack phase
 * - Powered (mode "destroy"): Destroys the blocked enemy
 *   (respects Fire Resistance and Arcane Immunity)
 *
 * The modifier is consumed (removed) after triggering.
 */

import type { GameState } from "../../state/GameState.js";
import type { GameEvent } from "@mage-knight/shared";
import type { CombatEnemy } from "../../types/combat.js";
import type { BurningShieldActiveModifier } from "../../types/modifiers.js";
import { ABILITY_ARCANE_IMMUNITY, RESIST_FIRE } from "@mage-knight/shared";
import { EFFECT_BURNING_SHIELD_ACTIVE, ELEMENT_FIRE } from "../../types/modifierConstants.js";
import { getModifiersForPlayer } from "../modifiers/queries.js";
import { removeModifier } from "../modifiers/lifecycle.js";

/**
 * Check for and apply Burning Shield effects after a successful block.
 *
 * @param state - Current game state (after block success)
 * @param playerId - Player who blocked
 * @param blockedEnemy - The enemy whose attack was blocked
 * @returns Updated state and events, or null if no Burning Shield active
 */
export function applyBurningShieldOnBlock(
  state: GameState,
  playerId: string,
  blockedEnemy: CombatEnemy
): { state: GameState; events: GameEvent[] } | null {
  // Find active Burning Shield modifier for this player
  const modifiers = getModifiersForPlayer(state, playerId);
  const burningShieldMod = modifiers.find(
    (m) => m.effect.type === EFFECT_BURNING_SHIELD_ACTIVE
  );

  if (!burningShieldMod) {
    return null;
  }

  const effect = burningShieldMod.effect as BurningShieldActiveModifier;

  // Remove the modifier (consumed on first successful block)
  let updatedState = removeModifier(state, burningShieldMod.id);

  if (effect.mode === "attack") {
    // Basic: Grant Fire Attack 4 to the player's combat accumulator
    return applyBurningShieldAttack(updatedState, playerId, effect.attackValue);
  }

  // Powered: Destroy the blocked enemy (respects resistances)
  return applyExplodingShieldDestroy(updatedState, playerId, blockedEnemy);
}

/**
 * Grant Fire Attack to player's combat accumulator.
 * Fire Attack bypasses resistances (applied as fire element attack points).
 */
function applyBurningShieldAttack(
  state: GameState,
  playerId: string,
  attackValue: number
): { state: GameState; events: GameEvent[] } {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    return { state, events: [] };
  }

  const player = state.players[playerIndex]!;
  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...player,
    combatAccumulator: {
      ...player.combatAccumulator,
      attack: {
        ...player.combatAccumulator.attack,
        normal: player.combatAccumulator.attack.normal + attackValue,
        normalElements: {
          ...player.combatAccumulator.attack.normalElements,
          [ELEMENT_FIRE]:
            player.combatAccumulator.attack.normalElements.fire + attackValue,
        },
      },
    },
  };

  return {
    state: { ...state, players: updatedPlayers },
    events: [],
  };
}

/**
 * Destroy the blocked enemy if it doesn't have Fire Resistance or Arcane Immunity.
 * Awards fame for destroyed enemy (except summoned enemies which grant no fame).
 */
function applyExplodingShieldDestroy(
  state: GameState,
  playerId: string,
  blockedEnemy: CombatEnemy
): { state: GameState; events: GameEvent[] } {
  if (!state.combat) {
    return { state, events: [] };
  }

  // Check Fire Resistance — enemy is NOT destroyed
  if (blockedEnemy.definition.resistances.includes(RESIST_FIRE)) {
    return { state, events: [] };
  }

  // Check Arcane Immunity — enemy is NOT destroyed
  if (blockedEnemy.definition.abilities.includes(ABILITY_ARCANE_IMMUNITY)) {
    return { state, events: [] };
  }

  // Destroy the enemy
  const enemyIndex = state.combat.enemies.findIndex(
    (e) => e.instanceId === blockedEnemy.instanceId
  );
  if (enemyIndex === -1) {
    return { state, events: [] };
  }

  const updatedEnemies = state.combat.enemies.map((e, i) =>
    i === enemyIndex ? { ...e, isDefeated: true } : e
  );

  // Award fame (summoned enemies grant no fame per rules)
  const isSummoned = blockedEnemy.summonedByInstanceId !== undefined;
  const fameValue = isSummoned ? 0 : blockedEnemy.definition.fame;

  let updatedPlayers = state.players;
  if (fameValue > 0) {
    const playerIndex = state.players.findIndex((p) => p.id === playerId);
    if (playerIndex !== -1) {
      const player = state.players[playerIndex]!;
      updatedPlayers = [...state.players];
      updatedPlayers[playerIndex] = {
        ...player,
        fame: player.fame + fameValue,
      };
    }
  }

  const updatedState: GameState = {
    ...state,
    combat: {
      ...state.combat,
      enemies: updatedEnemies,
      fameGained: state.combat.fameGained + fameValue,
    },
    players: updatedPlayers,
  };

  return {
    state: updatedState,
    events: [],
  };
}
