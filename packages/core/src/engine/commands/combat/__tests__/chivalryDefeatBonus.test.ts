/**
 * Chivalry defeat bonus tests
 *
 * Tests for the Chivalry advanced action card's per-enemy-defeated
 * reputation and fame bonuses.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../../../MageKnightEngine.js";
import { createTestPlayer, createTestGameState } from "../../../__tests__/testHelpers.js";
import { resolveEffect, addBonusToEffect } from "../../../effects/index.js";
import { reverseEffect } from "../../../effects/reverse.js";
import { describeEffect } from "../../../effects/describeEffect.js";
import { CHIVALRY } from "../../../../data/advancedActions/white/chivalry.js";
import type { ChoiceEffect, AttackWithDefeatBonusEffect } from "../../../../types/cards.js";
import {
  EFFECT_ATTACK_WITH_DEFEAT_BONUS,
  COMBAT_TYPE_MELEE,
} from "../../../../types/effectTypes.js";
import {
  ENTER_COMBAT_ACTION,
  ASSIGN_ATTACK_ACTION,
  END_COMBAT_PHASE_ACTION,
  ATTACK_TYPE_MELEE,
  ATTACK_ELEMENT_PHYSICAL,
  ENEMY_PROWLERS,
  getEnemy,
} from "@mage-knight/shared";
import { COMBAT_PHASE_ATTACK } from "../../../../types/combat.js";
import type { GameState } from "../../../../state/GameState.js";

/** Extract choice options from a ChoiceEffect. */
function getChoiceOptions(effect: ChoiceEffect) {
  return effect.options;
}

/** Skip combat to the attack phase by setting it directly. */
function skipToAttackPhase(state: GameState): GameState {
  if (!state.combat) throw new Error("Not in combat");
  return {
    ...state,
    combat: { ...state.combat, phase: COMBAT_PHASE_ATTACK },
  };
}

/** Add extra melee attack to a player's combat accumulator. */
function addMeleeAttack(state: GameState, playerId: string, amount: number): GameState {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  const player = state.players[playerIndex]!;
  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...player,
    combatAccumulator: {
      ...player.combatAccumulator,
      attack: {
        ...player.combatAccumulator.attack,
        normal: player.combatAccumulator.attack.normal + amount,
      },
    },
  };
  return { ...state, players: updatedPlayers };
}

const basicOptions = getChoiceOptions(CHIVALRY.basicEffect as ChoiceEffect);
const poweredOptions = getChoiceOptions(CHIVALRY.poweredEffect as ChoiceEffect);

