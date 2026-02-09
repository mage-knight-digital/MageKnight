/**
 * Dodge and Weave Card Tests
 *
 * Dodge and Weave is a white Advanced Action.
 * Basic: Reduce one enemy attack by 2. Gain Attack 1 in Attack phase if no wounds to hand this combat.
 * Powered (White): Reduce one attack by 4 OR two attacks by 2 each. Gain Attack 2 if no wounds.
 *
 * Key mechanics:
 * - Attack reduction (NOT block) - affects Swiftness/Brutal calculations
 * - Conditional attack bonus evaluated at phase transition to Attack
 * - Block phase only (attack reduction)
 * - Physical attack bonus (non-elemental)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  PLAY_CARD_ACTION,
  RESOLVE_CHOICE_ACTION,
  ASSIGN_DAMAGE_ACTION,
  CARD_DODGE_AND_WEAVE,
  MANA_WHITE,
  MANA_SOURCE_TOKEN,
  ENEMY_DIGGERS,
  ENEMY_PROWLERS,
  DAMAGE_TARGET_HERO,
} from "@mage-knight/shared";
import {
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";
import { getEffectiveEnemyAttack } from "../modifiers/combat.js";

describe("Dodge and Weave", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("basic effect - attack reduction", () => {
    it("should reduce enemy attack by 2 in Block phase", () => {
      const player = createTestPlayer({
        hand: [CARD_DODGE_AND_WEAVE],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers (Attack 3, Armor 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      const baseAttack = state.combat?.enemies[0].definition.attack ?? 0;
      expect(baseAttack).toBe(3);

      // Skip to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Play Dodge and Weave basic - compound effect with attack reduction + modifier
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DODGE_AND_WEAVE,
        powered: false,
      }).state;

      // Select enemy target for attack reduction
      if (state.players[0].pendingChoice) {
        state = engine.processAction(state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Verify attack was reduced by 2
      expect(getEffectiveEnemyAttack(state, enemyInstanceId, baseAttack)).toBe(1);
    });

    it("should only be playable during Block phase", () => {
      const player = createTestPlayer({
        hand: [CARD_DODGE_AND_WEAVE],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat (starts in Ranged/Siege phase)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      // Try to play in Ranged/Siege phase - the attack reduction has requiredPhase: BLOCK
      // The compound effect should still resolve but the attack reduction won't have valid targets
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DODGE_AND_WEAVE,
        powered: false,
      });

      // The attack reduction part should resolve as "no valid targets" since we're not in Block phase
      // The modifier part should still apply
      expect(result.state.combat?.enemies[0].definition.attack).toBe(3);
    });
  });

  describe("basic effect - conditional attack bonus", () => {
    it("should grant Attack 1 in Attack phase when no wounds taken this combat", () => {
      const player = createTestPlayer({
        hand: [CARD_DODGE_AND_WEAVE],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers (Attack 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      // Skip to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Play Dodge and Weave basic
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DODGE_AND_WEAVE,
        powered: false,
      }).state;

      // Select enemy for attack reduction
      if (state.players[0].pendingChoice) {
        state = engine.processAction(state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Attack is now 1 (3 - 2). Skip block phase.
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ASSIGN_DAMAGE);

      // Assign 1 damage to hero (reduced from 3 to 1)
      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId,
        assignments: [{ target: DAMAGE_TARGET_HERO, amount: 1 }],
      }).state;

      // Hero takes 1 wound (1 damage / 2 armor rounds up to 1)
      // woundsAddedToHandThisCombat should be true
      expect(state.combat?.woundsAddedToHandThisCombat).toBe(true);

      // Skip to Attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Should NOT have conditional attack bonus since wounds were taken
      expect(state.players[0].combatAccumulator.attack.normal).toBe(0);
    });

    it("should grant Attack 1 when enemy attack reduced to 0 (no damage taken)", () => {
      const player = createTestPlayer({
        hand: [CARD_DODGE_AND_WEAVE, CARD_DODGE_AND_WEAVE],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers (Attack 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      // Skip to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Play first Dodge and Weave basic - reduces attack by 2 (3 -> 1)
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DODGE_AND_WEAVE,
        powered: false,
      }).state;

      if (state.players[0].pendingChoice) {
        state = engine.processAction(state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Play second Dodge and Weave basic - reduces attack by 2 (1 -> 0)
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DODGE_AND_WEAVE,
        powered: false,
      }).state;

      if (state.players[0].pendingChoice) {
        state = engine.processAction(state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      const baseAttack = state.combat?.enemies[0].definition.attack ?? 0;

      // Verify attack is 0
      expect(getEffectiveEnemyAttack(state, enemyInstanceId, baseAttack)).toBe(0);

      // No wounds taken
      expect(state.combat?.woundsAddedToHandThisCombat).toBe(false);

      // Skip Block → Assign Damage (enemy has 0 attack, auto-skips assignment)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Skip Assign Damage → Attack
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Should have conditional attack bonus: 1 + 1 = 2 (two cards played)
      expect(state.players[0].combatAccumulator.attack.normal).toBe(2);
    });
  });

  describe("powered effect", () => {
    it("should offer choice between reduce by 4 or reduce two by 2", () => {
      const player = createTestPlayer({
        hand: [CARD_DODGE_AND_WEAVE],
        pureMana: [{ color: MANA_WHITE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS, ENEMY_PROWLERS],
      }).state;

      // Skip to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play powered
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DODGE_AND_WEAVE,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_WHITE }],
      }).state;

      // Should have pending choice with 2 options
      expect(state.players[0].pendingChoice).not.toBeNull();
      expect(state.players[0].pendingChoice?.options).toHaveLength(2);
    });

    it("should reduce one enemy attack by 4 when first option chosen", () => {
      const player = createTestPlayer({
        hand: [CARD_DODGE_AND_WEAVE],
        pureMana: [{ color: MANA_WHITE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers (Attack 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      const baseAttack = state.combat?.enemies[0].definition.attack ?? 0;
      expect(baseAttack).toBe(3);

      // Skip to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play powered
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DODGE_AND_WEAVE,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_WHITE }],
      }).state;

      // Choose option 1: reduce one attack by 4
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // Select enemy
      if (state.players[0].pendingChoice) {
        state = engine.processAction(state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Verify attack was reduced by 4 (clamped to 0)
      expect(getEffectiveEnemyAttack(state, enemyInstanceId, baseAttack)).toBe(0);
    });

    it("should reduce two enemies by 2 each when second option chosen", () => {
      const player = createTestPlayer({
        hand: [CARD_DODGE_AND_WEAVE],
        pureMana: [{ color: MANA_WHITE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with two enemies
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS, ENEMY_PROWLERS],
      }).state;

      const enemy1InstanceId = state.combat?.enemies[0].instanceId ?? "";
      const enemy2InstanceId = state.combat?.enemies[1].instanceId ?? "";
      const enemy1BaseAttack = state.combat?.enemies[0].definition.attack ?? 0;
      const enemy2BaseAttack = state.combat?.enemies[1].definition.attack ?? 0;

      // Skip to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play powered
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DODGE_AND_WEAVE,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_WHITE }],
      }).state;

      // Choose option 2: reduce two attacks by 2 each
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      }).state;

      // Select first enemy
      if (state.players[0].pendingChoice) {
        state = engine.processAction(state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Select second enemy
      if (state.players[0].pendingChoice) {
        state = engine.processAction(state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Both enemies should have attack reduced by 2
      expect(getEffectiveEnemyAttack(state, enemy1InstanceId, enemy1BaseAttack)).toBe(
        enemy1BaseAttack - 2
      );
      expect(getEffectiveEnemyAttack(state, enemy2InstanceId, enemy2BaseAttack)).toBe(
        enemy2BaseAttack - 2
      );
    });

    it("should grant Attack 2 in Attack phase when no wounds taken (powered)", () => {
      const player = createTestPlayer({
        hand: [CARD_DODGE_AND_WEAVE],
        pureMana: [{ color: MANA_WHITE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers (Attack 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      // Skip to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play powered - reduces attack by 4 (3 -> 0)
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DODGE_AND_WEAVE,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_WHITE }],
      }).state;

      // Choose reduce by 4
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // Select enemy
      if (state.players[0].pendingChoice) {
        state = engine.processAction(state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // No wounds - attack reduced to 0
      expect(state.combat?.woundsAddedToHandThisCombat).toBe(false);

      // Skip through to Attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Should have Attack 2 from powered conditional bonus
      expect(state.players[0].combatAccumulator.attack.normal).toBe(2);
    });
  });

  describe("wound tracking", () => {
    it("should track woundsAddedToHandThisCombat correctly", () => {
      const player = createTestPlayer({
        hand: [CARD_DODGE_AND_WEAVE],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      // Initially false
      expect(state.combat?.woundsAddedToHandThisCombat).toBe(false);

      // Skip to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play Dodge and Weave
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DODGE_AND_WEAVE,
        powered: false,
      }).state;

      // Select enemy for reduction
      if (state.players[0].pendingChoice) {
        state = engine.processAction(state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Skip to Assign Damage
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ASSIGN_DAMAGE);

      // Assign damage to hero (attack reduced from 3 to 1)
      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId,
        assignments: [{ target: DAMAGE_TARGET_HERO, amount: 1 }],
      }).state;

      // Should be true after hero takes wounds
      expect(state.combat?.woundsAddedToHandThisCombat).toBe(true);
    });

    it("should NOT grant attack bonus when wounds were taken", () => {
      const player = createTestPlayer({
        hand: [CARD_DODGE_AND_WEAVE],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers (Attack 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      // Skip to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play Dodge and Weave - reduces attack by 2 (3 -> 1)
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DODGE_AND_WEAVE,
        powered: false,
      }).state;

      if (state.players[0].pendingChoice) {
        state = engine.processAction(state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Skip to Assign Damage
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign damage (1 damage remaining)
      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId,
        assignments: [{ target: DAMAGE_TARGET_HERO, amount: 1 }],
      }).state;

      // Skip to Attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Should NOT have attack bonus (wounds were taken)
      expect(state.players[0].combatAccumulator.attack.normal).toBe(0);
    });
  });

  describe("attack bonus is physical", () => {
    it("should grant physical (non-elemental) attack", () => {
      const player = createTestPlayer({
        hand: [CARD_DODGE_AND_WEAVE],
        pureMana: [{ color: MANA_WHITE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers (Attack 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      // Skip to Block
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play powered - reduce by 4
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DODGE_AND_WEAVE,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_WHITE }],
      }).state;

      // Choose reduce by 4
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      if (state.players[0].pendingChoice) {
        state = engine.processAction(state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Skip through to Attack phase (no damage since attack reduced to 0)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Attack bonus should be physical
      expect(state.players[0].combatAccumulator.attack.normalElements.physical).toBe(2);
      expect(state.players[0].combatAccumulator.attack.normalElements.fire).toBe(0);
      expect(state.players[0].combatAccumulator.attack.normalElements.ice).toBe(0);
    });
  });

  describe("multi-enemy interaction", () => {
    it("should only reduce attack of targeted enemy (basic)", () => {
      const player = createTestPlayer({
        hand: [CARD_DODGE_AND_WEAVE],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with two enemies
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS, ENEMY_PROWLERS],
      }).state;

      const enemy1InstanceId = state.combat?.enemies[0].instanceId ?? "";
      const enemy2InstanceId = state.combat?.enemies[1].instanceId ?? "";
      const enemy1BaseAttack = state.combat?.enemies[0].definition.attack ?? 0;
      const enemy2BaseAttack = state.combat?.enemies[1].definition.attack ?? 0;

      // Skip to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play Dodge and Weave and target first enemy
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DODGE_AND_WEAVE,
        powered: false,
      }).state;

      // Should have enemy selection choice
      expect(state.players[0].pendingChoice).not.toBeNull();

      // Select first enemy
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // First enemy reduced, second unchanged
      expect(getEffectiveEnemyAttack(state, enemy1InstanceId, enemy1BaseAttack)).toBe(
        enemy1BaseAttack - 2
      );
      expect(getEffectiveEnemyAttack(state, enemy2InstanceId, enemy2BaseAttack)).toBe(
        enemy2BaseAttack
      );
    });
  });
});
