/**
 * Tests for Amulet of Darkness artifact
 *
 * Basic: Gain 1 mana token of any color (choice). At day: deserts cost 3, black mana usable.
 * Powered (any color, destroy): Same but gain 3 mana tokens of any colors.
 *
 * Edge cases:
 * - Forest stays at cost 3 during day (no change)
 * - Gold mana still usable during day
 * - Gold mana still NOT usable at night
 * - Day/Night skills still use day values
 */

import { describe, it, expect } from "vitest";
import {
  createTestGameState,
  createTestPlayer,
  createUnitCombatState,
} from "./testHelpers.js";
import { resolveEffect } from "../effects/index.js";
import { AMULET_OF_DARKNESS_CARDS } from "../../data/artifacts/amuletOfDarkness.js";
import { getEffectiveTerrainCost } from "../modifiers/terrain.js";
import { isRuleActive } from "../modifiers/index.js";
import { isManaColorAllowed } from "../rules/mana.js";
import { validateManaTimeOfDayWithDungeonOverride } from "../validators/mana/rulesValidators.js";
import { canPayForMana, getManaOptions } from "../validActions/mana.js";
import {
  CARD_AMULET_OF_DARKNESS,
  CARD_MARCH,
  MANA_GOLD,
  MANA_BLACK,
  MANA_RED,
  MANA_BLUE,
  PLAY_CARD_ACTION,
  TIME_OF_DAY_DAY,
  TIME_OF_DAY_NIGHT,
  TERRAIN_FOREST,
  TERRAIN_DESERT,
  TERRAIN_PLAINS,
  TERRAIN_HILLS,
} from "@mage-knight/shared";
import { RULE_ALLOW_BLACK_AT_DAY } from "../../types/modifierConstants.js";
import { COMBAT_PHASE_ATTACK } from "../../types/combat.js";

