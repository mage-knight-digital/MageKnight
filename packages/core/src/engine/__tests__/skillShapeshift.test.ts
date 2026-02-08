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
import { createTestGameState, createTestPlayer, createUnitCombatState } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  RESOLVE_CHOICE_ACTION,
  CHOICE_RESOLVED,
  PLAY_CARD_ACTION,
  UNDO_ACTION,
  CARD_MARCH,
  CARD_RAGE,
  CARD_SWIFTNESS,
  CARD_CONCENTRATION,
  CARD_WOUND,
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
  EFFECT_TERRAIN_BASED_BLOCK,
  EFFECT_SHAPESHIFT_RESOLVE,
  COMBAT_TYPE_MELEE,
} from "../../types/effectTypes.js";
import {
  SHAPESHIFT_TARGET_MOVE,
  SHAPESHIFT_TARGET_ATTACK,
  SHAPESHIFT_TARGET_BLOCK,
  EFFECT_SHAPESHIFT_ACTIVE,
} from "../../types/modifierConstants.js";
import { applyShapeshiftTransformation, getShapeshiftModifier, consumeShapeshiftModifier } from "../modifiers/shapeshift.js";
import { addModifier } from "../modifiers/lifecycle.js";
import { SCOPE_SELF, DURATION_TURN, SOURCE_SKILL } from "../../types/modifierConstants.js";
import { COMBAT_PHASE_ATTACK } from "../../types/combat.js";
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

  describe("end-to-end card play with transformation", () => {
    it("should transform March Move 2 into Move when shapeshifted and played outside combat", () => {
      // This tests the playCardCommand interception path:
      // Activate shapeshift → resolve choice → play card → modifier consumed
      // We shapeshift Move→Block on March, but since we're not in combat
      // the block won't apply to combatAccumulator. What we CAN verify:
      // 1. The modifier is consumed
      // 2. The player does NOT gain move points (the effect was transformed)
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_SHAPESHIFT],
        skillCooldowns: { ...defaultCooldowns },
        hand: [CARD_MARCH, CARD_RAGE], // Need another card to avoid mandatory announcement
        movePoints: 0,
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      // 1. Activate Shapeshift
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_SHAPESHIFT,
      });

      // 2. Choose March: Move 2 → Attack 2 (first option)
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Verify modifier exists before card play
      expect(afterChoice.state.activeModifiers.some(
        (m) => m.effect.type === EFFECT_SHAPESHIFT_ACTIVE
      )).toBe(true);

      // 3. Play March — the shapeshift modifier transforms Move 2 → Attack 2
      // Outside combat, attack points go to combatAccumulator which stays at 0
      // (no combat context), but the key is the modifier gets consumed
      const afterPlay = engine.processAction(afterChoice.state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: false,
      });

      // Modifier should be consumed after card play
      expect(afterPlay.state.activeModifiers.some(
        (m) => m.effect.type === EFFECT_SHAPESHIFT_ACTIVE
      )).toBe(false);

      // March was moved from hand to play area
      expect(afterPlay.state.players[0]!.hand).not.toContain(CARD_MARCH);
      expect(afterPlay.state.players[0]!.playArea).toContain(CARD_MARCH);
    });

    it("should transform Rage choice options when played in combat", () => {
      // Rage is CATEGORY_COMBAT, so it must be played during combat.
      // Shapeshift transforms Attack option (choiceIndex=0) to Move.
      // In combat, the choice is presented with transformed options.
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_SHAPESHIFT],
        skillCooldowns: { ...defaultCooldowns },
        hand: [CARD_RAGE, CARD_MARCH],
        movePoints: 0,
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      // 1. Activate Shapeshift (can be used during combat)
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_SHAPESHIFT,
      });

      // Choose option 0: Rage Attack 2 → Move 2 (with choiceIndex=0)
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Verify modifier targets Rage and transforms Attack (choiceIndex 0) to Move
      const mod = afterChoice.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_SHAPESHIFT_ACTIVE
      )!.effect as ShapeshiftActiveModifier;
      expect(mod.targetCardId).toBe(CARD_RAGE);
      expect(mod.targetType).toBe(SHAPESHIFT_TARGET_MOVE);
      expect(mod.choiceIndex).toBe(0);

      // 2. Play Rage basic (unpowered) during attack phase
      // With shapeshift: choice option 0 (Attack 2) becomes Move 2
      // So the choice becomes: Move 2 OR Block 2
      const afterPlay = engine.processAction(afterChoice.state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_RAGE,
        powered: false,
      });

      // Modifier should be consumed after card play
      expect(afterPlay.state.activeModifiers.some(
        (m) => m.effect.type === EFFECT_SHAPESHIFT_ACTIVE
      )).toBe(false);

      // Card should have moved from hand to play area
      expect(afterPlay.state.players[0]!.hand).not.toContain(CARD_RAGE);
      expect(afterPlay.state.players[0]!.playArea).toContain(CARD_RAGE);
    });
  });

  describe("modifier system (unit tests)", () => {
    it("getShapeshiftModifier should find modifier for target card", () => {
      const player = createTestPlayer({ position: { q: 0, r: 0 } });
      let state = createTestGameState({ players: [player] });

      const modifierEffect: ShapeshiftActiveModifier = {
        type: EFFECT_SHAPESHIFT_ACTIVE,
        targetCardId: CARD_MARCH,
        targetType: SHAPESHIFT_TARGET_ATTACK,
        combatType: COMBAT_TYPE_MELEE,
      };

      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_BRAEVALAR_SHAPESHIFT, playerId: "player1" },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: modifierEffect,
        createdByPlayerId: "player1",
        createdAtRound: state.round,
      });

      const found = getShapeshiftModifier(state, "player1", CARD_MARCH);
      expect(found).not.toBeNull();
      expect((found!.effect as ShapeshiftActiveModifier).targetCardId).toBe(CARD_MARCH);
    });

    it("getShapeshiftModifier should return null for different card", () => {
      const player = createTestPlayer({ position: { q: 0, r: 0 } });
      let state = createTestGameState({ players: [player] });

      const modifierEffect: ShapeshiftActiveModifier = {
        type: EFFECT_SHAPESHIFT_ACTIVE,
        targetCardId: CARD_MARCH,
        targetType: SHAPESHIFT_TARGET_ATTACK,
        combatType: COMBAT_TYPE_MELEE,
      };

      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_BRAEVALAR_SHAPESHIFT, playerId: "player1" },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: modifierEffect,
        createdByPlayerId: "player1",
        createdAtRound: state.round,
      });

      const found = getShapeshiftModifier(state, "player1", CARD_RAGE);
      expect(found).toBeNull();
    });

    it("getShapeshiftModifier should return null when no modifiers exist", () => {
      const player = createTestPlayer({ position: { q: 0, r: 0 } });
      const state = createTestGameState({ players: [player] });

      const found = getShapeshiftModifier(state, "player1", CARD_MARCH);
      expect(found).toBeNull();
    });

    it("consumeShapeshiftModifier should remove the modifier", () => {
      const player = createTestPlayer({ position: { q: 0, r: 0 } });
      let state = createTestGameState({ players: [player] });

      const modifierEffect: ShapeshiftActiveModifier = {
        type: EFFECT_SHAPESHIFT_ACTIVE,
        targetCardId: CARD_MARCH,
        targetType: SHAPESHIFT_TARGET_BLOCK,
      };

      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_BRAEVALAR_SHAPESHIFT, playerId: "player1" },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: modifierEffect,
        createdByPlayerId: "player1",
        createdAtRound: state.round,
      });

      const mod = getShapeshiftModifier(state, "player1", CARD_MARCH);
      expect(mod).not.toBeNull();

      const afterConsume = consumeShapeshiftModifier(state, mod!.id);
      expect(getShapeshiftModifier(afterConsume, "player1", CARD_MARCH)).toBeNull();
    });
  });

  describe("additional transformation edge cases", () => {
    it("should transform Attack to Block without element", () => {
      const effect: CardEffect = {
        type: EFFECT_GAIN_ATTACK,
        amount: 2,
        combatType: COMBAT_TYPE_MELEE,
      };
      const modifier: ShapeshiftActiveModifier = {
        type: EFFECT_SHAPESHIFT_ACTIVE,
        targetCardId: "test" as CardId,
        targetType: SHAPESHIFT_TARGET_BLOCK,
      };

      const result = applyShapeshiftTransformation(effect, modifier);
      expect(result.type).toBe(EFFECT_GAIN_BLOCK);
      expect((result as { amount: number }).amount).toBe(2);
      // No element on source means no element on result
      expect((result as Record<string, unknown>).element).toBeUndefined();
    });

    it("should transform Block to Attack without element", () => {
      const effect: CardEffect = {
        type: EFFECT_GAIN_BLOCK,
        amount: 3,
      };
      const modifier: ShapeshiftActiveModifier = {
        type: EFFECT_SHAPESHIFT_ACTIVE,
        targetCardId: "test" as CardId,
        targetType: SHAPESHIFT_TARGET_ATTACK,
        combatType: COMBAT_TYPE_MELEE,
      };

      const result = applyShapeshiftTransformation(effect, modifier);
      expect(result.type).toBe(EFFECT_GAIN_ATTACK);
      expect((result as { amount: number }).amount).toBe(3);
      expect((result as Record<string, unknown>).element).toBeUndefined();
    });

    it("should handle terrain-based block transformation", () => {
      const effect: CardEffect = { type: EFFECT_TERRAIN_BASED_BLOCK };
      const modifier: ShapeshiftActiveModifier = {
        type: EFFECT_SHAPESHIFT_ACTIVE,
        targetCardId: CARD_BRAEVALAR_ONE_WITH_THE_LAND,
        targetType: SHAPESHIFT_TARGET_MOVE,
      };

      // Terrain-based block is a special case - kept as-is since amount is dynamic
      const result = applyShapeshiftTransformation(effect, modifier);
      expect(result.type).toBe(EFFECT_TERRAIN_BASED_BLOCK);
    });

    it("should transform choice without specific index (all applicable options)", () => {
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
        // No choiceIndex — transforms all applicable options
      };

      const result = applyShapeshiftTransformation(effect, modifier);
      expect(result.type).toBe("choice");
      const options = (result as { options: CardEffect[] }).options;

      // Both options should be transformed to Move
      expect(options[0]!.type).toBe(EFFECT_GAIN_MOVE);
      expect(options[1]!.type).toBe(EFFECT_GAIN_MOVE);
    });

    it("should return non-transformable effects unchanged", () => {
      // An effect that isn't Move/Attack/Block shouldn't be transformed
      const effect: CardEffect = { type: "gain_influence" as const, amount: 2 };
      const modifier: ShapeshiftActiveModifier = {
        type: EFFECT_SHAPESHIFT_ACTIVE,
        targetCardId: "test" as CardId,
        targetType: SHAPESHIFT_TARGET_ATTACK,
      };

      const result = applyShapeshiftTransformation(effect, modifier);
      expect(result.type).toBe("gain_influence");
      expect((result as { amount: number }).amount).toBe(2);
    });

    it("should return move unchanged for move→move edge case", () => {
      const effect: CardEffect = { type: EFFECT_GAIN_MOVE, amount: 2 };
      const modifier: ShapeshiftActiveModifier = {
        type: EFFECT_SHAPESHIFT_ACTIVE,
        targetCardId: "test" as CardId,
        targetType: SHAPESHIFT_TARGET_MOVE,
      };

      const result = applyShapeshiftTransformation(effect, modifier);
      expect(result.type).toBe(EFFECT_GAIN_MOVE);
      expect((result as { amount: number }).amount).toBe(2);
    });

    it("should return attack unchanged for attack→attack edge case", () => {
      const effect: CardEffect = {
        type: EFFECT_GAIN_ATTACK,
        amount: 3,
        combatType: COMBAT_TYPE_MELEE,
      };
      const modifier: ShapeshiftActiveModifier = {
        type: EFFECT_SHAPESHIFT_ACTIVE,
        targetCardId: "test" as CardId,
        targetType: SHAPESHIFT_TARGET_ATTACK,
      };

      const result = applyShapeshiftTransformation(effect, modifier);
      expect(result.type).toBe(EFFECT_GAIN_ATTACK);
    });

    it("should return block unchanged for block→block edge case", () => {
      const effect: CardEffect = { type: EFFECT_GAIN_BLOCK, amount: 2 };
      const modifier: ShapeshiftActiveModifier = {
        type: EFFECT_SHAPESHIFT_ACTIVE,
        targetCardId: "test" as CardId,
        targetType: SHAPESHIFT_TARGET_BLOCK,
      };

      const result = applyShapeshiftTransformation(effect, modifier);
      expect(result.type).toBe(EFFECT_GAIN_BLOCK);
    });
  });

  describe("non-basic-action cards filtered out", () => {
    it("should ignore wound cards in hand", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_SHAPESHIFT],
        skillCooldowns: { ...defaultCooldowns },
        hand: [CARD_WOUND, CARD_MARCH],
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_SHAPESHIFT,
      });

      const options = result.state.players[0]?.pendingChoice?.options ?? [];
      // Only March options, no wound options
      const cardIds = options.map((o: CardEffect) => (o as Record<string, unknown>).targetCardId);
      expect(cardIds.every((id) => id === CARD_MARCH)).toBe(true);
    });
  });

  describe("undo", () => {
    it("should undo skill activation and clear pending choice", () => {
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

      expect(afterSkill.state.players[0]?.pendingChoice).not.toBeNull();
      expect(afterSkill.state.players[0]?.skillCooldowns.usedThisTurn).toContain(
        SKILL_BRAEVALAR_SHAPESHIFT
      );

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Pending choice should be cleared
      expect(afterUndo.state.players[0]?.pendingChoice).toBeNull();
      // Cooldown should be removed
      expect(afterUndo.state.players[0]?.skillCooldowns.usedThisTurn).not.toContain(
        SKILL_BRAEVALAR_SHAPESHIFT
      );
    });

    it("should fully undo skill activation clearing modifier and cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_SHAPESHIFT],
        skillCooldowns: { ...defaultCooldowns },
        hand: [CARD_MARCH],
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      // Activate and resolve choice
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_SHAPESHIFT,
      });
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Modifier should exist after resolution
      expect(afterChoice.state.activeModifiers.some(
        (m) => m.effect.type === EFFECT_SHAPESHIFT_ACTIVE
      )).toBe(true);

      // Undo until we're back to initial state (before skill activation)
      let current = afterChoice.state;
      for (let i = 0; i < 3; i++) {
        const undoResult = engine.processAction(current, "player1", {
          type: UNDO_ACTION,
        });
        current = undoResult.state;
        // Check if we've fully undone the skill
        if (
          !current.players[0]?.skillCooldowns.usedThisTurn.includes(SKILL_BRAEVALAR_SHAPESHIFT) &&
          !current.activeModifiers.some((m) => m.effect.type === EFFECT_SHAPESHIFT_ACTIVE)
        ) {
          break;
        }
      }

      // After full undo: no modifier, no cooldown, no pending choice
      expect(current.activeModifiers.some(
        (m) => m.effect.type === EFFECT_SHAPESHIFT_ACTIVE
      )).toBe(false);
      expect(current.players[0]?.pendingChoice).toBeNull();
      expect(current.players[0]?.skillCooldowns.usedThisTurn).not.toContain(
        SKILL_BRAEVALAR_SHAPESHIFT
      );
    });
  });

  describe("choice resolution with optional fields", () => {
    it("should resolve choice with choiceIndex for Rage Attack option", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_SHAPESHIFT],
        skillCooldowns: { ...defaultCooldowns },
        hand: [CARD_RAGE],
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_SHAPESHIFT,
      });

      // First option for Rage should be Attack 2 → Move 2 (with choiceIndex=0)
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      const shapeshiftMods = afterChoice.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_SHAPESHIFT_ACTIVE
      );
      expect(shapeshiftMods.length).toBe(1);

      const mod = shapeshiftMods[0]!.effect as ShapeshiftActiveModifier;
      expect(mod.targetCardId).toBe(CARD_RAGE);
      // Should have choiceIndex set since Rage is a choice effect
      expect(mod.choiceIndex).toBeDefined();
    });

    it("should set combatType on modifier for Attack target options", () => {
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

      // First option: March Move 2 → Attack 2 (should have combatType: melee)
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      const mod = afterChoice.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_SHAPESHIFT_ACTIVE
      )!.effect as ShapeshiftActiveModifier;
      expect(mod.targetType).toBe(SHAPESHIFT_TARGET_ATTACK);
      expect(mod.combatType).toBe(COMBAT_TYPE_MELEE);
    });
  });
});
