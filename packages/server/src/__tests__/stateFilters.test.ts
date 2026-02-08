/**
 * Tests for state filtering - dummy player visibility
 */

import { describe, it, expect } from "vitest";
import { toClientState } from "../stateFilters.js";
import { createInitialGameState } from "@mage-knight/core";
import type { GameState } from "@mage-knight/core";
import type { DummyPlayer } from "@mage-knight/core";
import {
  GAME_PHASE_ROUND,
  TIME_OF_DAY_DAY,
  ROUND_PHASE_PLAYER_TURNS,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  CARD_RAGE,
  CARD_MARCH,
  CARD_SWIFTNESS,
  CARD_STAMINA,
  CARD_DETERMINATION,
  CARD_TRANQUILITY,
  hexKey,
  TERRAIN_PLAINS,
  CARD_CRYSTALLIZE,
  CARD_IMPROVISATION,
  CARD_MANA_DRAW,
  CARD_THREATEN,
  CARD_PROMISE,
} from "@mage-knight/shared";
import type { CardId, HeroId } from "@mage-knight/shared";
import { Hero, createEmptyCombatAccumulator, TileId } from "@mage-knight/core";

function createMinimalGameState(): GameState {
  const base = createInitialGameState();
  return {
    ...base,
    phase: GAME_PHASE_ROUND,
    timeOfDay: TIME_OF_DAY_DAY,
    roundPhase: ROUND_PHASE_PLAYER_TURNS,
    turnOrder: ["player1"],
    currentPlayerIndex: 0,
    endOfRoundAnnouncedBy: null,
    playersWithFinalTurn: [],
    players: [
      {
        id: "player1",
        hero: Hero.Arythea,
        position: { q: 0, r: 0 },
        fame: 0,
        level: 1,
        reputation: 0,
        armor: 2,
        handLimit: 5,
        commandTokens: 1,
        hand: [CARD_MARCH] as readonly CardId[],
        deck: [],
        discard: [],
        units: [],
        bondsOfLoyaltyUnitInstanceId: null,
        attachedBanners: [],
        skills: [],
        skillCooldowns: { usedThisRound: [], usedThisTurn: [], usedThisCombat: [], activeUntilNextTurn: [] },
        skillFlipState: { flippedSkills: [] },
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        selectedTactic: null,
        tacticFlipped: false,
        tacticState: {},
        pendingTacticDecision: null,
        beforeTurnTacticPending: false,
        knockedOut: false,
        movePoints: 4,
        influencePoints: 0,
        playArea: [],
        pureMana: [],
        usedManaFromSource: false,
        usedDieIds: [],
        manaDrawDieIds: [],
        hasMovedThisTurn: false,
        hasTakenActionThisTurn: false,
        playedCardFromHandThisTurn: false,
        combatAccumulator: createEmptyCombatAccumulator(),
        pendingChoice: null,
        pendingLevelUps: [],
        pendingLevelUpRewards: [],
        remainingHeroSkills: [],
        pendingRewards: [],
        hasCombattedThisTurn: false,
        hasPlunderedThisTurn: false,
        hasRecruitedUnitThisTurn: false,
        unitsRecruitedThisInteraction: [],
        manaUsedThisTurn: [],
        spellColorsCastThisTurn: [],
        spellsCastByColorThisTurn: {},
        pendingGladeWoundChoice: false,
        pendingDiscard: null,
        pendingDeepMineChoice: null,
        pendingUnitMaintenance: null,
        pendingDiscardForAttack: null,
        pendingDiscardForCrystal: null,
        pendingDecompose: null,
        pendingMaximalEffect: null,
        pendingBookOfWisdom: null,
        pendingTerrainCostReduction: null,
        pendingAttackDefeatFame: [],
        enemiesDefeatedThisTurn: 0,
        healingPoints: 0,
        woundsHealedFromHandThisTurn: 0,
        unitsHealedThisTurn: [],
        removedCards: [],
        isResting: false,
        woundImmunityActive: false,
        roundOrderTokenFlipped: false,
        isTimeBentTurn: false,
        timeBendingSetAsideCards: [],
        woundsReceivedThisTurn: { hand: 0, discard: 0 },
        bannerOfProtectionActive: false,
        pendingBannerProtectionChoice: false,
        spentCrystalsThisTurn: { red: 0, blue: 0, green: 0, white: 0 },
        crystalMasteryPoweredActive: false,
        pendingMeditation: undefined,
        meditationHandLimitBonus: 0,
      },
    ],
    map: {
      ...base.map,
      hexes: {
        [hexKey({ q: 0, r: 0 })]: {
          coord: { q: 0, r: 0 },
          terrain: TERRAIN_PLAINS,
          tileId: TileId.StartingTileA,
          site: null,
          enemies: [],
          shieldTokens: [],
          rampagingEnemies: [],
        },
      },
    },
    availableTactics: [],
    tacticsSelectionOrder: [],
    currentTacticSelector: null,
  };
}

