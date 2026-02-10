/**
 * Deep Schema Contract Tests
 *
 * Validates that:
 * 1. Generated deep schemas are valid and match committed artifacts
 * 2. Representative fixtures validate against schemas via Ajv
 * 3. Invalid payloads are rejected
 * 4. Branded types are serialized as plain strings
 * 5. A full state_update message validates against composed schemas (like an external client would)
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";

import {
  MOVE_ACTION,
  PLAY_CARD_ACTION,
  ENTER_COMBAT_ACTION,
  END_TURN_ACTION,
  EXPLORE_ACTION,
} from "../src/actions.js";
import {
  NETWORK_PROTOCOL_VERSION,
  SERVER_MESSAGE_STATE_UPDATE,
} from "../src/networkProtocol.js";
import { MANA_SOURCE_DIE } from "../src/valueConstants.js";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = join(TEST_DIR, "..", "schemas", "network-protocol", "v1");

function loadSchema(filename: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(SCHEMA_DIR, filename), "utf8")) as Record<string, unknown>;
}

const playerActionSchema = loadSchema("player-action.schema.json");
const gameEventSchema = loadSchema("game-event.schema.json");
const clientGameStateSchema = loadSchema("client-game-state.schema.json");
const serverToClientSchema = loadSchema("server-to-client.schema.json");

function createAjv(): Ajv {
  const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
  ajv.addSchema(playerActionSchema, "player-action.schema.json");
  ajv.addSchema(gameEventSchema, "game-event.schema.json");
  ajv.addSchema(clientGameStateSchema, "client-game-state.schema.json");
  return ajv;
}

// === Action Fixtures ===

const validMoveAction = {
  type: MOVE_ACTION,
  target: { q: 1, r: -1 },
};

const validPlayCardAction = {
  type: PLAY_CARD_ACTION,
  cardId: "march",
  powered: false,
};

const validPlayCardPoweredAction = {
  type: PLAY_CARD_ACTION,
  cardId: "rage",
  powered: true,
  manaSource: {
    type: MANA_SOURCE_DIE,
    color: "red",
    dieId: "die-1",
  },
};

const validEnterCombatAction = {
  type: ENTER_COMBAT_ACTION,
  enemyIds: ["prowlers"],
};

const validEndTurnAction = {
  type: END_TURN_ACTION,
};

const validExploreAction = {
  type: EXPLORE_ACTION,
  direction: "NE",
  fromTileCoord: { q: 0, r: 0 },
};

// === Event Fixtures ===

const validGameStartedEvent = {
  type: "GAME_STARTED",
  playerCount: 1,
  scenario: "solo_conquest",
};

const validPlayerMovedEvent = {
  type: "PLAYER_MOVED",
  playerId: "player1",
  from: { q: 0, r: 0 },
  to: { q: 1, r: -1 },
};

const validTurnEndedEvent = {
  type: "TURN_ENDED",
  playerId: "player1",
  nextPlayerId: null,
  cardsDiscarded: 3,
  cardsDrawn: 5,
};

// === Minimal ClientGameState Fixture ===

const ZERO_ELEMENTAL: Record<string, number> = {
  physical: 0,
  fire: 0,
  ice: 0,
  coldFire: 0,
};

const ZERO_ACCUMULATED_ATTACK = {
  normal: 0,
  ranged: 0,
  siege: 0,
  normalElements: ZERO_ELEMENTAL,
  rangedElements: ZERO_ELEMENTAL,
  siegeElements: ZERO_ELEMENTAL,
};

const minimalClientPlayer = {
  id: "player1",
  heroId: "arythea",
  position: { q: 0, r: 0 },
  fame: 0,
  level: 1,
  reputation: 0,
  armor: 2,
  handLimit: 5,
  commandTokens: 1,
  hand: ["march", "rage", "stamina", "determination", "swiftness"],
  deckCount: 11,
  discardCount: 0,
  playArea: [],
  units: [],
  attachedBanners: [],
  crystals: { red: 0, blue: 0, green: 0, white: 0 },
  skills: [],
  keptEnemyTokens: [],
  movePoints: 0,
  influencePoints: 0,
  pureMana: [],
  hasMovedThisTurn: false,
  hasTakenActionThisTurn: false,
  usedManaFromSource: false,
  playedCardFromHandThisTurn: false,
  isResting: false,
  knockedOut: false,
  selectedTacticId: null,
  tacticFlipped: false,
  pendingChoice: null,
  combatAccumulator: {
    attack: ZERO_ACCUMULATED_ATTACK,
    block: 0,
    blockElements: ZERO_ELEMENTAL,
  },
  pendingRewards: [],
  pendingGladeWoundChoice: false,
  pendingDiscard: null,
  pendingDeepMineChoice: null,
  pendingUnitMaintenance: null,
  healingPoints: 0,
  stolenManaDie: null,
  pendingLevelUpRewards: [],
  pendingLevelUps: [],
};

const minimalClientGameState = {
  phase: "round",
  roundPhase: "player_turns",
  timeOfDay: "day",
  round: 1,
  turnOrder: ["player1"],
  currentPlayerId: "player1",
  endOfRoundAnnouncedBy: null,
  players: [minimalClientPlayer],
  map: {
    hexes: {},
    tiles: [],
    tileSlots: {},
  },
  source: {
    dice: [],
  },
  offers: {
    units: [],
    advancedActions: { cards: [] },
    spells: { cards: [] },
    commonSkills: [],
    monasteryAdvancedActions: [],
  },
  combat: null,
  scenarioEndTriggered: false,
  deckCounts: {
    spells: 10,
    advancedActions: 20,
    artifacts: 10,
    regularUnits: 8,
    eliteUnits: 6,
  },
  woundPileCount: null,
  dummyPlayer: null,
  validActions: {
    mode: "cannot_act",
    reason: "Not your turn",
  },
};

describe("deep schema contract", () => {
  describe("PlayerAction schema", () => {
    it("validates MoveAction", () => {
      const ajv = createAjv();
      const validate = ajv.compile(playerActionSchema);
      expect(validate(validMoveAction)).toBe(true);
    });

    it("validates PlayCardAction (unpowered)", () => {
      const ajv = createAjv();
      const validate = ajv.compile(playerActionSchema);
      expect(validate(validPlayCardAction)).toBe(true);
    });

    it("validates PlayCardAction (powered)", () => {
      const ajv = createAjv();
      const validate = ajv.compile(playerActionSchema);
      expect(validate(validPlayCardPoweredAction)).toBe(true);
    });

    it("validates EnterCombatAction", () => {
      const ajv = createAjv();
      const validate = ajv.compile(playerActionSchema);
      expect(validate(validEnterCombatAction)).toBe(true);
    });

    it("validates EndTurnAction", () => {
      const ajv = createAjv();
      const validate = ajv.compile(playerActionSchema);
      expect(validate(validEndTurnAction)).toBe(true);
    });

    it("validates ExploreAction", () => {
      const ajv = createAjv();
      const validate = ajv.compile(playerActionSchema);
      expect(validate(validExploreAction)).toBe(true);
    });

    it("rejects action with missing required fields", () => {
      const ajv = createAjv();
      const validate = ajv.compile(playerActionSchema);
      // MoveAction without target
      expect(validate({ type: MOVE_ACTION })).toBe(false);
    });

    it("rejects action with unknown type discriminant", () => {
      const ajv = createAjv();
      const validate = ajv.compile(playerActionSchema);
      expect(validate({ type: "BOGUS_ACTION" })).toBe(false);
    });

    it("treats branded type fields (CardId, EnemyId) as plain strings", () => {
      const schema = JSON.stringify(playerActionSchema);
      expect(schema).not.toContain("__brand");
      // CardId fields should just be { type: "string" }
      const ajv = createAjv();
      const validate = ajv.compile(playerActionSchema);
      // PlayCardAction with cardId as plain string
      expect(validate({ type: PLAY_CARD_ACTION, cardId: "any_string", powered: false })).toBe(true);
    });
  });

  describe("GameEvent schema", () => {
    it("validates GameStartedEvent", () => {
      const ajv = createAjv();
      const validate = ajv.compile(gameEventSchema);
      expect(validate(validGameStartedEvent)).toBe(true);
    });

    it("validates PlayerMovedEvent", () => {
      const ajv = createAjv();
      const validate = ajv.compile(gameEventSchema);
      expect(validate(validPlayerMovedEvent)).toBe(true);
    });

    it("validates TurnEndedEvent", () => {
      const ajv = createAjv();
      const validate = ajv.compile(gameEventSchema);
      expect(validate(validTurnEndedEvent)).toBe(true);
    });

    it("rejects event with missing required fields", () => {
      const ajv = createAjv();
      const validate = ajv.compile(gameEventSchema);
      // PlayerMovedEvent without `to`
      expect(validate({ type: "PLAYER_MOVED", playerId: "p1", from: { q: 0, r: 0 } })).toBe(false);
    });
  });

  describe("ClientGameState schema", () => {
    it("validates minimal game state", () => {
      const ajv = createAjv();
      const validate = ajv.compile(clientGameStateSchema);
      const valid = validate(minimalClientGameState);
      if (!valid) {
        // eslint-disable-next-line no-console -- useful for debugging test failures
        console.error("Validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });
  });

  describe("full state_update round-trip", () => {
    it("validates a complete server message with all $ref schemas loaded", () => {
      const ajv = createAjv();
      const validate = ajv.compile(serverToClientSchema);

      const stateUpdateMessage = {
        protocolVersion: NETWORK_PROTOCOL_VERSION,
        type: SERVER_MESSAGE_STATE_UPDATE,
        events: [validGameStartedEvent, validPlayerMovedEvent],
        state: minimalClientGameState,
      };

      const valid = validate(stateUpdateMessage);
      if (!valid) {
        // eslint-disable-next-line no-console -- useful for debugging test failures
        console.error("Validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

    it("rejects state_update with invalid event", () => {
      const ajv = createAjv();
      const validate = ajv.compile(serverToClientSchema);

      const badMessage = {
        protocolVersion: NETWORK_PROTOCOL_VERSION,
        type: SERVER_MESSAGE_STATE_UPDATE,
        events: [{ type: "BOGUS_EVENT" }],
        state: minimalClientGameState,
      };

      expect(validate(badMessage)).toBe(false);
    });
  });

  describe("schema artifact freshness", () => {
    it("deep schemas exist and are valid JSON", () => {
      expect(() => loadSchema("player-action.schema.json")).not.toThrow();
      expect(() => loadSchema("game-event.schema.json")).not.toThrow();
      expect(() => loadSchema("client-game-state.schema.json")).not.toThrow();
    });

    it("deep schemas contain expected top-level structure", () => {
      expect(playerActionSchema).toHaveProperty("anyOf");
      expect(gameEventSchema).toHaveProperty("anyOf");
      expect(clientGameStateSchema).toHaveProperty("properties");
      expect(clientGameStateSchema).toHaveProperty("required");
    });

    it("protocol.json lists all schema files", () => {
      const protocol = loadSchema("protocol.json");
      const files = protocol.files as string[];
      expect(files).toContain("player-action.schema.json");
      expect(files).toContain("game-event.schema.json");
      expect(files).toContain("client-game-state.schema.json");
    });
  });
});
