/**
 * Tests for Ambush card
 *
 * Ambush (Green Advanced Action):
 * Basic: Move 2. First Attack card gets +1 or first Block card gets +2.
 * Powered: Move 4. First Attack card gets +2 or first Block card gets +4.
 *
 * Key rules:
 * - Bonus applies to the first Attack OR Block card, whichever comes first
 * - Only applies to deed cards (not units or skills)
 * - Sideways attack/block plays trigger the bonus
 * - Diplomacy/Agility do NOT count as Block/Attack cards
 * - One-time: consumed on first use
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import type { ActiveModifier } from "../../types/modifiers.js";
import {
  PLAY_CARD_ACTION,
  PLAY_CARD_SIDEWAYS_ACTION,
  RESOLVE_CHOICE_ACTION,
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  ASSIGN_DAMAGE_ACTION,
  PLAY_SIDEWAYS_AS_ATTACK,
  PLAY_SIDEWAYS_AS_BLOCK,
  PLAY_SIDEWAYS_AS_MOVE,
  CARD_AMBUSH,
  CARD_RAGE,
  CARD_DETERMINATION,
  CARD_MARCH,
  CARD_COUNTERATTACK,
  CARD_PROMISE,
  MANA_GREEN,
  MANA_RED,
  MANA_BLUE,
  MANA_SOURCE_TOKEN,
  MANA_TOKEN_SOURCE_CARD,
  ENEMY_GUARDSMEN,
} from "@mage-knight/shared";
import {
  DURATION_TURN,
  EFFECT_ATTACK_BLOCK_CARD_BONUS,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";
import { COMBAT_PHASE_BLOCK, COMBAT_PHASE_ASSIGN_DAMAGE, COMBAT_PHASE_ATTACK } from "../../types/combat.js";

describe("Ambush", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("movement points", () => {
    it("basic effect grants Move 2", () => {
      const player = createTestPlayer({
        hand: [CARD_AMBUSH],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_AMBUSH,
        powered: false,
      });

      expect(result.state.players[0].movePoints).toBe(2);
    });

    it("powered effect grants Move 4", () => {
      const player = createTestPlayer({
        hand: [CARD_AMBUSH],
        movePoints: 0,
        pureMana: [{ color: MANA_GREEN, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_AMBUSH,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      expect(result.state.players[0].movePoints).toBe(4);
    });
  });

  describe("modifier creation", () => {
    it("basic effect creates attack/block card bonus modifier", () => {
      const player = createTestPlayer({
        hand: [CARD_AMBUSH],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_AMBUSH,
        powered: false,
      });

      const modifier = result.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_ATTACK_BLOCK_CARD_BONUS
      );
      expect(modifier).toBeDefined();
      expect(modifier?.effect).toEqual({
        type: EFFECT_ATTACK_BLOCK_CARD_BONUS,
        attackBonus: 1,
        blockBonus: 2,
      });
      expect(modifier?.duration).toBe(DURATION_TURN);
    });

    it("powered effect creates modifier with higher bonuses", () => {
      const player = createTestPlayer({
        hand: [CARD_AMBUSH],
        movePoints: 0,
        pureMana: [{ color: MANA_GREEN, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_AMBUSH,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      const modifier = result.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_ATTACK_BLOCK_CARD_BONUS
      );
      expect(modifier).toBeDefined();
      expect(modifier?.effect).toEqual({
        type: EFFECT_ATTACK_BLOCK_CARD_BONUS,
        attackBonus: 2,
        blockBonus: 4,
      });
    });
  });

  describe("attack card bonus", () => {
    it("first attack card gets +1 bonus (basic)", () => {
      const player = createTestPlayer({
        hand: [CARD_COUNTERATTACK],
      });

      // Set up state with an active Ambush modifier (basic: +1 attack, +2 block)
      const modifier: ActiveModifier = {
        id: "ambush_bonus",
        source: { type: SOURCE_CARD, cardId: CARD_AMBUSH, playerId: "player1" },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: { type: EFFECT_ATTACK_BLOCK_CARD_BONUS, attackBonus: 1, blockBonus: 2 },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      };

      let state = createTestGameState({
        players: [player],
        activeModifiers: [modifier],
      });

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      }).state;

      // Ranged/Siege → Block
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block → Assign Damage
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ASSIGN_DAMAGE);

      // Assign damage (mandatory)
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      }).state;

      // Assign Damage → Attack
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Play Counterattack (Attack 2) — should get +1 from Ambush = 3
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_COUNTERATTACK,
        powered: false,
      });

      // Attack should be 2 (base) + 1 (Ambush bonus) = 3
      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(3);
      // Modifier should be consumed
      expect(result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_ATTACK_BLOCK_CARD_BONUS
      )).toHaveLength(0);
    });

    it("first attack card gets +2 bonus (powered)", () => {
      const player = createTestPlayer({
        hand: [CARD_COUNTERATTACK],
      });

      const modifier: ActiveModifier = {
        id: "ambush_bonus",
        source: { type: SOURCE_CARD, cardId: CARD_AMBUSH, playerId: "player1" },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: { type: EFFECT_ATTACK_BLOCK_CARD_BONUS, attackBonus: 2, blockBonus: 4 },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      };

      let state = createTestGameState({
        players: [player],
        activeModifiers: [modifier],
      });

      // Enter combat and advance to attack phase
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_COUNTERATTACK,
        powered: false,
      });

      // Attack should be 2 (base) + 2 (Ambush powered bonus) = 4
      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(4);
      expect(result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_ATTACK_BLOCK_CARD_BONUS
      )).toHaveLength(0);
    });
  });

  describe("block card bonus", () => {
    it("first block card gets +2 bonus (basic)", () => {
      const player = createTestPlayer({
        hand: [CARD_DETERMINATION],
        pureMana: [{ color: MANA_BLUE, source: MANA_TOKEN_SOURCE_CARD }],
      });

      const modifier: ActiveModifier = {
        id: "ambush_bonus",
        source: { type: SOURCE_CARD, cardId: CARD_AMBUSH, playerId: "player1" },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: { type: EFFECT_ATTACK_BLOCK_CARD_BONUS, attackBonus: 1, blockBonus: 2 },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      };

      let state = createTestGameState({
        players: [player],
        activeModifiers: [modifier],
      });

      // Enter combat and advance to block phase
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Play Determination powered (Block 5) — should get +2 from Ambush = 7
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DETERMINATION,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      expect(result.state.players[0].combatAccumulator.block).toBe(7);
      expect(result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_ATTACK_BLOCK_CARD_BONUS
      )).toHaveLength(0);
    });

    it("first block card gets +4 bonus (powered)", () => {
      const player = createTestPlayer({
        hand: [CARD_DETERMINATION],
        pureMana: [{ color: MANA_BLUE, source: MANA_TOKEN_SOURCE_CARD }],
      });

      const modifier: ActiveModifier = {
        id: "ambush_bonus",
        source: { type: SOURCE_CARD, cardId: CARD_AMBUSH, playerId: "player1" },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: { type: EFFECT_ATTACK_BLOCK_CARD_BONUS, attackBonus: 2, blockBonus: 4 },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      };

      let state = createTestGameState({
        players: [player],
        activeModifiers: [modifier],
      });

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DETERMINATION,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      // Block should be 5 (base) + 4 (Ambush powered bonus) = 9
      expect(result.state.players[0].combatAccumulator.block).toBe(9);
    });
  });

  describe("one-time consumption", () => {
    it("bonus is consumed after first attack card — second card gets no bonus", () => {
      const player = createTestPlayer({
        hand: [CARD_COUNTERATTACK, CARD_RAGE],
        pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_CARD }],
      });

      const modifier: ActiveModifier = {
        id: "ambush_bonus",
        source: { type: SOURCE_CARD, cardId: CARD_AMBUSH, playerId: "player1" },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: { type: EFFECT_ATTACK_BLOCK_CARD_BONUS, attackBonus: 1, blockBonus: 2 },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      };

      let state = createTestGameState({
        players: [player],
        activeModifiers: [modifier],
      });

      // Enter combat and advance to attack phase
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // First card: Counterattack (Attack 2 + 1 bonus = 3)
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_COUNTERATTACK,
        powered: false,
      }).state;
      expect(state.players[0].combatAccumulator.attack.normal).toBe(3);

      // Second card: Rage powered (Attack 4, no bonus)
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_RAGE,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });
      // Should be 3 (from first card) + 4 (rage powered) = 7 total, no bonus on rage
      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(7);
    });

    it("attack card consumes the bonus so block card gets nothing", () => {
      const player = createTestPlayer({
        hand: [CARD_COUNTERATTACK, CARD_DETERMINATION],
        pureMana: [{ color: MANA_BLUE, source: MANA_TOKEN_SOURCE_CARD }],
      });

      const modifier: ActiveModifier = {
        id: "ambush_bonus",
        source: { type: SOURCE_CARD, cardId: CARD_AMBUSH, playerId: "player1" },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: { type: EFFECT_ATTACK_BLOCK_CARD_BONUS, attackBonus: 1, blockBonus: 2 },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      };

      let state = createTestGameState({
        players: [player],
        activeModifiers: [modifier],
      });

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      }).state;

      // Skip to block phase
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Play Determination powered as block (Block 5 + 2 bonus = 7)
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DETERMINATION,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      }).state;
      expect(state.players[0].combatAccumulator.block).toBe(7);

      // Skip to assign damage phase, assign damage, then advance to attack
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Play Counterattack (Attack 2, no bonus — it was consumed by the block card)
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_COUNTERATTACK,
        powered: false,
      });
      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(2);
    });
  });

  describe("non-combat cards do not consume the bonus", () => {
    it("movement card does not consume the bonus", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_COUNTERATTACK],
        movePoints: 0,
      });

      const modifier: ActiveModifier = {
        id: "ambush_bonus",
        source: { type: SOURCE_CARD, cardId: CARD_AMBUSH, playerId: "player1" },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: { type: EFFECT_ATTACK_BLOCK_CARD_BONUS, attackBonus: 1, blockBonus: 2 },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      };

      let state = createTestGameState({
        players: [player],
        activeModifiers: [modifier],
      });

      // Play March (Move 2) — should not consume the bonus
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: false,
      }).state;

      // Modifier should still be active
      expect(state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_ATTACK_BLOCK_CARD_BONUS
      )).toHaveLength(1);
      expect(state.players[0].movePoints).toBe(2);
    });
  });

  describe("sideways plays trigger the bonus", () => {
    it("sideways attack play triggers attack bonus", () => {
      const player = createTestPlayer({
        hand: [CARD_PROMISE],
      });

      const modifier: ActiveModifier = {
        id: "ambush_bonus",
        source: { type: SOURCE_CARD, cardId: CARD_AMBUSH, playerId: "player1" },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: { type: EFFECT_ATTACK_BLOCK_CARD_BONUS, attackBonus: 1, blockBonus: 2 },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      };

      let state = createTestGameState({
        players: [player],
        activeModifiers: [modifier],
      });

      // Enter combat and advance to attack phase
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Play Promise sideways as Attack 1 — should get +1 from Ambush = 2
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_PROMISE,
        as: PLAY_SIDEWAYS_AS_ATTACK,
      });

      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(2);
      expect(result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_ATTACK_BLOCK_CARD_BONUS
      )).toHaveLength(0);
    });

    it("sideways block play triggers block bonus", () => {
      const player = createTestPlayer({
        hand: [CARD_PROMISE],
      });

      const modifier: ActiveModifier = {
        id: "ambush_bonus",
        source: { type: SOURCE_CARD, cardId: CARD_AMBUSH, playerId: "player1" },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: { type: EFFECT_ATTACK_BLOCK_CARD_BONUS, attackBonus: 1, blockBonus: 2 },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      };

      let state = createTestGameState({
        players: [player],
        activeModifiers: [modifier],
      });

      // Enter combat and advance to block phase
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Play Promise sideways as Block 1 — should get +2 from Ambush = 3
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_PROMISE,
        as: PLAY_SIDEWAYS_AS_BLOCK,
      });

      expect(result.state.players[0].combatAccumulator.block).toBe(3);
      expect(result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_ATTACK_BLOCK_CARD_BONUS
      )).toHaveLength(0);
    });

    it("sideways move play does NOT trigger the bonus", () => {
      const player = createTestPlayer({
        hand: [CARD_PROMISE],
        movePoints: 0,
      });

      const modifier: ActiveModifier = {
        id: "ambush_bonus",
        source: { type: SOURCE_CARD, cardId: CARD_AMBUSH, playerId: "player1" },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: { type: EFFECT_ATTACK_BLOCK_CARD_BONUS, attackBonus: 1, blockBonus: 2 },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      };

      const state = createTestGameState({
        players: [player],
        activeModifiers: [modifier],
      });

      // Play Promise sideways as Move 1 — should NOT trigger bonus
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_PROMISE,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(result.state.players[0].movePoints).toBe(1);
      // Modifier should still be active
      expect(result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_ATTACK_BLOCK_CARD_BONUS
      )).toHaveLength(1);
    });
  });

  describe("choice card interaction", () => {
    it("choice card (Rage basic) triggers bonus when attack is chosen", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE],
      });

      const modifier: ActiveModifier = {
        id: "ambush_bonus",
        source: { type: SOURCE_CARD, cardId: CARD_AMBUSH, playerId: "player1" },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: { type: EFFECT_ATTACK_BLOCK_CARD_BONUS, attackBonus: 1, blockBonus: 2 },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      };

      let state = createTestGameState({
        players: [player],
        activeModifiers: [modifier],
      });

      // Enter combat and advance to attack phase
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Play Rage basic — creates a choice between Attack 2 and Block 2
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_RAGE,
        powered: false,
      }).state;

      expect(state.players[0].pendingChoice).not.toBeNull();

      // Choose Attack (index 0)
      const result = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Attack should be 2 (base) + 1 (Ambush bonus) = 3
      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(3);
      expect(result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_ATTACK_BLOCK_CARD_BONUS
      )).toHaveLength(0);
    });

    it("choice card (Rage basic) triggers block bonus when block is chosen", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE],
      });

      const modifier: ActiveModifier = {
        id: "ambush_bonus",
        source: { type: SOURCE_CARD, cardId: CARD_AMBUSH, playerId: "player1" },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: { type: EFFECT_ATTACK_BLOCK_CARD_BONUS, attackBonus: 1, blockBonus: 2 },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      };

      let state = createTestGameState({
        players: [player],
        activeModifiers: [modifier],
      });

      // Enter combat and advance to block phase
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Play Rage basic — creates a choice between Attack 2 and Block 2
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_RAGE,
        powered: false,
      }).state;

      expect(state.players[0].pendingChoice).not.toBeNull();

      // Choose Block (index 1)
      const result = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      // Block should be 2 (base) + 2 (Ambush bonus) = 4
      expect(result.state.players[0].combatAccumulator.block).toBe(4);
      expect(result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_ATTACK_BLOCK_CARD_BONUS
      )).toHaveLength(0);
    });
  });

  describe("full card flow", () => {
    it("playing Ambush then an attack card applies the bonus end-to-end", () => {
      const player = createTestPlayer({
        hand: [CARD_AMBUSH, CARD_COUNTERATTACK],
        movePoints: 0,
      });
      let state = createTestGameState({ players: [player] });

      // Play Ambush basic (Move 2 + modifier)
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_AMBUSH,
        powered: false,
      }).state;

      expect(state.players[0].movePoints).toBe(2);
      expect(state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_ATTACK_BLOCK_CARD_BONUS
      )).toHaveLength(1);

      // Enter combat and advance to attack phase
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Play Counterattack (Attack 2 + 1 bonus = 3)
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_COUNTERATTACK,
        powered: false,
      });

      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(3);
      expect(result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_ATTACK_BLOCK_CARD_BONUS
      )).toHaveLength(0);
    });
  });
});
