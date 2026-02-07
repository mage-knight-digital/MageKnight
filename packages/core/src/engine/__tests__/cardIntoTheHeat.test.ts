/**
 * Into the Heat Card Tests
 *
 * Into the Heat is a red advanced action card.
 * Basic: All units get +2 Attack and +2 Block this combat. Cannot assign damage to units.
 * Powered (Red): All units get +3 Attack and +3 Block this combat. Cannot assign damage to units.
 *
 * Restrictions:
 * - Can only be played at the start of combat (Ranged/Siege phase)
 * - Only units with base value > 0 benefit from the bonus
 * - Cannot assign damage to own units this combat
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  PLAY_CARD_ACTION,
  ACTIVATE_UNIT_ACTION,
  ASSIGN_DAMAGE_ACTION,
  DAMAGE_TARGET_UNIT,
  INVALID_ACTION,
  CARD_INTO_THE_HEAT,
  CARD_MARCH,
  MANA_RED,
  MANA_SOURCE_TOKEN,
  ENEMY_ORC,
  UNIT_UTEM_GUARDSMEN,
  UNIT_ACTIVATED,
} from "@mage-knight/shared";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
} from "../../types/combat.js";
import { createPlayerUnit } from "../../types/unit.js";
import { getValidActions } from "../validActions/index.js";
import { EFFECT_UNIT_COMBAT_BONUS, RULE_UNITS_CANNOT_ABSORB_DAMAGE } from "../../types/modifierConstants.js";
import { isRuleActive } from "../modifiers/index.js";

describe("Into the Heat", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("combat phase restriction", () => {
    it("should be playable in Ranged/Siege phase", () => {
      const player = createTestPlayer({
        hand: [CARD_INTO_THE_HEAT],
        units: [createPlayerUnit(UNIT_UTEM_GUARDSMEN, "guard_1")],
      });
      let state = createTestGameState({ players: [player] });

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      expect(state.combat?.phase).toBe(COMBAT_PHASE_RANGED_SIEGE);

      // Should be playable
      const validActions = getValidActions(state, "player1");
      const playableCards = validActions.playCard?.cards ?? [];
      const intoTheHeat = playableCards.find(c => c.cardId === CARD_INTO_THE_HEAT);
      expect(intoTheHeat).toBeDefined();
      expect(intoTheHeat?.canPlayBasic).toBe(true);
    });

    it("should NOT be playable in Block phase", () => {
      const player = createTestPlayer({
        hand: [CARD_INTO_THE_HEAT],
        units: [createPlayerUnit(UNIT_UTEM_GUARDSMEN, "guard_1")],
      });
      let state = createTestGameState({ players: [player] });

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Skip to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Should NOT be playable for basic/powered (may be sideways-playable)
      const validActions = getValidActions(state, "player1");
      const playableCards = validActions.playCard?.cards ?? [];
      const intoTheHeat = playableCards.find(c => c.cardId === CARD_INTO_THE_HEAT);
      if (intoTheHeat) {
        expect(intoTheHeat.canPlayBasic).toBe(false);
        expect(intoTheHeat.canPlayPowered).toBe(false);
      }
    });

    it("should reject playing in Block phase via validator", () => {
      const player = createTestPlayer({
        hand: [CARD_INTO_THE_HEAT],
        units: [createPlayerUnit(UNIT_UTEM_GUARDSMEN, "guard_1")],
      });
      let state = createTestGameState({ players: [player] });

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Skip to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_INTO_THE_HEAT,
        powered: false,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should NOT be playable in Attack phase", () => {
      const player = createTestPlayer({
        hand: [CARD_INTO_THE_HEAT],
        units: [createPlayerUnit(UNIT_UTEM_GUARDSMEN, "guard_1")],
      });
      let state = createTestGameState({ players: [player] });

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Skip to Block phase, then Assign Damage, then Attack
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      // Assign Orc damage to hero, then end phase to reach Attack
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Should NOT be playable (only sideways at most)
      const validActions = getValidActions(state, "player1");
      const playableCards = validActions.playCard?.cards ?? [];
      const intoTheHeat = playableCards.find(c => c.cardId === CARD_INTO_THE_HEAT);
      // Card may appear for sideways play, but basic/powered must be unavailable
      if (intoTheHeat) {
        expect(intoTheHeat.canPlayBasic).toBe(false);
        expect(intoTheHeat.canPlayPowered).toBe(false);
      }
    });
  });

  describe("basic effect - unit combat bonus", () => {
    it("should grant +2 attack to unit abilities", () => {
      const player = createTestPlayer({
        hand: [CARD_INTO_THE_HEAT, CARD_MARCH],
        units: [createPlayerUnit(UNIT_UTEM_GUARDSMEN, "guard_1")],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Play Into the Heat basic
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_INTO_THE_HEAT,
        powered: false,
      }).state;

      // Verify modifier was applied
      const combatBonusMod = state.activeModifiers.find(
        m => m.effect.type === EFFECT_UNIT_COMBAT_BONUS
      );
      expect(combatBonusMod).toBeDefined();
      expect(combatBonusMod?.effect).toEqual(
        expect.objectContaining({ attackBonus: 2, blockBonus: 2 })
      );

      // Skip to Attack phase (skip ranged/siege → block → assign damage → attack)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state; // → block
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state; // → assign damage
      // Assign Orc damage to hero
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state; // → attack
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Activate unit attack ability (index 0: Attack 2 + 2 bonus = 4)
      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "guard_1",
        abilityIndex: 0,
      });

      // Check that the unit activated event shows boosted value
      const activatedEvent = result.events.find(e => e.type === UNIT_ACTIVATED);
      expect(activatedEvent).toBeDefined();
      // Utem Guardsmen base attack is 2, +2 from Into the Heat = 4
      expect(activatedEvent).toEqual(
        expect.objectContaining({ abilityValue: 4 })
      );
    });

    it("should grant +2 block to unit abilities", () => {
      const player = createTestPlayer({
        hand: [CARD_INTO_THE_HEAT, CARD_MARCH],
        units: [createPlayerUnit(UNIT_UTEM_GUARDSMEN, "guard_1")],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Play Into the Heat basic
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_INTO_THE_HEAT,
        powered: false,
      }).state;

      // Skip to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Activate unit block ability (index 1: Block 4 + 2 bonus = 6)
      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "guard_1",
        abilityIndex: 1,
      });

      const activatedEvent = result.events.find(e => e.type === UNIT_ACTIVATED);
      expect(activatedEvent).toBeDefined();
      // Utem Guardsmen base block is 4, +2 from Into the Heat = 6
      expect(activatedEvent).toEqual(
        expect.objectContaining({ abilityValue: 6 })
      );
    });
  });

  describe("powered effect - unit combat bonus", () => {
    it("should grant +3 attack and +3 block when powered with red mana", () => {
      const player = createTestPlayer({
        hand: [CARD_INTO_THE_HEAT, CARD_MARCH],
        units: [createPlayerUnit(UNIT_UTEM_GUARDSMEN, "guard_1")],
        pureMana: [{ color: MANA_RED, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Play Into the Heat powered
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_INTO_THE_HEAT,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      }).state;

      // Verify modifier
      const combatBonusMod = state.activeModifiers.find(
        m => m.effect.type === EFFECT_UNIT_COMBAT_BONUS
      );
      expect(combatBonusMod).toBeDefined();
      expect(combatBonusMod?.effect).toEqual(
        expect.objectContaining({ attackBonus: 3, blockBonus: 3 })
      );

      // Skip to Attack phase (skip block → assign damage → attack)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state; // → block
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state; // → assign damage
      // Assign Orc damage to hero
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state; // → attack

      // Activate unit attack: base 2 + 3 = 5
      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "guard_1",
        abilityIndex: 0,
      });

      const activatedEvent = result.events.find(e => e.type === UNIT_ACTIVATED);
      expect(activatedEvent).toEqual(
        expect.objectContaining({ abilityValue: 5 })
      );
    });
  });

  describe("damage assignment restriction", () => {
    it("should prevent assigning damage to units after playing Into the Heat", () => {
      const player = createTestPlayer({
        hand: [CARD_INTO_THE_HEAT, CARD_MARCH],
        units: [createPlayerUnit(UNIT_UTEM_GUARDSMEN, "guard_1")],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Play Into the Heat basic
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_INTO_THE_HEAT,
        powered: false,
      }).state;

      // Verify the rule is active
      expect(isRuleActive(state, "player1", RULE_UNITS_CANNOT_ABSORB_DAMAGE)).toBe(true);

      // Skip to Assign Damage phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ASSIGN_DAMAGE);

      // Try to assign damage to unit - should be rejected
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
        assignments: [
          {
            target: DAMAGE_TARGET_UNIT,
            unitInstanceId: "guard_1",
            amount: 3,
          },
        ],
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should show no unit targets in valid actions during damage assignment", () => {
      const player = createTestPlayer({
        hand: [CARD_INTO_THE_HEAT, CARD_MARCH],
        units: [createPlayerUnit(UNIT_UTEM_GUARDSMEN, "guard_1")],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Play Into the Heat basic
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_INTO_THE_HEAT,
        powered: false,
      }).state;

      // Skip to Assign Damage phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      const validActions = getValidActions(state, "player1");
      const damageOptions = validActions.combat?.damageAssignments ?? [];

      // Should have damage options (Orc attacks) but no unit targets
      expect(damageOptions.length).toBeGreaterThan(0);
      for (const option of damageOptions) {
        expect(option.availableUnits).toHaveLength(0);
      }
    });

    it("should still allow assigning damage to hero (wounds to hand)", () => {
      const player = createTestPlayer({
        hand: [CARD_INTO_THE_HEAT],
        deck: [CARD_MARCH],
        units: [createPlayerUnit(UNIT_UTEM_GUARDSMEN, "guard_1")],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Play Into the Heat basic
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_INTO_THE_HEAT,
        powered: false,
      }).state;

      // Skip to Assign Damage phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign damage to hero (default, no assignments specified)
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });

      // Should succeed - hero takes wounds
      expect(result.events).not.toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });
  });
});
