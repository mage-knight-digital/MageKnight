/**
 * Puppet Master skill effect handler
 *
 * Krang's skill: Once per turn during combat, either:
 * - Keep one defeated enemy token, OR
 * - Discard a previously kept token for Attack or Block
 *
 * Attack = ceil(enemy_attack / 2), same element
 * Block = ceil(enemy_armor / 2), opposite element of resistance
 *
 * Key rules:
 * - Cannot keep AND expend in same turn (S7)
 * - Can accumulate multiple tokens across turns (S7)
 * - Arcane Immunity and Elusive ignored (S1)
 * - Physical resistance has no effect on Block element (S5)
 * - Attacks are NOT Ranged/Siege (S9)
 * - Usable in Dungeons/Tombs (not a unit) (S6)
 * - Multiple attacks can split or combine (S3)
 *
 * @module commands/skills/puppetMasterEffect
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player, KeptEnemyToken } from "../../../types/player.js";
import type { CardEffect, PuppetMasterKeepEffect, PuppetMasterExpendEffect } from "../../../types/cards.js";
import type { CombatEnemy } from "../../../types/combat.js";
import { SKILL_KRANG_PUPPET_MASTER } from "../../../data/skills/krang/puppetMaster.js";
import { getPlayerIndexByIdOrThrow } from "../../helpers/playerHelpers.js";
import {
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_COMPOUND,
  EFFECT_PUPPET_MASTER_KEEP,
  EFFECT_PUPPET_MASTER_EXPEND,
} from "../../../types/effectTypes.js";
import type {
  Element,
  EnemyAttack,
  EnemyResistances,
} from "@mage-knight/shared";
import {
  ELEMENT_PHYSICAL,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_COLD_FIRE,
  RESIST_FIRE,
  RESIST_ICE,
} from "@mage-knight/shared";

// ============================================================================
// Public API
// ============================================================================

/**
 * Check if Puppet Master can be activated.
 * Requires combat AND either:
 * - Defeated enemies to keep (keep mode), OR
 * - Stored enemy tokens to expend (expend mode)
 */
export function canActivatePuppetMaster(
  state: GameState,
  player: Player
): boolean {
  if (!state.combat) return false;
  return hasDefeatedEnemies(state) || hasKeptTokens(player);
}

/**
 * Apply the Puppet Master skill effect.
 *
 * Creates a pending choice based on available modes:
 * - If defeated enemies exist AND stored tokens exist: choice between keep/expend
 * - If only defeated enemies: choose which enemy to keep
 * - If only stored tokens: choose which token to expend, then attack/block choice
 */
export function applyPuppetMasterEffect(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];
  if (!player || !state.combat) return state;

  const defeated = getDefeatedEnemies(state);
  const hasTokens = hasKeptTokens(player);

  // Build the choice options
  const options: CardEffect[] = [];

  // Add "keep enemy" options (one per defeated enemy)
  for (const enemy of defeated) {
    options.push(createKeepEnemyEffect(enemy));
  }

  // Add "expend token" options (one per stored token, each with attack/block sub-choice)
  if (hasTokens) {
    for (const token of player.keptEnemyTokens) {
      options.push(createExpendTokenEffect(token));
    }
  }

  if (options.length === 0) return state;

  const updatedPlayer: Player = {
    ...player,
    pendingChoice: {
      cardId: null,
      skillId: SKILL_KRANG_PUPPET_MASTER,
      unitInstanceId: null,
      options,
    },
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;
  return { ...state, players };
}

/**
 * Remove Puppet Master effects for undo.
 * Clears pending choice if from Puppet Master.
 */
export function removePuppetMasterEffect(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];
  if (!player) return state;

  const updatedPlayer: Player = {
    ...player,
    pendingChoice:
      player.pendingChoice?.skillId === SKILL_KRANG_PUPPET_MASTER
        ? null
        : player.pendingChoice,
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;
  return { ...state, players };
}

// ============================================================================
// Keep Enemy Token Logic
// ============================================================================

/**
 * Create a "keep enemy token" effect for a defeated enemy.
 * Uses EFFECT_PUPPET_MASTER_KEEP type which is resolved by resolveChoiceCommand.
 */
function createKeepEnemyEffect(enemy: CombatEnemy): PuppetMasterKeepEffect {
  return {
    type: EFFECT_PUPPET_MASTER_KEEP,
    enemyInstanceId: enemy.instanceId,
    token: createKeptTokenFromEnemy(enemy),
    description: `Keep ${enemy.definition.name} token`,
  };
}

/**
 * Create a KeptEnemyToken from a defeated CombatEnemy.
 * Preserves only attack/armor/element/resistance data per FAQ S1.
 * Ignores Arcane Immunity, Elusive (higher armor), all other abilities.
 */
export function createKeptTokenFromEnemy(enemy: CombatEnemy): KeptEnemyToken {
  return {
    enemyId: enemy.enemyId,
    name: enemy.definition.name,
    attack: enemy.definition.attack,
    attackElement: enemy.definition.attackElement,
    attacks: enemy.definition.attacks,
    armor: enemy.definition.armor, // Uses base armor, not Elusive value (S1)
    resistances: enemy.definition.resistances,
  };
}

/**
 * Apply the "keep enemy" choice resolution.
 * Adds the token to player's keptEnemyTokens.
 */
export function resolveKeepEnemyToken(
  state: GameState,
  playerId: string,
  token: KeptEnemyToken
): GameState {
  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];
  if (!player) return state;

  const updatedPlayer: Player = {
    ...player,
    keptEnemyTokens: [...player.keptEnemyTokens, token],
    pendingChoice: null,
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;
  return { ...state, players };
}

// ============================================================================
// Expend Token Logic
// ============================================================================

