import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer, createUnitCombatState } from "./testHelpers.js";
import { isAbilityNullified, doesEnemyAttackThisCombat } from "../modifiers/combat.js";
import {
  ABILITY_ASSASSINATION,
  ABILITY_POISON,
  CARD_CHILLING_STARE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_RANGED_SIEGE,
  getEnemy,
  ENEMY_GUNNERS,
  ENEMY_ORC_SUMMONERS,
  ENEMY_SORCERERS,
  ENEMY_DIGGERS,
  ENTER_COMBAT_ACTION,
  MANA_SOURCE_TOKEN,
  MANA_WHITE,
  PLAY_CARD_ACTION,
  RESOLVE_CHOICE_ACTION,
} from "@mage-knight/shared";
import {
  EFFECT_ABILITY_NULLIFIER,
  EFFECT_ENEMY_SKIP_ATTACK,
} from "../../types/modifierConstants.js";

describe("Chilling Stare", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it("basic can be used outside combat for Influence 3", () => {
    const player = createTestPlayer({ hand: [CARD_CHILLING_STARE] });
    let state = createTestGameState({ players: [player] });

    const playResult = engine.processAction(state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_CHILLING_STARE,
      powered: false,
    });
    state = playResult.state;

    if (state.players[0]?.pendingChoice) {
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;
    }

    expect(state.players[0]?.influencePoints).toBe(3);
  });

  it("basic removes attack abilities on Arcane Immune enemies (but keeps attack element)", () => {
    const player = createTestPlayer({ hand: [CARD_CHILLING_STARE] });
    let state = createTestGameState({ players: [player] });

    state = engine.processAction(state, "player1", {
      type: ENTER_COMBAT_ACTION,
      enemyIds: [ENEMY_SORCERERS],
    }).state;

    const enemyInstanceId = state.combat?.enemies[0]?.instanceId ?? "";
    const beforeAttackElement = state.combat?.enemies[0]?.definition.attackElement;

    state = engine.processAction(state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_CHILLING_STARE,
      powered: false,
    }).state;

    state = engine.processAction(state, "player1", {
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex: 1,
    }).state;

    if (state.players[0]?.pendingChoice) {
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;
    }

    expect(isAbilityNullified(state, "player1", enemyInstanceId, ABILITY_POISON)).toBe(true);
    expect(isAbilityNullified(state, "player1", enemyInstanceId, ABILITY_ASSASSINATION)).toBe(true);
    expect(state.combat?.enemies[0]?.definition.attackElement).toBe(beforeAttackElement);
  });

  it("basic enemy-cancellation mode is blocked by Ice Resistance", () => {
    const player = createTestPlayer({ hand: [CARD_CHILLING_STARE] });
    let state = createTestGameState({ players: [player] });

    state = engine.processAction(state, "player1", {
      type: ENTER_COMBAT_ACTION,
      enemyIds: [ENEMY_GUNNERS],
    }).state;

    state = engine.processAction(state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_CHILLING_STARE,
      powered: false,
    }).state;

    state = engine.processAction(state, "player1", {
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex: 1,
    }).state;

    const nullifiers = state.activeModifiers.filter(
      (m) => m.effect.type === EFFECT_ABILITY_NULLIFIER
    );
    expect(nullifiers).toHaveLength(0);
  });

  it("powered enemy-cancellation mode is blocked by Arcane Immunity and Ice Resistance", () => {
    const player = createTestPlayer({
      hand: [CARD_CHILLING_STARE],
      pureMana: [{ color: MANA_WHITE, source: "token" }],
    });
    let state = createTestGameState({ players: [player] });

    state = engine.processAction(state, "player1", {
      type: ENTER_COMBAT_ACTION,
      enemyIds: [ENEMY_SORCERERS, ENEMY_GUNNERS],
    }).state;

    state = engine.processAction(state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_CHILLING_STARE,
      powered: true,
      manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_WHITE }],
    }).state;

    state = engine.processAction(state, "player1", {
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex: 1,
    }).state;

    const skipAttack = state.activeModifiers.filter(
      (m) => m.effect.type === EFFECT_ENEMY_SKIP_ATTACK
    );
    expect(skipAttack).toHaveLength(0);
  });

  it("basic targets summoned monsters (not summoners)", () => {
    const summonerId = "enemy_summoner";
    const summonedId = "enemy_summoned";
    const otherEnemyId = "enemy_other";
    const player = createTestPlayer({ hand: [CARD_CHILLING_STARE] });
    const combat = createUnitCombatState(COMBAT_PHASE_BLOCK);
    let state = createTestGameState({
      players: [player],
      combat: {
        ...combat,
        phase: COMBAT_PHASE_BLOCK,
        enemies: [
          {
            instanceId: summonerId,
            enemyId: ENEMY_ORC_SUMMONERS,
            definition: getEnemy(ENEMY_ORC_SUMMONERS),
            isBlocked: false,
            isDefeated: false,
            damageAssigned: false,
            isRequiredForConquest: true,
            isSummonerHidden: true,
          },
          {
            instanceId: summonedId,
            enemyId: ENEMY_DIGGERS,
            definition: getEnemy(ENEMY_DIGGERS),
            isBlocked: false,
            isDefeated: false,
            damageAssigned: false,
            isRequiredForConquest: false,
            summonedByInstanceId: summonerId,
          },
          {
            instanceId: otherEnemyId,
            enemyId: ENEMY_DIGGERS,
            definition: getEnemy(ENEMY_DIGGERS),
            isBlocked: false,
            isDefeated: false,
            damageAssigned: false,
            isRequiredForConquest: true,
          },
        ],
      },
    });

    state = engine.processAction(state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_CHILLING_STARE,
      powered: false,
    }).state;

    state = engine.processAction(state, "player1", {
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex: 1,
    }).state;

    const options = state.players[0]?.pendingChoice?.options ?? [];
    const targetIds = options
      .map((o) => (o as { enemyInstanceId?: string }).enemyInstanceId)
      .filter((id): id is string => id !== undefined);

    expect(targetIds).toContain(summonedId);
    expect(targetIds).not.toContain(summonerId);
  });

  it("powered targets summoners (not summoned monsters)", () => {
    const summonerId = "enemy_summoner";
    const summonedId = "enemy_summoned";
    const otherEnemyId = "enemy_other";
    const player = createTestPlayer({
      hand: [CARD_CHILLING_STARE],
      pureMana: [{ color: MANA_WHITE, source: "token" }],
    });
    const combat = createUnitCombatState(COMBAT_PHASE_RANGED_SIEGE);
    let state = createTestGameState({
      players: [player],
      combat: {
        ...combat,
        phase: COMBAT_PHASE_RANGED_SIEGE,
        enemies: [
          {
            instanceId: summonerId,
            enemyId: ENEMY_ORC_SUMMONERS,
            definition: getEnemy(ENEMY_ORC_SUMMONERS),
            isBlocked: false,
            isDefeated: false,
            damageAssigned: false,
            isRequiredForConquest: true,
            isSummonerHidden: false,
          },
          {
            instanceId: summonedId,
            enemyId: ENEMY_DIGGERS,
            definition: getEnemy(ENEMY_DIGGERS),
            isBlocked: false,
            isDefeated: false,
            damageAssigned: false,
            isRequiredForConquest: false,
            summonedByInstanceId: summonerId,
          },
          {
            instanceId: otherEnemyId,
            enemyId: ENEMY_DIGGERS,
            definition: getEnemy(ENEMY_DIGGERS),
            isBlocked: false,
            isDefeated: false,
            damageAssigned: false,
            isRequiredForConquest: true,
          },
        ],
      },
    });

    state = engine.processAction(state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_CHILLING_STARE,
      powered: true,
      manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_WHITE }],
    }).state;

    state = engine.processAction(state, "player1", {
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex: 1,
    }).state;

    const options = state.players[0]?.pendingChoice?.options ?? [];
    const targetIds = options
      .map((o) => (o as { enemyInstanceId?: string }).enemyInstanceId)
      .filter((id): id is string => id !== undefined);

    expect(targetIds).toContain(summonerId);
    expect(targetIds).not.toContain(summonedId);
  });

  it("powered applies skip-attack to valid targets", () => {
    const player = createTestPlayer({
      hand: [CARD_CHILLING_STARE],
      pureMana: [{ color: MANA_WHITE, source: "token" }],
    });
    let state = createTestGameState({ players: [player] });

    state = engine.processAction(state, "player1", {
      type: ENTER_COMBAT_ACTION,
      enemyIds: [ENEMY_DIGGERS],
    }).state;

    const enemyInstanceId = state.combat?.enemies[0]?.instanceId ?? "";

    state = engine.processAction(state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_CHILLING_STARE,
      powered: true,
      manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_WHITE }],
    }).state;

    state = engine.processAction(state, "player1", {
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex: 1,
    }).state;

    if (state.players[0]?.pendingChoice) {
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;
    }

    expect(doesEnemyAttackThisCombat(state, enemyInstanceId)).toBe(false);
  });
});
