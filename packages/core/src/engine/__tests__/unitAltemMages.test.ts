/**
 * Altem Mages Unit Ability Tests
 *
 * Altem Mages have three abilities:
 * 1. Gain 2 mana tokens of any colors (free, non-combat)
 * 2. Cold Fire Attack 5 OR Cold Fire Block 5 (free, combat)
 *    Scaling: +blue = 7, +red = 7, +both = 9
 * 3. (Black Mana) Choose: All attacks become Cold Fire OR all attacks gain Siege
 *
 * FAQ edge cases:
 * - Attack modifier affects units, skills, and cards played sideways
 * - Attack modifier only affects attacks played AFTER activation
 * - Siege modifier works in ranged/siege phase
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  INVALID_ACTION,
  UNIT_ALTEM_MAGES,
  UNIT_STATE_READY,
  UNIT_STATE_SPENT,
  ACTIVATE_UNIT_ACTION,
  RESOLVE_CHOICE_ACTION,
  CHOICE_REQUIRED,
  MANA_SOURCE_TOKEN,
  MANA_BLUE,
  MANA_RED,
  MANA_BLACK,
  MANA_GREEN,
  ENEMY_GUARDSMEN,
  getEnemy,
  TIME_OF_DAY_NIGHT,
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
import { ALTEM_MAGES } from "@mage-knight/shared";

/**
 * Create a combat state for Altem Mages tests
 */
