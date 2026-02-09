/**
 * Know Your Prey Effect Resolution
 *
 * Wolfhawk's skill: Once per round, during combat, flip to ignore one
 * offensive or defensive ability of an enemy token, or to remove one
 * element of one enemy attack (Fire/Ice → Physical, Cold Fire → Fire or Ice).
 * Cannot target enemies with Arcane Immunity.
 *
 * Two-step choice flow:
 * 1. EFFECT_KNOW_YOUR_PREY_SELECT_ENEMY: Select an enemy target
 * 2. EFFECT_KNOW_YOUR_PREY_SELECT_OPTION: Choose ability/resistance/element to remove
 * 3. EFFECT_KNOW_YOUR_PREY_APPLY: Apply the selected modifier
 *
 * FAQ rulings implemented:
 * - Q1/A1: Offensive abilities removable: Assassination, Brutal, Paralyze, Poison, Swift, Vampiric
 * - Q1/A1: Defensive abilities removable: Elusive, Fortified (printed on token), one Resistance
 * - Q1/A1: Element conversion: Fire/Ice → Physical, Cold Fire → Fire or Ice
 * - Q1/A1: Cannot remove: Fortified from location, city bonuses, Summon, Multiple Attack
 * - Q4/A4: Can target summoned monsters from Arcane Immune summoners
 */

import type { GameState } from "../../state/GameState.js";
import type { CombatEnemy } from "../../types/combat.js";
import type { CardEffect, KnowYourPreySelectOptionEffect, KnowYourPreyApplyEffect } from "../../types/cards.js";
import type { EnemyAbilityType, ResistanceType } from "@mage-knight/shared";
import {
  ABILITY_ARCANE_IMMUNITY,
  ABILITY_ASSASSINATION,
  ABILITY_BRUTAL,
  ABILITY_ELUSIVE,
  ABILITY_FORTIFIED,
  ABILITY_PARALYZE,
  ABILITY_POISON,
  ABILITY_SWIFT,
  ABILITY_VAMPIRIC,
  ELEMENT_COLD_FIRE,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_PHYSICAL,
  RESIST_FIRE,
  RESIST_ICE,
  RESIST_PHYSICAL,
} from "@mage-knight/shared";
import { registerEffect } from "./effectRegistry.js";
import { addModifier } from "../modifiers/index.js";
import { SKILL_WOLFHAWK_KNOW_YOUR_PREY } from "../../data/skills/index.js";
import {
  DURATION_COMBAT,
  EFFECT_ABILITY_NULLIFIER,
  EFFECT_CONVERT_ATTACK_ELEMENT,
  EFFECT_REMOVE_FIRE_RESISTANCE,
  EFFECT_REMOVE_ICE_RESISTANCE,
  EFFECT_REMOVE_PHYSICAL_RESISTANCE,
  SCOPE_ONE_ENEMY,
  SOURCE_SKILL,
} from "../../types/modifierConstants.js";
import {
  EFFECT_KNOW_YOUR_PREY_SELECT_ENEMY,
  EFFECT_KNOW_YOUR_PREY_SELECT_OPTION,
  EFFECT_KNOW_YOUR_PREY_APPLY,
} from "../../types/effectTypes.js";
import { getEnemyAttacks } from "../combat/enemyAttackHelpers.js";

// ============================================================================
// Constants
// ============================================================================

/** Offensive abilities that can be removed by Know Your Prey */
const REMOVABLE_OFFENSIVE_ABILITIES: readonly EnemyAbilityType[] = [
  ABILITY_ASSASSINATION,
  ABILITY_BRUTAL,
  ABILITY_PARALYZE,
  ABILITY_POISON,
  ABILITY_SWIFT,
  ABILITY_VAMPIRIC,
];

/** Defensive abilities that can be removed by Know Your Prey */
const REMOVABLE_DEFENSIVE_ABILITIES: readonly EnemyAbilityType[] = [
  ABILITY_ELUSIVE,
  ABILITY_FORTIFIED,
];

/** Ability display names for UI */
const ABILITY_NAMES: Record<string, string> = {
  [ABILITY_ASSASSINATION]: "Assassination",
  [ABILITY_BRUTAL]: "Brutal",
  [ABILITY_PARALYZE]: "Paralyze",
  [ABILITY_POISON]: "Poison",
  [ABILITY_SWIFT]: "Swift",
  [ABILITY_VAMPIRIC]: "Vampiric",
  [ABILITY_ELUSIVE]: "Elusive",
  [ABILITY_FORTIFIED]: "Fortified",
};

/** Resistance display names for UI */
const RESISTANCE_NAMES: Record<string, string> = {
  [RESIST_PHYSICAL]: "Physical Resistance",
  [RESIST_FIRE]: "Fire Resistance",
  [RESIST_ICE]: "Ice Resistance",
};