describe("Chivalry defeat bonus", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("basic effect", () => {
    it("grants reputation per enemy defeated when choosing defeat bonus option", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = skipToAttackPhase(state);

      // Resolve the defeat bonus option directly (Attack 2 + Rep per enemy)
      const effectResult = resolveEffect(state, "player1", basicOptions[1]!, CHIVALRY.id);
      state = effectResult.state;

      const enemyDef = getEnemy(ENEMY_PROWLERS);

      // We have Attack 2, need 3 to defeat prowlers. Add 1 more.
      state = addMeleeAttack(state, "player1", 1);

      state = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: enemyDef.armor,
      }).state;

      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.fame).toBe(enemyDef.fame);
      expect(player?.reputation).toBe(1);
    });

    it("does not grant reputation when no enemy is defeated", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = skipToAttackPhase(state);

      // Resolve defeat bonus option
      const effectResult = resolveEffect(state, "player1", basicOptions[1]!, CHIVALRY.id);
      state = effectResult.state;

      // Assign only 1 point of attack (enemy needs 3)
      state = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 1,
      }).state;

      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.fame).toBe(0);
      expect(player?.reputation).toBe(0);
    });

    it("plain Attack 3 option does not grant reputation bonus", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = skipToAttackPhase(state);

      // Resolve the plain Attack 3 option
      const effectResult = resolveEffect(state, "player1", basicOptions[0]!, CHIVALRY.id);
      state = effectResult.state;

      const enemyDef = getEnemy(ENEMY_PROWLERS);

      state = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: enemyDef.armor,
      }).state;

      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.fame).toBe(enemyDef.fame);
      expect(player?.reputation).toBe(0);
    });
  });

  describe("powered effect", () => {
    it("grants reputation and fame per enemy defeated", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = skipToAttackPhase(state);

      // Resolve defeat bonus option (Attack 4 + Rep+1, Fame+1 per enemy)
      const effectResult = resolveEffect(state, "player1", poweredOptions[1]!, CHIVALRY.id);
      state = effectResult.state;

      const enemyDef = getEnemy(ENEMY_PROWLERS);

      // Attack 4 is enough to defeat prowlers (armor 3)
      state = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: enemyDef.armor,
      }).state;

      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      const player = result.state.players.find((p) => p.id === "player1");
      // Enemy fame + 1 fame from tracker per defeated enemy
      expect(player?.fame).toBe(enemyDef.fame + 1);
      expect(player?.reputation).toBe(1);
    });

    it("scales reputation and fame with multiple defeated enemies", () => {
      let state = createTestGameState();

      // Use two prowlers (armor 3 each) so we can defeat both
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS, ENEMY_PROWLERS],
      }).state;

      state = skipToAttackPhase(state);

      // Resolve defeat bonus option (Attack 4)
      const effectResult = resolveEffect(state, "player1", poweredOptions[1]!, CHIVALRY.id);
      state = effectResult.state;

      const prowlersDef = getEnemy(ENEMY_PROWLERS);

      // Attack 4, need 3+3=6 total. Add 2 more.
      state = addMeleeAttack(state, "player1", 2);

      state = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: prowlersDef.armor,
      }).state;

      state = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_1",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: prowlersDef.armor,
      }).state;

      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      const player = result.state.players.find((p) => p.id === "player1");
      // Fame from both enemies + 2 fame from tracker (1 per enemy)
      expect(player?.fame).toBe(prowlersDef.fame * 2 + 2);
      // +2 reputation (1 per enemy)
      expect(player?.reputation).toBe(2);
    });
  });

  describe("reverseEffect", () => {
    const defeatBonusEffect: AttackWithDefeatBonusEffect = {
      type: EFFECT_ATTACK_WITH_DEFEAT_BONUS,
      amount: 2,
      combatType: COMBAT_TYPE_MELEE,
      reputationPerDefeat: 1,
      famePerDefeat: 0,
    };

    it("reverses melee attack and removes tracker", () => {
      const player = createTestPlayer({
        combatAccumulator: {
          attack: { normal: 2, ranged: 0, siege: 0, fire: 0, ice: 0, coldFire: 0 },
          block: { normal: 0, fire: 0, ice: 0, coldFire: 0 },
        },
        pendingAttackDefeatFame: [
          {
            sourceCardId: null,
            attackType: ATTACK_TYPE_MELEE,
            element: ATTACK_ELEMENT_PHYSICAL,
            amount: 2,
            remaining: 2,
            assignedByEnemy: {},
            fame: 0,
            reputationPerDefeat: 1,
            famePerDefeat: 0,
          },
        ],
      });

      const reversed = reverseEffect(player, defeatBonusEffect);
      expect(reversed.combatAccumulator.attack.normal).toBe(0);
      expect(reversed.pendingAttackDefeatFame).toHaveLength(0);
    });
  });

  describe("describeEffect", () => {
    it("describes basic defeat bonus (reputation only)", () => {
      const effect: AttackWithDefeatBonusEffect = {
        type: EFFECT_ATTACK_WITH_DEFEAT_BONUS,
        amount: 2,
        combatType: COMBAT_TYPE_MELEE,
        reputationPerDefeat: 1,
        famePerDefeat: 0,
      };
      const desc = describeEffect(effect);
      expect(desc).toContain("Attack 2");
      expect(desc).toContain("Rep +1");
      expect(desc).not.toContain("Fame");
    });

    it("describes powered defeat bonus (reputation and fame)", () => {
      const effect: AttackWithDefeatBonusEffect = {
        type: EFFECT_ATTACK_WITH_DEFEAT_BONUS,
        amount: 4,
        combatType: COMBAT_TYPE_MELEE,
        reputationPerDefeat: 1,
        famePerDefeat: 1,
      };
      const desc = describeEffect(effect);
      expect(desc).toContain("Attack 4");
      expect(desc).toContain("Rep +1");
      expect(desc).toContain("Fame +1");
    });
  });

  describe("addBonusToEffect", () => {
    it("adds bonus to attack amount for defeat bonus effect", () => {
      const effect: AttackWithDefeatBonusEffect = {
        type: EFFECT_ATTACK_WITH_DEFEAT_BONUS,
        amount: 2,
        combatType: COMBAT_TYPE_MELEE,
        reputationPerDefeat: 1,
        famePerDefeat: 0,
      };
      const boosted = addBonusToEffect(effect, 2) as AttackWithDefeatBonusEffect;
      expect(boosted.amount).toBe(4);
      expect(boosted.reputationPerDefeat).toBe(1);
      expect(boosted.famePerDefeat).toBe(0);
    });
  });
});
