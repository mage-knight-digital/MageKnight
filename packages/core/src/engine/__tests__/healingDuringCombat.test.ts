/**
 * Healing During Combat Tests
 *
 * Validates that healing effects are restricted during combat based on card categories.
 */

import { describe, it, expect } from "vitest";
import { getValidActions } from "../validActions/index.js";
import { createPlayCardCommand } from "../commands/playCardCommand.js";
import { createTestGameState, createTestPlayer, createUnitCombatState } from "./testHelpers.js";
import {
  CARD_TRANQUILITY,
  CARD_REGENERATION,
  CARD_RESTORATION,
  CARD_REFRESHING_WALK,
  CARD_POWER_OF_CRYSTALS,
  CARD_WOUND,
  MANA_GREEN,
  MANA_BLACK,
  MANA_SOURCE_TOKEN,
  CHOICE_REQUIRED,
} from "@mage-knight/shared";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";

function getPlayableCard(state: ReturnType<typeof createTestGameState>, cardId: string) {
  const validActions = getValidActions(state, "player1");
  if (validActions.mode !== "combat" && validActions.mode !== "normal_turn") return undefined;
  return validActions.playCard?.cards.find((card) => card.cardId === cardId);
}

describe("Healing cards during combat", () => {
  it("blocks Tranquility basic/powered in all combat phases (sideways only when allowed)", () => {
    const phases = [
      COMBAT_PHASE_RANGED_SIEGE,
      COMBAT_PHASE_BLOCK,
      COMBAT_PHASE_ATTACK,
    ];

    for (const phase of phases) {
      const player = createTestPlayer({
        hand: [CARD_TRANQUILITY],
      });
      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(phase),
      });

      const playableCard = getPlayableCard(state, CARD_TRANQUILITY);

      if (phase === COMBAT_PHASE_RANGED_SIEGE) {
        expect(playableCard).toBeUndefined();
        continue;
      }

      expect(playableCard).toBeDefined();
      expect(playableCard?.canPlayBasic).toBe(false);
      expect(playableCard?.canPlayPowered).toBe(false);
      expect(playableCard?.canPlaySideways).toBe(true);
    }
  });

  it("blocks Regeneration basic/powered during combat", () => {
    const player = createTestPlayer({
      hand: [CARD_REGENERATION],
    });
    const state = createTestGameState({
      players: [player],
      combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
    });

    const playableCard = getPlayableCard(state, CARD_REGENERATION);
    expect(playableCard).toBeDefined();
    expect(playableCard?.canPlayBasic).toBe(false);
    expect(playableCard?.canPlayPowered).toBe(false);
  });

  it("blocks Restoration basic/powered during combat even with mana available", () => {
    const player = createTestPlayer({
      hand: [CARD_RESTORATION],
      pureMana: [
        { color: MANA_GREEN, source: MANA_SOURCE_TOKEN },
        { color: MANA_BLACK, source: MANA_SOURCE_TOKEN },
      ],
    });
    const state = createTestGameState({
      players: [player],
      combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
    });

    const playableCard = getPlayableCard(state, CARD_RESTORATION);
    expect(playableCard).toBeDefined();
    expect(playableCard?.canPlayBasic).toBe(false);
    expect(playableCard?.canPlayPowered).toBe(false);
    expect(playableCard?.canPlaySideways).toBe(true);
  });
});

describe("Mixed-category healing cards during combat", () => {
  it("plays Refreshing Walk for movement only (healing filtered out)", () => {
    const player = createTestPlayer({
      hand: [CARD_REFRESHING_WALK, CARD_WOUND],
      movePoints: 0,
    });
    const state = createTestGameState({
      players: [player],
      combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
    });

    const playableCard = getPlayableCard(state, CARD_REFRESHING_WALK);
    expect(playableCard?.canPlayBasic).toBe(true);

    const command = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_REFRESHING_WALK,
      handIndex: 0,
      powered: false,
      previousPlayedCardFromHand: false,
    });

    const result = command.execute(state);
    const updatedPlayer = result.state.players.find((p) => p.id === "player1");

    expect(updatedPlayer?.movePoints).toBe(2);
    expect(updatedPlayer?.hand).toContain(CARD_WOUND);
  });

  it("removes heal option from Power of Crystals powered choice in combat", () => {
    const player = createTestPlayer({
      hand: [CARD_POWER_OF_CRYSTALS, CARD_WOUND],
      pureMana: [{ color: MANA_GREEN, source: MANA_SOURCE_TOKEN }],
      movePoints: 0,
    });
    const state = createTestGameState({
      players: [player],
      combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
    });

    const playableCard = getPlayableCard(state, CARD_POWER_OF_CRYSTALS);
    expect(playableCard?.canPlayPowered).toBe(true);

    const command = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_POWER_OF_CRYSTALS,
      handIndex: 0,
      powered: true,
      manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      previousPlayedCardFromHand: false,
    });

    const result = command.execute(state);
    const updatedPlayer = result.state.players.find((p) => p.id === "player1");

    expect(result.events.some((event) => event.type === CHOICE_REQUIRED)).toBe(false);
    expect(updatedPlayer?.movePoints).toBe(4);
    expect(updatedPlayer?.hand).toContain(CARD_WOUND);
  });
});