/** Element display names for UI */
const ELEMENT_NAMES: Record<string, string> = {
  [ELEMENT_FIRE]: "Fire",
  [ELEMENT_ICE]: "Ice",
  [ELEMENT_COLD_FIRE]: "Cold Fire",
  [ELEMENT_PHYSICAL]: "Physical",
};

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Get eligible enemies for Know Your Prey targeting.
 * Excludes defeated enemies and enemies with Arcane Immunity.
 * Includes summoned monsters from Arcane Immune summoners (Q4/A4).
 */
function getEligibleEnemies(state: GameState): readonly CombatEnemy[] {
  if (!state.combat) return [];

  return state.combat.enemies.filter((e) => {
    if (e.isDefeated) return false;
    if (e.definition.abilities.includes(ABILITY_ARCANE_IMMUNITY)) return false;
    return true;
  });
}

/**
 * Build all available KnowYourPreyApplyEffect options for a selected enemy.
 */
export function buildApplyOptionsForEnemy(
  enemy: CombatEnemy,
  enemyInstanceId: string
): readonly KnowYourPreyApplyEffect[] {
  const options: KnowYourPreyApplyEffect[] = [];

  // Offensive abilities
  for (const ability of REMOVABLE_OFFENSIVE_ABILITIES) {
    if (enemy.definition.abilities.includes(ability)) {
      options.push({
        type: EFFECT_KNOW_YOUR_PREY_APPLY,
        enemyInstanceId,
        ability,
        label: `Remove ${ABILITY_NAMES[ability] ?? ability}`,
      });
    }
  }

  // Defensive abilities
  for (const ability of REMOVABLE_DEFENSIVE_ABILITIES) {
    if (enemy.definition.abilities.includes(ability)) {
      options.push({
        type: EFFECT_KNOW_YOUR_PREY_APPLY,
        enemyInstanceId,
        ability,
        label: `Remove ${ABILITY_NAMES[ability] ?? ability}`,
      });
    }
  }

  // Resistances
  for (const resistance of [RESIST_PHYSICAL, RESIST_FIRE, RESIST_ICE] as ResistanceType[]) {
    if (enemy.definition.resistances.includes(resistance)) {
      options.push({
        type: EFFECT_KNOW_YOUR_PREY_APPLY,
        enemyInstanceId,
        resistance,
        label: `Remove ${RESISTANCE_NAMES[resistance] ?? resistance}`,
      });
    }
  }

  // Element conversions
  const attacks = getEnemyAttacks(enemy);
  const seen = new Set<string>();
  for (const attack of attacks) {
    if (seen.has(attack.element)) continue;
    seen.add(attack.element);

    if (attack.element === ELEMENT_FIRE) {
      options.push({
        type: EFFECT_KNOW_YOUR_PREY_APPLY,
        enemyInstanceId,
        fromElement: ELEMENT_FIRE,
        toElement: ELEMENT_PHYSICAL,
        label: `Convert ${ELEMENT_NAMES[ELEMENT_FIRE]} → ${ELEMENT_NAMES[ELEMENT_PHYSICAL]}`,
      });
    } else if (attack.element === ELEMENT_ICE) {
      options.push({
        type: EFFECT_KNOW_YOUR_PREY_APPLY,
        enemyInstanceId,
        fromElement: ELEMENT_ICE,
        toElement: ELEMENT_PHYSICAL,
        label: `Convert ${ELEMENT_NAMES[ELEMENT_ICE]} → ${ELEMENT_NAMES[ELEMENT_PHYSICAL]}`,
      });
    } else if (attack.element === ELEMENT_COLD_FIRE) {
      options.push({
        type: EFFECT_KNOW_YOUR_PREY_APPLY,
        enemyInstanceId,
        fromElement: ELEMENT_COLD_FIRE,
        toElement: ELEMENT_FIRE,
        label: `Convert ${ELEMENT_NAMES[ELEMENT_COLD_FIRE]} → ${ELEMENT_NAMES[ELEMENT_FIRE]}`,
      });
      options.push({
        type: EFFECT_KNOW_YOUR_PREY_APPLY,
        enemyInstanceId,
        fromElement: ELEMENT_COLD_FIRE,
        toElement: ELEMENT_ICE,
        label: `Convert ${ELEMENT_NAMES[ELEMENT_COLD_FIRE]} → ${ELEMENT_NAMES[ELEMENT_ICE]}`,
      });
    }
  }

  return options;
}

/**
 * Get the resistance removal modifier effect type for a resistance.
 */
