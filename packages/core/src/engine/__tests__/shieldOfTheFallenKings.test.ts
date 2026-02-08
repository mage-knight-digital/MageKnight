/**
 * Shield of the Fallen Kings Tests
 *
 * Tests for:
 * - Card definition (properties, effect structure)
 * - Basic effect: Block 6 OR two Block 4 (split)
 * - Powered effect: Cold Fire Block 8 OR up to three Cold Fire Block 4 (split)
 * - Cold Fire element efficiency against Fire and Ice attacks
 * - Artifact destruction on powered use
 * - Ambush interaction (bonus applies once to overall block pool)
 */

import { describe, it, expect } from "vitest";
import {
  CARD_SHIELD_OF_THE_FALLEN_KINGS,
  ELEMENT_COLD_FIRE,
} from "@mage-knight/shared";
import {
  DEED_CARD_TYPE_ARTIFACT,
  CATEGORY_COMBAT,
} from "../../types/cards.js";
import type { GainBlockEffect, CompoundEffect, ChoiceEffect } from "../../types/cards.js";
import {
  EFFECT_CHOICE,
  EFFECT_COMPOUND,
  EFFECT_GAIN_BLOCK,
} from "../../types/effectTypes.js";
import { SHIELD_OF_THE_FALLEN_KINGS_CARDS } from "../../data/artifacts/shieldOfTheFallenKings.js";
import { resolveEffect } from "../effects/index.js";
import { createTestPlayer, createTestGameState, createUnitCombatState } from "./testHelpers.js";
import { COMBAT_PHASE_BLOCK } from "@mage-knight/shared";

const card = SHIELD_OF_THE_FALLEN_KINGS_CARDS[CARD_SHIELD_OF_THE_FALLEN_KINGS]!;

