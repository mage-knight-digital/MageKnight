/**
 * Valid actions while resting
 */

import { describe, it, expect } from "vitest";
import {
  createTestGameState,
  createTestPlayer,
  createTestHex,
  createHexEnemy,
} from "./testHelpers.js";
import { getValidMoveTargets } from "../validActions/movement.js";
import { getValidExploreOptions } from "../validActions/exploration.js";
import { getChallengeOptions } from "../validActions/challenge.js";
import { getSiteOptions } from "../validActions/sites.js";
import {
  ENEMY_DIGGERS,
  CARD_WOUND,
  CARD_WHIRLWIND,
  CARD_MARCH,
  CARD_STAMINA,
  PLAY_SIDEWAYS_AS_MOVE,
  PLAY_SIDEWAYS_AS_INFLUENCE,
  TERRAIN_PLAINS,
  hexKey,
} from "@mage-knight/shared";
import { createEnemyTokenId } from "../helpers/enemy/index.js";
import {
  RampagingEnemyType,
  SiteType,
  type Site,
  type HexState,
  TileId,
} from "../../types/map.js";
import { getValidActions } from "../validActions/index.js";

function withTiles(state: ReturnType<typeof createTestGameState>) {
  return {
    ...state,
    map: {
      ...state.map,
      tileDeck: {
        countryside: [TileId.Countryside1],
        core: [],
      },
    },
  };
}

