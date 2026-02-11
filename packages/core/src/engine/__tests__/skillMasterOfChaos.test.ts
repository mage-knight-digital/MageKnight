import { beforeEach, describe, expect, it } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import {
  createTestGameState,
  createTestPlayer,
  createUnitCombatState,
} from "./testHelpers.js";
import {
  CARD_BLOOD_RAGE,
  CARD_INTIMIDATE,
  INVALID_ACTION,
  MANA_BLACK,
  MANA_BLUE,
  MANA_GOLD,
  MANA_GREEN,
  MANA_RED,
  MANA_WHITE,
  RESOLVE_CHOICE_ACTION,
  USE_SKILL_ACTION,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import {
  SKILL_KRANG_BATTLE_FRENZY,
  SKILL_KRANG_MASTER_OF_CHAOS,
} from "../../data/skills/index.js";
import { createChooseLevelUpRewardsCommand } from "../commands/chooseLevelUpRewardsCommand.js";
import { createResetPlayer } from "../commands/endTurn/playerReset.js";
import { createMasterOfChaosState } from "../rules/masterOfChaos.js";
import { COMBAT_PHASE_ATTACK, COMBAT_PHASE_RANGED_SIEGE } from "../../types/combat.js";

function buildSkillCooldowns() {
  return {
    usedThisRound: [] as string[],
    usedThisTurn: [] as string[],
    usedThisCombat: [] as string[],
    activeUntilNextTurn: [] as string[],
  };
}

function createMasterOfChaosPlayer(
  position: typeof MANA_BLUE | typeof MANA_GREEN | typeof MANA_BLACK | typeof MANA_WHITE | typeof MANA_RED | typeof MANA_GOLD,
  freeRotateAvailable = false
) {
  return createTestPlayer({
    hero: Hero.Krang,
    skills: [SKILL_KRANG_MASTER_OF_CHAOS],
    skillCooldowns: buildSkillCooldowns(),
    masterOfChaosState: createMasterOfChaosState(position, freeRotateAvailable),
    movePoints: 0,
    influencePoints: 0,
  });
}

describe("Master of Chaos skill (Krang)", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it("initializes a random position when the skill is gained at level up", () => {
    const player = createTestPlayer({
      hero: Hero.Krang,
      pendingLevelUpRewards: [
        {
          level: 2,
          drawnSkills: [SKILL_KRANG_MASTER_OF_CHAOS, SKILL_KRANG_BATTLE_FRENZY],
        },
      ],
    });

    const state = createTestGameState({
      players: [player],
      offers: {
        units: [],
        advancedActions: { cards: [CARD_BLOOD_RAGE, CARD_INTIMIDATE] },
        spells: { cards: [] },
        commonSkills: [],
        monasteryAdvancedActions: [],
      },
    });

    const command = createChooseLevelUpRewardsCommand({
      playerId: "player1",
      level: 2,
      skillChoice: {
        fromCommonPool: false,
        skillId: SKILL_KRANG_MASTER_OF_CHAOS,
      },
      advancedActionId: CARD_BLOOD_RAGE,
    });

    const result = command.execute(state);
    const updatedPlayer = result.state.players[0];

    expect(updatedPlayer?.masterOfChaosState).toBeDefined();
    expect([
      MANA_BLUE,
      MANA_GREEN,
      MANA_BLACK,
      MANA_WHITE,
      MANA_RED,
      MANA_GOLD,
    ]).toContain(updatedPlayer?.masterOfChaosState?.position);
    expect(updatedPlayer?.masterOfChaosState?.freeRotateAvailable).toBe(false);
  });

  it("rotates blue -> green and grants Move 1", () => {
    const state = createTestGameState({
      players: [createMasterOfChaosPlayer(MANA_BLUE)],
    });

    const result = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_MASTER_OF_CHAOS,
    });

    const player = result.state.players[0];
    expect(player?.masterOfChaosState?.position).toBe(MANA_GREEN);
    expect(player?.movePoints).toBe(1);
  });

  it("rotates green -> black and grants Ranged Cold Fire Attack 1", () => {
    const state = createTestGameState({
      players: [createMasterOfChaosPlayer(MANA_GREEN)],
      combat: createUnitCombatState(COMBAT_PHASE_RANGED_SIEGE),
    });

    const result = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_MASTER_OF_CHAOS,
    });

    const attack = result.state.players[0]?.combatAccumulator.attack;
    expect(result.state.players[0]?.masterOfChaosState?.position).toBe(MANA_BLACK);
    expect(attack?.rangedElements.coldFire).toBe(1);
  });

  it("rotates black -> white and grants Influence 2", () => {
    const state = createTestGameState({
      players: [createMasterOfChaosPlayer(MANA_BLACK)],
    });

    const result = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_MASTER_OF_CHAOS,
    });

    const player = result.state.players[0];
    expect(player?.masterOfChaosState?.position).toBe(MANA_WHITE);
    expect(player?.influencePoints).toBe(2);
  });

  it("rotates white -> red and grants Attack 2", () => {
    const state = createTestGameState({
      players: [createMasterOfChaosPlayer(MANA_WHITE)],
      combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
    });

    const result = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_MASTER_OF_CHAOS,
    });

    const attack = result.state.players[0]?.combatAccumulator.attack;
    expect(result.state.players[0]?.masterOfChaosState?.position).toBe(MANA_RED);
    expect(attack?.normal).toBe(2);
  });

  it("rotates gold -> blue and grants Block 3", () => {
    const state = createTestGameState({
      players: [createMasterOfChaosPlayer(MANA_GOLD)],
    });

    const result = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_MASTER_OF_CHAOS,
    });

    const block = result.state.players[0]?.combatAccumulator;
    expect(result.state.players[0]?.masterOfChaosState?.position).toBe(MANA_BLUE);
    expect(block?.block).toBe(3);
    expect(block?.blockElements.physical).toBe(3);
  });

  it("rotates red -> gold and presents a choice of all five effects when in combat", () => {
    const combat = createUnitCombatState(COMBAT_PHASE_ATTACK);
    const state = createTestGameState({
      players: [createMasterOfChaosPlayer(MANA_RED)],
      combat,
    });

    const afterUse = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_MASTER_OF_CHAOS,
    });

    expect(afterUse.state.players[0]?.masterOfChaosState?.position).toBe(MANA_GOLD);
    expect(afterUse.state.players[0]?.pendingChoice?.skillId).toBe(
      SKILL_KRANG_MASTER_OF_CHAOS
    );
    expect(afterUse.state.players[0]?.pendingChoice?.options).toHaveLength(5);

    const afterChoice = engine.processAction(afterUse.state, "player1", {
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex: 3, // Influence 2
    });

    expect(afterChoice.state.players[0]?.influencePoints).toBe(2);
    expect(afterChoice.state.players[0]?.pendingChoice).toBeNull();
  });

  it("filters to Move/Influence when not in combat (attack/block/ranged require combat)", () => {
    const state = createTestGameState({
      players: [createMasterOfChaosPlayer(MANA_RED)],
    });

    const afterUse = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_MASTER_OF_CHAOS,
    });

    // Block, Ranged, and Attack filtered out when not in combat (all use attack/block)
    expect(afterUse.state.players[0]?.pendingChoice?.options).toHaveLength(2);

    const afterChoice = engine.processAction(afterUse.state, "player1", {
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex: 1, // Influence 2 (of Move, Influence)
    });

    expect(afterChoice.state.players[0]?.influencePoints).toBe(2);
  });

  it("allows off-turn free rotate without effect or cooldown use", () => {
    const player1 = createTestPlayer({ id: "player1", hero: Hero.Arythea });
    const player2 = createMasterOfChaosPlayer(MANA_BLUE, true);
    const state = createTestGameState({
      players: [player1, { ...player2, id: "player2" }],
      turnOrder: ["player1", "player2"],
      currentPlayerIndex: 0,
    });

    const result = engine.processAction(state, "player2", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_MASTER_OF_CHAOS,
    });

    const updatedPlayer2 = result.state.players.find((p) => p.id === "player2");
    expect(result.events).not.toContainEqual(
      expect.objectContaining({ type: INVALID_ACTION })
    );
    expect(updatedPlayer2?.masterOfChaosState?.position).toBe(MANA_GREEN);
    expect(updatedPlayer2?.masterOfChaosState?.freeRotateAvailable).toBe(false);
    expect(updatedPlayer2?.movePoints).toBe(0);
    expect(updatedPlayer2?.skillCooldowns.usedThisTurn).not.toContain(
      SKILL_KRANG_MASTER_OF_CHAOS
    );
  });

  it("rejects off-turn free rotate when the window is not available", () => {
    const player1 = createTestPlayer({ id: "player1", hero: Hero.Arythea });
    const player2 = createMasterOfChaosPlayer(MANA_BLUE, false);
    const state = createTestGameState({
      players: [player1, { ...player2, id: "player2" }],
      turnOrder: ["player1", "player2"],
      currentPlayerIndex: 0,
    });

    const result = engine.processAction(state, "player2", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_MASTER_OF_CHAOS,
    });

    expect(result.events).toContainEqual(
      expect.objectContaining({ type: INVALID_ACTION })
    );
  });

  it("opens free-rotate window on end-turn reset when skill was not used", () => {
    const player = createMasterOfChaosPlayer(MANA_RED, false);
    const resetPlayer = createResetPlayer(player, {
      hand: [],
      deck: [],
      discard: [],
      playArea: [],
      cardsDrawn: 0,
    });

    expect(resetPlayer.masterOfChaosState?.position).toBe(MANA_RED);
    expect(resetPlayer.masterOfChaosState?.freeRotateAvailable).toBe(true);
  });

  it("does not open free-rotate window on end-turn reset when skill was used", () => {
    const player = createTestPlayer({
      ...createMasterOfChaosPlayer(MANA_RED, false),
      skillCooldowns: {
        ...buildSkillCooldowns(),
        usedThisTurn: [SKILL_KRANG_MASTER_OF_CHAOS],
      },
    });
    const resetPlayer = createResetPlayer(player, {
      hand: [],
      deck: [],
      discard: [],
      playArea: [],
      cardsDrawn: 0,
    });

    expect(resetPlayer.masterOfChaosState?.freeRotateAvailable).toBe(false);
  });
});
