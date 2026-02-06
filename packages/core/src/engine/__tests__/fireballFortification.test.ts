/**
 * Fireball / Firestorm Fortification Playability Tests (#195)
 *
 * Tests that:
 * - Fireball (basic: Ranged Fire Attack 5) cannot be played when all enemies are fortified
 * - Firestorm (powered: Take Wound + Siege Fire Attack 8) CAN be played vs fortified enemies
 * - Fireball basic CAN be played when at least one enemy is not fortified
 * - Firestorm wound cost is always exactly 1 regardless of poison enemies
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  PLAY_CARD_ACTION,
  INVALID_ACTION,
  ENEMY_DIGGERS,
  ENEMY_PROWLERS,
  ENEMY_ORC_WAR_BEASTS,
  CARD_FIREBALL,
  CARD_WOUND,
  MANA_RED,
  MANA_BLACK,
  MANA_TOKEN_SOURCE_CARD,
  MANA_SOURCE_TOKEN,
  TIME_OF_DAY_NIGHT,
} from "@mage-knight/shared";
import { COMBAT_PHASE_RANGED_SIEGE } from "../../types/combat.js";
import type { CardId } from "@mage-knight/shared";
import type { ManaToken } from "../../types/player.js";

/** Helper to create a mana token for tests */
function manaToken(color: string): ManaToken {
  return { color: color as ManaToken["color"], source: MANA_TOKEN_SOURCE_CARD };
}

describe("Fireball / Firestorm Fortification", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("Fireball basic (Ranged Fire Attack 5)", () => {
    it("should NOT be playable when all enemies have ABILITY_FORTIFIED", () => {
      let state = createTestGameState({
        players: [
          createTestPlayer({
            hand: [CARD_FIREBALL],
            pureMana: [manaToken(MANA_RED)],
          }),
        ],
      });

      // Enter combat with Diggers (has ABILITY_FORTIFIED)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      expect(state.combat?.phase).toBe(COMBAT_PHASE_RANGED_SIEGE);

      // Try to play Fireball basic - should fail
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_FIREBALL,
        powered: false,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: expect.stringContaining("fortified"),
        })
      );
    });

    it("should NOT be playable when all enemies are fortified via site", () => {
      let state = createTestGameState({
        players: [
          createTestPlayer({
            hand: [CARD_FIREBALL],
            pureMana: [manaToken(MANA_RED)],
          }),
        ],
      });

      // Enter combat at fortified site with Prowlers (no ABILITY_FORTIFIED, but site grants it)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
        isAtFortifiedSite: true,
      }).state;

      expect(state.combat?.phase).toBe(COMBAT_PHASE_RANGED_SIEGE);

      // Try to play Fireball basic - should fail (site grants fortification)
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_FIREBALL,
        powered: false,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: expect.stringContaining("fortified"),
        })
      );
    });

    it("should be playable when at least one enemy is not fortified", () => {
      let state = createTestGameState({
        players: [
          createTestPlayer({
            hand: [CARD_FIREBALL],
            pureMana: [manaToken(MANA_RED)],
          }),
        ],
      });

      // Enter combat with both Diggers (fortified) and Prowlers (not fortified)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS, ENEMY_PROWLERS],
      }).state;

      expect(state.combat?.phase).toBe(COMBAT_PHASE_RANGED_SIEGE);

      // Play Fireball basic - should succeed (Prowlers are not fortified)
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_FIREBALL,
        powered: false,
      });

      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should be playable at fortified site when enemy has ABILITY_UNFORTIFIED", () => {
      let state = createTestGameState({
        players: [
          createTestPlayer({
            hand: [CARD_FIREBALL],
            pureMana: [manaToken(MANA_RED)],
          }),
        ],
      });

      // Enter combat at fortified site with Orc War Beasts (ABILITY_UNFORTIFIED)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC_WAR_BEASTS],
        isAtFortifiedSite: true,
      }).state;

      expect(state.combat?.phase).toBe(COMBAT_PHASE_RANGED_SIEGE);

      // Play Fireball basic - should succeed (Orc War Beasts are unfortified)
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_FIREBALL,
        powered: false,
      });

      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should be playable against non-fortified enemies", () => {
      let state = createTestGameState({
        players: [
          createTestPlayer({
            hand: [CARD_FIREBALL],
            pureMana: [manaToken(MANA_RED)],
          }),
        ],
      });

      // Enter combat with Prowlers (not fortified)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      expect(state.combat?.phase).toBe(COMBAT_PHASE_RANGED_SIEGE);

      // Play Fireball basic - should succeed
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_FIREBALL,
        powered: false,
      });

      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("Firestorm powered (Take Wound + Siege Fire Attack 8)", () => {
    it("should be playable when all enemies are fortified (has siege)", () => {
      let state = createTestGameState({
        timeOfDay: TIME_OF_DAY_NIGHT, // Night so black mana is usable
        players: [
          createTestPlayer({
            hand: [CARD_FIREBALL],
            // Need mana tokens for powered spell: black + red
            pureMana: [manaToken(MANA_BLACK), manaToken(MANA_RED)],
          }),
        ],
      });

      // Enter combat with Diggers (fortified)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      expect(state.combat?.phase).toBe(COMBAT_PHASE_RANGED_SIEGE);

      // Play Firestorm (powered) - should succeed because it provides Siege Attack
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_FIREBALL,
        powered: true,
      });

      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: expect.stringContaining("fortified"),
        })
      );
    });
  });

  describe("Firestorm wound cost", () => {
    it("should take exactly 1 wound when powered", () => {
      let state = createTestGameState({
        timeOfDay: TIME_OF_DAY_NIGHT, // Night so black mana is usable
        players: [
          createTestPlayer({
            hand: [CARD_FIREBALL],
            pureMana: [manaToken(MANA_BLACK), manaToken(MANA_RED)],
          }),
        ],
      });

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      const handBefore = state.players[0]?.hand ?? [];
      const woundsBefore = handBefore.filter(c => c === CARD_WOUND).length;

      // Play Firestorm (powered) - must provide manaSources for spell powered
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_FIREBALL,
        powered: true,
        manaSources: [
          { type: MANA_SOURCE_TOKEN, color: MANA_BLACK },
          { type: MANA_SOURCE_TOKEN, color: MANA_RED },
        ],
      });

      // Verify no INVALID_ACTION was returned
      expect(result.events).not.toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );

      const handAfter = result.state.players[0]?.hand ?? [];
      const woundsAfter = handAfter.filter((c: CardId) => c === CARD_WOUND).length;

      // Should have exactly 1 more wound (casting cost)
      expect(woundsAfter - woundsBefore).toBe(1);
    });
  });
});