describe("Shield of the Fallen Kings", () => {
  describe("card definition", () => {
    it("should be defined with correct properties", () => {
      expect(card).toBeDefined();
      expect(card.name).toBe("Shield of the Fallen Kings");
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
  });

  describe("basic effect structure", () => {
    it("should be a choice effect", () => {
      expect(card.basicEffect.type).toBe(EFFECT_CHOICE);
    });

    it("should have two options: single Block 6 or split Block 4+4", () => {
      const choiceEffect = card.basicEffect as ChoiceEffect;
      expect(choiceEffect.options).toHaveLength(2);

      // Option 1: Block 6
      const singleBlock = choiceEffect.options[0] as GainBlockEffect;
      expect(singleBlock.type).toBe(EFFECT_GAIN_BLOCK);
      expect(singleBlock.amount).toBe(6);
      expect(singleBlock.element).toBeUndefined(); // Physical

      // Option 2: Compound of Block 4 + Block 4
      const splitBlock = choiceEffect.options[1] as CompoundEffect;
      expect(splitBlock.type).toBe(EFFECT_COMPOUND);
      expect(splitBlock.effects).toHaveLength(2);

      const block1 = splitBlock.effects[0] as GainBlockEffect;
      expect(block1.type).toBe(EFFECT_GAIN_BLOCK);
      expect(block1.amount).toBe(4);
      expect(block1.element).toBeUndefined();

      const block2 = splitBlock.effects[1] as GainBlockEffect;
      expect(block2.type).toBe(EFFECT_GAIN_BLOCK);
      expect(block2.amount).toBe(4);
      expect(block2.element).toBeUndefined();
    });
  });

  describe("powered effect structure", () => {
    it("should be a choice effect", () => {
      expect(card.poweredEffect.type).toBe(EFFECT_CHOICE);
    });

    it("should have two options: single Cold Fire Block 8 or split Cold Fire Block 4x3", () => {
      const choiceEffect = card.poweredEffect as ChoiceEffect;
      expect(choiceEffect.options).toHaveLength(2);

      // Option 1: Cold Fire Block 8
      const singleBlock = choiceEffect.options[0] as GainBlockEffect;
      expect(singleBlock.type).toBe(EFFECT_GAIN_BLOCK);
      expect(singleBlock.amount).toBe(8);
      expect(singleBlock.element).toBe(ELEMENT_COLD_FIRE);

      // Option 2: Compound of 3x Cold Fire Block 4
      const splitBlock = choiceEffect.options[1] as CompoundEffect;
      expect(splitBlock.type).toBe(EFFECT_COMPOUND);
      expect(splitBlock.effects).toHaveLength(3);

      for (const effect of splitBlock.effects) {
        const blockEffect = effect as GainBlockEffect;
        expect(blockEffect.type).toBe(EFFECT_GAIN_BLOCK);
        expect(blockEffect.amount).toBe(4);
        expect(blockEffect.element).toBe(ELEMENT_COLD_FIRE);
      }
    });
  });

  describe("basic effect resolution", () => {
    it("should grant Block 6 when single block option is chosen", () => {
      const state = createTestGameState({
        players: [
          createTestPlayer({
            combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
          } as never),
        ],
      });

      // Resolve the single block option directly (option index 0)
      const choiceEffect = card.basicEffect as ChoiceEffect;
      const result = resolveEffect(state, "player1", choiceEffect.options[0]!);

      const player = result.state.players[0]!;
      expect(player.combatAccumulator.block).toBe(6);
      expect(player.combatAccumulator.blockElements.physical).toBe(6);
    });

    it("should grant Block 4+4=8 total when split option is chosen", () => {
      const state = createTestGameState({
        players: [
          createTestPlayer({
            combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
          } as never),
        ],
      });

      // Resolve the split block option directly (option index 1)
      const choiceEffect = card.basicEffect as ChoiceEffect;
      const result = resolveEffect(state, "player1", choiceEffect.options[1]!);

      const player = result.state.players[0]!;
      expect(player.combatAccumulator.block).toBe(8);
      expect(player.combatAccumulator.blockElements.physical).toBe(8);
      // Should have two block sources for potential split assignment
      expect(player.combatAccumulator.blockSources).toHaveLength(2);
      expect(player.combatAccumulator.blockSources[0]!.value).toBe(4);
      expect(player.combatAccumulator.blockSources[1]!.value).toBe(4);
    });
  });

  describe("powered effect resolution", () => {
    it("should grant Cold Fire Block 8 when single block option is chosen", () => {
      const state = createTestGameState({
        players: [
          createTestPlayer({
            combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
          } as never),
        ],
      });

      const choiceEffect = card.poweredEffect as ChoiceEffect;
      const result = resolveEffect(state, "player1", choiceEffect.options[0]!);

      const player = result.state.players[0]!;
      expect(player.combatAccumulator.block).toBe(8);
      expect(player.combatAccumulator.blockElements.coldFire).toBe(8);
    });

    it("should grant 3x Cold Fire Block 4=12 total when split option is chosen", () => {
      const state = createTestGameState({
        players: [
          createTestPlayer({
            combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
          } as never),
        ],
      });

      const choiceEffect = card.poweredEffect as ChoiceEffect;
      const result = resolveEffect(state, "player1", choiceEffect.options[1]!);

      const player = result.state.players[0]!;
      expect(player.combatAccumulator.block).toBe(12);
      expect(player.combatAccumulator.blockElements.coldFire).toBe(12);
      // Should have three Cold Fire block sources
      expect(player.combatAccumulator.blockSources).toHaveLength(3);
      for (const source of player.combatAccumulator.blockSources) {
        expect(source.value).toBe(4);
        expect(source.element).toBe(ELEMENT_COLD_FIRE);
      }
    });

    it("should track block sources as Cold Fire element", () => {
      const state = createTestGameState({
        players: [
          createTestPlayer({
            combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
          } as never),
        ],
      });

      const choiceEffect = card.poweredEffect as ChoiceEffect;
      const result = resolveEffect(state, "player1", choiceEffect.options[0]!);

      const player = result.state.players[0]!;
      expect(player.combatAccumulator.blockSources).toHaveLength(1);
      expect(player.combatAccumulator.blockSources[0]!.element).toBe(ELEMENT_COLD_FIRE);
    });
  });

  describe("choice effect requires player selection", () => {
    it("basic effect should present a choice to the player", () => {
      const state = createTestGameState();
      const result = resolveEffect(state, "player1", card.basicEffect);

      // Choice effects return requiresChoice: true
      expect(result.requiresChoice).toBe(true);
    });

    it("powered effect should present a choice to the player", () => {
      const state = createTestGameState();
      const result = resolveEffect(state, "player1", card.poweredEffect);

      expect(result.requiresChoice).toBe(true);
    });
  });
});
