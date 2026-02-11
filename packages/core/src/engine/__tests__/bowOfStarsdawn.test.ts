/**
 * Bow of Starsdawn Tests
 *
 * Tests for:
 * - Card definition (properties, effect structure)
 * - Basic effect: Discard for Ranged Attack +2 per card
 * - Basic effect: Fame +1 per enemy defeated in current phase
 * - Powered effect: Attack transformation modifier
 *   - Ranged → double OR convert to Siege (same element)
 *   - Siege → keep as-is OR double (becomes Ranged, same element)
 *   - Melee attacks unaffected
 *   - Only active during Ranged/Siege phase
 * - Phase fame tracking (BowPhaseFameTracking modifier)
 */

import { describe, it, expect } from "vitest";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import {
  CARD_BOW_OF_STARSDAWN,
  CARD_MARCH,
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_ATTACK,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
  ELEMENT_FIRE,
  ELEMENT_ICE,
} from "@mage-knight/shared";
import {
  DEED_CARD_TYPE_ARTIFACT,
  CATEGORY_COMBAT,
} from "../../types/cards.js";
import type { GainAttackEffect } from "../../types/cards.js";
import {
  EFFECT_COMPOUND,
  EFFECT_DISCARD_FOR_ATTACK,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_ATTACK_BOW_RESOLVED,
} from "../../types/effectTypes.js";
import {
  DURATION_COMBAT,
  DURATION_TURN,
  EFFECT_BOW_ATTACK_TRANSFORMATION,
  EFFECT_BOW_PHASE_FAME_TRACKING,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";
import { BOW_OF_STARSDAWN_CARDS } from "../../data/artifacts/bowOfStarsdawn.js";
import { resolveEffect, applyGainAttack, applyGainBowResolvedAttack, describeEffect, isEffectResolvable } from "../effects/index.js";
import { addModifier } from "../modifiers/index.js";
import { resolveBowPhaseFameBonus } from "../combat/bowPhaseFameTracking.js";
import { createTestPlayer, createTestGameState, createUnitCombatState } from "./testHelpers.js";

const card = BOW_OF_STARSDAWN_CARDS[CARD_BOW_OF_STARSDAWN]!;

describe("Bow of Starsdawn", () => {
  describe("card definition", () => {
    it("should be defined with correct properties", () => {
      expect(card).toBeDefined();
      expect(card.name).toBe("Bow of Starsdawn");
      expect(card.cardType).toBe(DEED_CARD_TYPE_ARTIFACT);
      expect(card.categories).toContain(CATEGORY_COMBAT);
      expect(card.sidewaysValue).toBe(1);
      expect(card.destroyOnPowered).toBe(true);
    });

    it("should be powered by any basic color", () => {
      expect(card.poweredBy).toContain("red");
      expect(card.poweredBy).toContain("blue");
      expect(card.poweredBy).toContain("green");
      expect(card.poweredBy).toContain("white");
    });

    it("should have compound basic effect with discard-for-attack and fame tracking", () => {
      expect(card.basicEffect.type).toBe(EFFECT_COMPOUND);
      if (card.basicEffect.type === EFFECT_COMPOUND) {
        const effects = card.basicEffect.effects;
        expect(effects).toHaveLength(2);

        // First sub-effect: discard for ranged attack
        const discardEffect = effects[0]!;
        expect(discardEffect.type).toBe(EFFECT_DISCARD_FOR_ATTACK);
        if (discardEffect.type === EFFECT_DISCARD_FOR_ATTACK) {
          expect(discardEffect.attackPerCard).toBe(2);
          expect(discardEffect.combatType).toBe(COMBAT_TYPE_RANGED);
        }
      }
    });

    it("should have powered effect that applies attack transformation modifier", () => {
      const powered = card.poweredEffect;
      expect(powered.type).toBe("apply_modifier");
    });
  });

  describe("Phase Fame Tracking", () => {
    it("should award fame based on enemies defeated in the phase", () => {
      let state = createTestGameState();
      // Add the BowPhaseFameTracking modifier
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: CARD_BOW_OF_STARSDAWN,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_BOW_PHASE_FAME_TRACKING,
          famePerEnemy: 1,
        },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      const result = resolveBowPhaseFameBonus(state, "player1", 3);

      expect(result.fameToGain).toBe(3);
    });

    it("should award 0 fame when no enemies defeated", () => {
      let state = createTestGameState();
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: CARD_BOW_OF_STARSDAWN,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_BOW_PHASE_FAME_TRACKING,
          famePerEnemy: 1,
        },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      const result = resolveBowPhaseFameBonus(state, "player1", 0);

      expect(result.fameToGain).toBe(0);
    });

    it("should consume the modifier after checking", () => {
      let state = createTestGameState();
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: CARD_BOW_OF_STARSDAWN,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_BOW_PHASE_FAME_TRACKING,
          famePerEnemy: 1,
        },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      const result = resolveBowPhaseFameBonus(state, "player1", 2);

      // Modifier should be consumed
      const remainingBowModifiers = result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_BOW_PHASE_FAME_TRACKING
      );
      expect(remainingBowModifiers).toHaveLength(0);
    });

    it("should not affect other players' modifiers", () => {
      let state = createTestGameState();
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: CARD_BOW_OF_STARSDAWN,
          playerId: "player2",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_BOW_PHASE_FAME_TRACKING,
          famePerEnemy: 1,
        },
        createdAtRound: 1,
        createdByPlayerId: "player2",
      });

      const result = resolveBowPhaseFameBonus(state, "player1", 2);

      // Player1 gets no fame (modifier belongs to player2)
      expect(result.fameToGain).toBe(0);
      // Player2's modifier should still exist
      const remainingBowModifiers = result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_BOW_PHASE_FAME_TRACKING
      );
      expect(remainingBowModifiers).toHaveLength(1);
    });

    it("should return unchanged state when no modifier exists", () => {
      const state = createTestGameState();

      const result = resolveBowPhaseFameBonus(state, "player1", 5);

      expect(result.fameToGain).toBe(0);
      expect(result.state).toBe(state); // Same reference — no change
    });
  });

  describe("Attack Transformation (Powered Effect)", () => {
    function createCombatStateWithBowModifier(
      phase: typeof COMBAT_PHASE_RANGED_SIEGE | typeof COMBAT_PHASE_ATTACK
    ): { state: GameState; player: Player; playerIndex: number } {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
      });
      let state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(phase),
      });

      // Add the Bow attack transformation modifier
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: CARD_BOW_OF_STARSDAWN,
          playerId: "player1",
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: { type: EFFECT_BOW_ATTACK_TRANSFORMATION },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      return { state, player: state.players[0]!, playerIndex: 0 };
    }

    it("should present choice for Ranged attack during Ranged/Siege phase", () => {
      const { state, player, playerIndex } = createCombatStateWithBowModifier(
        COMBAT_PHASE_RANGED_SIEGE
      );

      const effect: GainAttackEffect = {
        type: EFFECT_GAIN_ATTACK,
        amount: 3,
        combatType: COMBAT_TYPE_RANGED,
      };

      const result = applyGainAttack(state, playerIndex, player, effect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toBeDefined();
      expect(result.dynamicChoiceOptions).toHaveLength(2);

      // Option 1: Ranged doubled (6)
      const doubleOption = result.dynamicChoiceOptions![0]!;
      expect(doubleOption.type).toBe(EFFECT_GAIN_ATTACK_BOW_RESOLVED);
      if (doubleOption.type === EFFECT_GAIN_ATTACK_BOW_RESOLVED) {
        expect(doubleOption.amount).toBe(6);
        expect(doubleOption.combatType).toBe(COMBAT_TYPE_RANGED);
      }

      // Option 2: Siege same amount (3)
      const siegeOption = result.dynamicChoiceOptions![1]!;
      expect(siegeOption.type).toBe(EFFECT_GAIN_ATTACK_BOW_RESOLVED);
      if (siegeOption.type === EFFECT_GAIN_ATTACK_BOW_RESOLVED) {
        expect(siegeOption.amount).toBe(3);
        expect(siegeOption.combatType).toBe(COMBAT_TYPE_SIEGE);
      }
    });

    it("should present choice for Siege attack during Ranged/Siege phase", () => {
      const { state, player, playerIndex } = createCombatStateWithBowModifier(
        COMBAT_PHASE_RANGED_SIEGE
      );

      const effect: GainAttackEffect = {
        type: EFFECT_GAIN_ATTACK,
        amount: 4,
        combatType: COMBAT_TYPE_SIEGE,
      };

      const result = applyGainAttack(state, playerIndex, player, effect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(2);

      // Option 1: Keep as Siege (4)
      const keepOption = result.dynamicChoiceOptions![0]!;
      if (keepOption.type === EFFECT_GAIN_ATTACK_BOW_RESOLVED) {
        expect(keepOption.amount).toBe(4);
        expect(keepOption.combatType).toBe(COMBAT_TYPE_SIEGE);
      }

      // Option 2: Double as Ranged (8)
      const doubleOption = result.dynamicChoiceOptions![1]!;
      if (doubleOption.type === EFFECT_GAIN_ATTACK_BOW_RESOLVED) {
        expect(doubleOption.amount).toBe(8);
        expect(doubleOption.combatType).toBe(COMBAT_TYPE_RANGED);
      }
    });

    it("should preserve element on transformation options", () => {
      const { state, player, playerIndex } = createCombatStateWithBowModifier(
        COMBAT_PHASE_RANGED_SIEGE
      );

      const effect: GainAttackEffect = {
        type: EFFECT_GAIN_ATTACK,
        amount: 2,
        combatType: COMBAT_TYPE_RANGED,
        element: ELEMENT_FIRE,
      };

      const result = applyGainAttack(state, playerIndex, player, effect);

      expect(result.requiresChoice).toBe(true);

      // Both options should have Fire element
      const opt1 = result.dynamicChoiceOptions![0]!;
      const opt2 = result.dynamicChoiceOptions![1]!;
      if (opt1.type === EFFECT_GAIN_ATTACK_BOW_RESOLVED) {
        expect(opt1.element).toBe(ELEMENT_FIRE);
      }
      if (opt2.type === EFFECT_GAIN_ATTACK_BOW_RESOLVED) {
        expect(opt2.element).toBe(ELEMENT_FIRE);
      }
    });

    it("should NOT present choice for melee attack", () => {
      const { state, player, playerIndex } = createCombatStateWithBowModifier(
        COMBAT_PHASE_RANGED_SIEGE
      );

      const effect: GainAttackEffect = {
        type: EFFECT_GAIN_ATTACK,
        amount: 5,
      };

      const result = applyGainAttack(state, playerIndex, player, effect);

      // Should apply normally, no choice
      expect(result.requiresChoice).toBeUndefined();
      expect(result.dynamicChoiceOptions).toBeUndefined();
      // Attack should be accumulated directly
      expect(result.state.players[0]!.combatAccumulator.attack.normal).toBe(5);
    });

    it("should NOT present choice during Attack phase", () => {
      const { state, player, playerIndex } = createCombatStateWithBowModifier(
        COMBAT_PHASE_ATTACK
      );

      const effect: GainAttackEffect = {
        type: EFFECT_GAIN_ATTACK,
        amount: 3,
        combatType: COMBAT_TYPE_RANGED,
      };

      const result = applyGainAttack(state, playerIndex, player, effect);

      // Should apply normally, no choice
      expect(result.requiresChoice).toBeUndefined();
      expect(result.state.players[0]!.combatAccumulator.attack.ranged).toBe(3);
    });

    it("should NOT present choice when no Bow modifier is active", () => {
      const player = createTestPlayer();
      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_RANGED_SIEGE),
      });

      const effect: GainAttackEffect = {
        type: EFFECT_GAIN_ATTACK,
        amount: 3,
        combatType: COMBAT_TYPE_RANGED,
      };

      const result = applyGainAttack(state, 0, state.players[0]!, effect);

      expect(result.requiresChoice).toBeUndefined();
      expect(result.state.players[0]!.combatAccumulator.attack.ranged).toBe(3);
    });
  });

  describe("Bow Resolved Attack", () => {
    it("should apply ranged attack from resolved effect", () => {
      const player = createTestPlayer();
      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_RANGED_SIEGE),
      });

      const result = applyGainBowResolvedAttack(state, 0, state.players[0]!, {
        type: EFFECT_GAIN_ATTACK_BOW_RESOLVED,
        amount: 6,
        combatType: COMBAT_TYPE_RANGED,
      });

      expect(result.state.players[0]!.combatAccumulator.attack.ranged).toBe(6);
    });

    it("should apply siege attack from resolved effect", () => {
      const player = createTestPlayer();
      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_RANGED_SIEGE),
      });

      const result = applyGainBowResolvedAttack(state, 0, state.players[0]!, {
        type: EFFECT_GAIN_ATTACK_BOW_RESOLVED,
        amount: 3,
        combatType: COMBAT_TYPE_SIEGE,
      });

      expect(result.state.players[0]!.combatAccumulator.attack.siege).toBe(3);
    });

    it("should NOT re-trigger Bow transformation on resolved effect", () => {
      // Even with Bow modifier active, resolved effects should not trigger choices
      const player = createTestPlayer();
      let state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_RANGED_SIEGE),
      });

      // Add the Bow modifier
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: CARD_BOW_OF_STARSDAWN,
          playerId: "player1",
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: { type: EFFECT_BOW_ATTACK_TRANSFORMATION },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      // Resolve a Bow-resolved effect through the main resolver
      const result = resolveEffect(state, "player1", {
        type: EFFECT_GAIN_ATTACK_BOW_RESOLVED,
        amount: 6,
        combatType: COMBAT_TYPE_RANGED,
      });

      // Should apply directly, no choice
      expect(result.requiresChoice).toBeUndefined();
      expect(result.state.players[0]!.combatAccumulator.attack.ranged).toBe(6);
    });

    it("should preserve element on resolved effect", () => {
      const player = createTestPlayer();
      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_RANGED_SIEGE),
      });

      const result = applyGainBowResolvedAttack(state, 0, state.players[0]!, {
        type: EFFECT_GAIN_ATTACK_BOW_RESOLVED,
        amount: 4,
        combatType: COMBAT_TYPE_RANGED,
        element: ELEMENT_ICE,
      });

      expect(result.state.players[0]!.combatAccumulator.attack.rangedElements.ice).toBe(4);
    });
  });

  describe("Effect Description", () => {
    it("should describe bow resolved Ranged Attack", () => {
      const desc = describeEffect({
        type: EFFECT_GAIN_ATTACK_BOW_RESOLVED,
        amount: 6,
        combatType: COMBAT_TYPE_RANGED,
      });

      expect(desc).toBe("Ranged Attack 6");
    });

    it("should describe bow resolved Siege Attack", () => {
      const desc = describeEffect({
        type: EFFECT_GAIN_ATTACK_BOW_RESOLVED,
        amount: 3,
        combatType: COMBAT_TYPE_SIEGE,
      });

      expect(desc).toBe("Siege Attack 3");
    });
  });

  describe("Effect Resolvability", () => {
    it("should be resolvable when in combat (attack/block require combat context)", () => {
      const state = createTestGameState({
        players: [createTestPlayer()],
        combat: createUnitCombatState(COMBAT_PHASE_RANGED_SIEGE),
      });

      const resolvable = isEffectResolvable(state, "player1", {
        type: EFFECT_GAIN_ATTACK_BOW_RESOLVED,
        amount: 6,
        combatType: COMBAT_TYPE_RANGED,
      });

      expect(resolvable).toBe(true);
    });

    it("should not be resolvable when not in combat (attack/block require combat context)", () => {
      const state = createTestGameState();

      const resolvable = isEffectResolvable(state, "player1", {
        type: EFFECT_GAIN_ATTACK_BOW_RESOLVED,
        amount: 6,
        combatType: COMBAT_TYPE_RANGED,
      });

      expect(resolvable).toBe(false);
    });
  });
});