function getResistanceRemovalEffectType(resistance: ResistanceType) {
  switch (resistance) {
    case RESIST_PHYSICAL:
      return { type: EFFECT_REMOVE_PHYSICAL_RESISTANCE } as const;
    case RESIST_FIRE:
      return { type: EFFECT_REMOVE_FIRE_RESISTANCE } as const;
    case RESIST_ICE:
      return { type: EFFECT_REMOVE_ICE_RESISTANCE } as const;
  }
}

// ============================================================================
// Effect Registration
// ============================================================================

export function registerKnowYourPreyEffects(): void {
  // Step 1: Select an enemy
  registerEffect(EFFECT_KNOW_YOUR_PREY_SELECT_ENEMY, (state) => {
    const eligibleEnemies = getEligibleEnemies(state);

    // Filter to enemies that have something removable
    const targetableEnemies = eligibleEnemies.filter((enemy) => {
      const options = buildApplyOptionsForEnemy(enemy, enemy.instanceId);
      return options.length > 0;
    });

    if (targetableEnemies.length === 0) {
      return {
        state,
        description: "No valid enemy targets for Know Your Prey",
      };
    }

    // Generate choice options - one per eligible enemy
    const choiceOptions: CardEffect[] = targetableEnemies.map((enemy) => ({
      type: EFFECT_KNOW_YOUR_PREY_SELECT_OPTION,
      enemyInstanceId: enemy.instanceId,
      enemyName: enemy.definition.name,
    } as KnowYourPreySelectOptionEffect));

    return {
      state,
      description: "Select an enemy to target with Know Your Prey",
      requiresChoice: true,
      dynamicChoiceOptions: choiceOptions,
    };
  });

  // Step 2: After enemy selection, present removal options
  registerEffect(EFFECT_KNOW_YOUR_PREY_SELECT_OPTION, (state, _playerId, effect) => {
    const e = effect as KnowYourPreySelectOptionEffect;

    if (!state.combat) {
      return { state, description: "Not in combat" };
    }

    const enemy = state.combat.enemies.find((en) => en.instanceId === e.enemyInstanceId);
    if (!enemy) {
      return { state, description: "Enemy not found" };
    }

    const applyOptions = buildApplyOptionsForEnemy(enemy, e.enemyInstanceId);

    if (applyOptions.length === 0) {
      return { state, description: "No removable abilities/resistances/elements" };
    }

    return {
      state,
      description: `Choose what to remove from ${e.enemyName}`,
      requiresChoice: true,
      dynamicChoiceOptions: [...applyOptions],
    };
  });

  // Step 3: Apply the chosen removal
  registerEffect(EFFECT_KNOW_YOUR_PREY_APPLY, (state, playerId, effect) => {
    const e = effect as KnowYourPreyApplyEffect;

    if (e.ability) {
      // Apply ability nullifier
      const updatedState = addModifier(state, {
        source: {
          type: SOURCE_SKILL,
          skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
          playerId,
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: e.enemyInstanceId },
        effect: {
          type: EFFECT_ABILITY_NULLIFIER,
          ability: e.ability,
        },
        createdAtRound: state.round,
        createdByPlayerId: playerId,
      });
      return { state: updatedState, description: e.label };
    }

    if (e.resistance) {
      // Apply resistance removal
      const updatedState = addModifier(state, {
        source: {
          type: SOURCE_SKILL,
          skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
          playerId,
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: e.enemyInstanceId },
        effect: getResistanceRemovalEffectType(e.resistance),
        createdAtRound: state.round,
        createdByPlayerId: playerId,
      });
      return { state: updatedState, description: e.label };
    }

    if (e.fromElement && e.toElement) {
      // Apply element conversion
      const updatedState = addModifier(state, {
        source: {
          type: SOURCE_SKILL,
          skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
          playerId,
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: e.enemyInstanceId },
        effect: {
          type: EFFECT_CONVERT_ATTACK_ELEMENT,
          fromElement: e.fromElement,
          toElement: e.toElement,
        },
        createdAtRound: state.round,
        createdByPlayerId: playerId,
      });
      return { state: updatedState, description: e.label };
    }

    return { state, description: "Invalid Know Your Prey option" };
  });
}

// ============================================================================
// Exported helpers (for skill activation and validation)
// ============================================================================

/**
 * Check if Know Your Prey can be activated.
 * Requires being in combat with at least one targetable enemy that has
 * something removable/convertible.
 */
export function canActivateKnowYourPrey(state: GameState): boolean {
  if (!state.combat) return false;

  const eligibleEnemies = getEligibleEnemies(state);
  return eligibleEnemies.some((enemy) => {
    const options = buildApplyOptionsForEnemy(enemy, enemy.instanceId);
    return options.length > 0;
  });
}
