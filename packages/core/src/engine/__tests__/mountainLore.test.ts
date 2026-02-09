import { describe, it, expect } from "vitest";
import type { CardId, Terrain } from "@mage-knight/shared";
import {
  CARD_MOUNTAIN_LORE,
  CARD_MARCH,
  MANA_GREEN,
  MANA_SOURCE_CRYSTAL,
  TERRAIN_HILLS,
  TERRAIN_MOUNTAIN,
  TERRAIN_PLAINS,
  hexKey,
} from "@mage-knight/shared";
import { getCard } from "../validActions/cards/index.js";
import { createPlayCardCommand } from "../commands/playCardCommand.js";
import { createEndTurnCommand } from "../commands/endTurn/index.js";
import { createTestGameState, createTestHex, createTestPlayer } from "./testHelpers.js";
import { getEffectiveTerrainCost, isTerrainSafe } from "../modifiers/terrain.js";
import { EFFECT_COMPOUND } from "../../types/effectTypes.js";

function createMountainLoreState(terrain: Terrain) {
  const player = createTestPlayer({
    hand: [CARD_MOUNTAIN_LORE],
    deck: Array.from({ length: 10 }, () => CARD_MARCH as CardId),
    position: { q: 0, r: 0 },
    crystals: { red: 0, blue: 0, green: 1, white: 0 },
  });

  const base = createTestGameState({ players: [player] });
  return {
    ...base,
    map: {
      ...base.map,
      hexes: {
        ...base.map.hexes,
        [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, terrain),
      },
    },
  };
}

describe("Mountain Lore card definition", () => {
  it("defines basic and powered effects", () => {
    const card = getCard(CARD_MOUNTAIN_LORE);
    expect(card).toBeDefined();
    expect(card?.name).toBe("Mountain Lore");
    expect(card?.poweredBy).toEqual([MANA_GREEN]);
    expect(card?.basicEffect.type).toBe(EFFECT_COMPOUND);
    expect(card?.poweredEffect.type).toBe(EFFECT_COMPOUND);
  });
});

describe("Mountain Lore behavior", () => {
  it("powered effect makes mountains cost 5 and safe this turn", () => {
    const state = createMountainLoreState(TERRAIN_PLAINS);
    const playResult = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_MOUNTAIN_LORE,
      handIndex: 0,
      powered: true,
      manaSources: [{ type: MANA_SOURCE_CRYSTAL, color: MANA_GREEN }],
      previousPlayedCardFromHand: false,
    }).execute(state);

    expect(getEffectiveTerrainCost(playResult.state, TERRAIN_MOUNTAIN, "player1")).toBe(5);
    expect(isTerrainSafe(playResult.state, "player1", TERRAIN_MOUNTAIN)).toBe(true);
  });

  it("basic effect grants +1 draw-up hand limit when ending turn in hills", () => {
    const state = createMountainLoreState(TERRAIN_HILLS);
    const afterPlay = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_MOUNTAIN_LORE,
      handIndex: 0,
      powered: false,
      previousPlayedCardFromHand: false,
    }).execute(state).state;

    const afterEndTurn = createEndTurnCommand({ playerId: "player1" }).execute(afterPlay).state;
    expect(afterEndTurn.players[0]?.hand.length).toBe(6);
  });

  it("powered effect grants +2 draw-up hand limit when ending turn in mountains", () => {
    const state = createMountainLoreState(TERRAIN_MOUNTAIN);
    const afterPlay = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_MOUNTAIN_LORE,
      handIndex: 0,
      powered: true,
      manaSources: [{ type: MANA_SOURCE_CRYSTAL, color: MANA_GREEN }],
      previousPlayedCardFromHand: false,
    }).execute(state).state;

    const afterEndTurn = createEndTurnCommand({ playerId: "player1" }).execute(afterPlay).state;
    expect(afterEndTurn.players[0]?.hand.length).toBe(7);
  });

  it("powered effect grants +1 draw-up hand limit when ending turn in hills", () => {
    const state = createMountainLoreState(TERRAIN_HILLS);
    const afterPlay = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_MOUNTAIN_LORE,
      handIndex: 0,
      powered: true,
      manaSources: [{ type: MANA_SOURCE_CRYSTAL, color: MANA_GREEN }],
      previousPlayedCardFromHand: false,
    }).execute(state).state;

    const afterEndTurn = createEndTurnCommand({ playerId: "player1" }).execute(afterPlay).state;
    expect(afterEndTurn.players[0]?.hand.length).toBe(6);
  });
});
