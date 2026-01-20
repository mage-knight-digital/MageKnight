/**
 * Tests for getPlayableCardsForCombat
 *
 * Validates that cards are correctly identified as playable during each combat phase.
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { getPlayableCardsForCombat, getPlayableCardsForNormalTurn } from "../validActions/cards/index.js";
import {
  CARD_RAGE,
  CARD_DETERMINATION,
  CARD_SWIFTNESS,
  CARD_MARCH,
  CARD_STAMINA,
  CARD_PROMISE,
  CARD_WOUND,
  CARD_IMPROVISATION,
  CARD_CRYSTALLIZE,
  CARD_WHIRLWIND,
  PLAY_SIDEWAYS_AS_ATTACK,
  PLAY_SIDEWAYS_AS_BLOCK,
  MANA_BLUE,
  MANA_WHITE,
  MANA_BLACK,
  MANA_GOLD,
  MANA_GREEN,
  TIME_OF_DAY_NIGHT,
} from "@mage-knight/shared";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
} from "../../types/combat.js";
import type { CombatState } from "../../types/combat.js";
import type { EnemyTokenId } from "../../types/enemy.js";

function createTestCombat(phase: CombatState["phase"], withEnemy = false): CombatState {
  return {
    phase,
    enemies: withEnemy ? [{
      instanceId: "enemy_0",
      definition: {
        id: "orc" as EnemyTokenId,
        name: "Orc",
        attack: 4,
        armor: 3,
        fame: 2,
        abilities: [],
        resistances: [],
      },
      isDefeated: false,
      isBlocked: false,
      damageAssigned: 0,
      modifiers: [],
    }] : [],
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

  describe("Effect resolvability in combat", () => {
    it("should NOT allow Crystallize when no mana is available at all", () => {
      // Crystallize basic effect converts mana to crystal
      // Without any mana (no tokens, no crystals, no source dice, already used source)
      // it should NOT be playable
      const player = createTestPlayer({
        hand: [CARD_CRYSTALLIZE],
        pureMana: [], // No mana tokens
        crystals: { red: 0, blue: 0, green: 0, white: 0 }, // No crystals
        usedManaFromSource: true, // Already used source this turn
      });
      // State with no available dice in source
      const state = createTestGameState({
        players: [player],
        source: {
          dice: [], // No dice available
        },
      });
      const combat = createTestCombat(COMBAT_PHASE_ATTACK);

      const result = getPlayableCardsForCombat(state, player, combat);

      // Crystallize can't be played basic without any mana source
      const crystallizeCard = result.cards.find(c => c.cardId === CARD_CRYSTALLIZE);
      // Card might still appear for sideways play, but basic should be false
      if (crystallizeCard) {
        expect(crystallizeCard.canPlayBasic).toBe(false);
      }
    });

    it("should allow Crystallize when player has mana tokens", () => {
      // Crystallize basic effect converts mana to crystal
      // With mana tokens, it should be playable
      const player = createTestPlayer({
        hand: [CARD_CRYSTALLIZE],
        pureMana: [{ color: "red", source: "card" }], // Has mana to convert
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });
      const combat = createTestCombat(COMBAT_PHASE_ATTACK);

      const result = getPlayableCardsForCombat(state, player, combat);

      const crystallizeCard = result.cards.find(c => c.cardId === CARD_CRYSTALLIZE);
      expect(crystallizeCard).toBeDefined();
      expect(crystallizeCard?.canPlayBasic).toBe(true);
    });

    it("should allow Crystallize when player can use mana from source", () => {
      // Crystallize should be playable if player hasn't used mana from source
      // and there's an available die (even without mana tokens)
      const player = createTestPlayer({
        hand: [CARD_CRYSTALLIZE],
        pureMana: [], // No mana tokens
        crystals: { red: 0, blue: 0, green: 0, white: 0 }, // No crystals to convert
        usedManaFromSource: false, // Can still use source
      });
      const state = createTestGameState({
        players: [player],
        source: {
          dice: [
            { id: "die1", color: "red", takenByPlayerId: null, isDepleted: false },
          ],
        },
      });
      const combat = createTestCombat(COMBAT_PHASE_ATTACK);

      const result = getPlayableCardsForCombat(state, player, combat);

      const crystallizeCard = result.cards.find(c => c.cardId === CARD_CRYSTALLIZE);
      expect(crystallizeCard).toBeDefined();
      expect(crystallizeCard?.canPlayBasic).toBe(true);
    });

    it("should allow Crystallize when player has crystals to convert", () => {
      // Crystallize should be playable if player has crystals they can convert to tokens
      const player = createTestPlayer({
        hand: [CARD_CRYSTALLIZE],
        pureMana: [], // No mana tokens
        crystals: { red: 1, blue: 0, green: 0, white: 0 }, // Has a crystal
        usedManaFromSource: true, // Already used source
      });
      const state = createTestGameState({
        players: [player],
        source: {
          dice: [], // No dice available
        },
      });
      const combat = createTestCombat(COMBAT_PHASE_ATTACK);

      const result = getPlayableCardsForCombat(state, player, combat);

      const crystallizeCard = result.cards.find(c => c.cardId === CARD_CRYSTALLIZE);
      expect(crystallizeCard).toBeDefined();
      expect(crystallizeCard?.canPlayBasic).toBe(true);
    });

    it("should NOT allow Crystallize when source has only gold/black dice at wrong time", () => {
      // Gold dice are available during day, but black dice are depleted during day
      // Crystallize needs a basic color mana source
      const player = createTestPlayer({
        hand: [CARD_CRYSTALLIZE],
        pureMana: [], // No mana tokens
        crystals: { red: 0, blue: 0, green: 0, white: 0 }, // No crystals
        usedManaFromSource: false, // Can use source
      });
      const state = createTestGameState({
        players: [player],
        source: {
          dice: [
            // Black die is depleted during day (default timeOfDay is day)
            { id: "die1", color: MANA_BLACK, takenByPlayerId: null, isDepleted: true },
          ],
        },
      });
      const combat = createTestCombat(COMBAT_PHASE_ATTACK);

      const result = getPlayableCardsForCombat(state, player, combat);

      // Can't crystallize - black die is depleted
      const crystallizeCard = result.cards.find(c => c.cardId === CARD_CRYSTALLIZE);
      if (crystallizeCard) {
        expect(crystallizeCard.canPlayBasic).toBe(false);
      }
    });

    it("should allow Crystallize when source has gold die (can be any basic color)", () => {
      // Gold die can be used as any basic color
      const player = createTestPlayer({
        hand: [CARD_CRYSTALLIZE],
        pureMana: [], // No mana tokens
        crystals: { red: 0, blue: 0, green: 0, white: 0 }, // No crystals
        usedManaFromSource: false, // Can use source
      });
      const state = createTestGameState({
        players: [player],
        source: {
          dice: [
            { id: "die1", color: MANA_GOLD, takenByPlayerId: null, isDepleted: false },
          ],
        },
      });
      const combat = createTestCombat(COMBAT_PHASE_ATTACK);

      const result = getPlayableCardsForCombat(state, player, combat);

      const crystallizeCard = result.cards.find(c => c.cardId === CARD_CRYSTALLIZE);
      expect(crystallizeCard).toBeDefined();
      expect(crystallizeCard?.canPlayBasic).toBe(true);
    });
  });

  describe("Spell mana requirements for basic effect", () => {
    it("should not show spell as playable basic without the spell's color mana", () => {
      // Whirlwind is a white spell - requires white mana even for basic effect
      const player = createTestPlayer({
        hand: [CARD_WHIRLWIND],
        crystals: { red: 0, blue: 0, green: 0, white: 0 }, // No mana
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });
      const combat = createTestCombat(COMBAT_PHASE_RANGED_SIEGE);

      const result = getPlayableCardsForCombat(state, player, combat);

      const whirlwindCard = result.cards.find(c => c.cardId === CARD_WHIRLWIND);
      // Without mana, spell won't appear in playable cards at all (can't play any way)
      // OR if it appears, canPlayBasic should be false
      expect(whirlwindCard === undefined || whirlwindCard.canPlayBasic === false).toBe(true);
    });

    it("should show spell as playable basic with the spell's color mana", () => {
      // Whirlwind is a white spell - requires white mana for basic effect
      const player = createTestPlayer({
        hand: [CARD_WHIRLWIND],
        crystals: { red: 0, blue: 0, green: 0, white: 1 }, // Has white crystal
        pureMana: [],
      });
      // Need enemy for Whirlwind to target - combat must be in state for isEffectResolvable
      const combat = createTestCombat(COMBAT_PHASE_RANGED_SIEGE, true);
      const state = createTestGameState({ players: [player], combat });

      const result = getPlayableCardsForCombat(state, player, combat);

      const whirlwindCard = result.cards.find(c => c.cardId === CARD_WHIRLWIND);
      // Should be playable basic with white mana
      expect(whirlwindCard?.canPlayBasic).toBe(true);
    });

    it("should show spell as playable powered only with black + color mana", () => {
      // Whirlwind powered requires black + white
      const player = createTestPlayer({
        hand: [CARD_WHIRLWIND],
        crystals: { red: 0, blue: 0, green: 0, white: 1 }, // Only white, no black
        pureMana: [],
      });
      // Need enemy for Whirlwind to target - combat must be in state for isEffectResolvable
      const combat = createTestCombat(COMBAT_PHASE_ATTACK, true); // Powered requires attack phase
      const state = createTestGameState({ players: [player], combat });

      const result = getPlayableCardsForCombat(state, player, combat);

      const whirlwindCard = result.cards.find(c => c.cardId === CARD_WHIRLWIND);
      // Should NOT be playable powered without black mana
      expect(whirlwindCard?.canPlayPowered).toBe(false);
    });

    it("should show spell as playable powered with black + color mana", () => {
      // Whirlwind powered requires black + white
      const player = createTestPlayer({
        hand: [CARD_WHIRLWIND],
        crystals: { red: 0, blue: 0, green: 0, white: 1 }, // White crystal
        pureMana: [{ color: MANA_BLACK, source: "die" as const }], // Black mana token
      });
      // Need enemy for Whirlwind to target - combat must be in state for isEffectResolvable
      const combat = createTestCombat(COMBAT_PHASE_ATTACK, true); // Powered requires attack phase
      const state = createTestGameState({ players: [player], combat });

      const result = getPlayableCardsForCombat(state, player, combat);

      const whirlwindCard = result.cards.find(c => c.cardId === CARD_WHIRLWIND);
      // Should be playable powered with both mana sources
      expect(whirlwindCard?.canPlayPowered).toBe(true);
    });
  });

  describe("Black mana is NOT wild (bug regression tests)", () => {
    // These tests verify that black mana is NOT treated as a wildcard.
    // Black mana can ONLY be used to power spells (as part of the black + color requirement).
    // It should NOT enable canPlayPowered for action cards.

    it("should NOT show canPlayPowered when only black token available for action card", () => {
      // BUG TEST: If player only has black mana token, they should NOT be able to power March
      // Black is NOT a wildcard - it can only be used for spells
      const player = createTestPlayer({
        hand: [CARD_MARCH], // Green card - needs green mana
        crystals: { red: 0, blue: 0, green: 0, white: 0 }, // No crystals
        pureMana: [{ color: MANA_BLACK, source: "die" as const }], // Only black token
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT, // Night so black is usable (for spells)
      });

      const result = getPlayableCardsForNormalTurn(state, player);

      const marchCard = result.cards.find(c => c.cardId === CARD_MARCH);
      // March should NOT have canPlayPowered=true because black cannot substitute for green
      expect(marchCard?.canPlayPowered).toBe(false);
    });

    it("should NOT show canPlayPowered when only black die available for action card", () => {
      // BUG TEST: Black die should not enable powered play for action cards
      const player = createTestPlayer({
        hand: [CARD_RAGE], // Red card - needs red mana
        crystals: { red: 0, blue: 0, green: 0, white: 0 }, // No crystals
        pureMana: [], // No tokens
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
        source: {
          dice: [
            { id: "die_0", color: MANA_BLACK, isDepleted: false, takenByPlayerId: null },
          ],
        },
      });

      const result = getPlayableCardsForNormalTurn(state, player);

      const rageCard = result.cards.find(c => c.cardId === CARD_RAGE);
      // Rage should NOT have canPlayPowered=true because black cannot substitute for red
      expect(rageCard?.canPlayPowered).toBe(false);
    });

    it("should show canPlayPowered when correct color mana available (control test)", () => {
      // Control test: verify green mana DOES enable powered for March
      const player = createTestPlayer({
        hand: [CARD_MARCH], // Green card
        crystals: { red: 0, blue: 0, green: 1, white: 0 }, // Green crystal available
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      const result = getPlayableCardsForNormalTurn(state, player);

      const marchCard = result.cards.find(c => c.cardId === CARD_MARCH);
      // March SHOULD be playable powered with green mana
      expect(marchCard?.canPlayPowered).toBe(true);
      expect(marchCard?.requiredMana).toBe(MANA_GREEN);
    });
  });
});
