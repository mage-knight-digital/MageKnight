/**
 * Combat Abilities Tests
 *
 * Tests for enemy abilities including Paralyze and enemy skip attack modifier.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { withBlockSources } from "./combatTestHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_BLOCK_ACTION,
  ASSIGN_DAMAGE_ACTION,
  INVALID_ACTION,
  UNIT_DESTROYED,
  PARALYZE_HAND_DISCARDED,
  ENEMY_MEDUSA,
  ENEMY_FREEZERS,
  ENEMY_DIGGERS,
  ENEMY_SORCERERS,
  ENEMY_DELPHANA_MASTERS,
  CARD_WOUND,
  CARD_MARCH,
  CARD_RAGE,
  CARD_STAMINA,
  ELEMENT_PHYSICAL,
  ABILITY_PARALYZE,
  ABILITY_ASSASSINATION,
  DAMAGE_TARGET_UNIT,
  DAMAGE_TARGET_HERO,
  UNIT_DESTROY_REASON_PARALYZE,
  UNIT_PEASANTS,
  UNIT_FORESTERS,
} from "@mage-knight/shared";
import { addModifier } from "../modifiers.js";
import {
  DURATION_COMBAT,
  SCOPE_ONE_ENEMY,
  SOURCE_SKILL,
  EFFECT_ABILITY_NULLIFIER,
  EFFECT_ENEMY_SKIP_ATTACK,
} from "../../types/modifierConstants.js";
import {
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";

describe("Combat Abilities", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("Paralyze ability", () => {
    describe("units", () => {
      it("should destroy unit immediately on wound from paralyze enemy", () => {
        // Peasants have armor 2 (level 1 Regular)
        const player = createTestPlayer({
          hand: [],
          deck: [CARD_MARCH],
          handLimit: 5,
          armor: 2,
          units: [
            {
              unitId: UNIT_PEASANTS,
              instanceId: "unit_0",
              ready: true,
              wounded: false,
              usedResistanceThisCombat: false,
            },
          ],
        });
        let state = createTestGameState({ players: [player] });

        // Enter combat with Medusa (attack 6, paralyze)
        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_MEDUSA],
        }).state;

        // Skip to Assign Damage phase (don't block)
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;

        // Assign damage to unit (Peasants have armor 2, Medusa attack 6)
        // Unit absorbs 2 damage and would be wounded, but paralyze destroys it
        const result = engine.processAction(state, "player1", {
          type: ASSIGN_DAMAGE_ACTION,
          enemyInstanceId: "enemy_0",
          assignments: [
            { target: DAMAGE_TARGET_UNIT, unitInstanceId: "unit_0", amount: 6 },
          ],
        });

        // Unit should be destroyed
        expect(result.state.players[0].units).toHaveLength(0);
        expect(result.events).toContainEqual(
          expect.objectContaining({
            type: UNIT_DESTROYED,
            unitInstanceId: "unit_0",
            reason: UNIT_DESTROY_REASON_PARALYZE,
          })
        );
      });

      it("should still absorb armor value when destroyed by paralyze", () => {
        // Peasants have armor 2
        // Hero has armor 2
        const player = createTestPlayer({
          hand: [],
          deck: [CARD_MARCH],
          handLimit: 5,
          armor: 2,
          units: [
            {
              unitId: UNIT_PEASANTS,
              instanceId: "unit_0",
              ready: true,
              wounded: false,
              usedResistanceThisCombat: false,
            },
          ],
        });
        let state = createTestGameState({ players: [player] });

        // Enter combat with Medusa (attack 6, paralyze)
        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_MEDUSA],
        }).state;

        // Skip to Assign Damage phase (don't block)
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;

        // Assign all 6 damage to unit (Peasants have armor 2)
        // Unit absorbs 2 damage (armor) and is destroyed by paralyze
        // Remaining 4 damage overflows to hero
        // 4 / 2 armor = 2 wounds
        const result = engine.processAction(state, "player1", {
          type: ASSIGN_DAMAGE_ACTION,
          enemyInstanceId: "enemy_0",
          assignments: [
            { target: DAMAGE_TARGET_UNIT, unitInstanceId: "unit_0", amount: 6 },
          ],
        });

        // Unit should be destroyed
        expect(result.state.players[0].units).toHaveLength(0);

        // Hero should have wounds from overflow damage
        // 6 damage to unit - 2 armor = 4 overflow damage
        // 4 / 2 hero armor = 2 wounds
        const heroWounds = result.state.players[0].hand.filter(
          (c) => c === CARD_WOUND
        ).length;
        expect(heroWounds).toBe(2);
      });
    });

    describe("hero", () => {
      it("should discard all non-wound cards from hand when wounded", () => {
        const player = createTestPlayer({
          hand: [CARD_MARCH, CARD_RAGE, CARD_WOUND, CARD_STAMINA],
          deck: [CARD_MARCH],
          handLimit: 5,
          armor: 2,
        });
        let state = createTestGameState({ players: [player] });

        // Enter combat with Medusa (attack 6, paralyze)
        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_MEDUSA],
        }).state;

        // Skip to Assign Damage phase (don't block)
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;

        // Assign damage to hero
        // Medusa attack 6 / armor 2 = 3 wounds
        const result = engine.processAction(state, "player1", {
          type: ASSIGN_DAMAGE_ACTION,
          enemyInstanceId: "enemy_0",
        });

        const player1 = result.state.players[0];

        // Hand should only contain wounds (1 existing + 3 new = 4 wounds)
        expect(player1.hand.filter((c) => c === CARD_WOUND)).toHaveLength(4);
        expect(player1.hand.filter((c) => c !== CARD_WOUND)).toHaveLength(0);

        // Discard should contain the non-wound cards (March, Rage, Stamina)
        expect(player1.discard).toContain(CARD_MARCH);
        expect(player1.discard).toContain(CARD_RAGE);
        expect(player1.discard).toContain(CARD_STAMINA);

        // Should have emitted the paralyze event
        expect(result.events).toContainEqual(
          expect.objectContaining({
            type: PARALYZE_HAND_DISCARDED,
            playerId: "player1",
            cardsDiscarded: 3,
          })
        );
      });

      it("should not discard if no wounds taken (blocked)", () => {
        const player = createTestPlayer({
          hand: [CARD_MARCH, CARD_RAGE],
          deck: [CARD_MARCH],
          handLimit: 5,
        });
        let state = createTestGameState({ players: [player] });

        // Enter combat with Medusa (attack 6, paralyze)
        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_MEDUSA],
        }).state;

        // Block phase - block the enemy
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;
        state = withBlockSources(state, "player1", [
          { element: ELEMENT_PHYSICAL, value: 6 },
        ]);
        state = engine.processAction(state, "player1", {
          type: DECLARE_BLOCK_ACTION,
          targetEnemyInstanceId: "enemy_0",
        }).state;

        // Assign Damage phase - skip (enemy is blocked)
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;

        // Hand should be unchanged
        expect(state.players[0].hand).toEqual([CARD_MARCH, CARD_RAGE]);
      });

      it("should NOT discard hero hand when unit absorbs all damage from paralyze enemy", () => {
        // Freezers have attack 3 with paralyze
        // Foresters have armor 4 - can absorb all 3 damage
        // If unit absorbs all damage, hero takes 0 wounds
        // Paralyze should NOT discard hero's hand since hero wasn't wounded
        const player = createTestPlayer({
          hand: [CARD_MARCH, CARD_RAGE, CARD_STAMINA],
          deck: [CARD_MARCH],
          handLimit: 5,
          armor: 2,
          units: [
            {
              unitId: UNIT_FORESTERS, // armor 4
              instanceId: "unit_0",
              ready: true,
              wounded: false,
              usedResistanceThisCombat: false,
            },
          ],
        });
        let state = createTestGameState({ players: [player] });

        // Enter combat with Freezers (attack 3, paralyze)
        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_FREEZERS],
        }).state;

        // Skip to Assign Damage phase (don't block)
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;

        // Assign all 3 damage to unit (Foresters have armor 4)
        // Unit absorbs all 3 damage (armor 4 > damage 3)
        // Unit is destroyed by paralyze, but no overflow to hero
        // Hero takes 0 wounds
        const result = engine.processAction(state, "player1", {
          type: ASSIGN_DAMAGE_ACTION,
          enemyInstanceId: "enemy_0",
          assignments: [
            { target: DAMAGE_TARGET_UNIT, unitInstanceId: "unit_0", amount: 3 },
          ],
        });

        // Unit should be destroyed (paralyze)
        expect(result.state.players[0].units).toHaveLength(0);

        // Hero took 0 wounds - hand should be unchanged
        const heroWounds = result.state.players[0].hand.filter(
          (c) => c === CARD_WOUND
        ).length;
        expect(heroWounds).toBe(0);

        // Hand should still have all original cards (NOT discarded by paralyze)
        expect(result.state.players[0].hand).toContain(CARD_MARCH);
        expect(result.state.players[0].hand).toContain(CARD_RAGE);
        expect(result.state.players[0].hand).toContain(CARD_STAMINA);

        // Should NOT have emitted the paralyze hand discard event
        expect(result.events).not.toContainEqual(
          expect.objectContaining({
            type: PARALYZE_HAND_DISCARDED,
          })
        );
      });
    });

    describe("nullification", () => {
      it("should wound unit normally if paralyze is nullified", () => {
        const player = createTestPlayer({
          hand: [],
          deck: [CARD_MARCH],
          handLimit: 5,
          armor: 2,
          units: [
            {
              unitId: UNIT_PEASANTS,
              instanceId: "unit_0",
              ready: true,
              wounded: false,
              usedResistanceThisCombat: false,
            },
          ],
        });
        let state = createTestGameState({ players: [player] });

        // Enter combat with Medusa (attack 6, paralyze)
        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_MEDUSA],
        }).state;

        // Add ability nullifier for Paralyze on this enemy
        state = addModifier(state, {
          source: { type: SOURCE_SKILL, id: "test_skill" },
          duration: DURATION_COMBAT,
          scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
          effect: { type: EFFECT_ABILITY_NULLIFIER, ability: ABILITY_PARALYZE },
          createdByPlayerId: "player1",
          createdAtRound: state.round,
        });

        // Skip to Assign Damage phase (don't block)
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;

        // Assign damage to unit
        const result = engine.processAction(state, "player1", {
          type: ASSIGN_DAMAGE_ACTION,
          enemyInstanceId: "enemy_0",
          assignments: [
            { target: DAMAGE_TARGET_UNIT, unitInstanceId: "unit_0", amount: 6 },
          ],
        });

        // Unit should be wounded but NOT destroyed (paralyze is nullified)
        expect(result.state.players[0].units).toHaveLength(1);
        expect(result.state.players[0].units[0].wounded).toBe(true);

        // Should NOT have the destroy event
        expect(result.events).not.toContainEqual(
          expect.objectContaining({
            type: UNIT_DESTROYED,
            reason: UNIT_DESTROY_REASON_PARALYZE,
          })
        );
      });

      it("should not discard hand if paralyze is nullified", () => {
        const player = createTestPlayer({
          hand: [CARD_MARCH, CARD_RAGE],
          deck: [CARD_MARCH],
          handLimit: 5,
          armor: 2,
        });
        let state = createTestGameState({ players: [player] });

        // Enter combat with Medusa (attack 6, paralyze)
        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_MEDUSA],
        }).state;

        // Add ability nullifier for Paralyze on this enemy
        state = addModifier(state, {
          source: { type: SOURCE_SKILL, id: "test_skill" },
          duration: DURATION_COMBAT,
          scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
          effect: { type: EFFECT_ABILITY_NULLIFIER, ability: ABILITY_PARALYZE },
          createdByPlayerId: "player1",
          createdAtRound: state.round,
        });

        // Skip to Assign Damage phase (don't block)
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;

        // Assign damage to hero
        const result = engine.processAction(state, "player1", {
          type: ASSIGN_DAMAGE_ACTION,
          enemyInstanceId: "enemy_0",
        });

        const player1 = result.state.players[0];

        // Hand should contain wounds AND the non-wound cards (not discarded)
        expect(player1.hand).toContain(CARD_MARCH);
        expect(player1.hand).toContain(CARD_RAGE);
        expect(player1.hand.filter((c) => c === CARD_WOUND)).toHaveLength(3);

        // Should NOT have emitted the paralyze event
        expect(result.events).not.toContainEqual(
          expect.objectContaining({
            type: PARALYZE_HAND_DISCARDED,
          })
        );
      });
    });
  });

  describe("Assassination ability", () => {
    it("should prevent assigning damage to units from enemy with Assassination", () => {
      const player = createTestPlayer({
        hand: [],
        deck: [CARD_MARCH],
        handLimit: 5,
        armor: 2,
        units: [
          {
            unitId: UNIT_PEASANTS,
            instanceId: "unit_0",
            ready: true,
            wounded: false,
            usedResistanceThisCombat: false,
          },
        ],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Sorcerers (attack 6, assassination, poison, arcane immunity)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SORCERERS],
      }).state;

      // Skip to Assign Damage phase (don't block)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Try to assign damage to unit - should fail due to Assassination
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
        assignments: [
          { target: DAMAGE_TARGET_UNIT, unitInstanceId: "unit_0", amount: 6 },
        ],
      });

      // Should be an invalid action
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: expect.stringContaining("Assassination"),
        })
      );

      // Unit should still be there (damage not assigned)
      expect(result.state.players[0].units).toHaveLength(1);
    });

    it("should allow assigning damage to hero from enemy with Assassination", () => {
      const player = createTestPlayer({
        hand: [],
        deck: [CARD_MARCH],
        handLimit: 5,
        armor: 2,
        units: [
          {
            unitId: UNIT_PEASANTS,
            instanceId: "unit_0",
            ready: true,
            wounded: false,
            usedResistanceThisCombat: false,
          },
        ],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Sorcerers (attack 6, assassination)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SORCERERS],
      }).state;

      // Skip to Assign Damage phase (don't block)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign damage to hero - should work
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
        assignments: [{ target: DAMAGE_TARGET_HERO, amount: 6 }],
      });

      // Should NOT be an invalid action
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );

      // Hero should have wounds (6 damage / 2 armor = 3 wounds)
      const heroWounds = result.state.players[0].hand.filter(
        (c) => c === CARD_WOUND
      ).length;
      expect(heroWounds).toBe(3);
    });

    it("should allow assigning damage to units if Assassination is nullified", () => {
      const player = createTestPlayer({
        hand: [],
        deck: [CARD_MARCH],
        handLimit: 5,
        armor: 2,
        units: [
          {
            unitId: UNIT_PEASANTS,
            instanceId: "unit_0",
            ready: true,
            wounded: false,
            usedResistanceThisCombat: false,
          },
        ],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Delphana Masters (attack 5, assassination, paralyze)
      // Note: Can't use Sorcerers because they have Arcane Immunity which blocks ability nullification
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DELPHANA_MASTERS],
      }).state;

      // Add ability nullifier for Assassination on this enemy
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, id: "test_skill" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
        effect: { type: EFFECT_ABILITY_NULLIFIER, ability: ABILITY_ASSASSINATION },
        createdByPlayerId: "player1",
        createdAtRound: state.round,
      });

      // Skip to Assign Damage phase (don't block)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign damage to unit - should work now (Assassination is nullified)
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
        assignments: [
          { target: DAMAGE_TARGET_UNIT, unitInstanceId: "unit_0", amount: 5 },
        ],
      });

      // Should NOT be an invalid action
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );

      // Unit should be destroyed (by Paralyze, which is still active on Delphana Masters)
      // Delphana Masters have both Assassination and Paralyze
      expect(result.state.players[0].units).toHaveLength(0);
    });

    it("should allow default assignment (hero) when no assignments specified", () => {
      const player = createTestPlayer({
        hand: [],
        deck: [CARD_MARCH],
        handLimit: 5,
        armor: 2,
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Sorcerers (attack 6, assassination)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SORCERERS],
      }).state;

      // Skip to Assign Damage phase (don't block)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign damage with no assignments (default to hero)
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });

      // Should NOT be an invalid action
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );

      // Hero should have wounds
      const heroWounds = result.state.players[0].hand.filter(
        (c) => c === CARD_WOUND
      ).length;
      expect(heroWounds).toBe(3);
    });
  });

  describe("Enemy skip attack modifier", () => {
    it("should allow skipping damage assignment for enemies that don't attack", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers (Attack 3, Armor 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      expect(enemyInstanceId).not.toBe("");

      // Apply "enemy skip attack" modifier (simulating Chill/Whirlwind effect)
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_skill" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Skip ranged/siege phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Skip block phase (enemy doesn't attack, so nothing to block)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ASSIGN_DAMAGE);

      // Skip assign damage phase - this is the bug! Enemy doesn't attack,
      // so we shouldn't need to assign damage
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should succeed and move to attack phase (not INVALID_ACTION)
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
      expect(result.state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);
    });
  });
});
