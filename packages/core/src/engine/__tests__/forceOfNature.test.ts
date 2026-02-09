/**
 * Force of Nature Card Tests
 *
 * Tests for the Force of Nature advanced action card:
 *
 * Basic: Chosen Unit gains Physical Resistance this combat.
 * Powered: Siege Attack 3 or Block 6.
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { resolveEffect } from "../effects/index.js";
import { isEffectResolvable } from "../effects/resolvability.js";
import { getEffectiveUnitResistances } from "../modifiers/units.js";
import { addModifier } from "../modifiers/index.js";
import { createPlayerUnit } from "../../types/unit.js";
import {
  EFFECT_SELECT_UNIT_FOR_MODIFIER,
  EFFECT_RESOLVE_UNIT_MODIFIER_TARGET,
} from "../../types/effectTypes.js";
import type {
  SelectUnitForModifierEffect,
  ResolveUnitModifierTargetEffect,
} from "../../types/cards.js";
import {
  RESIST_PHYSICAL,
  RESIST_FIRE,
  RESIST_ICE,
  UNIT_PEASANTS,
  UNIT_GUARDIAN_GOLEMS,
  CARD_FORCE_OF_NATURE,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import {
  DURATION_COMBAT,
  EFFECT_GRANT_RESISTANCES,
  SOURCE_CARD,
  SCOPE_ONE_UNIT,
  SCOPE_ALL_UNITS,
} from "../../types/modifierConstants.js";

const basicEffect: SelectUnitForModifierEffect = {
  type: EFFECT_SELECT_UNIT_FOR_MODIFIER,
  modifier: {
    type: EFFECT_GRANT_RESISTANCES,
    resistances: [RESIST_PHYSICAL],
  },
  duration: DURATION_COMBAT,
  description: "Chosen unit gains Physical Resistance",
};

describe("Force of Nature", () => {
  describe("Basic Effect: Select Unit for Modifier", () => {
    it("should return no-op when player has no units", () => {
      const player = createTestPlayer({ units: [] });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(state, "player1", basicEffect, CARD_FORCE_OF_NATURE);

      expect(result.description).toBe("No units to target");
      expect(result.requiresChoice).toBeUndefined();
    });

    it("should auto-resolve when player has exactly one unit", () => {
      const unit = createPlayerUnit(UNIT_PEASANTS, "peasant_1");
      const player = createTestPlayer({ units: [unit] });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(state, "player1", basicEffect, CARD_FORCE_OF_NATURE);

      // Should auto-resolve (no choice needed)
      expect(result.requiresChoice).toBeUndefined();
      expect(result.description).toContain("Peasants");

      // Verify modifier was applied
      const resistances = getEffectiveUnitResistances(result.state, "player1", unit);
      expect(resistances).toContain(RESIST_PHYSICAL);
    });

    it("should present choices when player has multiple units", () => {
      const unit1 = createPlayerUnit(UNIT_PEASANTS, "peasant_1");
      const unit2 = createPlayerUnit(UNIT_GUARDIAN_GOLEMS, "golem_1");
      const player = createTestPlayer({ units: [unit1, unit2] });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(state, "player1", basicEffect, CARD_FORCE_OF_NATURE);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(2);

      // Verify choice options are ResolveUnitModifierTargetEffect
      const options = result.dynamicChoiceOptions as ResolveUnitModifierTargetEffect[];
      expect(options[0]?.type).toBe(EFFECT_RESOLVE_UNIT_MODIFIER_TARGET);
      expect(options[1]?.type).toBe(EFFECT_RESOLVE_UNIT_MODIFIER_TARGET);
    });

    it("should apply modifier to selected unit when resolving choice", () => {
      const unit1 = createPlayerUnit(UNIT_PEASANTS, "peasant_1");
      const unit2 = createPlayerUnit(UNIT_PEASANTS, "peasant_2");
      const player = createTestPlayer({ units: [unit1, unit2] });
      const state = createTestGameState({ players: [player] });

      // Resolve selecting the first unit
      const resolveEffect1: ResolveUnitModifierTargetEffect = {
        type: EFFECT_RESOLVE_UNIT_MODIFIER_TARGET,
        unitInstanceId: "peasant_1",
        unitName: "Peasants",
        modifier: {
          type: EFFECT_GRANT_RESISTANCES,
          resistances: [RESIST_PHYSICAL],
        },
        duration: DURATION_COMBAT,
        description: "Chosen unit gains Physical Resistance",
      };

      const result = resolveEffect(state, "player1", resolveEffect1, CARD_FORCE_OF_NATURE);

      // Unit 1 should have Physical Resistance
      const resistances1 = getEffectiveUnitResistances(result.state, "player1", unit1);
      expect(resistances1).toContain(RESIST_PHYSICAL);

      // Unit 2 should NOT have Physical Resistance (Peasants have none by default)
      const resistances2 = getEffectiveUnitResistances(result.state, "player1", unit2);
      expect(resistances2).not.toContain(RESIST_PHYSICAL);
    });
  });

  describe("SCOPE_ONE_UNIT modifier handling", () => {
    it("should only grant resistance to the targeted unit via SCOPE_ONE_UNIT", () => {
      const unit1 = createPlayerUnit(UNIT_PEASANTS, "peasant_1");
      const unit2 = createPlayerUnit(UNIT_PEASANTS, "peasant_2");
      const player = createTestPlayer({ units: [unit1, unit2] });
      const baseState = createTestGameState({ players: [player] });

      // Add SCOPE_ONE_UNIT modifier targeting unit at index 0
      const state = addModifier(baseState, {
        source: {
          type: SOURCE_CARD,
          cardId: CARD_FORCE_OF_NATURE as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_UNIT, unitIndex: 0 },
        effect: {
          type: EFFECT_GRANT_RESISTANCES,
          resistances: [RESIST_PHYSICAL],
        },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      // Unit at index 0 should have Physical Resistance
      const resistances1 = getEffectiveUnitResistances(state, "player1", unit1);
      expect(resistances1).toContain(RESIST_PHYSICAL);

      // Unit at index 1 should NOT have Physical Resistance
      const resistances2 = getEffectiveUnitResistances(state, "player1", unit2);
      expect(resistances2).not.toContain(RESIST_PHYSICAL);
    });

    it("should combine SCOPE_ONE_UNIT with SCOPE_ALL_UNITS resistances", () => {
      const unit1 = createPlayerUnit(UNIT_PEASANTS, "peasant_1");
      const unit2 = createPlayerUnit(UNIT_PEASANTS, "peasant_2");
      const player = createTestPlayer({ units: [unit1, unit2] });
      const baseState = createTestGameState({ players: [player] });

      // Add SCOPE_ONE_UNIT modifier targeting unit at index 0 (Physical Resistance)
      let state = addModifier(baseState, {
        source: {
          type: SOURCE_CARD,
          cardId: CARD_FORCE_OF_NATURE as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_UNIT, unitIndex: 0 },
        effect: {
          type: EFFECT_GRANT_RESISTANCES,
          resistances: [RESIST_PHYSICAL],
        },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      // Add SCOPE_ALL_UNITS modifier (Fire + Ice Resistance from Veil of Mist)
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "mist_form" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ALL_UNITS },
        effect: {
          type: EFFECT_GRANT_RESISTANCES,
          resistances: [RESIST_FIRE, RESIST_ICE],
        },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      // Unit 1 should have all three resistances (Physical from ONE_UNIT + Fire/Ice from ALL_UNITS)
      const resistances1 = getEffectiveUnitResistances(state, "player1", unit1);
      expect(resistances1).toContain(RESIST_PHYSICAL);
      expect(resistances1).toContain(RESIST_FIRE);
      expect(resistances1).toContain(RESIST_ICE);

      // Unit 2 should only have Fire + Ice (from ALL_UNITS), NOT Physical
      const resistances2 = getEffectiveUnitResistances(state, "player1", unit2);
      expect(resistances2).not.toContain(RESIST_PHYSICAL);
      expect(resistances2).toContain(RESIST_FIRE);
      expect(resistances2).toContain(RESIST_ICE);
    });

    it("should not grant resistance to units of other players", () => {
      const unit1 = createPlayerUnit(UNIT_PEASANTS, "peasant_1");
      const unit2 = createPlayerUnit(UNIT_PEASANTS, "peasant_2");
      const player1 = createTestPlayer({ id: "player1", units: [unit1] });
      const player2 = createTestPlayer({ id: "player2", position: { q: 1, r: 0 }, units: [unit2] });
      const baseState = createTestGameState({
        players: [player1, player2],
        turnOrder: ["player1", "player2"],
      });

      // Apply modifier to player1's unit
      const state = addModifier(baseState, {
        source: {
          type: SOURCE_CARD,
          cardId: CARD_FORCE_OF_NATURE as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_UNIT, unitIndex: 0 },
        effect: {
          type: EFFECT_GRANT_RESISTANCES,
          resistances: [RESIST_PHYSICAL],
        },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      // Player1's unit should have Physical Resistance
      const resistances1 = getEffectiveUnitResistances(state, "player1", unit1);
      expect(resistances1).toContain(RESIST_PHYSICAL);

      // Player2's unit should NOT have Physical Resistance
      const resistances2 = getEffectiveUnitResistances(state, "player2", unit2);
      expect(resistances2).not.toContain(RESIST_PHYSICAL);
    });

    it("should combine with unit base resistances", () => {
      // Guardian Golems have Physical Resistance by default
      const unit = createPlayerUnit(UNIT_GUARDIAN_GOLEMS, "golem_1");
      const player = createTestPlayer({ units: [unit] });
      const baseState = createTestGameState({ players: [player] });

      // Grant Fire Resistance via SCOPE_ONE_UNIT
      const state = addModifier(baseState, {
        source: {
          type: SOURCE_CARD,
          cardId: "test" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_UNIT, unitIndex: 0 },
        effect: {
          type: EFFECT_GRANT_RESISTANCES,
          resistances: [RESIST_FIRE],
        },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      const resistances = getEffectiveUnitResistances(state, "player1", unit);
      // Should have base Physical + granted Fire
      expect(resistances).toContain(RESIST_PHYSICAL);
      expect(resistances).toContain(RESIST_FIRE);
      // Should NOT have Ice (not granted or base)
      expect(resistances).not.toContain(RESIST_ICE);
    });
  });

  describe("Resolvability", () => {
    it("should be resolvable when player has units", () => {
      const unit = createPlayerUnit(UNIT_PEASANTS, "peasant_1");
      const player = createTestPlayer({ units: [unit] });
      const state = createTestGameState({ players: [player] });

      expect(isEffectResolvable(state, "player1", basicEffect)).toBe(true);
    });

    it("should not be resolvable when player has no units", () => {
      const player = createTestPlayer({ units: [] });
      const state = createTestGameState({ players: [player] });

      expect(isEffectResolvable(state, "player1", basicEffect)).toBe(false);
    });
  });
});
