/**
 * Tests for Endless Gem Pouch artifact
 *
 * Basic: Roll mana die twice. Gain crystal per color (choose if gold, Fame +1 if black).
 * Powered (any color, destroy): Gain mana token of each basic color + gold (day) or black (night/underground).
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer, createUnitCombatState } from "./testHelpers.js";
import { resolveEffect } from "../effects/index.js";
import {
  EFFECT_ROLL_FOR_CRYSTALS,
  EFFECT_RESOLVE_CRYSTAL_ROLL_CHOICE,
  EFFECT_COMPOUND,
} from "../../types/effectTypes.js";
import type {
  RollForCrystalsEffect,
  ResolveCrystalRollChoiceEffect,
} from "../../types/cards.js";
import {
  CARD_ENDLESS_GEM_POUCH,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_GOLD,
  MANA_BLACK,
  TIME_OF_DAY_DAY,
  TIME_OF_DAY_NIGHT,
} from "@mage-knight/shared";
import { createRng } from "../../utils/rng.js";
import { ENDLESS_GEM_POUCH_CARDS } from "../../data/artifacts/endlessGemPouch.js";
import { COMBAT_PHASE_RANGED_SIEGE } from "../../types/combat.js";

describe("Endless Gem Pouch", () => {
  // ============================================================================
  // CARD DEFINITION
  // ============================================================================

  describe("card definition", () => {
    it("should be defined with correct properties", () => {
      const card = ENDLESS_GEM_POUCH_CARDS[CARD_ENDLESS_GEM_POUCH];
      expect(card).toBeDefined();
      expect(card!.name).toBe("Endless Gem Pouch");
      expect(card!.destroyOnPowered).toBe(true);
      expect(card!.sidewaysValue).toBe(1);
      expect(card!.categories).toContain("special");
    });

    it("should be powered by any basic color", () => {
      const card = ENDLESS_GEM_POUCH_CARDS[CARD_ENDLESS_GEM_POUCH];
      expect(card!.poweredBy).toEqual([MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE]);
    });

    it("should have roll for crystals basic effect with 2 dice", () => {
      const card = ENDLESS_GEM_POUCH_CARDS[CARD_ENDLESS_GEM_POUCH];
      expect(card!.basicEffect).toEqual({
        type: EFFECT_ROLL_FOR_CRYSTALS,
        diceCount: 2,
      });
    });

    it("should have compound powered effect with all basic mana + conditional", () => {
      const card = ENDLESS_GEM_POUCH_CARDS[CARD_ENDLESS_GEM_POUCH];
      expect(card!.poweredEffect.type).toBe(EFFECT_COMPOUND);
    });
  });

  // ============================================================================
  // BASIC EFFECT: Roll for Crystals
  // ============================================================================

  describe("Roll for Crystals", () => {
    it("should roll specified number of dice", () => {
      const player = createTestPlayer({
        hand: [CARD_ENDLESS_GEM_POUCH],
      });
      const state = createTestGameState({
        players: [player],
        rng: createRng(42),
      });

      const effect: RollForCrystalsEffect = {
        type: EFFECT_ROLL_FOR_CRYSTALS,
        diceCount: 2,
      };

      const result = resolveEffect(state, "player1", effect);

      // RNG should have advanced by at least 2 (for 2 dice)
      expect(result.state.rng.counter).toBeGreaterThanOrEqual(state.rng.counter + 2);
      expect(result.description).toContain("Rolled:");
    });

    it("should gain crystal for basic color rolls (red/blue/green/white)", () => {
      const player = createTestPlayer({
        hand: [CARD_ENDLESS_GEM_POUCH],
      });

      // Find a seed where both rolls are basic colors (not gold or black)
      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const state = createTestGameState({
          players: [player],
          rng: createRng(seed),
        });

        const effect: RollForCrystalsEffect = {
          type: EFFECT_ROLL_FOR_CRYSTALS,
          diceCount: 2,
        };

        const result = resolveEffect(state, "player1", effect);

        // If no choice required and crystals gained, we found basic color rolls
        if (!result.requiresChoice) {
          const p = result.state.players[0]!;
          const totalCrystals = p.crystals.red + p.crystals.blue + p.crystals.green + p.crystals.white;
          const totalFame = p.fame;

          // Should have gained some crystals and/or fame (from black rolls)
          if (totalCrystals > 0 && totalFame === 0) {
            // Pure crystal gain (no black rolls, no gold choices)
            found = true;
            expect(totalCrystals).toBeGreaterThanOrEqual(1);
            break;
          }
        }
      }

      expect(found).toBe(true);
    });

    it("should gain Fame +1 for black roll instead of crystal", () => {
      const player = createTestPlayer({
        hand: [CARD_ENDLESS_GEM_POUCH],
        fame: 0,
      });

      // Find a seed that produces at least one black roll
      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const state = createTestGameState({
          players: [player],
          rng: createRng(seed),
        });

        const effect: RollForCrystalsEffect = {
          type: EFFECT_ROLL_FOR_CRYSTALS,
          diceCount: 2,
        };

        const result = resolveEffect(state, "player1", effect);

        // Check if fame was gained (indicates black roll)
        if (result.state.players[0]!.fame > 0 && !result.requiresChoice) {
          found = true;
          expect(result.state.players[0]!.fame).toBeGreaterThanOrEqual(1);
          expect(result.description).toContain("Black");
          expect(result.description).toContain("Fame");
          break;
        }
      }

      expect(found).toBe(true);
    });

    it("should present choice when gold is rolled", () => {
      const player = createTestPlayer({
        hand: [CARD_ENDLESS_GEM_POUCH],
      });

      // Find a seed that produces at least one gold roll
      let found = false;
      for (let seed = 0; seed < 200; seed++) {
        const state = createTestGameState({
          players: [player],
          rng: createRng(seed),
        });

        const effect: RollForCrystalsEffect = {
          type: EFFECT_ROLL_FOR_CRYSTALS,
          diceCount: 2,
        };

        const result = resolveEffect(state, "player1", effect);

        if (result.requiresChoice) {
          found = true;

          // Should offer 4 basic color choices
          expect(result.dynamicChoiceOptions).toHaveLength(4);

          const options = result.dynamicChoiceOptions as readonly ResolveCrystalRollChoiceEffect[];
          expect(options![0]!.type).toBe(EFFECT_RESOLVE_CRYSTAL_ROLL_CHOICE);
          expect(options![0]!.chosenColor).toBe(MANA_RED);
          expect(options![1]!.chosenColor).toBe(MANA_BLUE);
          expect(options![2]!.chosenColor).toBe(MANA_GREEN);
          expect(options![3]!.chosenColor).toBe(MANA_WHITE);
          break;
        }
      }

      expect(found).toBe(true);
    });
  });

  // ============================================================================
  // RESOLVE CRYSTAL ROLL CHOICE (Gold → Player Chooses)
  // ============================================================================

  describe("Resolve Crystal Roll Choice", () => {
    it("should gain crystal of chosen color for gold roll", () => {
      const player = createTestPlayer({
        hand: [CARD_ENDLESS_GEM_POUCH],
      });
      const state = createTestGameState({
        players: [player],
      });

      const effect: ResolveCrystalRollChoiceEffect = {
        type: EFFECT_RESOLVE_CRYSTAL_ROLL_CHOICE,
        chosenColor: MANA_BLUE,
        remainingResults: [],
      };

      const result = resolveEffect(state, "player1", effect);

      expect(result.state.players[0]!.crystals.blue).toBe(1);
      expect(result.description).toContain("blue crystal");
    });

    it("should process remaining results after gold choice", () => {
      const player = createTestPlayer({
        hand: [CARD_ENDLESS_GEM_POUCH],
      });
      const state = createTestGameState({
        players: [player],
      });

      // Gold was first, red is remaining
      const effect: ResolveCrystalRollChoiceEffect = {
        type: EFFECT_RESOLVE_CRYSTAL_ROLL_CHOICE,
        chosenColor: MANA_GREEN,
        remainingResults: [MANA_RED],
      };

      const result = resolveEffect(state, "player1", effect);

      expect(result.state.players[0]!.crystals.green).toBe(1);
      expect(result.state.players[0]!.crystals.red).toBe(1);
      expect(result.requiresChoice).toBeFalsy();
    });

    it("should handle remaining black result after gold choice (fame)", () => {
      const player = createTestPlayer({
        hand: [CARD_ENDLESS_GEM_POUCH],
        fame: 0,
      });
      const state = createTestGameState({
        players: [player],
      });

      const effect: ResolveCrystalRollChoiceEffect = {
        type: EFFECT_RESOLVE_CRYSTAL_ROLL_CHOICE,
        chosenColor: MANA_WHITE,
        remainingResults: [MANA_BLACK],
      };

      const result = resolveEffect(state, "player1", effect);

      expect(result.state.players[0]!.crystals.white).toBe(1);
      expect(result.state.players[0]!.fame).toBe(1);
    });

    it("should chain another choice if remaining results contain gold", () => {
      const player = createTestPlayer({
        hand: [CARD_ENDLESS_GEM_POUCH],
      });
      const state = createTestGameState({
        players: [player],
      });

      // First gold resolved, but remaining has another gold
      const effect: ResolveCrystalRollChoiceEffect = {
        type: EFFECT_RESOLVE_CRYSTAL_ROLL_CHOICE,
        chosenColor: MANA_RED,
        remainingResults: [MANA_GOLD],
      };

      const result = resolveEffect(state, "player1", effect);

      expect(result.state.players[0]!.crystals.red).toBe(1);
      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(4);
    });
  });

  // ============================================================================
  // POWERED EFFECT: Rainbow Mana
  // ============================================================================

  describe("Powered Effect", () => {
    it("should gain all basic mana tokens during day", () => {
      const player = createTestPlayer({
        hand: [CARD_ENDLESS_GEM_POUCH],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const card = ENDLESS_GEM_POUCH_CARDS[CARD_ENDLESS_GEM_POUCH]!;
      const result = resolveEffect(state, "player1", card.poweredEffect);

      const tokens = result.state.players[0]!.pureMana;
      const colors = tokens.map((t) => t.color);

      expect(colors).toContain(MANA_RED);
      expect(colors).toContain(MANA_BLUE);
      expect(colors).toContain(MANA_GREEN);
      expect(colors).toContain(MANA_WHITE);
      expect(colors).toContain(MANA_GOLD);
      expect(colors).not.toContain(MANA_BLACK);
      expect(tokens).toHaveLength(5);
    });

    it("should gain black mana instead of gold during night", () => {
      const player = createTestPlayer({
        hand: [CARD_ENDLESS_GEM_POUCH],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      const card = ENDLESS_GEM_POUCH_CARDS[CARD_ENDLESS_GEM_POUCH]!;
      const result = resolveEffect(state, "player1", card.poweredEffect);

      const tokens = result.state.players[0]!.pureMana;
      const colors = tokens.map((t) => t.color);

      expect(colors).toContain(MANA_RED);
      expect(colors).toContain(MANA_BLUE);
      expect(colors).toContain(MANA_GREEN);
      expect(colors).toContain(MANA_WHITE);
      expect(colors).toContain(MANA_BLACK);
      expect(colors).not.toContain(MANA_GOLD);
      expect(tokens).toHaveLength(5);
    });

    it("should gain black mana in dungeon/tomb (underground) even during day", () => {
      const player = createTestPlayer({
        hand: [CARD_ENDLESS_GEM_POUCH],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        combat: {
          ...createUnitCombatState(COMBAT_PHASE_RANGED_SIEGE),
          nightManaRules: true,  // Dungeon/Tomb
          unitsAllowed: false,   // Dungeon/Tomb
        },
      });

      const card = ENDLESS_GEM_POUCH_CARDS[CARD_ENDLESS_GEM_POUCH]!;
      const result = resolveEffect(state, "player1", card.poweredEffect);

      const tokens = result.state.players[0]!.pureMana;
      const colors = tokens.map((t) => t.color);

      expect(colors).toContain(MANA_RED);
      expect(colors).toContain(MANA_BLUE);
      expect(colors).toContain(MANA_GREEN);
      expect(colors).toContain(MANA_WHITE);
      expect(colors).toContain(MANA_BLACK);
      expect(colors).not.toContain(MANA_GOLD);
      expect(tokens).toHaveLength(5);
    });
  });

  // ============================================================================
  // PROBABILITY VERIFICATION
  // ============================================================================

  describe("probability distribution", () => {
    it("should produce each mana color roughly equally (1/6 each)", () => {
      const player = createTestPlayer({
        hand: [CARD_ENDLESS_GEM_POUCH],
      });

      const colorCounts: Record<string, number> = {
        red: 0, blue: 0, green: 0, white: 0, gold: 0, black: 0,
      };
      const totalRolls = 600;

      for (let seed = 0; seed < totalRolls; seed++) {
        const state = createTestGameState({
          players: [player],
          rng: createRng(seed),
        });

        const effect: RollForCrystalsEffect = {
          type: EFFECT_ROLL_FOR_CRYSTALS,
          diceCount: 1,
        };

        const result = resolveEffect(state, "player1", effect);

        // Check what happened
        const p = result.state.players[0]!;
        if (result.requiresChoice) {
          // Gold roll
          colorCounts["gold"]!++;
        } else if (p.fame > 0) {
          // Black roll
          colorCounts["black"]!++;
        } else if (p.crystals.red > 0) {
          colorCounts["red"]!++;
        } else if (p.crystals.blue > 0) {
          colorCounts["blue"]!++;
        } else if (p.crystals.green > 0) {
          colorCounts["green"]!++;
        } else if (p.crystals.white > 0) {
          colorCounts["white"]!++;
        }
      }

      // Each color should appear roughly 1/6 = 16.67% of the time
      // Allow wide margin: 8-28% (48-168 out of 600)
      for (const [color, count] of Object.entries(colorCounts)) {
        const percentage = (count / totalRolls) * 100;
        expect(percentage, `${color} at ${percentage.toFixed(1)}%`).toBeGreaterThan(8);
        expect(percentage, `${color} at ${percentage.toFixed(1)}%`).toBeLessThan(28);
      }
    });
  });
});
