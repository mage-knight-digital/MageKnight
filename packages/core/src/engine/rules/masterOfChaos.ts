/**
 * Shared rules for Krang's Master of Chaos skill.
 */

import {
  COMBAT_TYPE_MELEE,
  COMBAT_TYPE_RANGED,
  MANA_BLACK,
  MANA_BLUE,
  MANA_GOLD,
  MANA_GREEN,
  MANA_RED,
  MANA_WHITE,
  ELEMENT_COLD_FIRE,
} from "@mage-knight/shared";
import type { CardEffect } from "../../types/cards.js";
import {
  EFFECT_CHOICE,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_GAIN_MOVE,
} from "../../types/effectTypes.js";
import type { MasterOfChaosState, Player } from "../../types/player.js";
import type { GameState } from "../../state/GameState.js";
import type { RngState } from "../../utils/rng.js";
import { randomElement } from "../../utils/rng.js";

export const MASTER_OF_CHAOS_CLOCKWISE_ORDER = [
  MANA_BLUE,
  MANA_GREEN,
  MANA_BLACK,
  MANA_WHITE,
  MANA_RED,
  MANA_GOLD,
] as const;

export type MasterOfChaosPosition =
  (typeof MASTER_OF_CHAOS_CLOCKWISE_ORDER)[number];

const MASTER_OF_CHAOS_POSITIONS_SET = new Set<string>(
  MASTER_OF_CHAOS_CLOCKWISE_ORDER
);

const MASTER_OF_CHAOS_BLOCK_EFFECT: CardEffect = {
  type: EFFECT_GAIN_BLOCK,
  amount: 3,
};

const MASTER_OF_CHAOS_MOVE_EFFECT: CardEffect = {
  type: EFFECT_GAIN_MOVE,
  amount: 1,
};

const MASTER_OF_CHAOS_RANGED_EFFECT: CardEffect = {
  type: EFFECT_GAIN_ATTACK,
  amount: 1,
  combatType: COMBAT_TYPE_RANGED,
  element: ELEMENT_COLD_FIRE,
};

const MASTER_OF_CHAOS_INFLUENCE_EFFECT: CardEffect = {
  type: EFFECT_GAIN_INFLUENCE,
  amount: 2,
};

const MASTER_OF_CHAOS_ATTACK_EFFECT: CardEffect = {
  type: EFFECT_GAIN_ATTACK,
  amount: 2,
  combatType: COMBAT_TYPE_MELEE,
};

export const MASTER_OF_CHAOS_GOLD_OPTIONS: readonly CardEffect[] = [
  MASTER_OF_CHAOS_BLOCK_EFFECT,
  MASTER_OF_CHAOS_MOVE_EFFECT,
  MASTER_OF_CHAOS_RANGED_EFFECT,
  MASTER_OF_CHAOS_INFLUENCE_EFFECT,
  MASTER_OF_CHAOS_ATTACK_EFFECT,
];

/**
 * Normalize stored position to a valid Master of Chaos position.
 */
export function getMasterOfChaosPosition(
  player: Player
): MasterOfChaosPosition {
  const position = player.masterOfChaosState?.position;
  if (position && MASTER_OF_CHAOS_POSITIONS_SET.has(position)) {
    return position as MasterOfChaosPosition;
  }
  return MANA_BLUE;
}

/**
 * Rotate one step clockwise.
 */
export function rotateMasterOfChaosPosition(
  current: MasterOfChaosPosition
): MasterOfChaosPosition {
  const currentIndex = MASTER_OF_CHAOS_CLOCKWISE_ORDER.indexOf(current);
  const nextIndex =
    currentIndex === -1
      ? 0
      : (currentIndex + 1) % MASTER_OF_CHAOS_CLOCKWISE_ORDER.length;
  return MASTER_OF_CHAOS_CLOCKWISE_ORDER[nextIndex] ?? MANA_BLUE;
}

/**
 * Build persistent state payload.
 */
export function createMasterOfChaosState(
  position: MasterOfChaosPosition,
  freeRotateAvailable: boolean
): MasterOfChaosState {
  return {
    position,
    freeRotateAvailable,
  };
}

/**
 * Roll the initial position when the skill is gained.
 */
export function rollMasterOfChaosInitialPosition(rng: RngState): {
  position: MasterOfChaosPosition;
  rng: RngState;
} {
  const { value, rng: newRng } = randomElement(
    MASTER_OF_CHAOS_CLOCKWISE_ORDER,
    rng
  );
  return {
    position: value ?? MANA_BLUE,
    rng: newRng,
  };
}

/**
 * Get the effect granted by landing on a given position.
 */
export function getMasterOfChaosEffectForPosition(
  position: MasterOfChaosPosition
): CardEffect {
  switch (position) {
    case MANA_BLUE:
      return MASTER_OF_CHAOS_BLOCK_EFFECT;
    case MANA_GREEN:
      return MASTER_OF_CHAOS_MOVE_EFFECT;
    case MANA_BLACK:
      return MASTER_OF_CHAOS_RANGED_EFFECT;
    case MANA_WHITE:
      return MASTER_OF_CHAOS_INFLUENCE_EFFECT;
    case MANA_RED:
      return MASTER_OF_CHAOS_ATTACK_EFFECT;
    case MANA_GOLD:
      return {
        type: EFFECT_CHOICE,
        options: MASTER_OF_CHAOS_GOLD_OPTIONS,
      };
    default:
      return MASTER_OF_CHAOS_BLOCK_EFFECT;
  }
}

/**
 * True when player may do the off-turn free rotate action.
 */
export function canUseMasterOfChaosFreeRotate(
  state: GameState,
  player: Player
): boolean {
  if (!player.masterOfChaosState?.freeRotateAvailable) {
    return false;
  }

  const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
  return currentPlayerId !== player.id;
}
