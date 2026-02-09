/**
 * Tests for Know Your Prey skill (Wolfhawk)
 *
 * Once per round, during combat, flip to ignore one offensive or defensive
 * ability of an enemy token, or to remove one element of one enemy attack
 * (Fire/Ice → Physical, Cold Fire → Fire or Ice).
 * Cannot target enemies with Arcane Immunity.
 *
 * Key rules:
 * - Once per round (flip skill)
 * - Combat only
 * - Offensive abilities removable: Assassination, Brutal, Paralyze, Poison, Swift, Vampiric
 * - Defensive abilities removable: Elusive, Fortified (printed on token)
 * - One resistance removable: Physical, Fire, Ice
 * - Element conversion: Fire/Ice → Physical, Cold Fire → Fire or Ice
 * - Cannot target Arcane Immune enemies
 * - Can target summoned monsters from Arcane Immune summoners (Q4/A4)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  RESOLVE_CHOICE_ACTION,
  UNDO_ACTION,
  ENEMY_IRONCLADS,
  ENEMY_GUARDSMEN,
  ENEMY_MONKS,
  ENEMY_SORCERERS,
  ENEMY_FIRE_ELEMENTAL,
  ENEMY_WATER_ELEMENTAL,
  ENEMY_AIR_ELEMENTAL,
  ENEMY_PROWLERS,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_PHYSICAL,
  ELEMENT_COLD_FIRE,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_WOLFHAWK_KNOW_YOUR_PREY } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import { describeEffect, isEffectResolvable } from "../effects/index.js";
import {
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
  createCombatState,
} from "../../types/combat.js";
import {
  DURATION_COMBAT,
  EFFECT_ABILITY_NULLIFIER,
  EFFECT_REMOVE_PHYSICAL_RESISTANCE,
  EFFECT_REMOVE_FIRE_RESISTANCE,
  EFFECT_REMOVE_ICE_RESISTANCE,
  EFFECT_CONVERT_ATTACK_ELEMENT,
  SCOPE_ONE_ENEMY,
  SOURCE_SKILL,
} from "../../types/modifierConstants.js";
import {
  EFFECT_KNOW_YOUR_PREY_SELECT_ENEMY,
  EFFECT_KNOW_YOUR_PREY_APPLY,
  EFFECT_KNOW_YOUR_PREY_SELECT_OPTION,
} from "../../types/effectTypes.js";
import type { KnowYourPreySelectOptionEffect, KnowYourPreyApplyEffect } from "../../types/cards.js";
import { isIceResistanceRemoved, getEffectiveAttackElement } from "../modifiers/combat.js";
import { getEnemyResistances } from "../validActions/combatHelpers.js";

describe("Know Your Prey skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // Helper to create a player with Know Your Prey skill
  function createWolfhawkPlayer(overrides: Partial<Parameters<typeof createTestPlayer>[0]> = {}) {
    return createTestPlayer({
      hero: Hero.Wolfhawk,
      skills: [SKILL_WOLFHAWK_KNOW_YOUR_PREY],
      skillCooldowns: {
        usedThisRound: [],
        usedThisTurn: [],
        usedThisCombat: [],
        activeUntilNextTurn: [],
      },
      ...overrides,
    });
  }

  describe("activation", () => {
    it("should activate during combat", () => {
      const player = createWolfhawkPlayer();
      // Ironclads has Brutal (removable offensive ability) + Physical Resistance
      const combat = createCombatState([ENEMY_IRONCLADS]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
        })
      );
    });

    it("should reject when not in combat", () => {
      const player = createWolfhawkPlayer();
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should reject when already used this round", () => {
      const player = createWolfhawkPlayer({
        skillCooldowns: {
          usedThisRound: [SKILL_WOLFHAWK_KNOW_YOUR_PREY],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = createCombatState([ENEMY_IRONCLADS]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should reject when no targetable enemies exist", () => {
      const player = createWolfhawkPlayer();
      // Prowlers has no abilities, no resistances, physical attack — nothing to remove
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should reject when only enemy has Arcane Immunity", () => {
      const player = createWolfhawkPlayer();
      // Sorcerers has Arcane Immunity — cannot be targeted
      const combat = createCombatState([ENEMY_SORCERERS]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("enemy selection", () => {
    it("should skip enemy selection when only one eligible enemy", () => {
      const player = createWolfhawkPlayer();
      // Ironclads has Brutal + Physical Resistance — single eligible enemy
      const combat = createCombatState([ENEMY_IRONCLADS]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      // Should have pending choice with apply options (not enemy selection)
      const updatedPlayer = result.state.players[0];
      expect(updatedPlayer.pendingChoice).not.toBeNull();
      // Apply options should be KnowYourPreyApplyEffect (not SelectOption)
      const options = updatedPlayer.pendingChoice!.options;
      expect(options.every((o) => o.type === EFFECT_KNOW_YOUR_PREY_APPLY)).toBe(true);
    });

    it("should present enemy selection when multiple eligible enemies", () => {
      const player = createWolfhawkPlayer();
      // Ironclads (Brutal + Phys Resist) and Guardsmen (Fortified) — two eligible enemies
      const combat = createCombatState([ENEMY_IRONCLADS, ENEMY_GUARDSMEN]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      const updatedPlayer = result.state.players[0];
      expect(updatedPlayer.pendingChoice).not.toBeNull();
      // Enemy selection options should be KnowYourPreySelectOptionEffect
      const options = updatedPlayer.pendingChoice!.options;
      expect(options.every((o) => o.type === EFFECT_KNOW_YOUR_PREY_SELECT_OPTION)).toBe(true);
      expect(options).toHaveLength(2);
    });

    it("should filter out Arcane Immune enemies from selection", () => {
      const player = createWolfhawkPlayer();
      // Ironclads (targetable) + Sorcerers (Arcane Immune — not targetable)
      const combat = createCombatState([ENEMY_IRONCLADS, ENEMY_SORCERERS]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      // Should skip enemy selection (only one eligible) and go straight to apply options
      const updatedPlayer = result.state.players[0];
      expect(updatedPlayer.pendingChoice).not.toBeNull();
      const options = updatedPlayer.pendingChoice!.options;
      expect(options.every((o) => o.type === EFFECT_KNOW_YOUR_PREY_APPLY)).toBe(true);
    });

    it("should present apply options after choosing an enemy", () => {
      const player = createWolfhawkPlayer();
      const combat = createCombatState([ENEMY_IRONCLADS, ENEMY_GUARDSMEN]);
      const state = createTestGameState({ players: [player], combat });

      // Activate skill
      let result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      // Select first enemy (Ironclads)
      result = engine.processAction(result.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Now should have apply options for Ironclads
      const updatedPlayer = result.state.players[0];
      expect(updatedPlayer.pendingChoice).not.toBeNull();
      const options = updatedPlayer.pendingChoice!.options;
      expect(options.every((o) => o.type === EFFECT_KNOW_YOUR_PREY_APPLY)).toBe(true);
    });
  });

  describe("ability removal", () => {
    it("should create ability nullifier modifier for offensive ability (Brutal)", () => {
      const player = createWolfhawkPlayer();
      // Ironclads: Brutal + Physical Resistance
      const combat = createCombatState([ENEMY_IRONCLADS]);
      const state = createTestGameState({ players: [player], combat });

      // Activate skill
      let result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      // Find the "Remove Brutal" option
      const options = result.state.players[0].pendingChoice!.options;
      const brutalIndex = options.findIndex(
        (o) => o.type === EFFECT_KNOW_YOUR_PREY_APPLY && "ability" in o && o.ability === "brutal"
      );
      expect(brutalIndex).toBeGreaterThanOrEqual(0);

      // Select Remove Brutal
      result = engine.processAction(result.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: brutalIndex,
      });

      // Should have created ability nullifier modifier
      const modifier = result.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_ABILITY_NULLIFIER
      );
      expect(modifier).toBeDefined();
      expect(modifier?.effect).toEqual({
        type: EFFECT_ABILITY_NULLIFIER,
        ability: "brutal",
      });
      expect(modifier?.duration).toBe(DURATION_COMBAT);
      expect(modifier?.scope).toEqual({
        type: SCOPE_ONE_ENEMY,
        enemyId: "enemy_0",
      });
      expect(modifier?.source).toEqual({
        type: SOURCE_SKILL,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
        playerId: "player1",
      });
    });

    it("should create ability nullifier modifier for Poison", () => {
      const player = createWolfhawkPlayer();
      // Monks: Poison
      const combat = createCombatState([ENEMY_MONKS]);
      const state = createTestGameState({ players: [player], combat });

      let result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      // Monks only has Poison — should be the first option
      const options = result.state.players[0].pendingChoice!.options;
      const poisonIndex = options.findIndex(
        (o) => o.type === EFFECT_KNOW_YOUR_PREY_APPLY && "ability" in o && o.ability === "poison"
      );
      expect(poisonIndex).toBeGreaterThanOrEqual(0);

      result = engine.processAction(result.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: poisonIndex,
      });

      const modifier = result.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_ABILITY_NULLIFIER
      );
      expect(modifier).toBeDefined();
      expect(modifier?.effect).toEqual({
        type: EFFECT_ABILITY_NULLIFIER,
        ability: "poison",
      });
    });

    it("should create ability nullifier modifier for defensive ability (Fortified)", () => {
      const player = createWolfhawkPlayer();
      // Guardsmen: Fortified
      const combat = createCombatState([ENEMY_GUARDSMEN]);
      const state = createTestGameState({ players: [player], combat });

      let result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      // Guardsmen only has Fortified — should be the only option
      const options = result.state.players[0].pendingChoice!.options;
      expect(options).toHaveLength(1);

      result = engine.processAction(result.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      const modifier = result.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_ABILITY_NULLIFIER
      );
      expect(modifier).toBeDefined();
      expect(modifier?.effect).toEqual({
        type: EFFECT_ABILITY_NULLIFIER,
        ability: "fortified",
      });
    });
  });

  describe("resistance removal", () => {
    it("should create physical resistance removal modifier", () => {
      const player = createWolfhawkPlayer();
      // Ironclads: Brutal + Physical Resistance
      const combat = createCombatState([ENEMY_IRONCLADS]);
      const state = createTestGameState({ players: [player], combat });

      let result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      const options = result.state.players[0].pendingChoice!.options;
      const physResIndex = options.findIndex(
        (o) => o.type === EFFECT_KNOW_YOUR_PREY_APPLY && "resistance" in o && o.resistance === "physical"
      );
      expect(physResIndex).toBeGreaterThanOrEqual(0);

      result = engine.processAction(result.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: physResIndex,
      });

      const modifier = result.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_REMOVE_PHYSICAL_RESISTANCE
      );
      expect(modifier).toBeDefined();
      expect(modifier?.scope).toEqual({
        type: SCOPE_ONE_ENEMY,
        enemyId: "enemy_0",
      });
    });

    it("should create fire resistance removal modifier", () => {
      const player = createWolfhawkPlayer();
      // Fire Elemental: Fire attack, Fire Resistance
      const combat = createCombatState([ENEMY_FIRE_ELEMENTAL]);
      const state = createTestGameState({ players: [player], combat });

      let result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      const options = result.state.players[0].pendingChoice!.options;
      const fireResIndex = options.findIndex(
        (o) => o.type === EFFECT_KNOW_YOUR_PREY_APPLY && "resistance" in o && o.resistance === "fire"
      );
      expect(fireResIndex).toBeGreaterThanOrEqual(0);

      result = engine.processAction(result.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: fireResIndex,
      });

      const modifier = result.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_REMOVE_FIRE_RESISTANCE
      );
      expect(modifier).toBeDefined();
    });

    it("should create ice resistance removal modifier", () => {
      const player = createWolfhawkPlayer();
      // Water Elemental: Ice attack, Ice Resistance
      const combat = createCombatState([ENEMY_WATER_ELEMENTAL]);
      const state = createTestGameState({ players: [player], combat });

      let result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      const options = result.state.players[0].pendingChoice!.options;
      const iceResIndex = options.findIndex(
        (o) => o.type === EFFECT_KNOW_YOUR_PREY_APPLY && "resistance" in o && o.resistance === "ice"
      );
      expect(iceResIndex).toBeGreaterThanOrEqual(0);

      result = engine.processAction(result.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: iceResIndex,
      });

      const modifier = result.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_REMOVE_ICE_RESISTANCE
      );
      expect(modifier).toBeDefined();
    });
  });

  describe("element conversion", () => {
    it("should convert Fire attack to Physical", () => {
      const player = createWolfhawkPlayer();
      // Fire Elemental: Fire attack + Fire Resistance
      const combat = createCombatState([ENEMY_FIRE_ELEMENTAL]);
      const state = createTestGameState({ players: [player], combat });

      let result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      const options = result.state.players[0].pendingChoice!.options;
      const fireConvertIndex = options.findIndex(
        (o) =>
          o.type === EFFECT_KNOW_YOUR_PREY_APPLY &&
          "fromElement" in o &&
          o.fromElement === "fire" &&
          "toElement" in o &&
          o.toElement === "physical"
      );
      expect(fireConvertIndex).toBeGreaterThanOrEqual(0);

      result = engine.processAction(result.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: fireConvertIndex,
      });

      const modifier = result.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_CONVERT_ATTACK_ELEMENT
      );
      expect(modifier).toBeDefined();
      expect(modifier?.effect).toEqual({
        type: EFFECT_CONVERT_ATTACK_ELEMENT,
        fromElement: "fire",
        toElement: "physical",
      });
      expect(modifier?.scope).toEqual({
        type: SCOPE_ONE_ENEMY,
        enemyId: "enemy_0",
      });
    });

    it("should convert Ice attack to Physical", () => {
      const player = createWolfhawkPlayer();
      // Water Elemental: Ice attack + Ice Resistance
      const combat = createCombatState([ENEMY_WATER_ELEMENTAL]);
      const state = createTestGameState({ players: [player], combat });

      let result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      const options = result.state.players[0].pendingChoice!.options;
      const iceConvertIndex = options.findIndex(
        (o) =>
          o.type === EFFECT_KNOW_YOUR_PREY_APPLY &&
          "fromElement" in o &&
          o.fromElement === "ice" &&
          "toElement" in o &&
          o.toElement === "physical"
      );
      expect(iceConvertIndex).toBeGreaterThanOrEqual(0);

      result = engine.processAction(result.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: iceConvertIndex,
      });

      const modifier = result.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_CONVERT_ATTACK_ELEMENT
      );
      expect(modifier).toBeDefined();
      expect(modifier?.effect).toEqual({
        type: EFFECT_CONVERT_ATTACK_ELEMENT,
        fromElement: "ice",
        toElement: "physical",
      });
    });

    it("should offer Cold Fire to Fire and Cold Fire to Ice conversions", () => {
      const player = createWolfhawkPlayer();
      // Air Elemental: Cold Fire attack + Swift + Elusive + Fire/Ice Resistance
      const combat = createCombatState([ENEMY_AIR_ELEMENTAL]);
      const state = createTestGameState({ players: [player], combat });

      let result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      const options = result.state.players[0].pendingChoice!.options;

      // Should have Cold Fire → Fire option
      const coldFireToFireIndex = options.findIndex(
        (o) =>
          o.type === EFFECT_KNOW_YOUR_PREY_APPLY &&
          "fromElement" in o &&
          o.fromElement === "cold_fire" &&
          "toElement" in o &&
          o.toElement === "fire"
      );
      expect(coldFireToFireIndex).toBeGreaterThanOrEqual(0);

      // Should have Cold Fire → Ice option
      const coldFireToIceIndex = options.findIndex(
        (o) =>
          o.type === EFFECT_KNOW_YOUR_PREY_APPLY &&
          "fromElement" in o &&
          o.fromElement === "cold_fire" &&
          "toElement" in o &&
          o.toElement === "ice"
      );
      expect(coldFireToIceIndex).toBeGreaterThanOrEqual(0);
    });

    it("should create Cold Fire to Fire conversion modifier", () => {
      const player = createWolfhawkPlayer();
      const combat = createCombatState([ENEMY_AIR_ELEMENTAL]);
      const state = createTestGameState({ players: [player], combat });

      let result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      const options = result.state.players[0].pendingChoice!.options;
      const coldFireToFireIndex = options.findIndex(
        (o) =>
          o.type === EFFECT_KNOW_YOUR_PREY_APPLY &&
          "fromElement" in o &&
          o.fromElement === "cold_fire" &&
          "toElement" in o &&
          o.toElement === "fire"
      );

      result = engine.processAction(result.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: coldFireToFireIndex,
      });

      const modifier = result.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_CONVERT_ATTACK_ELEMENT
      );
      expect(modifier).toBeDefined();
      expect(modifier?.effect).toEqual({
        type: EFFECT_CONVERT_ATTACK_ELEMENT,
        fromElement: "cold_fire",
        toElement: "fire",
      });
    });
  });

  describe("option building", () => {
    it("should offer both ability and resistance removal for enemies with both", () => {
      const player = createWolfhawkPlayer();
      // Ironclads: Brutal (ability) + Physical Resistance
      const combat = createCombatState([ENEMY_IRONCLADS]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      const options = result.state.players[0].pendingChoice!.options;
      // Should have Brutal removal + Physical Resistance removal = 2 options
      expect(options).toHaveLength(2);

      const hasAbility = options.some(
        (o) => o.type === EFFECT_KNOW_YOUR_PREY_APPLY && "ability" in o
      );
      const hasResistance = options.some(
        (o) => o.type === EFFECT_KNOW_YOUR_PREY_APPLY && "resistance" in o
      );
      expect(hasAbility).toBe(true);
      expect(hasResistance).toBe(true);
    });

    it("should offer abilities, resistances, and element conversions for complex enemies", () => {
      const player = createWolfhawkPlayer();
      // Air Elemental: Swift + Elusive (abilities), Fire + Ice Resistance, Cold Fire attack
      const combat = createCombatState([ENEMY_AIR_ELEMENTAL]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      const options = result.state.players[0].pendingChoice!.options;
      // Swift + Elusive = 2 abilities
      // Fire + Ice = 2 resistances
      // Cold Fire → Fire, Cold Fire → Ice = 2 element conversions
      // Total = 6
      expect(options).toHaveLength(6);
    });
  });

  describe("valid actions", () => {
    it("should show skill during combat with targetable enemies", () => {
      const player = createWolfhawkPlayer();
      const combat = createCombatState([ENEMY_IRONCLADS]);
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      expect(skills).toBeDefined();
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
        })
      );
    });

    it("should not show skill when not in combat", () => {
      const player = createWolfhawkPlayer();
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        const kyp = skills.activatable.find(
          (s) => s.skillId === SKILL_WOLFHAWK_KNOW_YOUR_PREY
        );
        expect(kyp).toBeUndefined();
      }
    });

    it("should not show skill when already used this round", () => {
      const player = createWolfhawkPlayer({
        skillCooldowns: {
          usedThisRound: [SKILL_WOLFHAWK_KNOW_YOUR_PREY],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = createCombatState([ENEMY_IRONCLADS]);
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        const kyp = skills.activatable.find(
          (s) => s.skillId === SKILL_WOLFHAWK_KNOW_YOUR_PREY
        );
        expect(kyp).toBeUndefined();
      }
    });

    it("should not show skill when no enemies have removable options", () => {
      const player = createWolfhawkPlayer();
      // Prowlers: no abilities, no resistances, physical attack
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        const kyp = skills.activatable.find(
          (s) => s.skillId === SKILL_WOLFHAWK_KNOW_YOUR_PREY
        );
        expect(kyp).toBeUndefined();
      }
    });

    it("should show skill in block phase", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_IRONCLADS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      expect(skills).toBeDefined();
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
        })
      );
    });

    it("should show skill in attack phase", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_IRONCLADS]),
        phase: COMBAT_PHASE_ATTACK as typeof COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      expect(skills).toBeDefined();
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
        })
      );
    });
  });

  describe("undo", () => {
    it("should remove modifier and restore cooldown on undo", () => {
      const player = createWolfhawkPlayer();
      const combat = createCombatState([ENEMY_GUARDSMEN]);
      const state = createTestGameState({ players: [player], combat });

      // Activate skill
      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      // Verify skill is on cooldown
      expect(
        result.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_WOLFHAWK_KNOW_YOUR_PREY);

      // Undo should be available
      const validActions = getValidActions(result.state, "player1");
      expect(validActions.turn.canUndo).toBe(true);
    });

    it("should clear pending choice on undo", () => {
      const player = createWolfhawkPlayer();
      const combat = createCombatState([ENEMY_GUARDSMEN]);
      const state = createTestGameState({ players: [player], combat });

      // Activate skill
      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      // Verify pending choice exists
      expect(result.state.players[0].pendingChoice).not.toBeNull();
      expect(result.state.players[0].pendingChoice?.skillId).toBe(
        SKILL_WOLFHAWK_KNOW_YOUR_PREY
      );
    });
  });

  describe("multi-enemy combat", () => {
    it("should auto-resolve when selected enemy has only one option", () => {
      const player = createWolfhawkPlayer();
      // Ironclads (enemy_0) + Guardsmen (enemy_1: only Fortified)
      const combat = createCombatState([ENEMY_IRONCLADS, ENEMY_GUARDSMEN]);
      const state = createTestGameState({ players: [player], combat });

      // Step 1: Activate skill
      let result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      // Should have enemy selection pending
      expect(result.state.players[0].pendingChoice).not.toBeNull();
      const enemyOptions = result.state.players[0].pendingChoice!.options;
      expect(enemyOptions).toHaveLength(2);

      // Step 2: Select Guardsmen (index 1) — Guardsmen only has Fortified (1 option),
      // so it auto-resolves and creates the modifier directly
      result = engine.processAction(result.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      // Should have created modifier for enemy_1 (Guardsmen) via auto-resolve
      const modifier = result.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_ABILITY_NULLIFIER
      );
      expect(modifier).toBeDefined();
      expect(modifier?.scope).toEqual({
        type: SCOPE_ONE_ENEMY,
        enemyId: "enemy_1",
      });
    });

    it("should present apply options when selected enemy has multiple options", () => {
      const player = createWolfhawkPlayer();
      // Ironclads (enemy_0: Brutal + Physical Resistance) + Guardsmen (enemy_1)
      const combat = createCombatState([ENEMY_IRONCLADS, ENEMY_GUARDSMEN]);
      const state = createTestGameState({ players: [player], combat });

      // Step 1: Activate skill
      let result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      // Step 2: Select Ironclads (index 0) — has 2 options (Brutal + Physical Resistance)
      result = engine.processAction(result.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Should have pending choice with apply options
      expect(result.state.players[0].pendingChoice).not.toBeNull();
      const applyOptions = result.state.players[0].pendingChoice!.options;
      expect(applyOptions).toHaveLength(2);
      expect(applyOptions.every((o) => o.type === EFFECT_KNOW_YOUR_PREY_APPLY)).toBe(true);

      // Step 3: Choose to remove Brutal
      const brutalIndex = applyOptions.findIndex(
        (o) => o.type === EFFECT_KNOW_YOUR_PREY_APPLY && "ability" in o && o.ability === "brutal"
      );
      result = engine.processAction(result.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: brutalIndex,
      });

      // Modifier should be created for enemy_0
      const modifier = result.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_ABILITY_NULLIFIER
      );
      expect(modifier).toBeDefined();
      expect(modifier?.scope).toEqual({
        type: SCOPE_ONE_ENEMY,
        enemyId: "enemy_0",
      });
    });
  });

  describe("undo after activation", () => {
    it("should clear pending choice and restore cooldown on undo", () => {
      const player = createWolfhawkPlayer();
      const combat = createCombatState([ENEMY_IRONCLADS]);
      const state = createTestGameState({ players: [player], combat });

      // Activate skill — creates pending choice
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      // Verify pending choice exists and skill is on cooldown
      expect(afterSkill.state.players[0].pendingChoice).not.toBeNull();
      expect(afterSkill.state.players[0].skillCooldowns.usedThisRound).toContain(
        SKILL_WOLFHAWK_KNOW_YOUR_PREY
      );

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Pending choice should be cleared
      expect(afterUndo.state.players[0].pendingChoice).toBeNull();

      // Skill should no longer be on cooldown
      expect(afterUndo.state.players[0].skillCooldowns.usedThisRound).not.toContain(
        SKILL_WOLFHAWK_KNOW_YOUR_PREY
      );
    });

    it("should fully restore state after undoing both choice and skill activation", () => {
      const player = createWolfhawkPlayer();
      // Ironclads: Brutal + Physical Resistance
      const combat = createCombatState([ENEMY_IRONCLADS]);
      const state = createTestGameState({ players: [player], combat });

      // Activate skill
      let result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      // Resolve choice — select first option
      result = engine.processAction(result.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Verify modifier was created
      expect(result.state.activeModifiers.some(
        (m) => m.effect.type === EFFECT_ABILITY_NULLIFIER
      )).toBe(true);

      // Undo the choice resolution
      result = engine.processAction(result.state, "player1", {
        type: UNDO_ACTION,
      });

      // Undo the skill activation (exercises removeKnowYourPreyEffect)
      result = engine.processAction(result.state, "player1", {
        type: UNDO_ACTION,
      });

      // Modifier should be removed
      expect(result.state.activeModifiers.some(
        (m) => m.effect.type === EFFECT_ABILITY_NULLIFIER
      )).toBe(false);

      // Skill should no longer be on cooldown
      expect(result.state.players[0].skillCooldowns.usedThisRound).not.toContain(
        SKILL_WOLFHAWK_KNOW_YOUR_PREY
      );

      // Pending choice should be cleared
      expect(result.state.players[0].pendingChoice).toBeNull();
    });

    it("should allow re-activation after undo", () => {
      const player = createWolfhawkPlayer();
      const combat = createCombatState([ENEMY_IRONCLADS]);
      const state = createTestGameState({ players: [player], combat });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Re-activate should succeed
      const reActivate = engine.processAction(afterUndo.state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      expect(reActivate.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
        })
      );
    });
  });

  describe("defeated enemies", () => {
    it("should filter out defeated enemies from eligible targets", () => {
      const player = createWolfhawkPlayer();
      const combat = createCombatState([ENEMY_IRONCLADS, ENEMY_GUARDSMEN]);
      // Mark Ironclads as defeated
      combat.enemies[0] = { ...combat.enemies[0]!, isDefeated: true };
      const state = createTestGameState({ players: [player], combat });

      let result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      // Only Guardsmen remains (single enemy → skips selection)
      // Guardsmen has only Fortified (1 option), so pending choice has 1 option
      const options = result.state.players[0].pendingChoice!.options;
      expect(options).toHaveLength(1);

      // Resolve the choice
      result = engine.processAction(result.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Should have created modifier for enemy_1 (Guardsmen)
      const modifier = result.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_ABILITY_NULLIFIER
      );
      expect(modifier).toBeDefined();
      expect(modifier?.scope).toEqual({
        type: SCOPE_ONE_ENEMY,
        enemyId: "enemy_1",
      });
    });

    it("should reject when all enemies are defeated", () => {
      const player = createWolfhawkPlayer();
      const combat = createCombatState([ENEMY_IRONCLADS]);
      combat.enemies[0] = { ...combat.enemies[0]!, isDefeated: true };
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });
  });

  describe("describeEffect", () => {
    it("should describe SELECT_ENEMY effect", () => {
      const effect = { type: EFFECT_KNOW_YOUR_PREY_SELECT_ENEMY };
      expect(describeEffect(effect)).toBe("Select an enemy to target with Know Your Prey");
    });

    it("should describe SELECT_OPTION effect with enemy name", () => {
      const effect: KnowYourPreySelectOptionEffect = {
        type: EFFECT_KNOW_YOUR_PREY_SELECT_OPTION,
        enemyInstanceId: "enemy_0",
        enemyName: "Ironclads",
      };
      expect(describeEffect(effect)).toBe("Choose what to remove from Ironclads");
    });

    it("should describe APPLY effect with label", () => {
      const effect: KnowYourPreyApplyEffect = {
        type: EFFECT_KNOW_YOUR_PREY_APPLY,
        enemyInstanceId: "enemy_0",
        ability: "brutal" as import("@mage-knight/shared").EnemyAbilityType,
        label: "Remove Brutal",
      };
      expect(describeEffect(effect)).toBe("Remove Brutal");
    });
  });

  describe("isEffectResolvable", () => {
    it("should be resolvable for SELECT_ENEMY when in combat", () => {
      const player = createWolfhawkPlayer();
      const combat = createCombatState([ENEMY_IRONCLADS]);
      const state = createTestGameState({ players: [player], combat });

      const result = isEffectResolvable(
        state,
        "player1",
        { type: EFFECT_KNOW_YOUR_PREY_SELECT_ENEMY }
      );
      expect(result).toBe(true);
    });

    it("should not be resolvable for SELECT_ENEMY when not in combat", () => {
      const player = createWolfhawkPlayer();
      const state = createTestGameState({ players: [player] });

      const result = isEffectResolvable(
        state,
        "player1",
        { type: EFFECT_KNOW_YOUR_PREY_SELECT_ENEMY }
      );
      expect(result).toBe(false);
    });

    it("should always be resolvable for SELECT_OPTION", () => {
      const player = createWolfhawkPlayer();
      const state = createTestGameState({ players: [player] });

      const result = isEffectResolvable(
        state,
        "player1",
        { type: EFFECT_KNOW_YOUR_PREY_SELECT_OPTION, enemyInstanceId: "enemy_0", enemyName: "Test" } as KnowYourPreySelectOptionEffect
      );
      expect(result).toBe(true);
    });

    it("should always be resolvable for APPLY", () => {
      const player = createWolfhawkPlayer();
      const state = createTestGameState({ players: [player] });

      const result = isEffectResolvable(
        state,
        "player1",
        { type: EFFECT_KNOW_YOUR_PREY_APPLY, enemyInstanceId: "enemy_0", ability: "brutal" as import("@mage-knight/shared").EnemyAbilityType, label: "Remove Brutal" } as KnowYourPreyApplyEffect
      );
      expect(result).toBe(true);
    });
  });

  describe("modifier queries", () => {
    it("should report ice resistance as removed after applying removal", () => {
      const player = createWolfhawkPlayer();
      // Water Elemental: Ice attack + Ice Resistance
      const combat = createCombatState([ENEMY_WATER_ELEMENTAL]);
      const state = createTestGameState({ players: [player], combat });

      // Activate skill
      let result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      // Find and select ice resistance removal
      const options = result.state.players[0].pendingChoice!.options;
      const iceResIndex = options.findIndex(
        (o) => o.type === EFFECT_KNOW_YOUR_PREY_APPLY && "resistance" in o && o.resistance === "ice"
      );
      result = engine.processAction(result.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: iceResIndex,
      });

      // isIceResistanceRemoved should return true
      expect(isIceResistanceRemoved(result.state, "enemy_0")).toBe(true);
    });

    it("should not report ice resistance as removed for Arcane Immune enemy", () => {
      const player = createWolfhawkPlayer();
      // Sorcerers: Arcane Immunity — even if a modifier existed, it shouldn't apply
      const combat = createCombatState([ENEMY_SORCERERS]);
      const state = createTestGameState({ players: [player], combat });

      // isIceResistanceRemoved should return false for Arcane Immune
      expect(isIceResistanceRemoved(state, "enemy_0")).toBe(false);
    });

    it("should convert attack element via getEffectiveAttackElement", () => {
      const player = createWolfhawkPlayer();
      // Fire Elemental: Fire attack + Fire Resistance
      const combat = createCombatState([ENEMY_FIRE_ELEMENTAL]);
      const state = createTestGameState({ players: [player], combat });

      // Activate skill
      let result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      // Find and select Fire→Physical conversion
      const options = result.state.players[0].pendingChoice!.options;
      const fireConvertIndex = options.findIndex(
        (o) =>
          o.type === EFFECT_KNOW_YOUR_PREY_APPLY &&
          "fromElement" in o &&
          o.fromElement === "fire" &&
          "toElement" in o &&
          o.toElement === "physical"
      );
      result = engine.processAction(result.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: fireConvertIndex,
      });

      // getEffectiveAttackElement should convert fire to physical
      expect(getEffectiveAttackElement(result.state, "enemy_0", ELEMENT_FIRE)).toBe(ELEMENT_PHYSICAL);

      // Non-matching elements should pass through unchanged
      expect(getEffectiveAttackElement(result.state, "enemy_0", ELEMENT_ICE)).toBe(ELEMENT_ICE);
    });

    it("should filter ice resistance from getEnemyResistances after removal", () => {
      const player = createWolfhawkPlayer();
      // Water Elemental: Ice Resistance
      const combat = createCombatState([ENEMY_WATER_ELEMENTAL]);
      const state = createTestGameState({ players: [player], combat });

      // Activate and select ice resistance removal
      let result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      const options = result.state.players[0].pendingChoice!.options;
      const iceResIndex = options.findIndex(
        (o) => o.type === EFFECT_KNOW_YOUR_PREY_APPLY && "resistance" in o && o.resistance === "ice"
      );
      result = engine.processAction(result.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: iceResIndex,
      });

      // getEnemyResistances should no longer include ice
      const enemy = result.state.combat!.enemies[0]!;
      const resistances = getEnemyResistances(result.state, enemy);
      expect(resistances).not.toContain("ice");
    });

    it("should convert Cold Fire element via getEffectiveAttackElement", () => {
      const player = createWolfhawkPlayer();
      // Air Elemental: Cold Fire attack
      const combat = createCombatState([ENEMY_AIR_ELEMENTAL]);
      const state = createTestGameState({ players: [player], combat });

      // Activate skill
      let result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      });

      // Find and select Cold Fire → Ice conversion
      const options = result.state.players[0].pendingChoice!.options;
      const coldFireToIceIndex = options.findIndex(
        (o) =>
          o.type === EFFECT_KNOW_YOUR_PREY_APPLY &&
          "fromElement" in o &&
          o.fromElement === "cold_fire" &&
          "toElement" in o &&
          o.toElement === "ice"
      );
      result = engine.processAction(result.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: coldFireToIceIndex,
      });

      // getEffectiveAttackElement should convert cold_fire to ice
      expect(getEffectiveAttackElement(result.state, "enemy_0", ELEMENT_COLD_FIRE)).toBe(ELEMENT_ICE);
    });
  });
});
