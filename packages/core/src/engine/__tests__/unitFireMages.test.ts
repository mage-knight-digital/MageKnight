/**
 * Fire Mages Unit Ability Tests
 *
 * Fire Mages have three abilities:
 * 1. Ranged Fire Attack 3 - basic ranged attack (free)
 * 2. (Red Mana) Fire Attack 6 OR Fire Block 6 - mana-powered choice ability
 * 3. Gain red mana token + red crystal - resource generation (free)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  INVALID_ACTION,
  UNIT_FIRE_MAGES,
  UNIT_STATE_READY,
  UNIT_STATE_SPENT,
  ACTIVATE_UNIT_ACTION,
  UNIT_ACTIVATED,
  MANA_SOURCE_TOKEN,
  MANA_RED,
  ENEMY_GUARDSMEN,
  getEnemy,
} from "@mage-knight/shared";
import { createPlayerUnit } from "../../types/unit.js";
import { resetUnitInstanceCounter } from "../commands/units/index.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_ATTACK,
  COMBAT_CONTEXT_STANDARD,
  type CombatState,
  type CombatEnemy,
} from "../../types/combat.js";
import { FIRE_MAGES } from "@mage-knight/shared";
import { getUnitAbilityEffect } from "../../data/unitAbilityEffects.js";
import { resolveEffect } from "../effects/index.js";

function createFireMagesCombatState(
  phase: "ranged_siege" | "block" | "attack",
  enemies: CombatEnemy[],
  isAtFortifiedSite = false
): CombatState {
  return {
    enemies,
    phase,
    woundsThisCombat: 0,
    attacksThisPhase: 0,
    fameGained: 0,
    isAtFortifiedSite,
    unitsAllowed: true,
    nightManaRules: false,
    assaultOrigin: null,
    combatHexCoord: null,
    allDamageBlockedThisPhase: false,
    discardEnemiesOnFailure: false,
    pendingDamage: {},
    pendingBlock: {},
    pendingSwiftBlock: {},
    combatContext: COMBAT_CONTEXT_STANDARD,
    cumbersomeReductions: {},
    usedDefend: {},
    defendBonuses: {},
    paidHeroesAssaultInfluence: false,
    vampiricArmorBonus: {},
    damageRedirects: {},
  };
}

function createCombatEnemy(instanceId: string, enemyId: string): CombatEnemy {
  return {
    instanceId,
    enemyId: enemyId as never,
    definition: getEnemy(enemyId as never),
    isBlocked: false,
    isDefeated: false,
    isRequiredForConquest: true,
    isSummonerHidden: false,
    attacksBlocked: [],
    attacksDamageAssigned: [],
  };
}

describe("Fire Mages Unit", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  describe("Unit Definition", () => {
    it("should have correct basic properties", () => {
      expect(FIRE_MAGES.name).toBe("Fire Mages");
      expect(FIRE_MAGES.level).toBe(3);
      expect(FIRE_MAGES.influence).toBe(9);
      expect(FIRE_MAGES.armor).toBe(3);
    });

    it("should have three abilities", () => {
      expect(FIRE_MAGES.abilities.length).toBe(3);
    });

    it("should have Ranged Fire Attack 3 as first ability (no mana cost)", () => {
      const ability = FIRE_MAGES.abilities[0];
      expect(ability?.type).toBe("ranged_attack");
      expect(ability?.value).toBe(3);
      expect(ability?.element).toBe("fire");
      expect(ability?.manaCost).toBeUndefined();
    });

    it("should have Fire Attack 6 OR Fire Block 6 as second ability (red mana)", () => {
      const ability = FIRE_MAGES.abilities[1];
      expect(ability?.type).toBe("effect");
      expect(ability?.manaCost).toBe(MANA_RED);
      expect(ability?.displayName).toContain("Fire Attack");
      expect(ability?.displayName).toContain("Fire Block");
    });

    it("should have Gain Red Mana + Crystal as third ability (no mana cost)", () => {
      const ability = FIRE_MAGES.abilities[2];
      expect(ability?.type).toBe("effect");
      expect(ability?.manaCost).toBeUndefined();
      expect(ability?.displayName).toContain("Mana");
      expect(ability?.displayName).toContain("Crystal");
    });
  });

  describe("Ranged Fire Attack 3 (Ability 0)", () => {
    it("should add 3 ranged fire attack without mana", () => {
      const unit = createPlayerUnit(UNIT_FIRE_MAGES, "fire_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createFireMagesCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "fire_mages_1",
        abilityIndex: 0, // Ranged Fire Attack 3
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(
        result.state.players[0].combatAccumulator.attack.rangedElements.fire
      ).toBe(3);
      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(3);

      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
    });
  });

  describe("Fire Attack 6 OR Fire Block 6 (Ability 1 - Red Mana)", () => {
    it("should have effect registered and return requiresChoice when resolved", () => {
      const effect = getUnitAbilityEffect("fire_mages_attack_or_block");
      expect(effect).toBeDefined();
      expect(effect?.type).toBe("choice");
      const choiceEffect = effect as { type: string; options: readonly { type: string; amount: number }[] };
      expect(choiceEffect.options.length).toBe(2);
      expect(choiceEffect.options[0].type).toBe("gain_attack");
      expect(choiceEffect.options[0].amount).toBe(6);
      expect(choiceEffect.options[1].type).toBe("gain_block");
      expect(choiceEffect.options[1].amount).toBe(6);
      const unit = createPlayerUnit(UNIT_FIRE_MAGES, "fire_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_RED, source: "card" }],
      });
      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createFireMagesCombatState(COMBAT_PHASE_ATTACK, enemies),
      });
      const result = resolveEffect(state, "player1", effect!);
      expect(result.requiresChoice).toBe(true);
    });

    it("should require red mana", () => {
      const unit = createPlayerUnit(UNIT_FIRE_MAGES, "fire_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createFireMagesCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "fire_mages_1",
        abilityIndex: 1, // Fire Attack 6 OR Fire Block 6
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });

    it("should spend unit and consume red mana when activating ability 1", () => {
      const unit = createPlayerUnit(UNIT_FIRE_MAGES, "fire_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createFireMagesCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "fire_mages_1",
        abilityIndex: 1,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].pureMana.length).toBe(0);
      // Effect adds either pending choice or immediate attack/block; definition and resolve path tested above
    });
  });

  describe("Gain Red Mana + Crystal (Ability 2)", () => {
    it("should grant red mana token and red crystal", () => {
      const unit = createPlayerUnit(UNIT_FIRE_MAGES, "fire_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "fire_mages_1",
        abilityIndex: 2, // Gain Red Mana + Crystal
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].pureMana.length).toBe(1);
      expect(result.state.players[0].pureMana[0].color).toBe(MANA_RED);
      expect(result.state.players[0].crystals.red).toBe(1);

      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
    });

    it("should not require combat", () => {
      const unit = createPlayerUnit(UNIT_FIRE_MAGES, "fire_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "fire_mages_1",
        abilityIndex: 2,
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].pureMana.length).toBe(1);
      expect(result.state.players[0].crystals.red).toBe(1);
    });

    it("should add to existing red crystals", () => {
      const unit = createPlayerUnit(UNIT_FIRE_MAGES, "fire_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [],
        crystals: { red: 2, blue: 0, green: 0, white: 0 },
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "fire_mages_1",
        abilityIndex: 2,
      });

      expect(result.state.players[0].crystals.red).toBe(3);
    });
  });
});
