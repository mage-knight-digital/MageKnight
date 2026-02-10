import { describe, it, expect } from "vitest";
import {
  createTestGameState,
  createTestPlayer,
  createTestHex,
} from "./testHelpers.js";
import {
  CARD_WOUND,
  CARD_MARCH,
  GAME_PHASE_ROUND,
  TERRAIN_PLAINS,
  hexKey,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import { SiteType } from "../../types/map.js";
import type { Site } from "../../types/map.js";
import { getSiteOptions } from "../validActions/sites.js";

function createStateAtVillage(
  influencePoints: number,
  hand: readonly CardId[] = [CARD_WOUND, CARD_MARCH]
) {
  const village: Site = {
    type: SiteType.Village,
    owner: null,
    isConquered: false,
    isBurned: false,
  };

  const player = createTestPlayer({
    position: { q: 0, r: 0 },
    influencePoints,
    hand,
  });

  return createTestGameState({
    phase: GAME_PHASE_ROUND,
    players: [player],
    map: {
      hexes: {
        [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS, village),
      },
      tiles: [],
      tileDeck: { countryside: [], core: [] },
    },
  });
}

function createStateAtMonastery(influencePoints: number) {
  const monastery: Site = {
    type: SiteType.Monastery,
    owner: null,
    isConquered: false,
    isBurned: false,
  };

  const player = createTestPlayer({
    position: { q: 0, r: 0 },
    influencePoints,
  });

  return createTestGameState({
    phase: GAME_PHASE_ROUND,
    players: [player],
    offers: {
      advancedActions: {
        cards: ["agility"],
      },
      monasteryAdvancedActions: ["agility"],
      spells: {
        cards: [],
      },
      units: [],
      commonSkills: [],
    },
    map: {
      hexes: {
        [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS, monastery),
      },
      tiles: [],
      tileDeck: { countryside: [], core: [] },
    },
  });
}

describe("Site valid actions", () => {
  it("does not advertise healing when influence is below cost", () => {
    const state = createStateAtVillage(2);
    const player = state.players[0];
    const options = getSiteOptions(state, player);

    expect(options?.interactOptions?.canHeal).toBe(false);
    expect(options?.interactOptions?.healCost).toBe(3);
  });

  it("advertises healing when influence meets village cost", () => {
    const state = createStateAtVillage(3);
    const player = state.players[0];
    const options = getSiteOptions(state, player);

    expect(options?.interactOptions?.canHeal).toBe(true);
    expect(options?.interactOptions?.healCost).toBe(3);
  });

  it("does not advertise healing when player has no wounds", () => {
    const state = createStateAtVillage(6, [CARD_MARCH]);
    const player = state.players[0];
    const options = getSiteOptions(state, player);

    expect(options?.interactOptions?.canHeal).toBe(false);
    expect(options?.interactOptions?.healCost).toBe(3);
  });

  it("does not advertise interact after player has taken action", () => {
    const state = createStateAtVillage(6);
    const player = {
      ...state.players[0],
      hasTakenActionThisTurn: true,
    };
    const options = getSiteOptions(state, player);

    expect(options?.canInteract).toBe(false);
    expect(options?.interactOptions).toBeUndefined();
  });

  it("does not advertise monastery advanced action purchase when influence is below cost", () => {
    const state = createStateAtMonastery(5);
    const player = state.players[0];
    const options = getSiteOptions(state, player);

    expect(options?.interactOptions?.canBuyAdvancedActions).toBe(false);
  });

  it("advertises monastery advanced action purchase when influence meets cost", () => {
    const state = createStateAtMonastery(6);
    const player = state.players[0];
    const options = getSiteOptions(state, player);

    expect(options?.interactOptions?.canBuyAdvancedActions).toBe(true);
  });
});