describe("Amulet of Darkness", () => {
  const card = AMULET_OF_DARKNESS_CARDS[CARD_AMULET_OF_DARKNESS]!;

  // ============================================================================
  // CARD DEFINITION
  // ============================================================================

  describe("card definition", () => {
    it("should be defined with correct properties", () => {
      expect(card).toBeDefined();
      expect(card.name).toBe("Amulet of Darkness");
      expect(card.destroyOnPowered).toBe(true);
      expect(card.sidewaysValue).toBe(1);
      expect(card.categories).toContain("special");
    });

    it("should be powered by any basic color", () => {
      expect(card.poweredBy).toEqual(["red", "blue", "green", "white"]);
    });
  });

  // ============================================================================
  // BASIC EFFECT - NIGHT
  // ============================================================================

  describe("basic effect during night", () => {
    it("should present a mana color choice (requiresChoice)", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_DARKNESS],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      const result = resolveEffect(state, "player1", card.basicEffect);

      // Should require a choice for mana color
      expect(result.requiresChoice).toBe(true);
    });

    it("should not apply day modifiers during night", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_DARKNESS],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      // Resolve the mana choice manually (pick red)
      const manaEffect = { type: "gain_mana" as const, color: MANA_RED };
      const manaResult = resolveEffect(state, "player1", manaEffect);

      // Then resolve the conditional (ifDay at night = no effect)
      const conditionalEffect = (card.basicEffect as { effects: readonly unknown[] }).effects[1]!;
      const condResult = resolveEffect(manaResult.state, "player1", conditionalEffect as Parameters<typeof resolveEffect>[2]);

      // No modifiers should be applied during night
      expect(condResult.state.activeModifiers).toHaveLength(0);
    });
  });

  // ============================================================================
  // BASIC EFFECT - DAY (simulated via resolving parts individually)
  // ============================================================================

  describe("basic effect during day", () => {
    it("should present a mana color choice", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_DARKNESS],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const result = resolveEffect(state, "player1", card.basicEffect);

      // Should require a choice for mana color
      expect(result.requiresChoice).toBe(true);
    });

    it("should apply day modifiers when resolving full compound after choice", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_DARKNESS],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      // Simulate: resolve mana choice first (pick red), then resolve day conditional
      const manaEffect = { type: "gain_mana" as const, color: MANA_RED };
      const manaResult = resolveEffect(state, "player1", manaEffect);

      // The second sub-effect is ifDay(dayModifiers)
      const conditionalEffect = (card.basicEffect as { effects: readonly unknown[] }).effects[1]!;
      const condResult = resolveEffect(manaResult.state, "player1", conditionalEffect as Parameters<typeof resolveEffect>[2]);

      // Should have terrain cost and rule override modifiers
      expect(condResult.state.activeModifiers.length).toBeGreaterThanOrEqual(2);
    });

    it("should reduce desert movement cost to 3 during day", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_DARKNESS],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      // Desert at day costs 5
      const desertCostBefore = getEffectiveTerrainCost(
        state,
        TERRAIN_DESERT,
        "player1"
      );
      expect(desertCostBefore).toBe(5);

      // Resolve just the day modifiers
      const conditionalEffect = (card.basicEffect as { effects: readonly unknown[] }).effects[1]!;
      const result = resolveEffect(state, "player1", conditionalEffect as Parameters<typeof resolveEffect>[2]);

      // After Amulet, desert should cost 3
      const desertCostAfter = getEffectiveTerrainCost(
        result.state,
        TERRAIN_DESERT,
        "player1"
      );
      expect(desertCostAfter).toBe(3);
    });

    it("should allow black mana usage during day", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_DARKNESS],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      // Before: black mana not allowed during day
      expect(isManaColorAllowed(state, MANA_BLACK, "player1")).toBe(false);

      // Resolve the day modifiers
      const conditionalEffect = (card.basicEffect as { effects: readonly unknown[] }).effects[1]!;
      const result = resolveEffect(state, "player1", conditionalEffect as Parameters<typeof resolveEffect>[2]);

      // After: black mana allowed for this player
      expect(
        isManaColorAllowed(result.state, MANA_BLACK, "player1")
      ).toBe(true);
      expect(
        isRuleActive(result.state, "player1", RULE_ALLOW_BLACK_AT_DAY)
      ).toBe(true);
    });

    it("should make black dice available from Source during day", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_DARKNESS],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        source: {
          dice: [
            { id: "die1", color: MANA_BLACK, takenByPlayerId: null, isDepleted: true },
            { id: "die2", color: MANA_RED, takenByPlayerId: null, isDepleted: false },
          ],
        },
      });

      // Before: black die is depleted, should not be available
      const optionsBefore = getManaOptions(state, state.players[0]!);
      const blackDiceBefore = optionsBefore.availableDice.filter(d => d.color === MANA_BLACK);
      expect(blackDiceBefore).toHaveLength(0);

      // Resolve the day modifiers
      const conditionalEffect = (card.basicEffect as { effects: readonly unknown[] }).effects[1]!;
      const result = resolveEffect(state, "player1", conditionalEffect as Parameters<typeof resolveEffect>[2]);

      // After: black die should be available despite being depleted
      const optionsAfter = getManaOptions(result.state, result.state.players[0]!);
      const blackDiceAfter = optionsAfter.availableDice.filter(d => d.color === MANA_BLACK);
      expect(blackDiceAfter).toHaveLength(1);
    });
  });

  // ============================================================================
  // POWERED EFFECT
  // ============================================================================

  describe("powered effect", () => {
    it("should present a mana color choice (3 choices for powered)", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_DARKNESS],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const result = resolveEffect(state, "player1", card.poweredEffect);

      // Should require a choice for first mana color
      expect(result.requiresChoice).toBe(true);
    });

    it("should apply day modifiers after all choices resolved", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_DARKNESS],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      // Simulate resolving all 3 mana choices then the day conditional
      let currentState = state;
      for (let i = 0; i < 3; i++) {
        const manaEffect = { type: "gain_mana" as const, color: MANA_RED };
        const manaResult = resolveEffect(currentState, "player1", manaEffect);
        currentState = manaResult.state;
      }

      // Now resolve the day conditional
      const conditionalEffect = (card.poweredEffect as { effects: readonly unknown[] }).effects[3]!;
      const condResult = resolveEffect(currentState, "player1", conditionalEffect as Parameters<typeof resolveEffect>[2]);

      // Should have modifiers applied
      expect(condResult.state.activeModifiers.length).toBeGreaterThanOrEqual(2);

      // Desert should cost 3
      const desertCost = getEffectiveTerrainCost(
        condResult.state,
        TERRAIN_DESERT,
        "player1"
      );
      expect(desertCost).toBe(3);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe("edge cases", () => {
    it("should not change forest movement cost during day", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_DARKNESS],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      // Forest at day costs 3
      const forestCostBefore = getEffectiveTerrainCost(
        state,
        TERRAIN_FOREST,
        "player1"
      );
      expect(forestCostBefore).toBe(3);

      // Resolve day modifiers
      const conditionalEffect = (card.basicEffect as { effects: readonly unknown[] }).effects[1]!;
      const result = resolveEffect(state, "player1", conditionalEffect as Parameters<typeof resolveEffect>[2]);

      // Forest should still cost 3 (Amulet only affects desert)
      const forestCostAfter = getEffectiveTerrainCost(
        result.state,
        TERRAIN_FOREST,
        "player1"
      );
      expect(forestCostAfter).toBe(3);
    });

    it("should not affect other terrain costs during day", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_DARKNESS],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      // Resolve day modifiers
      const conditionalEffect = (card.basicEffect as { effects: readonly unknown[] }).effects[1]!;
      const result = resolveEffect(state, "player1", conditionalEffect as Parameters<typeof resolveEffect>[2]);

      // Hills at day = 3, should be unchanged
      const hillsCost = getEffectiveTerrainCost(
        result.state,
        TERRAIN_HILLS,
        "player1"
      );
      expect(hillsCost).toBe(3);

      // Plains at day = 2, should be unchanged
      const plainsCost = getEffectiveTerrainCost(
        result.state,
        TERRAIN_PLAINS,
        "player1"
      );
      expect(plainsCost).toBe(2);
    });

    it("should still allow gold mana during day", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_DARKNESS],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      // Resolve day modifiers
      const conditionalEffect = (card.basicEffect as { effects: readonly unknown[] }).effects[1]!;
      const result = resolveEffect(state, "player1", conditionalEffect as Parameters<typeof resolveEffect>[2]);

      // Gold mana should still be allowed during day
      expect(isManaColorAllowed(result.state, MANA_GOLD)).toBe(true);
    });

    it("should not allow gold mana at night (amulet doesn't grant night gold)", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_DARKNESS],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      // Resolve conditional at night (no modifiers applied)
      const conditionalEffect = (card.basicEffect as { effects: readonly unknown[] }).effects[1]!;
      const result = resolveEffect(state, "player1", conditionalEffect as Parameters<typeof resolveEffect>[2]);

      // Gold mana should NOT be allowed at night
      expect(isManaColorAllowed(result.state, MANA_GOLD, "player1")).toBe(false);
    });

    it("should not affect black mana for other players", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hand: [CARD_AMULET_OF_DARKNESS],
      });
      const player2 = createTestPlayer({
        id: "player2",
        hand: [],
      });
      const state = createTestGameState({
        players: [player1, player2],
        timeOfDay: TIME_OF_DAY_DAY,
        turnOrder: ["player1", "player2"],
      });

      // Resolve day modifiers for player1
      const conditionalEffect = (card.basicEffect as { effects: readonly unknown[] }).effects[1]!;
      const result = resolveEffect(state, "player1", conditionalEffect as Parameters<typeof resolveEffect>[2]);

      // Player 1 can use black mana
      expect(
        isManaColorAllowed(result.state, MANA_BLACK, "player1")
      ).toBe(true);

      // Player 2 cannot use black mana during day
      expect(
        isManaColorAllowed(result.state, MANA_BLACK, "player2")
      ).toBe(false);
    });

    it("should have no effect on modifiers during night", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_DARKNESS],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      // Resolve conditional at night
      const conditionalEffect = (card.basicEffect as { effects: readonly unknown[] }).effects[1]!;
      const result = resolveEffect(state, "player1", conditionalEffect as Parameters<typeof resolveEffect>[2]);

      // No modifiers at night (conditional is false, no else branch)
      expect(result.state.activeModifiers).toHaveLength(0);
    });
  });

  // ============================================================================
  // VALIDATOR INTEGRATION - validateManaTimeOfDayWithDungeonOverride
  // ============================================================================

  describe("validator integration", () => {
    it("should reject black mana during day without Amulet in non-dungeon combat", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_DARKNESS],
      });
      const combat = createUnitCombatState(COMBAT_PHASE_ATTACK);
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        combat,
      });

      const result = validateManaTimeOfDayWithDungeonOverride(
        state,
        "player1",
        {
          type: PLAY_CARD_ACTION,
          cardId: CARD_AMULET_OF_DARKNESS,
          powered: true,
          manaSource: { type: "token", color: MANA_BLACK },
        }
      );

      expect(result.valid).toBe(false);
    });

    it("should allow black mana during day with Amulet in non-dungeon combat", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_DARKNESS],
      });
      const combat = createUnitCombatState(COMBAT_PHASE_ATTACK);
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        combat,
      });

      // Apply Amulet day modifiers to get RULE_ALLOW_BLACK_AT_DAY
      const conditionalEffect = (card.basicEffect as { effects: readonly unknown[] }).effects[1]!;
      const afterAmulet = resolveEffect(state, "player1", conditionalEffect as Parameters<typeof resolveEffect>[2]);

      const result = validateManaTimeOfDayWithDungeonOverride(
        afterAmulet.state,
        "player1",
        {
          type: PLAY_CARD_ACTION,
          cardId: CARD_MARCH,
          powered: true,
          manaSource: { type: "token", color: MANA_BLACK },
        }
      );

      expect(result.valid).toBe(true);
    });

    it("should reject gold mana at night in non-dungeon combat", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_DARKNESS],
      });
      const combat = createUnitCombatState(COMBAT_PHASE_ATTACK);
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
        combat,
      });

      const result = validateManaTimeOfDayWithDungeonOverride(
        state,
        "player1",
        {
          type: PLAY_CARD_ACTION,
          cardId: CARD_AMULET_OF_DARKNESS,
          powered: true,
          manaSource: { type: "token", color: MANA_GOLD },
        }
      );

      expect(result.valid).toBe(false);
    });
  });

  // ============================================================================
  // VALID ACTIONS INTEGRATION - canPayForMana / getManaOptions
  // ============================================================================

  describe("validActions mana integration", () => {
    it("should allow black token to pay for spells during day with Amulet", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_DARKNESS],
        pureMana: [{ color: MANA_BLACK }],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      // Without Amulet: black cannot be used during day
      expect(canPayForMana(state, state.players[0]!, MANA_BLACK)).toBe(false);

      // Apply Amulet day modifiers
      const conditionalEffect = (card.basicEffect as { effects: readonly unknown[] }).effects[1]!;
      const afterAmulet = resolveEffect(state, "player1", conditionalEffect as Parameters<typeof resolveEffect>[2]);

      // With Amulet: black token can be used during day
      expect(
        canPayForMana(afterAmulet.state, afterAmulet.state.players[0]!, MANA_BLACK)
      ).toBe(true);
    });

    it("should show black source dice as available during day with Amulet", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_DARKNESS],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        source: {
          dice: [
            { id: "die1", color: MANA_BLACK, takenByPlayerId: null, isDepleted: true },
            { id: "die2", color: MANA_BLUE, takenByPlayerId: null, isDepleted: false },
          ],
        },
      });

      // Without Amulet: only blue die available
      const optionsBefore = getManaOptions(state, state.players[0]!);
      expect(optionsBefore.availableDice.map(d => d.color)).toEqual([MANA_BLUE]);

      // Apply Amulet day modifiers
      const conditionalEffect = (card.basicEffect as { effects: readonly unknown[] }).effects[1]!;
      const afterAmulet = resolveEffect(state, "player1", conditionalEffect as Parameters<typeof resolveEffect>[2]);

      // With Amulet: black die should now also be available
      const optionsAfter = getManaOptions(afterAmulet.state, afterAmulet.state.players[0]!);
      const colors = optionsAfter.availableDice.map(d => d.color);
      expect(colors).toContain(MANA_BLACK);
      expect(colors).toContain(MANA_BLUE);
    });

    it("should allow black source die to pay for mana during day with Amulet", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_DARKNESS],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        source: {
          dice: [
            { id: "die1", color: MANA_BLACK, takenByPlayerId: null, isDepleted: true },
          ],
        },
      });

      // Without Amulet: black die cannot pay
      expect(canPayForMana(state, state.players[0]!, MANA_BLACK)).toBe(false);

      // Apply Amulet day modifiers
      const conditionalEffect = (card.basicEffect as { effects: readonly unknown[] }).effects[1]!;
      const afterAmulet = resolveEffect(state, "player1", conditionalEffect as Parameters<typeof resolveEffect>[2]);

      // With Amulet: black die can pay
      expect(
        canPayForMana(afterAmulet.state, afterAmulet.state.players[0]!, MANA_BLACK)
      ).toBe(true);
    });
  });
});