describe("Valid actions while resting", () => {
  it("hides movement and exploration options", () => {
    const activePlayer = createTestPlayer({
      movePoints: 4,
      hasTakenActionThisTurn: false,
      isResting: false,
    });
    const activeState = withTiles(createTestGameState({ players: [activePlayer] }));

    expect(getValidMoveTargets(activeState, activePlayer)).toBeDefined();

    const restingPlayer = { ...activePlayer, isResting: true };
    const restingState = withTiles(createTestGameState({ players: [restingPlayer] }));

    expect(getValidMoveTargets(restingState, restingPlayer)).toBeUndefined();
    expect(getValidExploreOptions(restingState, restingPlayer)).toBeUndefined();
  });

  it("hides challenge options while resting", () => {
    const enemyToken = createEnemyTokenId(ENEMY_DIGGERS);
    const rampagingHex: HexState = {
      ...createTestHex(1, 0, TERRAIN_PLAINS),
      rampagingEnemies: [RampagingEnemyType.OrcMarauder],
      enemies: [createHexEnemy(enemyToken)],
    };

    const activePlayer = createTestPlayer({
      movePoints: 4,
      isResting: false,
    });
    const baseState = createTestGameState({ players: [activePlayer] });
    const activeState = {
      ...baseState,
      map: {
        ...baseState.map,
        hexes: {
          ...baseState.map.hexes,
          [hexKey({ q: 1, r: 0 })]: rampagingHex,
        },
      },
    };

    expect(getChallengeOptions(activeState, activePlayer)).toBeDefined();

    const restingPlayer = { ...activePlayer, isResting: true };
    const restingState = {
      ...activeState,
      players: [restingPlayer],
    };

    expect(getChallengeOptions(restingState, restingPlayer)).toBeUndefined();
  });

  it("hides challenge options after action is consumed", () => {
    const enemyToken = createEnemyTokenId(ENEMY_DIGGERS);
    const rampagingHex: HexState = {
      ...createTestHex(1, 0, TERRAIN_PLAINS),
      rampagingEnemies: [RampagingEnemyType.OrcMarauder],
      enemies: [createHexEnemy(enemyToken)],
    };

    const activePlayer = createTestPlayer({
      movePoints: 4,
      isResting: false,
      hasTakenActionThisTurn: false,
    });
    const baseState = createTestGameState({ players: [activePlayer] });
    const activeState = {
      ...baseState,
      map: {
        ...baseState.map,
        hexes: {
          ...baseState.map.hexes,
          [hexKey({ q: 1, r: 0 })]: rampagingHex,
        },
      },
    };

    expect(getChallengeOptions(activeState, activePlayer)).toBeDefined();

    const actedPlayer = { ...activePlayer, hasTakenActionThisTurn: true };
    const actedState = {
      ...activeState,
      players: [actedPlayer],
    };

    expect(getChallengeOptions(actedState, actedPlayer)).toBeUndefined();
  });

  it("blocks site interaction options while resting", () => {
    const monasterySite: Site = {
      type: SiteType.Monastery,
      owner: null,
      isConquered: false,
      isBurned: false,
    };

    const activePlayer = createTestPlayer({ isResting: false });
    const baseState = createTestGameState({ players: [activePlayer] });
    const activeState = {
      ...baseState,
      map: {
        ...baseState.map,
        hexes: {
          ...baseState.map.hexes,
          [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS, monasterySite),
        },
      },
    };

    const activeOptions = getSiteOptions(activeState, activePlayer);
    expect(activeOptions?.canInteract).toBe(true);

    const restingPlayer = { ...activePlayer, isResting: true };
    const restingState = { ...activeState, players: [restingPlayer] };

    const restingOptions = getSiteOptions(restingState, restingPlayer);
    expect(restingOptions?.canInteract).toBe(false);
  });

  it("blocks entering adventure sites while resting", () => {
    const dungeonSite: Site = {
      type: SiteType.Dungeon,
      owner: null,
      isConquered: false,
      isBurned: false,
    };

    const activePlayer = createTestPlayer({ isResting: false });
    const baseState = createTestGameState({ players: [activePlayer] });
    const activeState = {
      ...baseState,
      map: {
        ...baseState.map,
        hexes: {
          ...baseState.map.hexes,
          [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS, dungeonSite),
        },
      },
    };

    const activeOptions = getSiteOptions(activeState, activePlayer);
    expect(activeOptions?.canEnter).toBe(true);

    const restingPlayer = { ...activePlayer, isResting: true };
    const restingState = { ...activeState, players: [restingPlayer] };

    const restingOptions = getSiteOptions(restingState, restingPlayer);
    expect(restingOptions?.canEnter).toBe(false);
  });

  it("does not surface sideways-only combat cards while resting", () => {
    const restingPlayer = createTestPlayer({
      isResting: true,
      hasTakenActionThisTurn: true,
      hand: [CARD_WHIRLWIND],
    });

    const state = createTestGameState({ players: [restingPlayer] });
    const validActions = getValidActions(state, restingPlayer.id);

    expect(validActions.mode).toBe("normal_turn");
    expect(validActions.playCard).toBeUndefined();
  });

  it("excludes sideways-for-move after rest is completed", () => {
    const player = createTestPlayer({
      isResting: false,
      hasRestedThisTurn: true,
      hasTakenActionThisTurn: true,
      playedCardFromHandThisTurn: true,
      hand: [CARD_MARCH, CARD_STAMINA],
    });
    const state = createTestGameState({ players: [player] });
    const validActions = getValidActions(state, player.id);

    expect(validActions.mode).toBe("normal_turn");
    expect(validActions.playCard).toBeDefined();

    for (const card of validActions.playCard!.cards) {
      if (card.canPlaySideways) {
        const moveOption = card.sidewaysOptions?.find(
          (o) => o.as === PLAY_SIDEWAYS_AS_MOVE
        );
        const influenceOption = card.sidewaysOptions?.find(
          (o) => o.as === PLAY_SIDEWAYS_AS_INFLUENCE
        );

        expect(moveOption).toBeUndefined();
        expect(influenceOption).toBeDefined();
      }
    }
  });

  it("includes sideways-for-move when rest has not occurred", () => {
    const player = createTestPlayer({
      isResting: false,
      hasRestedThisTurn: false,
      hand: [CARD_MARCH],
    });
    const state = createTestGameState({ players: [player] });
    const validActions = getValidActions(state, player.id);

    expect(validActions.mode).toBe("normal_turn");
    const marchCard = validActions.playCard?.cards.find(
      (c) => c.cardId === CARD_MARCH
    );
    expect(marchCard?.canPlaySideways).toBe(true);

    const moveOption = marchCard?.sidewaysOptions?.find(
      (o) => o.as === PLAY_SIDEWAYS_AS_MOVE
    );
    expect(moveOption).toBeDefined();
  });

  it("does not offer declare rest after action when hand is all wounds", () => {
    const player = createTestPlayer({
      hasTakenActionThisTurn: true,
      hand: [CARD_WOUND, CARD_WOUND],
      isResting: false,
    });
    const state = createTestGameState({ players: [player] });

    const validActions = getValidActions(state, player.id);

    expect(validActions.mode).toBe("normal_turn");
    expect(validActions.turn?.canDeclareRest).toBe(false);
    expect(validActions.turn?.restTypes).toEqual(["slow_recovery"]);
  });
});
