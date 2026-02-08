/**
 * Tests for Shapeshift skill (Braevalar)
 *
 * Once per turn: One Basic Action card that gives a fixed amount of Move,
 * Attack, or Block instead gives the same amount in one of the other two.
 *
 * Key rules:
 * - Only Basic Action cards are eligible (16 starting cards)
 * - Only "fixed amount" effects (not Concentration bonus)
 * - Elemental types preserved: Attack ↔ Block
 * - Element lost when converting to Move
 * - One with the Land terrain-based block IS eligible (FAQ S3)
 * - Once per turn usage tracked via cooldown
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  RESOLVE_CHOICE_ACTION,
  CHOICE_RESOLVED,
  CARD_MARCH,
  CARD_RAGE,
  CARD_SWIFTNESS,
  CARD_CONCENTRATION,
  CARD_BRAEVALAR_ONE_WITH_THE_LAND,
  getSkillsFromValidActions,
  type CardId,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_BRAEVALAR_SHAPESHIFT } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import {
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_SHAPESHIFT_RESOLVE,
  COMBAT_TYPE_MELEE,
} from "../../types/effectTypes.js";
import {
  SHAPESHIFT_TARGET_MOVE,
  SHAPESHIFT_TARGET_ATTACK,
  SHAPESHIFT_TARGET_BLOCK,
  EFFECT_SHAPESHIFT_ACTIVE,
} from "../../types/modifierConstants.js";
import { applyShapeshiftTransformation } from "../modifiers/shapeshift.js";
import type { ShapeshiftActiveModifier } from "../../types/modifiers.js";
import type { CardEffect } from "../../types/cards.js";

const defaultCooldowns = {
  usedThisRound: [] as string[],
  usedThisTurn: [] as string[],
  usedThisCombat: [] as string[],
  activeUntilNextTurn: [] as string[],
};

describe("Shapeshift skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should create pending choice with transformation options when activated", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_SHAPESHIFT],
        skillCooldowns: { ...defaultCooldowns },
        hand: [CARD_MARCH],
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_SHAPESHIFT,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_BRAEVALAR_SHAPESHIFT,
        })
      );

      // Should have a pending choice
      const updatedPlayer = result.state.players[0];
      expect(updatedPlayer?.pendingChoice).not.toBeNull();
      expect(updatedPlayer?.pendingChoice?.skillId).toBe(SKILL_BRAEVALAR_SHAPESHIFT);

      // March (Move 2) should produce 2 options: Move→Attack, Move→Block
      const options = updatedPlayer?.pendingChoice?.options ?? [];
      expect(options.length).toBeGreaterThanOrEqual(2);

      // Verify options are SHAPESHIFT_RESOLVE effects
      for (const opt of options) {
        expect(opt.type).toBe(EFFECT_SHAPESHIFT_RESOLVE);
      }
    });

    it("should include options for March basic (Move 2) and powered (Move 4)", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_SHAPESHIFT],
        skillCooldowns: { ...defaultCooldowns },
        hand: [CARD_MARCH],
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_SHAPESHIFT,
      });

      const options = result.state.players[0]?.pendingChoice?.options ?? [];

      // March basic: Move 2 → Attack 2, Move 2 → Block 2
      // March powered: Move 4 → Attack 4, Move 4 → Block 4
      // Total: 4 options
      expect(options.length).toBe(4);
    });

    it("should include choice effect options for Rage (Attack 2 OR Block 2)", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_SHAPESHIFT],
        skillCooldowns: { ...defaultCooldowns },
        hand: [CARD_RAGE],
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_SHAPESHIFT,
      });

      const options = result.state.players[0]?.pendingChoice?.options ?? [];

      // Rage basic: choice(Attack 2, Block 2) — each option has 2 conversions:
      //   Attack 2 → Move 2, Attack 2 → Block 2
      //   Block 2 → Move 2, Block 2 → Attack 2
      // Rage powered: Attack 4 → Move 4, Attack 4 → Block 4
      // Total: 4 (basic) + 2 (powered) = 6
      expect(options.length).toBe(6);

      // Verify some have choiceIndex set
      const withChoiceIndex = options.filter(
        (o: CardEffect) => "choiceIndex" in o && (o as Record<string, unknown>).choiceIndex !== undefined
      );
      expect(withChoiceIndex.length).toBeGreaterThan(0);
    });

    it("should add skill to usedThisTurn cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_SHAPESHIFT],
        skillCooldowns: { ...defaultCooldowns },
        hand: [CARD_MARCH],
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_SHAPESHIFT,
      });

      expect(result.state.players[0]?.skillCooldowns.usedThisTurn).toContain(
        SKILL_BRAEVALAR_SHAPESHIFT
      );
    });
  });

  describe("choice resolution", () => {
    it("should add Shapeshift modifier when choice is resolved", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_SHAPESHIFT],
        skillCooldowns: { ...defaultCooldowns },
        hand: [CARD_MARCH],
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_SHAPESHIFT,
      });

      // Resolve first option (March: Move 2 → Attack 2)
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      expect(afterChoice.events).toContainEqual(
        expect.objectContaining({ type: CHOICE_RESOLVED })
      );

      // Pending choice should be cleared
      expect(afterChoice.state.players[0]?.pendingChoice).toBeNull();

      // Should have an active Shapeshift modifier
      const shapeshiftModifiers = afterChoice.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_SHAPESHIFT_ACTIVE
      );
      expect(shapeshiftModifiers.length).toBe(1);

      const mod = shapeshiftModifiers[0]!.effect as ShapeshiftActiveModifier;
      expect(mod.targetCardId).toBe(CARD_MARCH);
      expect(mod.targetType).toBe(SHAPESHIFT_TARGET_ATTACK);
    });

    it("should set correct target type for Move → Block option", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_SHAPESHIFT],
        skillCooldowns: { ...defaultCooldowns },
        hand: [CARD_MARCH],
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_SHAPESHIFT,
      });

      // Second option should be Move 2 → Block 2
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      const shapeshiftModifiers = afterChoice.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_SHAPESHIFT_ACTIVE
      );
      expect(shapeshiftModifiers.length).toBe(1);

      const mod = shapeshiftModifiers[0]!.effect as ShapeshiftActiveModifier;
      expect(mod.targetCardId).toBe(CARD_MARCH);
      expect(mod.targetType).toBe(SHAPESHIFT_TARGET_BLOCK);
    });
  });

  describe("effect transformation (unit tests)", () => {
    it("should transform Move to Attack", () => {
      const effect: CardEffect = { type: EFFECT_GAIN_MOVE, amount: 2 };
      const modifier: ShapeshiftActiveModifier = {
        type: EFFECT_SHAPESHIFT_ACTIVE,
        targetCardId: CARD_MARCH,
        targetType: SHAPESHIFT_TARGET_ATTACK,
        combatType: COMBAT_TYPE_MELEE,
      };

      const result = applyShapeshiftTransformation(effect, modifier);
      expect(result.type).toBe(EFFECT_GAIN_ATTACK);
      expect((result as { amount: number }).amount).toBe(2);
      expect((result as { combatType: string }).combatType).toBe(COMBAT_TYPE_MELEE);
    });

    it("should transform Move to Block", () => {
      const effect: CardEffect = { type: EFFECT_GAIN_MOVE, amount: 4 };
      const modifier: ShapeshiftActiveModifier = {
        type: EFFECT_SHAPESHIFT_ACTIVE,
        targetCardId: CARD_MARCH,
        targetType: SHAPESHIFT_TARGET_BLOCK,
      };

      const result = applyShapeshiftTransformation(effect, modifier);
      expect(result.type).toBe(EFFECT_GAIN_BLOCK);
      expect((result as { amount: number }).amount).toBe(4);
    });

    it("should transform Attack to Move (element lost)", () => {
      const effect: CardEffect = {
        type: EFFECT_GAIN_ATTACK,
        amount: 3,
        combatType: COMBAT_TYPE_MELEE,
      };
      const modifier: ShapeshiftActiveModifier = {
        type: EFFECT_SHAPESHIFT_ACTIVE,
        targetCardId: "test" as CardId,
        targetType: SHAPESHIFT_TARGET_MOVE,
      };

      const result = applyShapeshiftTransformation(effect, modifier);
      expect(result.type).toBe(EFFECT_GAIN_MOVE);
      expect((result as { amount: number }).amount).toBe(3);
    });

    it("should transform Attack to Block (element preserved)", () => {
      const effect: CardEffect = {
        type: EFFECT_GAIN_ATTACK,
        amount: 3,
        combatType: COMBAT_TYPE_MELEE,
        element: "ice" as const,
      };
      const modifier: ShapeshiftActiveModifier = {
        type: EFFECT_SHAPESHIFT_ACTIVE,
        targetCardId: "test" as CardId,
        targetType: SHAPESHIFT_TARGET_BLOCK,
      };

      const result = applyShapeshiftTransformation(effect, modifier);
      expect(result.type).toBe(EFFECT_GAIN_BLOCK);
      expect((result as { amount: number }).amount).toBe(3);
      expect((result as { element?: string }).element).toBe("ice");
    });

    it("should transform Block to Move (element lost)", () => {
      const effect: CardEffect = {
        type: EFFECT_GAIN_BLOCK,
        amount: 2,
        element: "fire" as const,
      };
      const modifier: ShapeshiftActiveModifier = {
        type: EFFECT_SHAPESHIFT_ACTIVE,
        targetCardId: "test" as CardId,
        targetType: SHAPESHIFT_TARGET_MOVE,
      };

      const result = applyShapeshiftTransformation(effect, modifier);
      expect(result.type).toBe(EFFECT_GAIN_MOVE);
      expect((result as { amount: number }).amount).toBe(2);
      // Element should be lost
      expect((result as Record<string, unknown>).element).toBeUndefined();
    });

    it("should transform Block to Attack (element preserved)", () => {
      const effect: CardEffect = {
        type: EFFECT_GAIN_BLOCK,
        amount: 2,
        element: "fire" as const,
      };
      const modifier: ShapeshiftActiveModifier = {
        type: EFFECT_SHAPESHIFT_ACTIVE,
        targetCardId: "test" as CardId,
        targetType: SHAPESHIFT_TARGET_ATTACK,
        combatType: COMBAT_TYPE_MELEE,
      };

      const result = applyShapeshiftTransformation(effect, modifier);
      expect(result.type).toBe(EFFECT_GAIN_ATTACK);
      expect((result as { amount: number }).amount).toBe(2);
      expect((result as { element?: string }).element).toBe("fire");
      expect((result as { combatType: string }).combatType).toBe(COMBAT_TYPE_MELEE);
    });

    it("should transform only the targeted choice option", () => {
      // Rage basic: choice(Attack 2, Block 2)
      const effect: CardEffect = {
        type: "choice" as const,
        options: [
          { type: EFFECT_GAIN_ATTACK, amount: 2, combatType: COMBAT_TYPE_MELEE },
          { type: EFFECT_GAIN_BLOCK, amount: 2 },
        ],
      };
      const modifier: ShapeshiftActiveModifier = {
        type: EFFECT_SHAPESHIFT_ACTIVE,
        targetCardId: CARD_RAGE,
        targetType: SHAPESHIFT_TARGET_MOVE,
        choiceIndex: 0, // Transform the Attack option
      };

      const result = applyShapeshiftTransformation(effect, modifier);
      expect(result.type).toBe("choice");
      const options = (result as { options: CardEffect[] }).options;

      // First option (Attack) should be transformed to Move
      expect(options[0]!.type).toBe(EFFECT_GAIN_MOVE);
      expect((options[0] as { amount: number }).amount).toBe(2);

      // Second option (Block) should be unchanged
      expect(options[1]!.type).toBe(EFFECT_GAIN_BLOCK);
      expect((options[1] as { amount: number }).amount).toBe(2);
    });
  });

  describe("Concentration exclusion (FAQ S2)", () => {
    it("should not include Concentration in transformation options", () => {
      // When Concentration is mixed with an eligible card, only the eligible card
      // should appear in options (Concentration effects are not Move/Attack/Block)
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_SHAPESHIFT],
        skillCooldowns: { ...defaultCooldowns },
        hand: [CARD_MARCH, CARD_CONCENTRATION],
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_SHAPESHIFT,
      });

      const options = result.state.players[0]?.pendingChoice?.options ?? [];

      // Only March options should appear, not Concentration
      const cardIds = options.map((o: CardEffect) => (o as Record<string, unknown>).targetCardId);
      expect(cardIds.every((id) => id === CARD_MARCH)).toBe(true);
      expect(cardIds).not.toContain(CARD_CONCENTRATION);
    });

    it("should not show Shapeshift in valid actions when only Concentration is in hand", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_SHAPESHIFT],
        skillCooldowns: { ...defaultCooldowns },
        hand: [CARD_CONCENTRATION],
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skillOptions = getSkillsFromValidActions(validActions);
      const found = skillOptions?.activatable?.find(
        (s) => s.skillId === SKILL_BRAEVALAR_SHAPESHIFT
      );
      expect(found).toBeUndefined();
    });
  });

  describe("One with the Land inclusion (FAQ S3)", () => {
    it("should include terrain-based block from One with the Land", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_SHAPESHIFT],
        skillCooldowns: { ...defaultCooldowns },
        hand: [CARD_BRAEVALAR_ONE_WITH_THE_LAND],
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_SHAPESHIFT,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          skillId: SKILL_BRAEVALAR_SHAPESHIFT,
        })
      );

      // One with the Land has shapeshiftable effects:
      // basic: choice(Move 2, Heal 1, Block 2) → Move and Block are shapeshiftable
      // powered: choice(Move 4, Heal 2, terrainBasedBlock) → Move and terrainBasedBlock are shapeshiftable
      const options = result.state.players[0]?.pendingChoice?.options ?? [];
      expect(options.length).toBeGreaterThan(0);
    });

    it("should show Shapeshift in valid actions when One with the Land is in hand", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_SHAPESHIFT],
        skillCooldowns: { ...defaultCooldowns },
        hand: [CARD_BRAEVALAR_ONE_WITH_THE_LAND],
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skillOptions = getSkillsFromValidActions(validActions);
      expect(skillOptions?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_BRAEVALAR_SHAPESHIFT,
        })
      );
    });
  });

  describe("once per turn restriction", () => {
    it("should reject if already used this turn", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_SHAPESHIFT],
        skillCooldowns: {
          ...defaultCooldowns,
          usedThisTurn: [SKILL_BRAEVALAR_SHAPESHIFT],
        },
        hand: [CARD_MARCH],
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_SHAPESHIFT,
      });

      expect(result.events[0]?.type).toBe(INVALID_ACTION);
    });
  });

  describe("valid actions", () => {
    it("should appear in valid actions when not on cooldown and eligible cards in hand", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_SHAPESHIFT],
        skillCooldowns: { ...defaultCooldowns },
        hand: [CARD_MARCH],
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skillOptions = getSkillsFromValidActions(validActions);
      expect(skillOptions?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_BRAEVALAR_SHAPESHIFT,
        })
      );
    });

    it("should not appear in valid actions when on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_SHAPESHIFT],
        skillCooldowns: {
          ...defaultCooldowns,
          usedThisTurn: [SKILL_BRAEVALAR_SHAPESHIFT],
        },
        hand: [CARD_MARCH],
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skillOptions = getSkillsFromValidActions(validActions);
      const found = skillOptions?.activatable?.find(
        (s) => s.skillId === SKILL_BRAEVALAR_SHAPESHIFT
      );
      expect(found).toBeUndefined();
    });

    it("should not appear when no eligible cards in hand", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_SHAPESHIFT],
        skillCooldowns: { ...defaultCooldowns },
        hand: [CARD_CONCENTRATION], // No shapeshiftable effects
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skillOptions = getSkillsFromValidActions(validActions);
      const found = skillOptions?.activatable?.find(
        (s) => s.skillId === SKILL_BRAEVALAR_SHAPESHIFT
      );
      expect(found).toBeUndefined();
    });
  });

  describe("multiple cards in hand", () => {
    it("should include options from all eligible cards", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_SHAPESHIFT],
        skillCooldowns: { ...defaultCooldowns },
        hand: [CARD_MARCH, CARD_RAGE],
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_SHAPESHIFT,
      });

      const options = result.state.players[0]?.pendingChoice?.options ?? [];

      // March: 4 options (basic Move 2 → 2, powered Move 4 → 2)
      // Rage: 6 options (basic choice Attack/Block → 4, powered Attack 4 → 2)
      // Total: 10
      expect(options.length).toBe(10);

      // Verify both card IDs are represented
      const cardIds = options.map((o: CardEffect) => (o as Record<string, unknown>).targetCardId);
      expect(cardIds).toContain(CARD_MARCH);
      expect(cardIds).toContain(CARD_RAGE);
    });

    it("should mix eligible and non-eligible cards correctly", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_SHAPESHIFT],
        skillCooldowns: { ...defaultCooldowns },
        hand: [CARD_MARCH, CARD_CONCENTRATION], // March eligible, Concentration not
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_SHAPESHIFT,
      });

      const options = result.state.players[0]?.pendingChoice?.options ?? [];

      // Only March options (4 total), no Concentration options
      expect(options.length).toBe(4);
      const cardIds = options.map((o: CardEffect) => (o as Record<string, unknown>).targetCardId);
      expect(cardIds.every((id) => id === CARD_MARCH)).toBe(true);
    });
  });

  describe("Swiftness powered effect", () => {
    it("should include powered Ranged Attack 3 as distinct option", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_SHAPESHIFT],
        skillCooldowns: { ...defaultCooldowns },
        hand: [CARD_SWIFTNESS],
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_SHAPESHIFT,
      });

      const options = result.state.players[0]?.pendingChoice?.options ?? [];

      // Swiftness basic: Move 2 → Attack 2, Move 2 → Block 2 (2 options)
      // Swiftness powered: Ranged Attack 3 → Move 3, Ranged Attack 3 → Block 3 (2 options)
      // Total: 4
      expect(options.length).toBe(4);
    });
  });
});