describe("toClientState - dummy player", () => {
  it("should return null dummyPlayer when no dummy exists", () => {
    const state = createMinimalGameState();
    state.dummyPlayer = null;

    const clientState = toClientState(state as GameState, "player1");

    expect(clientState.dummyPlayer).toBeNull();
  });

  it("should expose heroId and turn range when dummy exists", () => {
    const state = createMinimalGameState();
    const dummy: DummyPlayer = {
      heroId: Hero.Goldyx as HeroId,
      deck: [
        CARD_RAGE, CARD_MARCH, CARD_SWIFTNESS, CARD_STAMINA,
        CARD_DETERMINATION, CARD_TRANQUILITY, CARD_PROMISE,
        CARD_THREATEN, CARD_CRYSTALLIZE, CARD_MANA_DRAW,
        CARD_IMPROVISATION, CARD_RAGE,
      ] as readonly CardId[],
      discard: [],
      crystals: { [MANA_RED]: 0, [MANA_BLUE]: 2, [MANA_GREEN]: 0, [MANA_WHITE]: 1 },
      precomputedTurns: [],
      currentTurnIndex: 0,
    };
    (state as GameState).dummyPlayer = dummy;

    const clientState = toClientState(state as GameState, "player1");

    expect(clientState.dummyPlayer).not.toBeNull();
    expect(clientState.dummyPlayer!.heroId).toBe(Hero.Goldyx);
    // 12 cards: max = ceil(12/3) = 4, min = ceil(12/(3+2)) = ceil(12/5) = 3
    expect(clientState.dummyPlayer!.turnsRemainingMax).toBe(4);
    expect(clientState.dummyPlayer!.turnsRemainingMin).toBe(3);
  });

  it("should not expose deck, discard, or crystal details", () => {
    const state = createMinimalGameState();
    const dummy: DummyPlayer = {
      heroId: Hero.Arythea as HeroId,
      deck: [CARD_RAGE, CARD_MARCH, CARD_SWIFTNESS] as readonly CardId[],
      discard: [CARD_STAMINA] as readonly CardId[],
      crystals: { [MANA_RED]: 2, [MANA_BLUE]: 0, [MANA_GREEN]: 0, [MANA_WHITE]: 1 },
      precomputedTurns: [],
      currentTurnIndex: 0,
    };
    (state as GameState).dummyPlayer = dummy;

    const clientState = toClientState(state as GameState, "player1");

    const dummyClient = clientState.dummyPlayer!;
    // Should only have heroId and turn range — no deck/discard/crystals
    expect(dummyClient).toEqual({
      heroId: Hero.Arythea,
      turnsRemainingMin: expect.any(Number),
      turnsRemainingMax: expect.any(Number),
    });
    expect((dummyClient as Record<string, unknown>)["deck"]).toBeUndefined();
    expect((dummyClient as Record<string, unknown>)["discard"]).toBeUndefined();
    expect((dummyClient as Record<string, unknown>)["crystals"]).toBeUndefined();
  });

  it("should show 0/0 turns when deck is empty", () => {
    const state = createMinimalGameState();
    const dummy: DummyPlayer = {
      heroId: Hero.Arythea as HeroId,
      deck: [],
      discard: [CARD_RAGE, CARD_MARCH] as readonly CardId[],
      crystals: { [MANA_RED]: 2, [MANA_BLUE]: 0, [MANA_GREEN]: 0, [MANA_WHITE]: 1 },
      precomputedTurns: [],
      currentTurnIndex: 0,
    };
    (state as GameState).dummyPlayer = dummy;

    const clientState = toClientState(state as GameState, "player1");

    expect(clientState.dummyPlayer!.turnsRemainingMin).toBe(0);
    expect(clientState.dummyPlayer!.turnsRemainingMax).toBe(0);
  });
});
