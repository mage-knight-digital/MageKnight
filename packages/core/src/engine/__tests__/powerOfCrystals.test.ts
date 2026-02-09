import { describe, expect, it } from "vitest";
import {
  CARD_POWER_OF_CRYSTALS,
  CARD_RAGE,
  CARD_SWIFTNESS,
  CARD_MARCH,
  CARD_STAMINA,
  CARD_WOUND,
  CHOICE_REQUIRED,
  ENEMIES,
  ENEMY_FIRE_CATAPULT,
  MANA_GREEN,
  MANA_SOURCE_TOKEN,
} from "@mage-knight/shared";
import type { CombatState } from "../../types/combat.js";
import {
  COMBAT_CONTEXT_STANDARD,
  COMBAT_PHASE_BLOCK,
} from "../../types/combat.js";
import type { GainCrystalEffect, PowerOfCrystalsBasicEffect } from "../../types/cards.js";
import {
  EFFECT_DRAW_CARDS,
  EFFECT_GAIN_HEALING,
  EFFECT_GAIN_MOVE,
  EFFECT_POWER_OF_CRYSTALS_BASIC,
} from "../../types/effectTypes.js";
import { resolveEffect, isEffectResolvable } from "../effects/index.js";
import { handlePowerOfCrystalsBasic } from "../effects/powerOfCrystalsEffects.js";
import { createPlayCardCommand } from "../commands/playCardCommand.js";
import { createResolveChoiceCommand } from "../commands/resolveChoiceCommand.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";

const basicEffect: PowerOfCrystalsBasicEffect = { type: EFFECT_POWER_OF_CRYSTALS_BASIC };

function createCumbersomeCombatState(): CombatState {
  const def = ENEMIES[ENEMY_FIRE_CATAPULT];
  return {
    enemies: [
      {
        instanceId: "enemy_1",
        enemyId: ENEMY_FIRE_CATAPULT,
        definition: def,
        isBlocked: false,
        isDefeated: false,
        damageAssigned: false,
        isRequiredForConquest: true,
      },
    ],
    phase: COMBAT_PHASE_BLOCK,
    woundsThisCombat: 0,
    attacksThisPhase: 0,
    fameGained: 0,
    isAtFortifiedSite: false,
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
  };
}

describe("Power of Crystals basic effect", () => {
  it("offers only missing crystal colors", () => {
    const player = createTestPlayer({
      crystals: { red: 1, blue: 0, green: 0, white: 2 },
    });
    const state = createTestGameState({ players: [player] });

    const result = handlePowerOfCrystalsBasic(state, player.id, basicEffect, resolveEffect);
    expect(result.requiresChoice).toBe(true);

    const options = result.dynamicChoiceOptions as GainCrystalEffect[];
    expect(options).toHaveLength(2);
    expect(options.map((o) => o.color)).toEqual(["blue", "green"]);
  });

  it("auto-resolves when only one crystal color is missing", () => {
    const player = createTestPlayer({
      crystals: { red: 1, blue: 1, green: 1, white: 0 },
    });
    const state = createTestGameState({ players: [player] });

    const result = handlePowerOfCrystalsBasic(state, player.id, basicEffect, resolveEffect);
    expect(result.requiresChoice).toBeUndefined();
    expect(result.state.players[0]?.crystals.white).toBe(1);
  });

  it("is not resolvable when all basic colors are already owned", () => {
    const player = createTestPlayer({
      crystals: { red: 1, blue: 1, green: 1, white: 1 },
    });
    const state = createTestGameState({ players: [player] });

    expect(isEffectResolvable(state, player.id, basicEffect)).toBe(false);
  });
});

describe("Power of Crystals powered effect", () => {
  it("offers move/heal/draw with complete crystal set scaling outside combat", () => {
    const player = createTestPlayer({
      hand: [CARD_POWER_OF_CRYSTALS, CARD_WOUND, CARD_WOUND, CARD_WOUND],
      deck: [CARD_RAGE, CARD_SWIFTNESS, CARD_MARCH, CARD_STAMINA],
      pureMana: [{ color: MANA_GREEN, source: MANA_SOURCE_TOKEN }],
      crystals: { red: 2, blue: 1, green: 1, white: 1 }, // 1 complete set
    });
    const state = createTestGameState({ players: [player] });

    const playCommand = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_POWER_OF_CRYSTALS,
      handIndex: 0,
      powered: true,
      manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      previousPlayedCardFromHand: false,
    });
    const playResult = playCommand.execute(state);

    expect(playResult.events.some((e) => e.type === CHOICE_REQUIRED)).toBe(true);
    const pendingChoice = playResult.state.players[0]?.pendingChoice;
    expect(pendingChoice?.options).toHaveLength(3);

    const options = pendingChoice?.options ?? [];
    expect(options[0]).toMatchObject({
      type: EFFECT_GAIN_MOVE,
      amount: 6,
    });
    expect(options[1]).toMatchObject({
      type: EFFECT_GAIN_HEALING,
      amount: 3,
    });
    expect(options[2]).toMatchObject({
      type: EFFECT_DRAW_CARDS,
      amount: 3,
    });

    const resolveChoice = createResolveChoiceCommand({
      playerId: "player1",
      choiceIndex: 2,
      previousPendingChoice: pendingChoice!,
    });
    const resolveResult = resolveChoice.execute(playResult.state);

    // Draw 2 + 1 per complete set = draw 3 cards
    expect(resolveResult.state.players[0]?.hand.length).toBe(6);
  });

  it("becomes move-only in combat and auto-resolves with crystal-set scaling", () => {
    const player = createTestPlayer({
      hand: [CARD_POWER_OF_CRYSTALS],
      pureMana: [{ color: MANA_GREEN, source: MANA_SOURCE_TOKEN }],
      crystals: { red: 2, blue: 2, green: 2, white: 2 }, // 2 complete sets
      movePoints: 0,
    });
    const state = createTestGameState({
      players: [player],
      combat: createCumbersomeCombatState(),
    });

    const playCommand = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_POWER_OF_CRYSTALS,
      handIndex: 0,
      powered: true,
      manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      previousPlayedCardFromHand: false,
    });
    const playResult = playCommand.execute(state);

    expect(playResult.events.some((e) => e.type === CHOICE_REQUIRED)).toBe(false);
    expect(playResult.state.players[0]?.pendingChoice).toBeNull();
    expect(playResult.state.players[0]?.movePoints).toBe(8); // 4 + (2 sets * 2)
  });
});
