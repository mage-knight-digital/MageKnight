/**
 * Valid actions when player must announce end of round
 */

import { describe, it, expect } from "vitest";
import {
  createTestGameState,
  createTestPlayer,
  createTestHex,
  createHexEnemy,
} from "./testHelpers.js";
import { getValidMoveTargets } from "../validActions/movement.js";
import { getChallengeOptions } from "../validActions/challenge.js";
import { getSiteOptions } from "../validActions/sites.js";
import { getFullUnitOptions } from "../validActions/units/index.js";
import {
  ENEMY_DIGGERS,
  TERRAIN_PLAINS,
  hexKey,
  UNIT_PEASANTS,
  CARD_MARCH,
} from "@mage-knight/shared";
import { createEnemyTokenId } from "../helpers/enemy/index.js";
import {
  RampagingEnemyType,
  SiteType,
  type Site,
  type HexState,
} from "../../types/map.js";
import { createPlayerUnit } from "../../types/unit.js";

function createMustAnnounceState() {
  const player = createTestPlayer({
    hand: [],
    deck: [],
    movePoints: 4,
    units: [createPlayerUnit(UNIT_PEASANTS, "unit1")],
  });

  return createTestGameState({ players: [player], endOfRoundAnnouncedBy: null });
}

describe("Must announce end of round", () => {
  it("blocks movement and unit activation until announced", () => {
    const state = createMustAnnounceState();
    const player = state.players[0];
    if (!player) throw new Error("Missing player");

    expect(getValidMoveTargets(state, player)).toBeUndefined();
    expect(getFullUnitOptions(state, player)).toBeUndefined();

    const afterAnnounceState = {
      ...state,
      players: state.players.map((p) =>
        p.id === player.id ? { ...p, hand: [CARD_MARCH] } : p
      ),
      endOfRoundAnnouncedBy: "player2",
    };

    const announcedPlayer = afterAnnounceState.players[0];
    if (!announcedPlayer) throw new Error("Missing player");

    expect(getValidMoveTargets(afterAnnounceState, announcedPlayer)).toBeDefined();
    expect(getFullUnitOptions(afterAnnounceState, announcedPlayer)).toBeDefined();
  });

  it("blocks challenge options until announced", () => {
    const enemyToken = createEnemyTokenId(ENEMY_DIGGERS);
    const rampagingHex: HexState = {
      ...createTestHex(1, 0, TERRAIN_PLAINS),
      rampagingEnemies: [RampagingEnemyType.OrcMarauder],
      enemies: [createHexEnemy(enemyToken)],
    };

    const state = createMustAnnounceState();
    const player = state.players[0];
    if (!player) throw new Error("Missing player");

    const stateWithRampaging = {
      ...state,
      map: {
        ...state.map,
        hexes: {
          ...state.map.hexes,
          [hexKey({ q: 1, r: 0 })]: rampagingHex,
        },
      },
    };

    expect(getChallengeOptions(stateWithRampaging, player)).toBeUndefined();
  });

  it("blocks site interaction and entry until announced", () => {
    const monasterySite: Site = {
      type: SiteType.Monastery,
      owner: null,
      isConquered: false,
      isBurned: false,
    };

    const dungeonSite: Site = {
      type: SiteType.Dungeon,
      owner: null,
      isConquered: false,
      isBurned: false,
    };

    const state = createMustAnnounceState();
    const player = state.players[0];
    if (!player) throw new Error("Missing player");

    const monasteryState = {
      ...state,
      map: {
        ...state.map,
        hexes: {
          ...state.map.hexes,
          [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS, monasterySite),
        },
      },
    };

    const monasteryOptions = getSiteOptions(monasteryState, player);
    expect(monasteryOptions?.canInteract).toBe(false);

    const dungeonState = {
      ...state,
      map: {
        ...state.map,
        hexes: {
          ...state.map.hexes,
          [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS, dungeonSite),
        },
      },
    };

    const dungeonOptions = getSiteOptions(dungeonState, player);
    expect(dungeonOptions?.canEnter).toBe(false);
  });
});
