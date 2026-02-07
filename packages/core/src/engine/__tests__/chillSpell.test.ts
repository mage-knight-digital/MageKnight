/**
 * Chill / Lethal Chill Spell Tests
 *
 * Tests for:
 * - Card definition and registration
 * - Basic (Chill): Target enemy doesn't attack + loses Fire Resistance
 * - Powered (Lethal Chill): Target enemy doesn't attack + Armor -4
 * - Ice Resistance immunity (excludes from targeting)
 * - Arcane Immunity immunity (excludes from targeting)
 * - Fire resistance removal via modifier system
 */

import { describe, it, expect } from "vitest";
import type { GameState } from "../../state/GameState.js";
import type { CombatEnemy } from "../../types/combat.js";
import type { CardId } from "@mage-knight/shared";
import {
  CARD_CHILL,
  ENEMY_WOLF_RIDERS,
  ENEMY_FIRE_MAGES,
  ENEMY_ICE_MAGES,
  ENEMY_SORCERERS,
  ENEMY_DIGGERS,
  RESIST_FIRE,
  RESIST_ICE,
  ABILITY_ARCANE_IMMUNITY,
  getEnemy,
} from "@mage-knight/shared";
import { CHILL } from "../../data/spells/blue/chill.js";
import { getSpellCard } from "../../data/spells/index.js";
import {
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../types/cards.js";
import {
  MANA_BLUE,
  MANA_BLACK,
} from "@mage-knight/shared";
import { resolveEffect, isEffectResolvable } from "../effects/index.js";
import {
  getEffectiveEnemyArmor,
  doesEnemyAttackThisCombat,
  isFireResistanceRemoved,
  addModifier,
} from "../modifiers/index.js";
import { getEnemyResistances } from "../validActions/combatHelpers.js";
import {
  DURATION_COMBAT,
  EFFECT_REMOVE_FIRE_RESISTANCE,
  SCOPE_ONE_ENEMY,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

function createCombatEnemy(
  instanceId: string,
  enemyId: string,
  isRequiredForConquest = true
): CombatEnemy {
  return {
    instanceId,
    enemyId: enemyId as never,
    definition: getEnemy(enemyId as never),
    isDefeated: false,
    isBlocked: false,
    isRequiredForConquest,
    isSummonerHidden: false,
    attacksBlocked: [],
    attacksDamageAssigned: [],
  };
}

function createStateWithCombat(
  enemies: CombatEnemy[],
  phase: typeof COMBAT_PHASE_RANGED_SIEGE | typeof COMBAT_PHASE_ATTACK | typeof COMBAT_PHASE_BLOCK = COMBAT_PHASE_RANGED_SIEGE
): GameState {
  const player = createTestPlayer({ id: "player1" });
  const state = createTestGameState({ players: [player] });
  return {
    ...state,
    combat: {
      phase,
      enemies,
      isAtFortifiedSite: false,
      pendingDamage: {},
      pendingBlock: {},
      pendingSwiftBlock: {},
      fameGained: 0,
      unitsAllowed: true,
      enemyAssignments: undefined,
      assaultOrigin: undefined,
    },
    activeModifiers: [],
  };
}

// ============================================================================
// CARD DEFINITION TESTS
// ============================================================================

describe("Chill / Lethal Chill Spell", () => {
  describe("card definition", () => {
    it("should be registered in spell cards", () => {
      const card = getSpellCard(CARD_CHILL);
      expect(card).toBeDefined();
      expect(card?.name).toBe("Chill");
    });

    it("should have correct metadata", () => {
      expect(CHILL.id).toBe(CARD_CHILL);
      expect(CHILL.name).toBe("Chill");
      expect(CHILL.poweredName).toBe("Lethal Chill");
      expect(CHILL.cardType).toBe(DEED_CARD_TYPE_SPELL);
      expect(CHILL.sidewaysValue).toBe(1);
    });

    it("should be powered by black + blue mana", () => {
      expect(CHILL.poweredBy).toEqual([MANA_BLACK, MANA_BLUE]);
    });

    it("should have combat category", () => {
      expect(CHILL.categories).toEqual([CATEGORY_COMBAT]);
    });
  });

  // ============================================================================
  // BASIC EFFECT: CHILL
  // ============================================================================

  describe("basic effect (Chill)", () => {
    const basicEffect = CHILL.basicEffect;

    describe("skip attack", () => {
      it("should prevent target enemy from attacking", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS),
        ]);

        const result = resolveEffect(state, "player1", basicEffect);

        // Should require a choice (enemy selection)
        expect(result.requiresChoice).toBe(true);
        expect(result.dynamicChoiceOptions).toHaveLength(1);

        // Resolve the choice by selecting the enemy
        const choiceEffect = result.dynamicChoiceOptions![0]!;
        const resolved = resolveEffect(result.state, "player1", choiceEffect);

        expect(doesEnemyAttackThisCombat(resolved.state, "enemy_0")).toBe(false);
      });

      it("should allow targeting any non-resistant, non-immune enemy", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS),
          createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        ]);

        const result = resolveEffect(state, "player1", basicEffect);

        expect(result.requiresChoice).toBe(true);
        expect(result.dynamicChoiceOptions).toHaveLength(2);
      });
    });

    describe("fire resistance removal", () => {
      it("should remove fire resistance from target enemy", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_FIRE_MAGES), // has RESIST_FIRE
        ]);

        // Fire Mages should have fire resistance initially
        const fireMages = getEnemy(ENEMY_FIRE_MAGES);
        expect(fireMages.resistances).toContain(RESIST_FIRE);

        const result = resolveEffect(state, "player1", basicEffect);
        const choiceEffect = result.dynamicChoiceOptions![0]!;
        const resolved = resolveEffect(result.state, "player1", choiceEffect);

        // Fire resistance should be removed
        expect(isFireResistanceRemoved(resolved.state, "enemy_0")).toBe(true);

        // getEnemyResistances should reflect the removal
        const enemy = resolved.state.combat!.enemies[0]!;
        const resistances = getEnemyResistances(resolved.state, enemy);
        expect(resistances).not.toContain(RESIST_FIRE);
      });

      it("should not affect enemies without fire resistance", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS), // no resistances
        ]);

        const result = resolveEffect(state, "player1", basicEffect);
        const choiceEffect = result.dynamicChoiceOptions![0]!;
        const resolved = resolveEffect(result.state, "player1", choiceEffect);

        // Modifier is applied but has no practical effect since enemy has no fire resistance
        expect(isFireResistanceRemoved(resolved.state, "enemy_0")).toBe(true);

        const enemy = resolved.state.combat!.enemies[0]!;
        const resistances = getEnemyResistances(resolved.state, enemy);
        expect(resistances).toEqual([]);
      });
    });

    describe("ice resistance immunity", () => {
      it("should exclude Ice Resistant enemies from targeting", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_ICE_MAGES), // has RESIST_ICE
        ]);

        // Verify Ice Mages have ice resistance
        expect(getEnemy(ENEMY_ICE_MAGES).resistances).toContain(RESIST_ICE);

        const result = resolveEffect(state, "player1", basicEffect);

        // No valid targets - should not require a choice
        expect(result.requiresChoice).toBeUndefined();
        expect(result.description).toBe("No valid enemy targets");
      });

      it("should exclude Ice Resistant enemies but allow others", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_ICE_MAGES), // RESIST_ICE - excluded
          createCombatEnemy("enemy_1", ENEMY_WOLF_RIDERS), // no resistances - valid
        ]);

        const result = resolveEffect(state, "player1", basicEffect);

        expect(result.requiresChoice).toBe(true);
        expect(result.dynamicChoiceOptions).toHaveLength(1);
      });

      it("should not be resolvable when only Ice Resistant enemies exist", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_ICE_MAGES),
        ]);

        expect(isEffectResolvable(state, "player1", basicEffect)).toBe(false);
      });
    });

    describe("arcane immunity", () => {
      it("should exclude Arcane Immune enemies from targeting", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_SORCERERS), // has ABILITY_ARCANE_IMMUNITY
        ]);

        expect(getEnemy(ENEMY_SORCERERS).abilities).toContain(ABILITY_ARCANE_IMMUNITY);

        const result = resolveEffect(state, "player1", basicEffect);

        expect(result.requiresChoice).toBeUndefined();
        expect(result.description).toBe("No valid enemy targets");
      });

      it("should exclude Arcane Immune enemies but allow others", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_SORCERERS), // Arcane Immune - excluded
          createCombatEnemy("enemy_1", ENEMY_WOLF_RIDERS), // normal - valid
        ]);

        const result = resolveEffect(state, "player1", basicEffect);

        expect(result.requiresChoice).toBe(true);
        expect(result.dynamicChoiceOptions).toHaveLength(1);
      });

      it("should not be resolvable when only Arcane Immune enemies exist", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_SORCERERS),
        ]);

        expect(isEffectResolvable(state, "player1", basicEffect)).toBe(false);
      });
    });
  });

  // ============================================================================
  // POWERED EFFECT: LETHAL CHILL
  // ============================================================================

  describe("powered effect (Lethal Chill)", () => {
    const poweredEffect = CHILL.poweredEffect;

    describe("skip attack + armor reduction", () => {
      it("should prevent target enemy from attacking and reduce armor by 4", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS), // armor 4
        ]);

        const result = resolveEffect(state, "player1", poweredEffect);
        const choiceEffect = result.dynamicChoiceOptions![0]!;
        const resolved = resolveEffect(result.state, "player1", choiceEffect);

        // Enemy should not attack
        expect(doesEnemyAttackThisCombat(resolved.state, "enemy_0")).toBe(false);

        // Armor should be reduced by 4 (4 - 4 = 0, but minimum 1)
        const effectiveArmor = getEffectiveEnemyArmor(
          resolved.state,
          "enemy_0",
          getEnemy(ENEMY_WOLF_RIDERS).armor,
          0,
          "player1"
        );
        expect(effectiveArmor).toBe(1); // 4 - 4 = 0, min 1
      });

      it("should reduce armor but not below minimum of 1", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_DIGGERS), // armor 3
        ]);

        const result = resolveEffect(state, "player1", poweredEffect);
        const choiceEffect = result.dynamicChoiceOptions![0]!;
        const resolved = resolveEffect(result.state, "player1", choiceEffect);

        // 3 - 4 = -1, but minimum is 1
        const effectiveArmor = getEffectiveEnemyArmor(
          resolved.state,
          "enemy_0",
          getEnemy(ENEMY_DIGGERS).armor,
          0,
          "player1"
        );
        expect(effectiveArmor).toBe(1);
      });

      it("should reduce high armor enemies appropriately", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_FIRE_MAGES), // armor 5
        ]);

        const result = resolveEffect(state, "player1", poweredEffect);
        const choiceEffect = result.dynamicChoiceOptions![0]!;
        const resolved = resolveEffect(result.state, "player1", choiceEffect);

        // 5 - 4 = 1
        const effectiveArmor = getEffectiveEnemyArmor(
          resolved.state,
          "enemy_0",
          getEnemy(ENEMY_FIRE_MAGES).armor,
          getEnemy(ENEMY_FIRE_MAGES).resistances.length,
          "player1"
        );
        expect(effectiveArmor).toBe(1);
      });
    });

    describe("ice resistance immunity", () => {
      it("should exclude Ice Resistant enemies from powered targeting", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_ICE_MAGES), // has RESIST_ICE
        ]);

        const result = resolveEffect(state, "player1", poweredEffect);

        expect(result.requiresChoice).toBeUndefined();
        expect(result.description).toBe("No valid enemy targets");
      });
    });

    describe("arcane immunity", () => {
      it("should exclude Arcane Immune enemies from powered targeting", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_SORCERERS), // Arcane Immune
        ]);

        const result = resolveEffect(state, "player1", poweredEffect);

        expect(result.requiresChoice).toBeUndefined();
        expect(result.description).toBe("No valid enemy targets");
      });
    });
  });

  // ============================================================================
  // FIRE RESISTANCE REMOVAL MODIFIER
  // ============================================================================

  describe("isFireResistanceRemoved modifier", () => {
    it("should return false when no modifiers exist", () => {
      const state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_FIRE_MAGES),
      ]);

      expect(isFireResistanceRemoved(state, "enemy_0")).toBe(false);
    });

    it("should return true when EFFECT_REMOVE_FIRE_RESISTANCE modifier targets enemy", () => {
      let state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_FIRE_MAGES),
      ]);

      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "chill" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
        effect: { type: EFFECT_REMOVE_FIRE_RESISTANCE },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      expect(isFireResistanceRemoved(state, "enemy_0")).toBe(true);
    });

    it("should not affect other enemies when SCOPE_ONE_ENEMY is used", () => {
      let state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_FIRE_MAGES),
        createCombatEnemy("enemy_1", ENEMY_FIRE_MAGES),
      ]);

      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "chill" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
        effect: { type: EFFECT_REMOVE_FIRE_RESISTANCE },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      expect(isFireResistanceRemoved(state, "enemy_0")).toBe(true);
      expect(isFireResistanceRemoved(state, "enemy_1")).toBe(false);
    });

    it("should be blocked by Arcane Immunity", () => {
      let state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_SORCERERS), // Arcane Immune
      ]);

      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "chill" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
        effect: { type: EFFECT_REMOVE_FIRE_RESISTANCE },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      // Arcane Immunity blocks the modifier effect
      expect(isFireResistanceRemoved(state, "enemy_0")).toBe(false);
    });
  });

  // ============================================================================
  // getEnemyResistances INTEGRATION
  // ============================================================================

  describe("getEnemyResistances with fire resistance removal", () => {
    it("should remove fire resistance from enemy resistances list", () => {
      let state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_FIRE_MAGES), // [RESIST_FIRE]
      ]);

      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "chill" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
        effect: { type: EFFECT_REMOVE_FIRE_RESISTANCE },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      const enemy = state.combat!.enemies[0]!;
      const resistances = getEnemyResistances(state, enemy);
      expect(resistances).not.toContain(RESIST_FIRE);
      expect(resistances).toEqual([]);
    });

    it("should only remove fire resistance, keeping other resistances", () => {
      // Altem Guardsmen have [RESIST_PHYSICAL, RESIST_FIRE, RESIST_ICE]
      let state = createStateWithCombat([
        createCombatEnemy("enemy_0", "altem_guardsmen"),
      ]);

      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "chill" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
        effect: { type: EFFECT_REMOVE_FIRE_RESISTANCE },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      const enemy = state.combat!.enemies[0]!;
      const resistances = getEnemyResistances(state, enemy);
      expect(resistances).not.toContain(RESIST_FIRE);
      expect(resistances).toContain("physical");
      expect(resistances).toContain(RESIST_ICE);
    });
  });

  // ============================================================================
  // TIMING TESTS
  // ============================================================================

  describe("timing flexibility", () => {
    it("should be usable during ranged/siege phase", () => {
      const state = createStateWithCombat(
        [createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS)],
        COMBAT_PHASE_RANGED_SIEGE
      );

      expect(isEffectResolvable(state, "player1", CHILL.basicEffect)).toBe(true);
    });

    it("should be usable during block phase", () => {
      const state = createStateWithCombat(
        [createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS)],
        COMBAT_PHASE_BLOCK
      );

      expect(isEffectResolvable(state, "player1", CHILL.basicEffect)).toBe(true);
    });

    it("should be usable during attack phase", () => {
      const state = createStateWithCombat(
        [createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS)],
        COMBAT_PHASE_ATTACK
      );

      expect(isEffectResolvable(state, "player1", CHILL.basicEffect)).toBe(true);
    });
  });
});