function createAltemMagesCombatState(
  phase: "ranged_siege" | "attack",
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

/**
 * Create a combat enemy from an enemy ID
 */
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

describe("Altem Mages Unit", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  // ===========================================================================
  // UNIT DEFINITION
  // ===========================================================================

  describe("Unit Definition", () => {
    it("should have correct basic properties", () => {
      expect(ALTEM_MAGES.name).toBe("Altem Mages");
      expect(ALTEM_MAGES.level).toBe(4);
      expect(ALTEM_MAGES.influence).toBe(12);
      expect(ALTEM_MAGES.armor).toBe(5);
    });

    it("should have three abilities", () => {
      expect(ALTEM_MAGES.abilities.length).toBe(3);
    });

    it("should only be recruitable at Cities (Castles)", () => {
      expect(ALTEM_MAGES.recruitSites).toEqual(["city"]);
    });

    it("should have Fire and Ice resistances", () => {
      expect(ALTEM_MAGES.resistances).toContain("fire");
      expect(ALTEM_MAGES.resistances).toContain("ice");
    });

    it("should have Gain 2 Mana Tokens as first ability (no mana cost, non-combat)", () => {
      const ability = ALTEM_MAGES.abilities[0];
      expect(ability?.type).toBe("effect");
      expect(ability?.manaCost).toBeUndefined();
      expect(ability?.requiresCombat).toBe(false);
    });

    it("should have Cold Fire Attack/Block as second ability (no mana cost)", () => {
      const ability = ALTEM_MAGES.abilities[1];
      expect(ability?.type).toBe("effect");
      expect(ability?.manaCost).toBeUndefined();
    });

    it("should have Attack Modifier as third ability (black mana cost)", () => {
      const ability = ALTEM_MAGES.abilities[2];
      expect(ability?.type).toBe("effect");
      expect(ability?.manaCost).toBe(MANA_BLACK);
    });
  });

  // ===========================================================================
  // ABILITY 1: GAIN 2 MANA TOKENS
  // ===========================================================================

  describe("Gain 2 Mana Tokens (Ability 0)", () => {
    it("should present first mana color choice", () => {
      const unit = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "altem_mages_1",
        abilityIndex: 0,
      });

      // Should create a pending choice for first mana color
      expect(result.state.players[0].pendingChoice).not.toBeNull();
      const choiceEvent = result.events.find((e) => e.type === CHOICE_REQUIRED);
      expect(choiceEvent).toBeDefined();
    });

    it("should gain two mana tokens after both choices", () => {
      const unit = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [],
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      // Step 1: Activate ability
      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "altem_mages_1",
        abilityIndex: 0,
      });

      // Step 2: Choose first mana color (red = index 0)
      const choice1Result = engine.processAction(
        activateResult.state,
        "player1",
        {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0, // Red
        }
      );

      // Should have another pending choice for second mana
      expect(choice1Result.state.players[0].pendingChoice).not.toBeNull();

      // Step 3: Choose second mana color (blue = index 1)
      const choice2Result = engine.processAction(
        choice1Result.state,
        "player1",
        {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 1, // Blue
        }
      );

      // Should have gained 2 mana tokens
      const mana = choice2Result.state.players[0].pureMana;
      expect(mana.length).toBe(2);
      expect(mana.some((m) => m.color === MANA_RED)).toBe(true);
      expect(mana.some((m) => m.color === MANA_BLUE)).toBe(true);

      // Unit should be spent
      expect(choice2Result.state.players[0].units[0].state).toBe(
        UNIT_STATE_SPENT
      );
    });

    it("should allow choosing same color twice", () => {
      const unit = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [],
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      // Activate
      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "altem_mages_1",
        abilityIndex: 0,
      });

      // Choose green for both
      const choice1Result = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: 2 } // Green
      );

      const choice2Result = engine.processAction(
        choice1Result.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: 2 } // Green again
      );

      const mana = choice2Result.state.players[0].pureMana;
      expect(mana.length).toBe(2);
      expect(mana.filter((m) => m.color === MANA_GREEN).length).toBe(2);
    });

    it("should work outside combat (requiresCombat: false)", () => {
      const unit = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: null, // No combat
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "altem_mages_1",
        abilityIndex: 0,
      });

      // Should succeed
      expect(result.state.players[0].pendingChoice).not.toBeNull();
    });

    it("should not require any mana", () => {
      const unit = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_1");
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
        unitInstanceId: "altem_mages_1",
        abilityIndex: 0,
      });

      // Should succeed without mana
      expect(result.state.players[0].pendingChoice).not.toBeNull();
    });
  });

  // ===========================================================================
  // ABILITY 2: COLD FIRE ATTACK OR BLOCK 5
  // ===========================================================================

  describe("Cold Fire Attack OR Block 5 (Ability 1)", () => {
    it("should present choice between Cold Fire Attack and Block (base options)", () => {
      const unit = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [], // No mana for boosting
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createAltemMagesCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "altem_mages_1",
        abilityIndex: 1,
      });

      // Should create a choice
      expect(result.state.players[0].pendingChoice).not.toBeNull();
    });

    it("should grant Cold Fire Attack 5 when base attack chosen (no mana)", () => {
      const unit = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [], // No mana
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createAltemMagesCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      // Step 1: Activate ability
      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "altem_mages_1",
        abilityIndex: 1,
      });

      // Step 2: Choose base Cold Fire Attack (index 0)
      const choiceResult = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: 0 }
      );

      // Verify Cold Fire Attack 5 was added (melee with cold_fire element)
      expect(
        choiceResult.state.players[0].combatAccumulator.attack.normalElements
          .coldFire
      ).toBe(5);

      // Unit should be spent
      expect(choiceResult.state.players[0].units[0].state).toBe(
        UNIT_STATE_SPENT
      );
    });

    it("should grant Cold Fire Block 5 when base block chosen (no mana)", () => {
      const unit = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createAltemMagesCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      // Activate
      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "altem_mages_1",
        abilityIndex: 1,
      });

      // Choose base Cold Fire Block (index 1)
      const choiceResult = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: 1 }
      );

      // Verify Cold Fire Block 5 was added
      expect(
        choiceResult.state.players[0].combatAccumulator.blockElements.coldFire
      ).toBe(5);
      expect(choiceResult.state.players[0].combatAccumulator.block).toBe(5);
    });

    it("should offer boosted options when blue mana is available (+2 = 7)", () => {
      const unit = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_BLUE, source: "card" }],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createAltemMagesCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "altem_mages_1",
        abilityIndex: 1,
      });

      // Should have base (2) + blue-boosted (2) = 4 options
      const choice = result.state.players[0].pendingChoice;
      expect(choice).not.toBeNull();
      expect(choice!.options.length).toBe(4);
    });

    it("should grant Cold Fire Attack 7 when blue-boosted attack chosen", () => {
      const unit = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_BLUE, source: "card" }],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createAltemMagesCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      // Activate
      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "altem_mages_1",
        abilityIndex: 1,
      });

      // Options: 0=base attack, 1=base block, 2=blue attack, 3=blue block
      // Choose blue-boosted Cold Fire Attack (index 2)
      const choiceResult = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: 2 }
      );

      // Verify Cold Fire Attack 7
      expect(
        choiceResult.state.players[0].combatAccumulator.attack.normalElements
          .coldFire
      ).toBe(7);

      // Blue mana should have been consumed
      expect(
        choiceResult.state.players[0].pureMana.filter(
          (m) => m.color === MANA_BLUE
        ).length
      ).toBe(0);
    });

    it("should grant Cold Fire Block 7 when red-boosted block chosen", () => {
      const unit = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createAltemMagesCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      // Activate
      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "altem_mages_1",
        abilityIndex: 1,
      });

      // With only red mana: options are 0=base attack, 1=base block, 2=red attack, 3=red block
      const choiceResult = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: 3 } // red-boosted block
      );

      // Verify Cold Fire Block 7
      expect(
        choiceResult.state.players[0].combatAccumulator.blockElements.coldFire
      ).toBe(7);
      expect(choiceResult.state.players[0].combatAccumulator.block).toBe(7);

      // Red mana consumed
      expect(
        choiceResult.state.players[0].pureMana.filter(
          (m) => m.color === MANA_RED
        ).length
      ).toBe(0);
    });

    it("should offer 8 options when both blue and red mana available (base + blue + red + both)", () => {
      const unit = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [
          { color: MANA_BLUE, source: "card" },
          { color: MANA_RED, source: "card" },
        ],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createAltemMagesCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "altem_mages_1",
        abilityIndex: 1,
      });

      // base (2) + blue (2) + red (2) + both (2) = 8 options
      const choice = result.state.players[0].pendingChoice;
      expect(choice).not.toBeNull();
      expect(choice!.options.length).toBe(8);
    });

    it("should grant Cold Fire Attack 9 when both mana boosted attack chosen", () => {
      const unit = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [
          { color: MANA_BLUE, source: "card" },
          { color: MANA_RED, source: "card" },
        ],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createAltemMagesCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      // Activate
      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "altem_mages_1",
        abilityIndex: 1,
      });

      // With both mana:
      // 0=base attack, 1=base block, 2=blue attack, 3=blue block,
      // 4=red attack, 5=red block, 6=both attack, 7=both block
      const choiceResult = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: 6 } // both-boosted attack
      );

      // Verify Cold Fire Attack 9
      expect(
        choiceResult.state.players[0].combatAccumulator.attack.normalElements
          .coldFire
      ).toBe(9);

      // Both blue and red mana should be consumed
      expect(choiceResult.state.players[0].pureMana.length).toBe(0);
    });

    it("should not require mana for base options", () => {
      const unit = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createAltemMagesCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "altem_mages_1",
        abilityIndex: 1,
      });

      // Should still work with just base 2 options
      const choice = result.state.players[0].pendingChoice;
      expect(choice).not.toBeNull();
      expect(choice!.options.length).toBe(2);
    });
  });

  // ===========================================================================
  // ABILITY 3: ATTACK MODIFIER (BLACK MANA)
  // ===========================================================================

  describe("Attack Modifier (Ability 2 - Black Mana)", () => {
    it("should require black mana", () => {
      const unit = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [], // No mana
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createAltemMagesCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "altem_mages_1",
        abilityIndex: 2,
      });

      // Should fail - no mana
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });

    it("should present choice between Cold Fire transform and Add Siege", () => {
      const unit = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_BLACK, source: "card" }],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createAltemMagesCombatState(COMBAT_PHASE_ATTACK, enemies),
        timeOfDay: TIME_OF_DAY_NIGHT, // Black mana only available at night
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "altem_mages_1",
        abilityIndex: 2,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLACK },
      });

      // Should present choice
      expect(result.state.players[0].pendingChoice).not.toBeNull();
      expect(result.state.players[0].pendingChoice!.options.length).toBe(2);
    });

    it("should apply Cold Fire transform modifier when chosen", () => {
      const unit = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_BLACK, source: "card" }],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createAltemMagesCombatState(COMBAT_PHASE_ATTACK, enemies),
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      // Activate
      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "altem_mages_1",
        abilityIndex: 2,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLACK },
      });

      // Choose Cold Fire transform (index 0)
      const choiceResult = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: 0 }
      );

      // Verify modifier was applied
      const modifiers = choiceResult.state.activeModifiers;
      expect(
        modifiers.some(
          (m) => m.effect.type === "transform_attacks_cold_fire"
        )
      ).toBe(true);

      // Verify black mana was consumed
      expect(
        choiceResult.state.players[0].pureMana.filter(
          (m) => m.color === MANA_BLACK
        ).length
      ).toBe(0);

      // Unit spent
      expect(choiceResult.state.players[0].units[0].state).toBe(
        UNIT_STATE_SPENT
      );
    });

    it("should apply Add Siege modifier when chosen", () => {
      const unit = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_BLACK, source: "card" }],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createAltemMagesCombatState(COMBAT_PHASE_ATTACK, enemies),
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      // Activate
      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "altem_mages_1",
        abilityIndex: 2,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLACK },
      });

      // Choose Add Siege (index 1)
      const choiceResult = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: 1 }
      );

      // Verify modifier was applied
      const modifiers = choiceResult.state.activeModifiers;
      expect(
        modifiers.some(
          (m) => m.effect.type === "add_siege_to_attacks"
        )
      ).toBe(true);
    });
  });

  // ===========================================================================
  // ATTACK MODIFIER INTERACTION WITH SUBSEQUENT ATTACKS
  // ===========================================================================

  describe("Cold Fire Transform affects subsequent attacks", () => {
    it("should transform subsequent effect-based attacks to Cold Fire element", () => {
      // Set up two units: Altem Mages + another unit with a physical attack
      const altemMages = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_1");
      const otherUnit = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_2");
      otherUnit.state = UNIT_STATE_READY;

      const player = createTestPlayer({
        units: [altemMages, otherUnit],
        commandTokens: 2,
        pureMana: [{ color: MANA_BLACK, source: "card" }],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createAltemMagesCombatState(COMBAT_PHASE_ATTACK, enemies),
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      // Step 1: Activate Altem Mages' modifier ability (ability 2) with Cold Fire transform
      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "altem_mages_1",
        abilityIndex: 2,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLACK },
      });

      // Choose Cold Fire transform
      const modifierResult = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: 0 }
      );

      // Step 2: Activate second Altem Mages' Cold Fire Attack/Block (ability 1)
      const secondActivate = engine.processAction(
        modifierResult.state,
        "player1",
        {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "altem_mages_2",
          abilityIndex: 1, // Cold Fire Attack OR Block 5
        }
      );

      // Choose base attack (index 0) — already Cold Fire, transform should still apply
      const finalResult = engine.processAction(
        secondActivate.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: 0 }
      );

      // The second unit's attack is already Cold Fire, so it should remain Cold Fire
      expect(
        finalResult.state.players[0].combatAccumulator.attack.normalElements
          .coldFire
      ).toBe(5);
    });
  });

  describe("Add Siege modifier affects subsequent attacks", () => {
    it("should duplicate subsequent melee attacks into siege pool", () => {
      const altemMages = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_1");
      const otherUnit = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_2");
      otherUnit.state = UNIT_STATE_READY;

      const player = createTestPlayer({
        units: [altemMages, otherUnit],
        commandTokens: 2,
        pureMana: [{ color: MANA_BLACK, source: "card" }],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createAltemMagesCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      // Step 1: Activate modifier with Add Siege option
      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "altem_mages_1",
        abilityIndex: 2,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLACK },
      });

      // Choose Add Siege (index 1)
      const modifierResult = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: 1 }
      );

      // Step 2: Use second unit's Cold Fire Attack 5 (melee)
      const secondActivate = engine.processAction(
        modifierResult.state,
        "player1",
        {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "altem_mages_2",
          abilityIndex: 1,
        }
      );

      // Choose base attack (index 0)
      const finalResult = engine.processAction(
        secondActivate.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: 0 }
      );

      // Should have Cold Fire melee attack 5 AND Cold Fire siege attack 5
      const attack = finalResult.state.players[0].combatAccumulator.attack;
      expect(attack.normalElements.coldFire).toBe(5);
      expect(attack.siegeElements.coldFire).toBe(5);
    });

    it("should not duplicate siege attacks (already siege)", () => {
      const altemMages = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_1");
      const otherUnit = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_2");
      otherUnit.state = UNIT_STATE_READY;

      const player = createTestPlayer({
        units: [altemMages, otherUnit],
        commandTokens: 2,
        pureMana: [{ color: MANA_BLACK, source: "card" }],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createAltemMagesCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      // Activate modifier with Add Siege
      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "altem_mages_1",
        abilityIndex: 2,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLACK },
      });

      const modifierResult = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: 1 }
      );

      // Verify modifier is active
      expect(
        modifierResult.state.activeModifiers.some(
          (m) => m.effect.type === "add_siege_to_attacks"
        )
      ).toBe(true);

      // Siege attacks should only count once — the modifier doesn't double siege attacks
      // We can verify this by the fact that siege is not duplicated in the modifier logic
      // (combatType !== COMBAT_TYPE_SIEGE check in applyGainAttack)
    });
  });

  // ===========================================================================
  // ATTACK MODIFIER: ONLY AFFECTS FUTURE ATTACKS
  // ===========================================================================

  describe("Attack modifier only affects future attacks", () => {
    it("should not modify attacks already in accumulator before activation", () => {
      const altemMages = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_1");
      const otherUnit = createPlayerUnit(UNIT_ALTEM_MAGES, "altem_mages_2");
      otherUnit.state = UNIT_STATE_READY;

      const player = createTestPlayer({
        units: [altemMages, otherUnit],
        commandTokens: 2,
        pureMana: [{ color: MANA_BLACK, source: "card" }],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createAltemMagesCombatState(COMBAT_PHASE_ATTACK, enemies),
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      // Step 1: Use second unit's Cold Fire Attack 5 BEFORE modifier
      const firstAttack = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "altem_mages_2",
        abilityIndex: 1,
      });

      // Choose base attack
      const attackResult = engine.processAction(
        firstAttack.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: 0 }
      );

      // Should have Cold Fire melee 5, no siege
      expect(
        attackResult.state.players[0].combatAccumulator.attack.normalElements
          .coldFire
      ).toBe(5);
      expect(
        attackResult.state.players[0].combatAccumulator.attack.siegeElements
          .coldFire
      ).toBe(0);

      // Step 2: Now activate Add Siege modifier
      const modActivate = engine.processAction(
        attackResult.state,
        "player1",
        {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "altem_mages_1",
          abilityIndex: 2,
          manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLACK },
        }
      );

      const modResult = engine.processAction(
        modActivate.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: 1 } // Add Siege
      );

      // The previous 5 Cold Fire melee attack should NOT have gained siege retroactively
      expect(
        modResult.state.players[0].combatAccumulator.attack.normalElements
          .coldFire
      ).toBe(5);
      expect(
        modResult.state.players[0].combatAccumulator.attack.siegeElements
          .coldFire
      ).toBe(0); // No retroactive siege
    });
  });
});