/**
 * Create an "expend token" effect for a stored token.
 * This is a compound choice: first choose the token, then choose attack or block.
 */
function createExpendTokenEffect(token: KeptEnemyToken): PuppetMasterExpendEffect {
  return {
    type: EFFECT_PUPPET_MASTER_EXPEND,
    token,
    description: `Discard ${token.name} token for Attack or Block`,
  };
}

/**
 * Resolve expending a kept token.
 * Creates a sub-choice: Attack or Block.
 */
export function resolveExpendTokenChoice(
  state: GameState,
  playerId: string,
  token: KeptEnemyToken
): GameState {
  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];
  if (!player) return state;

  const attackEffects = createAttackEffectsFromToken(token);
  const blockEffect = createBlockEffectFromToken(token);

  const options: CardEffect[] = [attackEffects, blockEffect];

  // Remove the token from storage
  const updatedPlayer: Player = {
    ...player,
    keptEnemyTokens: player.keptEnemyTokens.filter(
      (t) => t.enemyId !== token.enemyId || t.name !== token.name
    ),
    pendingChoice: {
      cardId: null,
      skillId: SKILL_KRANG_PUPPET_MASTER,
      unitInstanceId: null,
      options,
    },
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;
  return { ...state, players };
}

// ============================================================================
// Attack Calculation
// ============================================================================

/**
 * Calculate attack effect(s) from a kept token.
 * Attack = ceil(enemy_attack / 2) with matching element.
 * Multiple attacks become a compound effect (S3).
 * Attacks are melee (not ranged/siege) per S9.
 */
function createAttackEffectsFromToken(token: KeptEnemyToken): CardEffect {
  const attacks = getTokenAttacks(token);

  if (attacks.length === 1) {
    const atk = attacks[0]!;
    // GainAttackEffect uses undefined for physical (not ELEMENT_PHYSICAL)
    const element = atk.element === ELEMENT_PHYSICAL ? undefined : atk.element;
    return {
      type: EFFECT_GAIN_ATTACK,
      amount: Math.ceil(atk.damage / 2),
      combatType: "melee" as const,
      element,
      description: `Attack ${Math.ceil(atk.damage / 2)} ${describeElement(atk.element)} (from ${token.name})`,
    } as CardEffect;
  }

  // Multiple attacks: compound effect
  const subEffects: CardEffect[] = attacks.map((atk) => {
    const element = atk.element === ELEMENT_PHYSICAL ? undefined : atk.element;
    return {
      type: EFFECT_GAIN_ATTACK,
      amount: Math.ceil(atk.damage / 2),
      combatType: "melee" as const,
      element,
      description: `Attack ${Math.ceil(atk.damage / 2)} ${describeElement(atk.element)}`,
    } as CardEffect;
  });

  return {
    type: EFFECT_COMPOUND,
    effects: subEffects,
    description: `Attack from ${token.name}: ${subEffects.length} attacks`,
  } as CardEffect;
}

// ============================================================================
// Block Calculation
// ============================================================================

/**
 * Calculate block effect from a kept token.
 * Block = ceil(enemy_armor / 2).
 * Element = opposite of enemy resistance:
 * - Fire resistance → Ice Block
 * - Ice resistance → Fire Block
 * - Both → Cold Fire Block
 * - Physical resistance → no effect (S5)
 * - No resistance → Physical Block
 */
function createBlockEffectFromToken(token: KeptEnemyToken): CardEffect {
  const blockAmount = Math.ceil(token.armor / 2);
  const blockElement = getBlockElementFromResistances(token.resistances);
  // GainBlockEffect uses undefined for physical (not ELEMENT_PHYSICAL)
  const element = blockElement === ELEMENT_PHYSICAL ? undefined : blockElement;

  return {
    type: EFFECT_GAIN_BLOCK,
    amount: blockAmount,
    element,
    description: `Block ${blockAmount} ${describeElement(blockElement)} (from ${token.name})`,
  } as CardEffect;
}

/**
 * Get the block element based on enemy resistances.
 * Fire resist → Ice Block
 * Ice resist → Fire Block
 * Both → Cold Fire Block
 * Physical resist → Physical Block (S5: no effect)
 * None → Physical Block
 */
export function getBlockElementFromResistances(
  resistances: EnemyResistances
): Element {
  const hasFire = resistances.includes(RESIST_FIRE);
  const hasIce = resistances.includes(RESIST_ICE);

  if (hasFire && hasIce) return ELEMENT_COLD_FIRE;
  if (hasFire) return ELEMENT_ICE;
  if (hasIce) return ELEMENT_FIRE;
  return ELEMENT_PHYSICAL;
}

// ============================================================================
// Helper Functions
// ============================================================================

function hasDefeatedEnemies(state: GameState): boolean {
  if (!state.combat) return false;
  return state.combat.enemies.some((e) => e.isDefeated);
}

function getDefeatedEnemies(state: GameState): readonly CombatEnemy[] {
  if (!state.combat) return [];
  return state.combat.enemies.filter((e) => e.isDefeated);
}

function hasKeptTokens(player: Player): boolean {
  return player.keptEnemyTokens.length > 0;
}

/**
 * Get attacks from a kept token, normalizing single and multi-attack forms.
 */
function getTokenAttacks(token: KeptEnemyToken): readonly EnemyAttack[] {
  if (token.attacks && token.attacks.length > 0) {
    return token.attacks;
  }
  return [{ damage: token.attack, element: token.attackElement }];
}

function describeElement(element: Element): string {
  switch (element) {
    case ELEMENT_PHYSICAL:
      return "Physical";
    case ELEMENT_FIRE:
      return "Fire";
    case ELEMENT_ICE:
      return "Ice";
    case ELEMENT_COLD_FIRE:
      return "ColdFire";
    default:
      return "Physical";
  }
}

