/**
 * Magic Familiars Unit Tests
 *
 * Magic Familiars have four abilities with mana token bonuses:
 * 1. Attack 3 (5 with red mana token)
 * 2. Block 4 (7 with blue mana token)
 * 3. Move OR Influence 3 (5 with white mana token) - choice effect
 * 4. Heal 2 (3 with green mana token)
 *
 * Special rules:
 * - Requires mana payment on recruit (1 basic mana → token placed on unit)
 * - Cannot be recruited via Call to Arms/Glory/combat rewards/Banner of Command
 * - Can use any ability regardless of token color
 * - Token not consumed on ability use
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import {
  createTestGameState,
  createTestPlayer,
  createTestHex,
  createUnitCombatState,
} from "./testHelpers.js";
import {
  INVALID_ACTION,
  UNIT_MAGIC_FAMILIARS,
  UNIT_STATE_SPENT,
  ACTIVATE_UNIT_ACTION,
  RECRUIT_UNIT_ACTION,
  RESOLVE_UNIT_MAINTENANCE_ACTION,
  UNIT_RECRUITED,
  UNIT_MAINTENANCE_PAID,
  UNIT_DISBANDED,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_GOLD,
  MANA_SOURCE_TOKEN,
  CARD_WOUND,
  hexKey,
  MAGIC_FAMILIARS,
  TERRAIN_PLAINS,
} from "@mage-knight/shared";
import type { BasicManaColor, PlayerAction } from "@mage-knight/shared";
import { createPlayerUnit } from "../../types/unit.js";
import { resetUnitInstanceCounter } from "../commands/units/index.js";
import {
  COMBAT_PHASE_ATTACK,
  COMBAT_PHASE_BLOCK,
} from "../../types/combat.js";
import { SiteType } from "../../types/map.js";
import { getUnitAbilityEffect } from "../../data/unitAbilityEffects.js";
import { getValidActions } from "../validActions/index.js";
import { processPlayerRoundReset } from "../commands/endRound/playerRoundReset.js";
import type { RngState } from "../../utils/rng.js";
import {
  validateHasPendingUnitMaintenance,
  validateUnitMaintenanceChoice,
} from "../validators/unitMaintenanceValidators.js";
import { validateRecruitManaPayment } from "../validators/units/recruitmentValidators.js";
import { createResolveUnitMaintenanceCommand } from "../commands/resolveUnitMaintenanceCommand.js";

const UNDO_ACTION_TYPE = "UNDO" as const;

describe("Magic Familiars Unit", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  // =========================================================================
  // DEFINITION TESTS
  // =========================================================================

  describe("Unit Definition", () => {
    it("should have correct basic properties", () => {
      expect(MAGIC_FAMILIARS.name).toBe("Magic Familiars");
      expect(MAGIC_FAMILIARS.level).toBe(2);
      expect(MAGIC_FAMILIARS.influence).toBe(6);
      expect(MAGIC_FAMILIARS.armor).toBe(5);
      expect(MAGIC_FAMILIARS.copies).toBe(2);
    });

    it("should have four abilities", () => {
      expect(MAGIC_FAMILIARS.abilities.length).toBe(4);
    });

    it("should have Attack 3 (bonus 5 with red) as first ability", () => {
      const ability = MAGIC_FAMILIARS.abilities[0];
      expect(ability?.type).toBe("attack");
      expect(ability?.value).toBe(3);
      expect(ability?.bonusValue).toBe(5);
      expect(ability?.bonusManaColor).toBe(MANA_RED);
    });

    it("should have Block 4 (bonus 7 with blue) as second ability", () => {
      const ability = MAGIC_FAMILIARS.abilities[1];
      expect(ability?.type).toBe("block");
      expect(ability?.value).toBe(4);
      expect(ability?.bonusValue).toBe(7);
      expect(ability?.bonusManaColor).toBe(MANA_BLUE);
    });

    it("should have Move OR Influence 3 (bonus 5 with white) as third ability", () => {
      const ability = MAGIC_FAMILIARS.abilities[2];
      expect(ability?.type).toBe("effect");
      expect(ability?.bonusValue).toBe(5);
      expect(ability?.bonusManaColor).toBe(MANA_WHITE);
    });

    it("should have Heal 2 (bonus 3 with green) as fourth ability", () => {
      const ability = MAGIC_FAMILIARS.abilities[3];
      expect(ability?.type).toBe("heal");
      expect(ability?.value).toBe(2);
      expect(ability?.bonusValue).toBe(3);
      expect(ability?.bonusManaColor).toBe(MANA_GREEN);
    });

    it("should be restricted from free recruit", () => {
      expect(MAGIC_FAMILIARS.restrictedFromFreeRecruit).toBe(true);
    });

    it("should have Move OR Influence choice effect registered", () => {
      const effect = getUnitAbilityEffect("magic_familiars_move_or_influence");
      expect(effect).toBeDefined();
      expect(effect?.type).toBe("choice");
    });
  });

  // =========================================================================
  // MANA TOKEN TRACKING
  // =========================================================================

  describe("Mana Token", () => {
    it("should store mana token on PlayerUnit", () => {
      const unit = createPlayerUnit(UNIT_MAGIC_FAMILIARS, "familiars_1", MANA_RED);
      expect(unit.manaToken).toBe(MANA_RED);
    });

    it("should have no mana token by default", () => {
      const unit = createPlayerUnit(UNIT_MAGIC_FAMILIARS, "familiars_1");
      expect(unit.manaToken).toBeUndefined();
    });
  });

  // =========================================================================
  // ATTACK ABILITY (INDEX 0)
  // =========================================================================

  describe("Attack Ability (Index 0)", () => {
    it("should add 3 attack without matching mana token", () => {
      const unit = createPlayerUnit(UNIT_MAGIC_FAMILIARS, "familiars_1", MANA_BLUE);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "familiars_1",
        abilityIndex: 0,
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(3);
    });

    it("should add 5 attack with red mana token (bonus)", () => {
      const unit = createPlayerUnit(UNIT_MAGIC_FAMILIARS, "familiars_1", MANA_RED);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "familiars_1",
        abilityIndex: 0,
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(5);
    });

    it("should not consume the mana token", () => {
      const unit = createPlayerUnit(UNIT_MAGIC_FAMILIARS, "familiars_1", MANA_RED);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "familiars_1",
        abilityIndex: 0,
      });

      expect(result.state.players[0].units[0].manaToken).toBe(MANA_RED);
    });
  });

  // =========================================================================
  // BLOCK ABILITY (INDEX 1)
  // =========================================================================

  describe("Block Ability (Index 1)", () => {
    it("should add 4 block without matching mana token", () => {
      const unit = createPlayerUnit(UNIT_MAGIC_FAMILIARS, "familiars_1", MANA_RED);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "familiars_1",
        abilityIndex: 1,
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].combatAccumulator.block).toBe(4);
    });

    it("should add 7 block with blue mana token (bonus)", () => {
      const unit = createPlayerUnit(UNIT_MAGIC_FAMILIARS, "familiars_1", MANA_BLUE);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "familiars_1",
        abilityIndex: 1,
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].combatAccumulator.block).toBe(7);
    });
  });

  // =========================================================================
  // MOVE/INFLUENCE CHOICE ABILITY (INDEX 2)
  // =========================================================================

  describe("Move/Influence Choice Ability (Index 2)", () => {
    it("should present Move or Influence choice", () => {
      const unit = createPlayerUnit(UNIT_MAGIC_FAMILIARS, "familiars_1", MANA_GREEN);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "familiars_1",
        abilityIndex: 2,
      });

      // Should create a pending choice for Move vs Influence
      expect(result.state.players[0].pendingChoice).not.toBeNull();
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });

    it("should grant base 3 move points with non-white token", () => {
      const unit = createPlayerUnit(UNIT_MAGIC_FAMILIARS, "familiars_1", MANA_RED);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        movePoints: 0,
      });

      const state = createTestGameState({
        players: [player],
      });

      // Activate the ability
      let result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "familiars_1",
        abilityIndex: 2,
      });

      // Choose Move (index 0)
      if (result.state.players[0].pendingChoice) {
        result = engine.processAction(result.state, "player1", {
          type: "RESOLVE_CHOICE" as never,
          choiceIndex: 0,
        });
        expect(result.state.players[0].movePoints).toBe(3);
      }
    });

    it("should grant 5 move points with white mana token (bonus)", () => {
      const unit = createPlayerUnit(UNIT_MAGIC_FAMILIARS, "familiars_1", MANA_WHITE);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        movePoints: 0,
      });

      const state = createTestGameState({
        players: [player],
      });

      // Activate the ability
      let result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "familiars_1",
        abilityIndex: 2,
      });

      // Choose Move (index 0)
      if (result.state.players[0].pendingChoice) {
        result = engine.processAction(result.state, "player1", {
          type: "RESOLVE_CHOICE" as never,
          choiceIndex: 0,
        });
        expect(result.state.players[0].movePoints).toBe(5);
      }
    });
  });

  // =========================================================================
  // HEAL ABILITY (INDEX 3)
  // =========================================================================

  describe("Heal Ability (Index 3)", () => {
    it("should heal 2 wounds without matching mana token", () => {
      const unit = createPlayerUnit(UNIT_MAGIC_FAMILIARS, "familiars_1", MANA_RED);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        hand: [CARD_WOUND, CARD_WOUND, CARD_WOUND],
      });

      const state = createTestGameState({
        players: [player],
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "familiars_1",
        abilityIndex: 3,
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      // Should have healed 2 wounds (1 remaining)
      const woundsInHand = result.state.players[0].hand.filter(
        (c) => c === CARD_WOUND
      ).length;
      expect(woundsInHand).toBe(1);
    });

    it("should heal 3 wounds with green mana token (bonus)", () => {
      const unit = createPlayerUnit(UNIT_MAGIC_FAMILIARS, "familiars_1", MANA_GREEN);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        hand: [CARD_WOUND, CARD_WOUND, CARD_WOUND],
      });

      const state = createTestGameState({
        players: [player],
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "familiars_1",
        abilityIndex: 3,
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      // Should have healed all 3 wounds
      const woundsInHand = result.state.players[0].hand.filter(
        (c) => c === CARD_WOUND
      ).length;
      expect(woundsInHand).toBe(0);
    });
  });

  // =========================================================================
  // RECRUITMENT WITH MANA PAYMENT
  // =========================================================================

  describe("Recruitment with Mana Payment", () => {
    function createRecruitmentState(
      manaTokens: { color: BasicManaColor; source: string }[],
      influencePoints = 10
    ) {
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        influencePoints,
        pureMana: manaTokens.map((t) => ({
          color: t.color,
          source: t.source as never,
        })),
      });

      const hexWithMageTower = createTestHex(0, 0, TERRAIN_PLAINS, {
        type: SiteType.MageTower,
        owner: "player1",
        isConquered: true,
        isBurned: false,
      });

      return createTestGameState({
        players: [player],
        offers: {
          advancedActions: [],
          spells: [],
          units: [UNIT_MAGIC_FAMILIARS],
          artifacts: [],
        },
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: hexWithMageTower,
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
      });
    }

    it("should recruit with mana payment and place token", () => {
      const state = createRecruitmentState([
        { color: MANA_RED, source: "card" },
      ]);

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_MAGIC_FAMILIARS,
        influenceSpent: 6,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED, index: 0 },
        manaTokenColor: MANA_RED,
      });

      // Should have recruited successfully
      const recruitEvent = result.events.find((e) => e.type === UNIT_RECRUITED);
      expect(recruitEvent).toBeDefined();
      expect(result.state.players[0].units.length).toBe(1);
      expect(result.state.players[0].units[0].unitId).toBe(UNIT_MAGIC_FAMILIARS);
      expect(result.state.players[0].units[0].manaToken).toBe(MANA_RED);

      // Mana token should have been consumed
      expect(result.state.players[0].pureMana.length).toBe(0);
    });

    it("should reject recruitment without mana payment", () => {
      const state = createRecruitmentState([
        { color: MANA_RED, source: "card" },
      ]);

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_MAGIC_FAMILIARS,
        influenceSpent: 6,
        // No manaSource or manaTokenColor
      });

      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      expect(result.state.players[0].units.length).toBe(0);
    });

    it("should reject recruitment without token color", () => {
      const state = createRecruitmentState([
        { color: MANA_RED, source: "card" },
      ]);

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_MAGIC_FAMILIARS,
        influenceSpent: 6,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED, index: 0 },
        // No manaTokenColor
      });

      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });

    it("should allow gold mana with specified basic color", () => {
      const state = createRecruitmentState([
        { color: MANA_GOLD as never, source: "card" },
      ]);

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_MAGIC_FAMILIARS,
        influenceSpent: 6,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GOLD, index: 0 },
        manaTokenColor: MANA_BLUE,
      });

      // Gold mana can be used as any basic color
      const recruitEvent = result.events.find((e) => e.type === UNIT_RECRUITED);
      expect(recruitEvent).toBeDefined();
      expect(result.state.players[0].units[0].manaToken).toBe(MANA_BLUE);
    });

    it("should allow recruiting both Familiars in same turn", () => {
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        influencePoints: 20,
        commandTokens: 3,
        pureMana: [
          { color: MANA_RED, source: "card" as never },
          { color: MANA_BLUE, source: "card" as never },
        ],
      });

      const hexWithMageTower = createTestHex(0, 0, TERRAIN_PLAINS, {
        type: SiteType.MageTower,
        owner: "player1",
        isConquered: true,
        isBurned: false,
      });

      const state = createTestGameState({
        players: [player],
        offers: {
          advancedActions: [],
          spells: [],
          units: [UNIT_MAGIC_FAMILIARS, UNIT_MAGIC_FAMILIARS],
          artifacts: [],
        },
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: hexWithMageTower,
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
      });

      // Recruit first
      const result1 = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_MAGIC_FAMILIARS,
        influenceSpent: 6,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED, index: 0 },
        manaTokenColor: MANA_RED,
      });

      expect(result1.state.players[0].units.length).toBe(1);

      // Recruit second
      const result2 = engine.processAction(result1.state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_MAGIC_FAMILIARS,
        influenceSpent: 6,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE, index: 0 },
        manaTokenColor: MANA_BLUE,
      });

      expect(result2.state.players[0].units.length).toBe(2);
      expect(result2.state.players[0].units[0].manaToken).toBe(MANA_RED);
      expect(result2.state.players[0].units[1].manaToken).toBe(MANA_BLUE);
    });
  });

  // =========================================================================
  // RECRUITMENT RESTRICTIONS
  // =========================================================================

  describe("Recruitment Restrictions", () => {
    it("should be excluded from Call to Arms (already in EXCLUDED_UNITS)", () => {
      // This is verified by the existing Call to Arms test suite,
      // just confirm the definition flag
      expect(MAGIC_FAMILIARS.restrictedFromFreeRecruit).toBe(true);
    });
  });

  // =========================================================================
  // CROSS-ABILITY TESTS
  // =========================================================================

  describe("Cross-Ability Tests", () => {
    it("can use any ability regardless of token color", () => {
      // Unit with green token can still use Attack
      const unit = createPlayerUnit(UNIT_MAGIC_FAMILIARS, "familiars_1", MANA_GREEN);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "familiars_1",
        abilityIndex: 0, // Attack
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      // Base attack value (no red bonus)
      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(3);
    });

    it("enhanced attack/block are physical element", () => {
      // The issue says "Enhanced Attack/Block are still PHYSICAL element (S7)"
      const unit = createPlayerUnit(UNIT_MAGIC_FAMILIARS, "familiars_1", MANA_RED);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "familiars_1",
        abilityIndex: 0, // Attack (enhanced to 5 with red)
      });

      // Physical element by default (no element specified in ability definition)
      expect(result.state.players[0].combatAccumulator.attack.normalElements.physical).toBe(5);
      expect(result.state.players[0].combatAccumulator.attack.normalElements.fire).toBe(0);
      expect(result.state.players[0].combatAccumulator.attack.normalElements.ice).toBe(0);
    });
  });

  // =========================================================================
  // ROUND-START MAINTENANCE
  // =========================================================================

  describe("Round-Start Maintenance", () => {
    function createMaintenanceState() {
      const unit = createPlayerUnit(UNIT_MAGIC_FAMILIARS, "familiars_1", MANA_RED);
      const player = createTestPlayer({
        units: [unit],
        crystals: { red: 1, blue: 0, green: 1, white: 0 },
        pendingUnitMaintenance: [
          { unitInstanceId: "familiars_1", unitId: UNIT_MAGIC_FAMILIARS },
        ],
      });

      return createTestGameState({
        players: [player],
        roundPhase: "tactics_selection",
        currentTacticSelector: "player1",
        tacticsSelectionOrder: ["player1"],
      });
    }

    it("should set pendingUnitMaintenance during round reset for Magic Familiars", () => {
      const unit = createPlayerUnit(UNIT_MAGIC_FAMILIARS, "familiars_1", MANA_RED);
      const player = createTestPlayer({
        units: [unit],
      });

      const state = createTestGameState({
        players: [player],
      });

      const rng: RngState = { seed: 12345, counter: 0 };
      const result = processPlayerRoundReset(state, rng);

      const updatedPlayer = result.players[0];
      expect(updatedPlayer.pendingUnitMaintenance).not.toBeNull();
      expect(updatedPlayer.pendingUnitMaintenance!.length).toBe(1);
      expect(updatedPlayer.pendingUnitMaintenance![0].unitInstanceId).toBe("familiars_1");
    });

    it("should not set pendingUnitMaintenance when no Magic Familiars", () => {
      const player = createTestPlayer({
        units: [],
      });

      const state = createTestGameState({
        players: [player],
      });

      const rng: RngState = { seed: 12345, counter: 0 };
      const result = processPlayerRoundReset(state, rng);

      expect(result.players[0].pendingUnitMaintenance).toBeNull();
    });

    it("should show pending_unit_maintenance mode in valid actions", () => {
      const state = createMaintenanceState();
      const validActions = getValidActions(state, "player1");

      expect(validActions.mode).toBe("pending_unit_maintenance");
      if (validActions.mode === "pending_unit_maintenance") {
        expect(validActions.unitMaintenance.units.length).toBe(1);
        expect(validActions.unitMaintenance.units[0].unitInstanceId).toBe("familiars_1");
        expect(validActions.unitMaintenance.units[0].availableCrystalColors).toContain(MANA_RED);
        expect(validActions.unitMaintenance.units[0].availableCrystalColors).toContain(MANA_GREEN);
        expect(validActions.unitMaintenance.units[0].availableCrystalColors).not.toContain(MANA_BLUE);
      }
    });

    it("should keep unit when paying crystal and replacing mana token", () => {
      const state = createMaintenanceState();

      const result = engine.processAction(state, "player1", {
        type: RESOLVE_UNIT_MAINTENANCE_ACTION,
        unitInstanceId: "familiars_1",
        keepUnit: true,
        crystalColor: MANA_RED,
        newManaTokenColor: MANA_GREEN,
      });

      // Crystal should be consumed
      expect(result.state.players[0].crystals.red).toBe(0);
      // Unit should still exist with new mana token
      expect(result.state.players[0].units.length).toBe(1);
      expect(result.state.players[0].units[0].manaToken).toBe(MANA_GREEN);
      // Maintenance should be cleared
      expect(result.state.players[0].pendingUnitMaintenance).toBeNull();
      // Should emit maintenance paid event
      const paidEvent = result.events.find((e) => e.type === UNIT_MAINTENANCE_PAID);
      expect(paidEvent).toBeDefined();
    });

    it("should disband unit when declining to pay", () => {
      const state = createMaintenanceState();

      const result = engine.processAction(state, "player1", {
        type: RESOLVE_UNIT_MAINTENANCE_ACTION,
        unitInstanceId: "familiars_1",
        keepUnit: false,
      });

      // Unit should be removed
      expect(result.state.players[0].units.length).toBe(0);
      // Crystals should be untouched
      expect(result.state.players[0].crystals.red).toBe(1);
      // Maintenance should be cleared
      expect(result.state.players[0].pendingUnitMaintenance).toBeNull();
      // Should emit disbanded event
      const disbandedEvent = result.events.find((e) => e.type === UNIT_DISBANDED);
      expect(disbandedEvent).toBeDefined();
    });

    it("should reject maintenance action when no maintenance pending", () => {
      const player = createTestPlayer({
        units: [createPlayerUnit(UNIT_MAGIC_FAMILIARS, "familiars_1", MANA_RED)],
      });

      const state = createTestGameState({
        players: [player],
      });

      const result = engine.processAction(state, "player1", {
        type: RESOLVE_UNIT_MAINTENANCE_ACTION,
        unitInstanceId: "familiars_1",
        keepUnit: false,
      });

      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });

    it("should reject keeping unit without crystal color", () => {
      const state = createMaintenanceState();

      const result = engine.processAction(state, "player1", {
        type: RESOLVE_UNIT_MAINTENANCE_ACTION,
        unitInstanceId: "familiars_1",
        keepUnit: true,
        // No crystalColor
        newManaTokenColor: MANA_RED,
      });

      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });

    it("should reject keeping unit with unavailable crystal color", () => {
      const state = createMaintenanceState();

      const result = engine.processAction(state, "player1", {
        type: RESOLVE_UNIT_MAINTENANCE_ACTION,
        unitInstanceId: "familiars_1",
        keepUnit: true,
        crystalColor: MANA_BLUE, // Player has 0 blue crystals
        newManaTokenColor: MANA_BLUE,
      });

      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });

    it("should handle multiple familiars maintenance one at a time", () => {
      const unit1 = createPlayerUnit(UNIT_MAGIC_FAMILIARS, "familiars_1", MANA_RED);
      const unit2 = createPlayerUnit(UNIT_MAGIC_FAMILIARS, "familiars_2", MANA_BLUE);
      const player = createTestPlayer({
        units: [unit1, unit2],
        crystals: { red: 1, blue: 1, green: 0, white: 0 },
        pendingUnitMaintenance: [
          { unitInstanceId: "familiars_1", unitId: UNIT_MAGIC_FAMILIARS },
          { unitInstanceId: "familiars_2", unitId: UNIT_MAGIC_FAMILIARS },
        ],
      });

      const state = createTestGameState({
        players: [player],
        roundPhase: "tactics_selection",
        currentTacticSelector: "player1",
        tacticsSelectionOrder: ["player1"],
      });

      // Resolve first unit
      const result1 = engine.processAction(state, "player1", {
        type: RESOLVE_UNIT_MAINTENANCE_ACTION,
        unitInstanceId: "familiars_1",
        keepUnit: true,
        crystalColor: MANA_RED,
        newManaTokenColor: MANA_RED,
      });

      // First resolved, second still pending
      expect(result1.state.players[0].pendingUnitMaintenance).not.toBeNull();
      expect(result1.state.players[0].pendingUnitMaintenance!.length).toBe(1);
      expect(result1.state.players[0].pendingUnitMaintenance![0].unitInstanceId).toBe("familiars_2");

      // Should still show maintenance mode
      const validActions = getValidActions(result1.state, "player1");
      expect(validActions.mode).toBe("pending_unit_maintenance");

      // Resolve second unit
      const result2 = engine.processAction(result1.state, "player1", {
        type: RESOLVE_UNIT_MAINTENANCE_ACTION,
        unitInstanceId: "familiars_2",
        keepUnit: true,
        crystalColor: MANA_BLUE,
        newManaTokenColor: MANA_BLUE,
      });

      // All maintenance cleared
      expect(result2.state.players[0].pendingUnitMaintenance).toBeNull();
      expect(result2.state.players[0].units.length).toBe(2);
    });

    it("should block tactics selection while maintenance is pending", () => {
      const state = createMaintenanceState();
      const validActions = getValidActions(state, "player1");

      // Should be in maintenance mode, not tactics_selection
      expect(validActions.mode).toBe("pending_unit_maintenance");
      expect(validActions.mode).not.toBe("tactics_selection");
    });
  });

  // =========================================================================
  // MAGICAL GLADE RECRUITMENT
  // =========================================================================

  describe("Magical Glade Recruitment", () => {
    function createGladeRecruitmentState(
      manaTokens: { color: BasicManaColor; source: string }[],
      influencePoints = 10
    ) {
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        influencePoints,
        pureMana: manaTokens.map((t) => ({
          color: t.color,
          source: t.source as never,
        })),
      });

      const hexWithGlade = createTestHex(0, 0, TERRAIN_PLAINS, {
        type: SiteType.MagicalGlade,
        owner: null,
        isConquered: false,
        isBurned: false,
      });

      return createTestGameState({
        players: [player],
        offers: {
          advancedActions: [],
          spells: [],
          units: [UNIT_MAGIC_FAMILIARS],
          artifacts: [],
        },
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: hexWithGlade,
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
      });
    }

    it("should allow recruiting from Magical Glade", () => {
      const state = createGladeRecruitmentState([
        { color: MANA_RED, source: "card" },
      ]);

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_MAGIC_FAMILIARS,
        influenceSpent: 6,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED, index: 0 },
        manaTokenColor: MANA_RED,
      });

      const recruitEvent = result.events.find((e) => e.type === UNIT_RECRUITED);
      expect(recruitEvent).toBeDefined();
      expect(result.state.players[0].units.length).toBe(1);
      expect(result.state.players[0].units[0].unitId).toBe(UNIT_MAGIC_FAMILIARS);
    });

    it("should recruit from Magical Glade without reputation modifier", () => {
      // Reputation shouldn't matter for Glade recruitment
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        influencePoints: 6, // Exactly the base cost
        reputation: -5, // Terrible reputation
        pureMana: [{ color: MANA_RED, source: "card" as never }],
      });

      const hexWithGlade = createTestHex(0, 0, TERRAIN_PLAINS, {
        type: SiteType.MagicalGlade,
        owner: null,
        isConquered: false,
        isBurned: false,
      });

      const state = createTestGameState({
        players: [player],
        offers: {
          advancedActions: [],
          spells: [],
          units: [UNIT_MAGIC_FAMILIARS],
          artifacts: [],
        },
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: hexWithGlade,
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
      });

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_MAGIC_FAMILIARS,
        influenceSpent: 6,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED, index: 0 },
        manaTokenColor: MANA_RED,
      });

      // Should succeed despite terrible reputation
      const recruitEvent = result.events.find((e) => e.type === UNIT_RECRUITED);
      expect(recruitEvent).toBeDefined();
    });

    it("should show Magic Familiars as recruitable in valid actions at Magical Glade", () => {
      const state = createGladeRecruitmentState([
        { color: MANA_RED, source: "card" },
      ]);

      const validActions = getValidActions(state, "player1");

      if (validActions.mode === "normal_turn" && validActions.units) {
        const recruitable = validActions.units.recruitable;
        const familiars = recruitable.find(
          (u) => u.unitId === UNIT_MAGIC_FAMILIARS
        );
        expect(familiars).toBeDefined();
      }
    });
  });

  // =========================================================================
  // UNDO TESTS
  // =========================================================================

  describe("Undo", () => {
    it("should undo attack ability activation with mana token bonus", () => {
      const unit = createPlayerUnit(UNIT_MAGIC_FAMILIARS, "familiars_1", MANA_RED);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      // Activate attack with red mana token (bonus 5)
      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "familiars_1",
        abilityIndex: 0,
      });

      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(5);

      // Undo should remove the full 5 (effective value with bonus)
      const undoResult = engine.processAction(result.state, "player1", {
        type: UNDO_ACTION_TYPE,
      });
      expect(undoResult.state.players[0].combatAccumulator.attack.normal).toBe(0);
      expect(undoResult.state.players[0].units[0].state).not.toBe(UNIT_STATE_SPENT);
    });

    it("should undo recruit with mana payment and restore mana token", () => {
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        influencePoints: 10,
        pureMana: [{ color: MANA_RED, source: "card" as never }],
      });

      const hexWithMageTower = createTestHex(0, 0, TERRAIN_PLAINS, {
        type: SiteType.MageTower,
        owner: "player1",
        isConquered: true,
        isBurned: false,
      });

      const state = createTestGameState({
        players: [player],
        offers: {
          advancedActions: [],
          spells: [],
          units: [UNIT_MAGIC_FAMILIARS],
          artifacts: [],
        },
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: hexWithMageTower,
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
      });

      // Recruit with mana payment
      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_MAGIC_FAMILIARS,
        influenceSpent: 6,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED, index: 0 },
        manaTokenColor: MANA_RED,
      });

      expect(result.state.players[0].units.length).toBe(1);
      expect(result.state.players[0].pureMana.length).toBe(0);

      // Undo should restore mana and remove unit
      const undoResult = engine.processAction(result.state, "player1", {
        type: UNDO_ACTION_TYPE,
      });
      expect(undoResult.state.players[0].units.length).toBe(0);
      expect(undoResult.state.players[0].pureMana.length).toBe(1);
      expect(undoResult.state.players[0].pureMana[0].color).toBe(MANA_RED);
    });
  });

  // =========================================================================
  // VALIDATOR DEFENSIVE BRANCHES
  // =========================================================================

  describe("Validator Defensive Branches", () => {
    it("validateHasPendingUnitMaintenance returns PLAYER_NOT_FOUND for missing player", () => {
      const state = createTestGameState({ players: [] });
      const action: PlayerAction = {
        type: RESOLVE_UNIT_MAINTENANCE_ACTION,
        unitInstanceId: "familiars_1",
        keepUnit: false,
      };
      const result = validateHasPendingUnitMaintenance(state, "nonexistent", action);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("PLAYER_NOT_FOUND");
      }
    });

    it("validateUnitMaintenanceChoice returns valid for wrong action type", () => {
      const state = createTestGameState({ players: [] });
      const action = { type: ACTIVATE_UNIT_ACTION } as PlayerAction;
      const result = validateUnitMaintenanceChoice(state, "player1", action);
      expect(result.valid).toBe(true);
    });

    it("validateUnitMaintenanceChoice returns PLAYER_NOT_FOUND for missing player", () => {
      const state = createTestGameState({ players: [] });
      const action: PlayerAction = {
        type: RESOLVE_UNIT_MAINTENANCE_ACTION,
        unitInstanceId: "familiars_1",
        keepUnit: false,
      };
      const result = validateUnitMaintenanceChoice(state, "nonexistent", action);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("PLAYER_NOT_FOUND");
      }
    });

    it("validateUnitMaintenanceChoice returns valid when pendingUnitMaintenance is null", () => {
      const player = createTestPlayer({ pendingUnitMaintenance: null });
      const state = createTestGameState({ players: [player] });
      const action: PlayerAction = {
        type: RESOLVE_UNIT_MAINTENANCE_ACTION,
        unitInstanceId: "familiars_1",
        keepUnit: false,
      };
      const result = validateUnitMaintenanceChoice(state, "player1", action);
      // Returns valid() — the null case is caught by validateHasPendingUnitMaintenance
      expect(result.valid).toBe(true);
    });

    it("validateUnitMaintenanceChoice rejects unit not in maintenance list", () => {
      const player = createTestPlayer({
        pendingUnitMaintenance: [
          { unitInstanceId: "familiars_1", unitId: UNIT_MAGIC_FAMILIARS },
        ],
      });
      const state = createTestGameState({ players: [player] });
      const action: PlayerAction = {
        type: RESOLVE_UNIT_MAINTENANCE_ACTION,
        unitInstanceId: "wrong_unit",
        keepUnit: false,
      };
      const result = validateUnitMaintenanceChoice(state, "player1", action);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("UNIT_NOT_IN_MAINTENANCE");
      }
    });

    it("validateUnitMaintenanceChoice rejects keeping without newManaTokenColor", () => {
      const player = createTestPlayer({
        crystals: { red: 1, blue: 0, green: 0, white: 0 },
        pendingUnitMaintenance: [
          { unitInstanceId: "familiars_1", unitId: UNIT_MAGIC_FAMILIARS },
        ],
      });
      const state = createTestGameState({ players: [player] });
      const action: PlayerAction = {
        type: RESOLVE_UNIT_MAINTENANCE_ACTION,
        unitInstanceId: "familiars_1",
        keepUnit: true,
        crystalColor: MANA_RED,
        // No newManaTokenColor
      };
      const result = validateUnitMaintenanceChoice(state, "player1", action);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("MAINTENANCE_REQUIRES_TOKEN_COLOR");
      }
    });

    it("validateRecruitManaPayment returns PLAYER_NOT_FOUND for missing player", () => {
      const state = createTestGameState({ players: [] });
      const action: PlayerAction = {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_MAGIC_FAMILIARS,
        influenceSpent: 6,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED, index: 0 },
        manaTokenColor: MANA_RED,
      };
      const result = validateRecruitManaPayment(state, "nonexistent", action);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("PLAYER_NOT_FOUND");
      }
    });

    it("validateRecruitManaPayment rejects when no mana available", () => {
      const player = createTestPlayer({
        pureMana: [], // No mana tokens
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({
        players: [player],
        source: {
          dice: [],
          usedDice: [],
          dummyDice: 0,
        },
      });
      const action: PlayerAction = {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_MAGIC_FAMILIARS,
        influenceSpent: 6,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED, index: 0 },
        manaTokenColor: MANA_RED,
      };
      const result = validateRecruitManaPayment(state, "player1", action);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("RECRUIT_REQUIRES_MANA");
      }
    });
  });

  // =========================================================================
  // COMMAND DEFENSIVE BRANCHES
  // =========================================================================

  describe("Command Defensive Branches", () => {
    it("resolveUnitMaintenance undo throws error", () => {
      const command = createResolveUnitMaintenanceCommand({
        playerId: "player1",
        unitInstanceId: "familiars_1",
        keepUnit: false,
      });

      const state = createTestGameState({ players: [] });
      expect(() => command.undo(state)).toThrow("Cannot undo RESOLVE_UNIT_MAINTENANCE");
    });

    it("resolveUnitMaintenance execute throws for missing crystal", () => {
      const unit = createPlayerUnit(UNIT_MAGIC_FAMILIARS, "familiars_1", MANA_RED);
      const player = createTestPlayer({
        units: [unit],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });

      const state = createTestGameState({ players: [player] });

      const command = createResolveUnitMaintenanceCommand({
        playerId: "player1",
        unitInstanceId: "familiars_1",
        keepUnit: true,
        crystalColor: MANA_RED,
        newManaTokenColor: MANA_BLUE,
      });

      expect(() => command.execute(state)).toThrow("No red crystal available");
    });
  });
});
