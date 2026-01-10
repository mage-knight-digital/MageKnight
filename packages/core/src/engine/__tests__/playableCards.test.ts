/**
 * Tests for getPlayableCardsForCombat
 *
 * Validates that cards are correctly identified as playable during each combat phase.
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { getPlayableCardsForCombat } from "../validActions/cards.js";
import {
  CARD_RAGE,
  CARD_DETERMINATION,
  CARD_SWIFTNESS,
  CARD_MARCH,
  CARD_STAMINA,
  CARD_PROMISE,
  CARD_WOUND,
  CARD_IMPROVISATION,
  PLAY_SIDEWAYS_AS_ATTACK,
  PLAY_SIDEWAYS_AS_BLOCK,
  MANA_BLUE,
  MANA_WHITE,
} from "@mage-knight/shared";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
} from "../../types/combat.js";
import type { CombatState } from "../../types/combat.js";

function createTestCombat(phase: CombatState["phase"]): CombatState {
  return {
    phase,
    enemies: [],
    isAtFortifiedSite: false,
    woundsThisCombat: 0,
    fameGained: 0,
  };
}

describe("getPlayableCardsForCombat", () => {
  describe("Ranged/Siege Phase", () => {
    it("should not allow any basic cards to be played for ranged/siege (no ranged basic effects)", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE, CARD_DETERMINATION, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });
      const combat = createTestCombat(COMBAT_PHASE_RANGED_SIEGE);

      const result = getPlayableCardsForCombat(state, player, combat);

      // Rage and Determination have attack/block choices, but no ranged attacks in basic
      // March has move, not attack
      // None of these should be playable basic in ranged/siege phase
      const rageCard = result.cards.find(c => c.cardId === CARD_RAGE);
      const determinationCard = result.cards.find(c => c.cardId === CARD_DETERMINATION);
      const marchCard = result.cards.find(c => c.cardId === CARD_MARCH);

      // These cards don't have ranged basic effects
      expect(rageCard?.canPlayBasic).toBeFalsy();
      expect(determinationCard?.canPlayBasic).toBeFalsy();
      expect(marchCard).toBeUndefined(); // March has no combat effects at all
    });

    it("should allow Swiftness powered for ranged attack when mana is available", () => {
      // Give the player white crystals so they can pay for powered effect
      const player = createTestPlayer({
        hand: [CARD_SWIFTNESS],
        crystals: { red: 0, blue: 0, green: 0, white: 1 },
      });
      const state = createTestGameState({ players: [player] });
      const combat = createTestCombat(COMBAT_PHASE_RANGED_SIEGE);

      const result = getPlayableCardsForCombat(state, player, combat);

      const swiftnessCard = result.cards.find(c => c.cardId === CARD_SWIFTNESS);
      expect(swiftnessCard).toBeDefined();
      expect(swiftnessCard?.canPlayBasic).toBe(false); // Basic is Move, not ranged
      expect(swiftnessCard?.canPlayPowered).toBe(true); // Powered is Ranged Attack 3
      expect(swiftnessCard?.requiredMana).toBe(MANA_WHITE);
    });

    it("should NOT allow Swiftness powered when no mana is available", () => {
      // Player has no mana to pay for powered effect
      const player = createTestPlayer({
        hand: [CARD_SWIFTNESS],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });
      const combat = createTestCombat(COMBAT_PHASE_RANGED_SIEGE);

      const result = getPlayableCardsForCombat(state, player, combat);

      // Swiftness should not be in playable cards at all
      // (no basic ranged effect, no powered without mana, no sideways in ranged phase)
      const swiftnessCard = result.cards.find(c => c.cardId === CARD_SWIFTNESS);
      expect(swiftnessCard).toBeUndefined();
    });

    it("should not allow sideways play in ranged/siege phase", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE],
      });
      const state = createTestGameState({ players: [player] });
      const combat = createTestCombat(COMBAT_PHASE_RANGED_SIEGE);

      const result = getPlayableCardsForCombat(state, player, combat);

      // Even if the card has sideways value, it shouldn't be playable sideways in ranged phase
      const rageCard = result.cards.find(c => c.cardId === CARD_RAGE);
      // Rage might not be in the list at all if it has no ranged effects
      if (rageCard) {
        expect(rageCard.canPlaySideways).toBe(false);
      }
    });
  });

  describe("Block Phase", () => {
    it("should allow cards with block effects", () => {
      // Give the player blue crystals so Determination powered is available
      const player = createTestPlayer({
        hand: [CARD_RAGE, CARD_DETERMINATION],
        crystals: { red: 0, blue: 1, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });
      const combat = createTestCombat(COMBAT_PHASE_BLOCK);

      const result = getPlayableCardsForCombat(state, player, combat);

      // Rage basic: choice(attack(2), block(2)) - has block option
      const rageCard = result.cards.find(c => c.cardId === CARD_RAGE);
      expect(rageCard).toBeDefined();
      expect(rageCard?.canPlayBasic).toBe(true);
      // Rage powered is attack(4), which doesn't have block - so canPlayPowered should be false
      // and requiredMana should be undefined (only set when canPlayPowered is true)
      expect(rageCard?.canPlayPowered).toBe(false);

      // Determination basic: choice(attack(2), block(2)) - has block option
      // Determination powered: block(5) - also has block, and player has blue crystal
      const determinationCard = result.cards.find(c => c.cardId === CARD_DETERMINATION);
      expect(determinationCard).toBeDefined();
      expect(determinationCard?.canPlayBasic).toBe(true);
      expect(determinationCard?.canPlayPowered).toBe(true);
      expect(determinationCard?.requiredMana).toBe(MANA_BLUE);
    });

    it("should not allow powered block without mana", () => {
      // Player has no mana
      const player = createTestPlayer({
        hand: [CARD_DETERMINATION],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });
      const combat = createTestCombat(COMBAT_PHASE_BLOCK);

      const result = getPlayableCardsForCombat(state, player, combat);

      // Determination basic still works (choice attack/block)
      // But powered is blocked (requires blue mana)
      const determinationCard = result.cards.find(c => c.cardId === CARD_DETERMINATION);
      expect(determinationCard).toBeDefined();
      expect(determinationCard?.canPlayBasic).toBe(true);
      expect(determinationCard?.canPlayPowered).toBe(false);
      expect(determinationCard?.requiredMana).toBeUndefined();
    });

    it("should allow sideways play as block", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE],
      });
      const state = createTestGameState({ players: [player] });
      const combat = createTestCombat(COMBAT_PHASE_BLOCK);

      const result = getPlayableCardsForCombat(state, player, combat);

      const rageCard = result.cards.find(c => c.cardId === CARD_RAGE);
      expect(rageCard?.canPlaySideways).toBe(true);
      expect(rageCard?.sidewaysOptions).toContainEqual({
        as: PLAY_SIDEWAYS_AS_BLOCK,
        value: 1,
      });
    });

    it("should not allow move-only cards", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_STAMINA],
      });
      const state = createTestGameState({ players: [player] });
      const combat = createTestCombat(COMBAT_PHASE_BLOCK);

      const result = getPlayableCardsForCombat(state, player, combat);

      // March and Stamina only have move effects, no block
      // But they have sidewaysValue > 0, so they can be played sideways for block
      const marchCard = result.cards.find(c => c.cardId === CARD_MARCH);
      const staminaCard = result.cards.find(c => c.cardId === CARD_STAMINA);

      // Can't play basic (no block effect)
      expect(marchCard?.canPlayBasic).toBeFalsy();
      expect(staminaCard?.canPlayBasic).toBeFalsy();

      // But CAN play sideways for block
      expect(marchCard?.canPlaySideways).toBe(true);
      expect(staminaCard?.canPlaySideways).toBe(true);
    });
  });

  describe("Attack Phase", () => {
    it("should allow cards with attack effects", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE, CARD_DETERMINATION, CARD_IMPROVISATION],
      });
      const state = createTestGameState({ players: [player] });
      const combat = createTestCombat(COMBAT_PHASE_ATTACK);

      const result = getPlayableCardsForCombat(state, player, combat);

      // Rage basic: choice(attack(2), block(2)) - has attack option
      const rageCard = result.cards.find(c => c.cardId === CARD_RAGE);
      expect(rageCard).toBeDefined();
      expect(rageCard?.canPlayBasic).toBe(true);

      // Determination basic: choice(attack(2), block(2)) - has attack option
      const determinationCard = result.cards.find(c => c.cardId === CARD_DETERMINATION);
      expect(determinationCard).toBeDefined();
      expect(determinationCard?.canPlayBasic).toBe(true);

      // Improvisation: choice(move, influence, attack, block) - has attack option
      const improvCard = result.cards.find(c => c.cardId === CARD_IMPROVISATION);
      expect(improvCard).toBeDefined();
      expect(improvCard?.canPlayBasic).toBe(true);
    });

    it("should allow sideways play as attack", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE],
      });
      const state = createTestGameState({ players: [player] });
      const combat = createTestCombat(COMBAT_PHASE_ATTACK);

      const result = getPlayableCardsForCombat(state, player, combat);

      const rageCard = result.cards.find(c => c.cardId === CARD_RAGE);
      expect(rageCard?.canPlaySideways).toBe(true);
      expect(rageCard?.sidewaysOptions).toContainEqual({
        as: PLAY_SIDEWAYS_AS_ATTACK,
        value: 1,
      });
    });

    it("should allow ranged/siege attacks in the attack phase", () => {
      // Per rulebook: "You can combine any Attacks: Ranged, Siege or regular.
      // In this phase, there is no difference between regular, Ranged and Siege Attacks."
      const player = createTestPlayer({
        hand: [CARD_SWIFTNESS], // Powered effect: Ranged Attack 3 (powered by white)
        crystals: { red: 0, blue: 0, green: 0, white: 1 },
      });
      const state = createTestGameState({ players: [player] });
      const combat = createTestCombat(COMBAT_PHASE_ATTACK);

      const result = getPlayableCardsForCombat(state, player, combat);

      const swiftnessCard = result.cards.find(c => c.cardId === CARD_SWIFTNESS);
      expect(swiftnessCard).toBeDefined();
      // Basic is Move, can't be played as attack
      expect(swiftnessCard?.canPlayBasic).toBe(false);
      // Powered is Ranged Attack 3 - should work in attack phase!
      expect(swiftnessCard?.canPlayPowered).toBe(true);
      expect(swiftnessCard?.requiredMana).toBe(MANA_WHITE);
    });

    it("should not allow influence-only cards (except sideways)", () => {
      const player = createTestPlayer({
        hand: [CARD_PROMISE],
      });
      const state = createTestGameState({ players: [player] });
      const combat = createTestCombat(COMBAT_PHASE_ATTACK);

      const result = getPlayableCardsForCombat(state, player, combat);

      // Promise only has influence, no attack
      const promiseCard = result.cards.find(c => c.cardId === CARD_PROMISE);

      // Can't play basic (no attack effect)
      expect(promiseCard?.canPlayBasic).toBeFalsy();

      // But CAN play sideways for attack
      expect(promiseCard?.canPlaySideways).toBe(true);
    });
  });

  describe("Assign Damage Phase", () => {
    it("should not allow any cards during assign damage phase", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE, CARD_DETERMINATION, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });
      const combat = createTestCombat(COMBAT_PHASE_ASSIGN_DAMAGE);

      const result = getPlayableCardsForCombat(state, player, combat);

      expect(result.cards).toHaveLength(0);
    });
  });

  describe("Wound cards", () => {
    it("should never allow wound cards to be played", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_RAGE],
      });
      const state = createTestGameState({ players: [player] });
      const combat = createTestCombat(COMBAT_PHASE_ATTACK);

      const result = getPlayableCardsForCombat(state, player, combat);

      const woundCard = result.cards.find(c => c.cardId === CARD_WOUND);
      expect(woundCard).toBeUndefined();

      // But Rage should still be playable
      const rageCard = result.cards.find(c => c.cardId === CARD_RAGE);
      expect(rageCard).toBeDefined();
    });
  });

  describe("Powered effects", () => {
    it("should indicate when powered version has different capabilities", () => {
      // Give player blue crystal so powered effect is available
      const player = createTestPlayer({
        hand: [CARD_DETERMINATION],
        crystals: { red: 0, blue: 1, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });
      const combat = createTestCombat(COMBAT_PHASE_BLOCK);

      const result = getPlayableCardsForCombat(state, player, combat);

      // Determination: basic choice(attack, block), powered block(5)
      // Both have block, and player has mana, so both should be playable
      const determinationCard = result.cards.find(c => c.cardId === CARD_DETERMINATION);
      expect(determinationCard?.canPlayBasic).toBe(true);
      expect(determinationCard?.canPlayPowered).toBe(true);
      expect(determinationCard?.requiredMana).toBe(MANA_BLUE);
    });
  });
});
