/**
 * Ruins rewards tests
 *
 * Tests for:
 * - handleRuinsTokenRewards: grants rewards after combat victory at ruins
 * - selectRewardCommand: handles unit reward selection (free recruitment)
 * - Crystal rewards: 4 crystals = +1 each basic color
 * - Token-specific rewards (artifact, spell, AA, unit, compound)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  handleCombatHexCleanup,
} from "../commands/combat/combatEndHandlers.js";
import {
  createSelectRewardCommand,
  resetRewardUnitInstanceCounter,
} from "../commands/selectRewardCommand.js";
import { validateCardInOffer } from "../validators/rewardValidators.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  hexKey,
  TERRAIN_PLAINS,
  SITE_CONQUERED,
  REWARD_QUEUED,
  REWARD_SELECTED,
  SITE_REWARD_SPELL,
  SITE_REWARD_ADVANCED_ACTION,
  SITE_REWARD_UNIT,
  SELECT_REWARD_ACTION,
  CARD_GAINED,
  type RuinsTokenId,
  type CardId,
  type UnitId,
  ENEMY_DIGGERS,
  ELEMENT_PHYSICAL,
} from "@mage-knight/shared";
import { SiteType } from "../../types/map.js";
import type { Site, HexState, RuinsToken } from "../../types/map.js";
import type { GameState } from "../../state/GameState.js";
import type { CombatState } from "../../types/combat.js";
import { COMBAT_CONTEXT_STANDARD } from "../../types/combat.js";
import { resetTokenCounter } from "../helpers/enemy/index.js";
import { DISBAND_REQUIRED } from "../validators/validationCodes.js";

// =============================================================================
// HELPERS
// =============================================================================

function createRuinsSite(isConquered = false): Site {
  return {
    type: SiteType.AncientRuins,
    owner: isConquered ? "player1" : null,
    isConquered,
    isBurned: false,
  };
}

function createRuinsToken(tokenId: string, isRevealed = true): RuinsToken {
  return {
    tokenId: tokenId as RuinsTokenId,
    isRevealed,
  };
}

function createCompletedCombatState(): CombatState {
  return {
    enemies: [
      {
        instanceId: "enemy_1",
        enemyId: ENEMY_DIGGERS,
        definition: {
          id: ENEMY_DIGGERS,
          name: "Diggers",
          color: "green" as const,
          attack: 3,
          attackElement: ELEMENT_PHYSICAL,
          armor: 3,
          fame: 2,
          resistances: [],
          abilities: [],
        },
        isBlocked: true,
        isDefeated: true,
        damageAssigned: true,
        isRequiredForConquest: true,
      },
    ],
    phase: "ATTACK" as CombatState["phase"],
    woundsThisCombat: 0,
    attacksThisPhase: 0,
    fameGained: 2,
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
    paidThugsDamageInfluence: {},
    damageRedirects: {},
  };
}

function createRuinsCombatVictoryState(
  tokenId: string,
  overrides: {
    playerOverrides?: Partial<Parameters<typeof createTestPlayer>[0]>;
    deckOverrides?: Partial<{ artifacts: CardId[] }>;
  } = {}
): GameState {
  const baseState = createTestGameState();
  const playerCoord = { q: 0, r: 0 };

  const site = createRuinsSite();
  const ruinsToken = createRuinsToken(tokenId);

  const siteHex: HexState = {
    coord: playerCoord,
    terrain: TERRAIN_PLAINS,
    tileId: baseState.map.hexes[hexKey(playerCoord)]?.tileId ?? ("StartingTileA" as import("../../types/map.js").TileId),
    site,
    enemies: [],
    shieldTokens: [],
    rampagingEnemies: [],
    ruinsToken,
  };

  const hexes: Record<string, HexState> = {
    ...baseState.map.hexes,
    [hexKey(playerCoord)]: siteHex,
  };

  const player = createTestPlayer({
    id: "player1",
    position: playerCoord,
    hasTakenActionThisTurn: true,
    hasCombattedThisTurn: true,
    ...overrides.playerOverrides,
  });

  return {
    ...baseState,
    players: [player],
    turnOrder: ["player1"],
    map: { ...baseState.map, hexes },
    combat: null,
    decks: {
      ...baseState.decks,
      artifacts: overrides.deckOverrides?.artifacts ?? [],
    },
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("Ruins combat victory rewards", () => {
  beforeEach(() => {
    resetTokenCounter();
  });

  describe("handleCombatHexCleanup with ruins tokens", () => {
    it("should grant artifact reward from enemy token (draws from deck)", () => {
      // enemy_green_brown_artifact: enemies green+brown, reward: artifact
      // Artifact rewards are auto-granted (drawn from deck), not queued
      const artifactCard = "banner_of_command" as CardId;
      const state = createRuinsCombatVictoryState("enemy_green_brown_artifact", {
        deckOverrides: { artifacts: [artifactCard] },
      });
      const combat = createCompletedCombatState();
      const player = state.players.find((p) => p.id === "player1");

      const result = handleCombatHexCleanup(
        state,
        combat,
        "player1",
        { q: 0, r: 0 },
        true,
        1,
        [],
        player
      );

      // Should have conquest event
      const conquestEvent = result.additionalEvents.find(
        (e) => e.type === SITE_CONQUERED
      );
      expect(conquestEvent).toBeDefined();

      // Artifact is auto-drawn from deck, emits CARD_GAINED not REWARD_QUEUED
      const cardGainedEvent = result.additionalEvents.find(
        (e) => e.type === CARD_GAINED
      );
      expect(cardGainedEvent).toBeDefined();
      if (cardGainedEvent && "cardId" in cardGainedEvent) {
        expect(cardGainedEvent.cardId).toBe(artifactCard);
      }

      // Player should have the artifact in their deck
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.deck).toContain(artifactCard);

      // Ruins token should be cleared from hex
      const hex = result.state.map.hexes[hexKey({ q: 0, r: 0 })];
      expect(hex?.ruinsToken).toBeNull();

      // Ruins token should be in discard pile
      expect(result.state.ruinsTokens.discardPile).toContain("enemy_green_brown_artifact");
    });

    it("should queue spell reward from enemy token with spell reward", () => {
      // enemy_brown_violet_spell_crystals: enemies brown+violet, rewards: spell + 4_crystals
      // Spell rewards are queued (player chooses from offer)
      const state = createRuinsCombatVictoryState("enemy_brown_violet_spell_crystals");
      const combat = createCompletedCombatState();
      const player = state.players.find((p) => p.id === "player1");

      const result = handleCombatHexCleanup(
        state,
        combat,
        "player1",
        { q: 0, r: 0 },
        true,
        1,
        [],
        player
      );

      // Should have queued spell reward
      const rewardEvents = result.additionalEvents.filter(
        (e) => e.type === REWARD_QUEUED
      );
      const spellRewardEvent = rewardEvents.find(
        (e) => "rewardType" in e && e.rewardType === SITE_REWARD_SPELL
      );
      expect(spellRewardEvent).toBeDefined();

      // Should have granted 4 crystals (+1 each basic color)
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.crystals.red).toBe(1);
      expect(updatedPlayer?.crystals.blue).toBe(1);
      expect(updatedPlayer?.crystals.green).toBe(1);
      expect(updatedPlayer?.crystals.white).toBe(1);
    });

    it("should grant 4 crystals (1 each basic color) from crystals reward", () => {
      // enemy_green_green_crystals: enemies green+green, rewards: 4_crystals
      const state = createRuinsCombatVictoryState("enemy_green_green_crystals");
      const combat = createCompletedCombatState();
      const player = state.players.find((p) => p.id === "player1");

      const result = handleCombatHexCleanup(
        state,
        combat,
        "player1",
        { q: 0, r: 0 },
        true,
        1,
        [],
        player
      );

      // Player should have +1 of each basic crystal
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.crystals.red).toBe(1);
      expect(updatedPlayer?.crystals.blue).toBe(1);
      expect(updatedPlayer?.crystals.green).toBe(1);
      expect(updatedPlayer?.crystals.white).toBe(1);
    });

    it("should queue unit reward from enemy token with unit reward", () => {
      // enemy_green_violet_artifact: rewards: unit
      const state = createRuinsCombatVictoryState("enemy_green_violet_artifact");
      const combat = createCompletedCombatState();
      const player = state.players.find((p) => p.id === "player1");

      const result = handleCombatHexCleanup(
        state,
        combat,
        "player1",
        { q: 0, r: 0 },
        true,
        1,
        [],
        player
      );

      // Should have queued a unit reward
      const rewardEvents = result.additionalEvents.filter(
        (e) => e.type === REWARD_QUEUED
      );
      const unitRewardEvent = rewardEvents.find(
        (e) => "rewardType" in e && e.rewardType === SITE_REWARD_UNIT
      );
      expect(unitRewardEvent).toBeDefined();

      // Player should have the unit reward in pendingRewards
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.pendingRewards).toContainEqual({ type: SITE_REWARD_UNIT });
    });

    it("should queue advanced action reward from enemy token", () => {
      // enemy_green_red_artifact_unit: enemies green+red, rewards: artifact + advanced_action
      // Provide an artifact in deck so artifact reward is auto-granted
      const artifactCard = "banner_of_command" as CardId;
      const state = createRuinsCombatVictoryState("enemy_green_red_artifact_unit", {
        deckOverrides: { artifacts: [artifactCard] },
      });
      const combat = createCompletedCombatState();
      const player = state.players.find((p) => p.id === "player1");

      const result = handleCombatHexCleanup(
        state,
        combat,
        "player1",
        { q: 0, r: 0 },
        true,
        1,
        [],
        player
      );

      // Artifact should be auto-drawn (CARD_GAINED)
      const cardGained = result.additionalEvents.find(
        (e) => e.type === CARD_GAINED
      );
      expect(cardGained).toBeDefined();

      // AA should be queued (REWARD_QUEUED)
      const aaReward = result.additionalEvents.find(
        (e) => e.type === REWARD_QUEUED && "rewardType" in e && e.rewardType === SITE_REWARD_ADVANCED_ACTION
      );
      expect(aaReward).toBeDefined();
    });

    it("should not grant rewards on defeat", () => {
      const state = createRuinsCombatVictoryState("enemy_green_brown_artifact");
      const combat: CombatState = {
        ...createCompletedCombatState(),
        enemies: [
          {
            ...createCompletedCombatState().enemies[0]!,
            isDefeated: false,
            isBlocked: false,
          },
        ],
      };
      const player = state.players.find((p) => p.id === "player1");

      const result = handleCombatHexCleanup(
        state,
        combat,
        "player1",
        { q: 0, r: 0 },
        false,
        0,
        [],
        player
      );

      // Should NOT have conquest event
      const conquestEvent = result.additionalEvents.find(
        (e) => e.type === SITE_CONQUERED
      );
      expect(conquestEvent).toBeUndefined();

      // Should NOT have reward events
      const rewardEvents = result.additionalEvents.filter(
        (e) => e.type === REWARD_QUEUED || e.type === CARD_GAINED
      );
      expect(rewardEvents).toHaveLength(0);
    });

    it("should skip ruins-specific rewards for non-enemy token", () => {
      // Use altar token — should not grant ruins-specific rewards (altars don't use combat)
      const state = createRuinsCombatVictoryState("altar_blue");
      const combat = createCompletedCombatState();
      const player = state.players.find((p) => p.id === "player1");

      const result = handleCombatHexCleanup(
        state,
        combat,
        "player1",
        { q: 0, r: 0 },
        true,
        1,
        [],
        player
      );

      // Conquest should still happen
      const conquestEvent = result.additionalEvents.find(
        (e) => e.type === SITE_CONQUERED
      );
      expect(conquestEvent).toBeDefined();

      // But no ruins-specific rewards queued or drawn
      const rewardQueuedEvents = result.additionalEvents.filter(
        (e) => e.type === REWARD_QUEUED
      );
      expect(rewardQueuedEvents).toHaveLength(0);

      // No card gained from ruins reward
      const cardGainedEvents = result.additionalEvents.filter(
        (e) => e.type === CARD_GAINED
      );
      expect(cardGainedEvents).toHaveLength(0);
    });

    it("should discard ruins token after granting rewards", () => {
      const state = createRuinsCombatVictoryState("enemy_green_green_crystals");
      const combat = createCompletedCombatState();
      const player = state.players.find((p) => p.id === "player1");

      const result = handleCombatHexCleanup(
        state,
        combat,
        "player1",
        { q: 0, r: 0 },
        true,
        1,
        [],
        player
      );

      // Ruins token should be removed from hex
      const hex = result.state.map.hexes[hexKey({ q: 0, r: 0 })];
      expect(hex?.ruinsToken).toBeNull();

      // Token should be in discard pile
      expect(result.state.ruinsTokens.discardPile).toContain("enemy_green_green_crystals");
    });
  });
});

describe("Select unit reward", () => {
  beforeEach(() => {
    resetRewardUnitInstanceCounter();
  });

  it("should recruit free unit from offer", () => {
    const unitId = "peasants" as UnitId;
    const state = createTestGameState({
      players: [
        createTestPlayer({
          id: "player1",
          pendingRewards: [{ type: SITE_REWARD_UNIT }],
        }),
      ],
      offers: {
        ...createTestGameState().offers,
        units: [unitId],
      },
    });

    const command = createSelectRewardCommand({
      playerId: "player1",
      cardId: "dummy" as CardId,
      rewardIndex: 0,
      unitId,
    });

    const result = command.execute(state);

    // Unit should be added to player
    const player = result.state.players.find((p) => p.id === "player1");
    expect(player?.units).toHaveLength(1);
    expect(player?.units[0]?.unitId).toBe(unitId);

    // Pending reward should be consumed
    expect(player?.pendingRewards).toHaveLength(0);

    // Unit should be removed from offer
    expect(result.state.offers.units).not.toContain(unitId);

    // Should emit reward selected event
    const selectedEvent = result.events.find(
      (e) => e.type === REWARD_SELECTED
    );
    expect(selectedEvent).toBeDefined();
    if (selectedEvent && "rewardType" in selectedEvent) {
      expect(selectedEvent.rewardType).toBe(SITE_REWARD_UNIT);
    }
  });

  it("should disband unit when at command limit", () => {
    const unitId = "peasants" as UnitId;
    const existingUnit = {
      instanceId: "existing_unit_1",
      unitId: "foresters" as UnitId,
      state: "ready" as const,
      wounded: false,
      usedResistanceThisCombat: false,
    };

    const state = createTestGameState({
      players: [
        createTestPlayer({
          id: "player1",
          units: [existingUnit],
          pendingRewards: [{ type: SITE_REWARD_UNIT }],
        }),
      ],
      offers: {
        ...createTestGameState().offers,
        units: [unitId],
      },
    });

    const command = createSelectRewardCommand({
      playerId: "player1",
      cardId: "dummy" as CardId,
      rewardIndex: 0,
      unitId,
      disbandUnitInstanceId: "existing_unit_1",
    });

    const result = command.execute(state);

    // Old unit should be removed, new unit added
    const player = result.state.players.find((p) => p.id === "player1");
    expect(player?.units).toHaveLength(1);
    expect(player?.units[0]?.unitId).toBe(unitId);
    expect(
      player?.units.find((u) => u.instanceId === "existing_unit_1")
    ).toBeUndefined();
  });

  it("should throw when unitId not provided", () => {
    const state = createTestGameState({
      players: [
        createTestPlayer({
          id: "player1",
          pendingRewards: [{ type: SITE_REWARD_UNIT }],
        }),
      ],
    });

    const command = createSelectRewardCommand({
      playerId: "player1",
      cardId: "dummy" as CardId,
      rewardIndex: 0,
    });

    expect(() => command.execute(state)).toThrow("Unit reward requires unitId");
  });

  it("should throw when unit not in offer", () => {
    const state = createTestGameState({
      players: [
        createTestPlayer({
          id: "player1",
          pendingRewards: [{ type: SITE_REWARD_UNIT }],
        }),
      ],
      offers: {
        ...createTestGameState().offers,
        units: [],
      },
    });

    const command = createSelectRewardCommand({
      playerId: "player1",
      cardId: "dummy" as CardId,
      rewardIndex: 0,
      unitId: "peasants" as UnitId,
    });

    expect(() => command.execute(state)).toThrow("Selected unit not in unit offer");
  });

  it("should validate unit reward selection when unit is in offer", () => {
    const state = createTestGameState({
      players: [
        createTestPlayer({
          id: "player1",
          pendingRewards: [{ type: SITE_REWARD_UNIT }],
        }),
      ],
      offers: {
        ...createTestGameState().offers,
        units: ["peasants" as UnitId],
      },
    });

    const validation = validateCardInOffer(state, "player1", {
      type: SELECT_REWARD_ACTION,
      cardId: "peasants" as CardId,
      rewardIndex: 0,
      unitId: "peasants" as UnitId,
    });

    expect(validation.valid).toBe(true);
  });

  it("should require disband target for unit reward when at command limit", () => {
    const state = createTestGameState({
      players: [
        createTestPlayer({
          id: "player1",
          pendingRewards: [{ type: SITE_REWARD_UNIT }],
          units: [
            {
              instanceId: "unit_1",
              unitId: "foresters" as UnitId,
              state: "ready",
              wounded: false,
              usedResistanceThisCombat: false,
            },
          ],
        }),
      ],
      offers: {
        ...createTestGameState().offers,
        units: ["peasants" as UnitId],
      },
    });

    const validation = validateCardInOffer(state, "player1", {
      type: SELECT_REWARD_ACTION,
      cardId: "peasants" as CardId,
      rewardIndex: 0,
      unitId: "peasants" as UnitId,
    });

    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.error.code).toBe(DISBAND_REQUIRED);
    }
  });
});
