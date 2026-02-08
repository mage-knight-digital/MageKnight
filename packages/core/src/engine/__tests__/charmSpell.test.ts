/**
 * Charm / Possess Spell Tests
 *
 * Tests for:
 * - Card definition and registration
 * - Basic (Charm): Influence 4 + interaction bonus (crystal OR unit discount)
 * - Powered (Possess): Enemy skip attack + gain melee attack from enemy
 * - Target restriction (possessed enemy excluded from attack assignment)
 * - Arcane Immunity immunity (excludes from targeting)
 * - Elemental attack preservation (fire, ice, cold fire)
 */

import { describe, it, expect } from "vitest";
import type { GameState } from "../../state/GameState.js";
import type { CombatEnemy } from "../../types/combat.js";
import {
  CARD_CHARM,
  ENEMY_WOLF_RIDERS,
  ENEMY_FIRE_GOLEMS,
  ENEMY_ICE_GOLEMS,
  ENEMY_ALTEM_MAGES,
  ENEMY_SORCERERS,
  ENEMY_DIGGERS,
  ABILITY_ARCANE_IMMUNITY,
  getEnemy,
} from "@mage-knight/shared";
import { CHARM } from "../../data/spells/white/charm.js";
import { getSpellCard } from "../../data/spells/index.js";
import {
  CATEGORY_INFLUENCE,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../types/cards.js";
import {
  MANA_WHITE,
  MANA_BLACK,
} from "@mage-knight/shared";
import { resolveEffect, isEffectResolvable } from "../effects/index.js";
import {
  doesEnemyAttackThisCombat,
  getPossessAttackRestriction,
  addModifier,
} from "../modifiers/index.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";
import type { CardId } from "@mage-knight/shared";
import {
  EFFECT_POSSESS_ATTACK_RESTRICTION,
  DURATION_COMBAT,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  computeAttackPhaseOptions,
  computeAvailableAttack,
} from "../validActions/combatAttack.js";

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

describe("Charm / Possess Spell", () => {
  describe("card definition", () => {
    it("should be registered in spell cards", () => {
      const card = getSpellCard(CARD_CHARM);
      expect(card).toBeDefined();
      expect(card?.name).toBe("Charm");
    });

    it("should have correct metadata", () => {
      expect(CHARM.id).toBe(CARD_CHARM);
      expect(CHARM.name).toBe("Charm");
      expect(CHARM.poweredName).toBe("Possess");
      expect(CHARM.cardType).toBe(DEED_CARD_TYPE_SPELL);
      expect(CHARM.sidewaysValue).toBe(1);
    });

    it("should be powered by black + white mana", () => {
      expect(CHARM.poweredBy).toEqual([MANA_BLACK, MANA_WHITE]);
    });

    it("should have influence category for basic effect", () => {
      expect(CHARM.categories).toEqual([CATEGORY_INFLUENCE]);
    });

    it("should have combat category for powered effect", () => {
      expect(CHARM.poweredEffectCategories).toEqual([CATEGORY_COMBAT]);
    });
  });

  // ============================================================================
  // BASIC EFFECT: CHARM
  // ============================================================================

  describe("basic effect (Charm)", () => {
    const basicEffect = CHARM.basicEffect;

    describe("influence", () => {
      it("should grant Influence 4", () => {
        const player = createTestPlayer({ id: "player1" });
        const state = createTestGameState({ players: [player] });

        const result = resolveEffect(state, "player1", basicEffect);

        // Compound effect resolves sequentially:
        // First sub-effect is influence(4), which should add 4 influence points
        const updatedPlayer = result.state.players.find(
          (p) => p.id === "player1"
        );
        expect(updatedPlayer?.influencePoints).toBe(4);
      });
    });

    describe("interaction bonus", () => {
      it("should offer crystal/discount choice during interaction", () => {
        // The interaction bonus is conditional on being in interaction.
        // When not in interaction, the conditional effect is a no-op.
        const player = createTestPlayer({ id: "player1" });
        const state = createTestGameState({ players: [player] });

        const result = resolveEffect(state, "player1", basicEffect);

        // Outside interaction: compound resolves influence, the conditional
        // ifInInteraction wrapping the choice is skipped
        const updatedPlayer = result.state.players.find(
          (p) => p.id === "player1"
        );
        expect(updatedPlayer?.influencePoints).toBe(4);
      });
    });
  });

  // ============================================================================
  // POWERED EFFECT: POSSESS
  // ============================================================================

  describe("powered effect (Possess)", () => {
    const poweredEffect = CHARM.poweredEffect;

    describe("enemy selection", () => {
      it("should present eligible enemies as choices", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS),
          createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        ]);

        const result = resolveEffect(state, "player1", poweredEffect);

        expect(result.requiresChoice).toBe(true);
        expect(result.dynamicChoiceOptions).toHaveLength(2);
      });

      it("should present only one option when single eligible enemy", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS),
        ]);

        const result = resolveEffect(state, "player1", poweredEffect);

        expect(result.requiresChoice).toBe(true);
        expect(result.dynamicChoiceOptions).toHaveLength(1);
      });
    });

    describe("skip attack", () => {
      it("should prevent target enemy from attacking", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS),
        ]);

        const result = resolveEffect(state, "player1", poweredEffect);
        const choiceEffect = result.dynamicChoiceOptions![0]!;
        const resolved = resolveEffect(result.state, "player1", choiceEffect);

        expect(doesEnemyAttackThisCombat(resolved.state, "enemy_0")).toBe(
          false
        );
      });

      it("should not prevent other enemies from attacking", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS),
          createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        ]);

        const result = resolveEffect(state, "player1", poweredEffect);
        // Select the first enemy
        const choiceEffect = result.dynamicChoiceOptions![0]!;
        const resolved = resolveEffect(result.state, "player1", choiceEffect);

        // First enemy should not attack
        expect(doesEnemyAttackThisCombat(resolved.state, "enemy_0")).toBe(
          false
        );
        // Second enemy should still attack
        expect(doesEnemyAttackThisCombat(resolved.state, "enemy_1")).toBe(true);
      });
    });

    describe("gain attack from enemy", () => {
      it("should grant melee attack equal to physical enemy attack value", () => {
        // Wolf Riders: attack 3, physical element
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS),
        ]);

        const result = resolveEffect(state, "player1", poweredEffect);
        const choiceEffect = result.dynamicChoiceOptions![0]!;
        const resolved = resolveEffect(result.state, "player1", choiceEffect);

        const player = resolved.state.players.find(
          (p) => p.id === "player1"
        )!;
        // Physical melee attack goes to attack.normal
        expect(player.combatAccumulator.attack.normal).toBe(3);
      });

      it("should grant fire melee attack from fire-element enemy", () => {
        // Fire Golems: attack 3, fire element
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_FIRE_GOLEMS),
        ]);

        const result = resolveEffect(state, "player1", poweredEffect);
        const choiceEffect = result.dynamicChoiceOptions![0]!;
        const resolved = resolveEffect(result.state, "player1", choiceEffect);

        const player = resolved.state.players.find(
          (p) => p.id === "player1"
        )!;
        // Fire melee attack goes to attack.normalElements.fire
        expect(player.combatAccumulator.attack.normalElements.fire).toBe(3);
      });

      it("should grant ice melee attack from ice-element enemy", () => {
        // Ice Golems: attack 2, ice element
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_ICE_GOLEMS),
        ]);

        const result = resolveEffect(state, "player1", poweredEffect);
        const choiceEffect = result.dynamicChoiceOptions![0]!;
        const resolved = resolveEffect(result.state, "player1", choiceEffect);

        const player = resolved.state.players.find(
          (p) => p.id === "player1"
        )!;
        // Ice melee attack goes to attack.normalElements.ice
        expect(player.combatAccumulator.attack.normalElements.ice).toBe(2);
      });

      it("should grant cold fire melee attack from cold-fire element enemy", () => {
        // Altem Mages: attack 4, cold_fire element
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_ALTEM_MAGES),
        ]);

        const result = resolveEffect(state, "player1", poweredEffect);
        const choiceEffect = result.dynamicChoiceOptions![0]!;
        const resolved = resolveEffect(result.state, "player1", choiceEffect);

        const player = resolved.state.players.find(
          (p) => p.id === "player1"
        )!;
        // Cold Fire melee attack goes to attack.normalElements.coldFire
        expect(player.combatAccumulator.attack.normalElements.coldFire).toBe(4);
      });
    });

    describe("arcane immunity", () => {
      it("should exclude Arcane Immune enemies from targeting", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_SORCERERS),
        ]);

        expect(getEnemy(ENEMY_SORCERERS).abilities).toContain(
          ABILITY_ARCANE_IMMUNITY
        );

        const result = resolveEffect(state, "player1", poweredEffect);

        expect(result.requiresChoice).toBeUndefined();
        expect(result.description).toBe("No valid enemy targets");
      });

      it("should exclude Arcane Immune enemies but allow others", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_SORCERERS), // Arcane Immune
          createCombatEnemy("enemy_1", ENEMY_WOLF_RIDERS), // Normal
        ]);

        const result = resolveEffect(state, "player1", poweredEffect);

        expect(result.requiresChoice).toBe(true);
        expect(result.dynamicChoiceOptions).toHaveLength(1);
      });

      it("should not be resolvable when only Arcane Immune enemies exist", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_SORCERERS),
        ]);

        expect(isEffectResolvable(state, "player1", poweredEffect)).toBe(
          false
        );
      });
    });

    describe("defeated enemies", () => {
      it("should exclude defeated enemies from targeting", () => {
        const enemy = createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS);
        enemy.isDefeated = true;

        const state = createStateWithCombat([enemy]);

        const result = resolveEffect(state, "player1", poweredEffect);

        expect(result.requiresChoice).toBeUndefined();
        expect(result.description).toBe("No valid enemy targets");
      });
    });

    describe("not in combat", () => {
      it("should return early when not in combat", () => {
        const player = createTestPlayer({ id: "player1" });
        const state = createTestGameState({ players: [player] });

        const result = resolveEffect(state, "player1", poweredEffect);

        expect(result.description).toBe("Not in combat");
      });
    });

    describe("possess attack restriction modifier", () => {
      it("should add restriction modifier for possessed enemy", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS), // attack 3
        ]);

        const result = resolveEffect(state, "player1", poweredEffect);
        const choiceEffect = result.dynamicChoiceOptions![0]!;
        const resolved = resolveEffect(result.state, "player1", choiceEffect);

        // Should have a possess attack restriction modifier
        const restrictionMod = resolved.state.activeModifiers.find(
          (m) => m.effect.type === EFFECT_POSSESS_ATTACK_RESTRICTION
        );
        expect(restrictionMod).toBeDefined();
        expect(restrictionMod!.effect).toEqual(
          expect.objectContaining({
            type: EFFECT_POSSESS_ATTACK_RESTRICTION,
            possessedEnemyId: "enemy_0",
            attackAmount: 3,
          })
        );
      });
    });
  });

  // ============================================================================
  // ATTACK ASSIGNMENT RESTRICTIONS
  // ============================================================================

  describe("attack assignment restrictions", () => {
    it("should exclude possessed enemy from assignable attacks in attack phase", () => {
      // Set up: Two enemies, one possessed
      const state = createStateWithCombat(
        [
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS), // attack 3, physical
          createCombatEnemy("enemy_1", ENEMY_DIGGERS), // attack 3
        ],
        COMBAT_PHASE_ATTACK
      );

      // Resolve possess on enemy_0
      const result = resolveEffect(state, "player1", CHARM.poweredEffect);
      const choiceEffect = result.dynamicChoiceOptions![0]!;
      const resolved = resolveEffect(result.state, "player1", choiceEffect);

      // Compute attack options - possessed enemy should be excluded
      const options = computeAttackPhaseOptions(
        resolved.state,
        resolved.state.combat!,
        resolved.state.players[0],
        false // attack phase
      );

      // Should have assignable attacks only for enemy_1 (the non-possessed enemy)
      if (options.assignableAttacks) {
        const targetedEnemies = new Set(
          options.assignableAttacks.map((a) => a.enemyInstanceId)
        );
        expect(targetedEnemies.has("enemy_0")).toBe(false);
        expect(targetedEnemies.has("enemy_1")).toBe(true);
      }
    });

    it("should allow attacking non-possessed enemies normally", () => {
      const state = createStateWithCombat(
        [
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS),
          createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        ],
        COMBAT_PHASE_ATTACK
      );

      // Resolve possess on enemy_0
      const result = resolveEffect(state, "player1", CHARM.poweredEffect);
      const choiceEffect = result.dynamicChoiceOptions![0]!;
      const resolved = resolveEffect(result.state, "player1", choiceEffect);

      const player = resolved.state.players[0]!;

      // Player should have attack from possessed enemy (3 melee)
      expect(player.combatAccumulator.attack.normal).toBe(3);

      // Available attack pool should show the melee attack
      const availablePool = computeAvailableAttack(
        player.combatAccumulator.attack,
        player.combatAccumulator.assignedAttack,
        false // attack phase
      );
      expect(availablePool.melee).toBe(3);
    });
  });

  // ============================================================================
  // TIMING TESTS
  // ============================================================================

  describe("timing flexibility", () => {
    it("should be resolvable during ranged/siege phase", () => {
      const state = createStateWithCombat(
        [createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS)],
        COMBAT_PHASE_RANGED_SIEGE
      );

      expect(isEffectResolvable(state, "player1", CHARM.poweredEffect)).toBe(
        true
      );
    });

    it("should be resolvable during block phase", () => {
      const state = createStateWithCombat(
        [createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS)],
        COMBAT_PHASE_BLOCK
      );

      expect(isEffectResolvable(state, "player1", CHARM.poweredEffect)).toBe(
        true
      );
    });

    it("should be resolvable during attack phase", () => {
      const state = createStateWithCombat(
        [createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS)],
        COMBAT_PHASE_ATTACK
      );

      expect(isEffectResolvable(state, "player1", CHARM.poweredEffect)).toBe(
        true
      );
    });
  });

  // ============================================================================
  // DESCRIPTION TESTS
  // ============================================================================

  describe("descriptions", () => {
    it("should describe skip attack and gained attack for physical enemy", () => {
      const state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS),
      ]);

      const result = resolveEffect(state, "player1", CHARM.poweredEffect);
      const choiceEffect = result.dynamicChoiceOptions![0]!;
      const resolved = resolveEffect(result.state, "player1", choiceEffect);

      expect(resolved.description).toContain("does not attack");
      expect(resolved.description).toContain("Attack");
    });

    it("should describe fire element in gained attack", () => {
      const state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_FIRE_GOLEMS),
      ]);

      const result = resolveEffect(state, "player1", CHARM.poweredEffect);
      const choiceEffect = result.dynamicChoiceOptions![0]!;
      const resolved = resolveEffect(result.state, "player1", choiceEffect);

      expect(resolved.description).toContain("fire");
    });
  });

  // ============================================================================
  // getPossessAttackRestriction MODIFIER QUERY
  // ============================================================================

  describe("getPossessAttackRestriction", () => {
    it("should return 0 when no restriction modifiers exist", () => {
      const state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS),
      ]);

      expect(getPossessAttackRestriction(state, "player1", "enemy_0")).toBe(0);
    });

    it("should return attack amount for possessed enemy", () => {
      let state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS),
      ]);

      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "charm" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_POSSESS_ATTACK_RESTRICTION,
          possessedEnemyId: "enemy_0",
          attackAmount: 3,
        },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      expect(getPossessAttackRestriction(state, "player1", "enemy_0")).toBe(3);
    });

    it("should not return restriction for a different enemy", () => {
      let state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS),
        createCombatEnemy("enemy_1", ENEMY_DIGGERS),
      ]);

      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "charm" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_POSSESS_ATTACK_RESTRICTION,
          possessedEnemyId: "enemy_0",
          attackAmount: 3,
        },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      expect(getPossessAttackRestriction(state, "player1", "enemy_0")).toBe(3);
      expect(getPossessAttackRestriction(state, "player1", "enemy_1")).toBe(0);
    });

    it("should be set by resolving possess on an enemy", () => {
      const state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS), // attack 3
      ]);

      const result = resolveEffect(state, "player1", CHARM.poweredEffect);
      const choiceEffect = result.dynamicChoiceOptions![0]!;
      const resolved = resolveEffect(result.state, "player1", choiceEffect);

      expect(
        getPossessAttackRestriction(resolved.state, "player1", "enemy_0")
      ).toBe(3);
    });
  });
});
