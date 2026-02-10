import type { PlayerAction } from "./actions.js";
import { KNOWN_ACTION_TYPES } from "./actions.js";
import type { GameEvent } from "./events/index.js";
import type { ClientGameState } from "./types/clientState.js";

export const NETWORK_PROTOCOL_VERSION_1 = "1.1.0" as const;
export const NETWORK_PROTOCOL_VERSION = NETWORK_PROTOCOL_VERSION_1;

export type NetworkProtocolVersion = typeof NETWORK_PROTOCOL_VERSION;

export const CLIENT_MESSAGE_ACTION = "action" as const;
export const CLIENT_MESSAGE_LOBBY_SUBSCRIBE = "lobby_subscribe" as const;

export const SERVER_MESSAGE_STATE_UPDATE = "state_update" as const;
export const SERVER_MESSAGE_ERROR = "error" as const;
export const SERVER_MESSAGE_LOBBY_STATE = "lobby_state" as const;

export type ClientMessageType =
  | typeof CLIENT_MESSAGE_ACTION
  | typeof CLIENT_MESSAGE_LOBBY_SUBSCRIBE;
export type ServerMessageType =
  | typeof SERVER_MESSAGE_STATE_UPDATE
  | typeof SERVER_MESSAGE_ERROR
  | typeof SERVER_MESSAGE_LOBBY_STATE;

export const PROTOCOL_PARSE_ERROR_INVALID_ENVELOPE = "invalid_envelope" as const;
export const PROTOCOL_PARSE_ERROR_UNSUPPORTED_VERSION = "unsupported_version" as const;
export const PROTOCOL_PARSE_ERROR_UNKNOWN_MESSAGE_TYPE = "unknown_message_type" as const;
export const PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD = "invalid_payload" as const;

export type ProtocolParseErrorCode =
  | typeof PROTOCOL_PARSE_ERROR_INVALID_ENVELOPE
  | typeof PROTOCOL_PARSE_ERROR_UNSUPPORTED_VERSION
  | typeof PROTOCOL_PARSE_ERROR_UNKNOWN_MESSAGE_TYPE
  | typeof PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD;

export interface NetworkMessageEnvelope {
  readonly protocolVersion: NetworkProtocolVersion;
  readonly type: string;
}

export interface ClientActionMessage extends NetworkMessageEnvelope {
  readonly type: typeof CLIENT_MESSAGE_ACTION;
  readonly action: PlayerAction;
}

export interface ClientLobbySubscribeMessage extends NetworkMessageEnvelope {
  readonly type: typeof CLIENT_MESSAGE_LOBBY_SUBSCRIBE;
  readonly gameId: string;
  readonly playerId: string;
  readonly sessionToken?: string;
}

export type ClientMessage = ClientActionMessage | ClientLobbySubscribeMessage;

export interface StateUpdateMessage extends NetworkMessageEnvelope {
  readonly type: typeof SERVER_MESSAGE_STATE_UPDATE;
  readonly events: readonly GameEvent[];
  readonly state: ClientGameState;
}

export interface ErrorMessage extends NetworkMessageEnvelope {
  readonly type: typeof SERVER_MESSAGE_ERROR;
  readonly message: string;
  readonly errorCode?: string;
}

export interface LobbyStateMessage extends NetworkMessageEnvelope {
  readonly type: typeof SERVER_MESSAGE_LOBBY_STATE;
  readonly gameId: string;
  readonly status: "lobby" | "started";
  readonly playerIds: readonly string[];
  readonly maxPlayers: number;
}

export type ServerMessage = StateUpdateMessage | ErrorMessage | LobbyStateMessage;

export interface ProtocolParseError {
  readonly code: ProtocolParseErrorCode;
  readonly message: string;
}

export type ParseResult<TMessage> =
  | { readonly ok: true; readonly message: TMessage }
  | { readonly ok: false; readonly error: ProtocolParseError };

type JsonSchema = Readonly<Record<string, unknown>>;

const JSON_SCHEMA_DRAFT_2020 = "https://json-schema.org/draft/2020-12/schema";
const SCHEMA_BASE_ID =
  "https://mageknight.digital/schemas/network-protocol/v1";

export const clientToServerSchemaV1: JsonSchema = {
  $schema: JSON_SCHEMA_DRAFT_2020,
  $id: `${SCHEMA_BASE_ID}/client-to-server.schema.json`,
  title: "Mage Knight Client -> Server WebSocket Messages v1",
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["protocolVersion", "type", "action"],
      properties: {
        protocolVersion: { const: NETWORK_PROTOCOL_VERSION },
        type: { const: CLIENT_MESSAGE_ACTION },
        action: {
          $ref: "player-action.schema.json",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["protocolVersion", "type", "gameId", "playerId"],
      properties: {
        protocolVersion: { const: NETWORK_PROTOCOL_VERSION },
        type: { const: CLIENT_MESSAGE_LOBBY_SUBSCRIBE },
        gameId: { type: "string", minLength: 1 },
        playerId: { type: "string", minLength: 1 },
        sessionToken: { type: "string", minLength: 1 },
      },
    },
  ],
};

export const serverToClientSchemaV1: JsonSchema = {
  $schema: JSON_SCHEMA_DRAFT_2020,
  $id: `${SCHEMA_BASE_ID}/server-to-client.schema.json`,
  title: "Mage Knight Server -> Client WebSocket Messages v1",
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["protocolVersion", "type", "events", "state"],
      properties: {
        protocolVersion: { const: NETWORK_PROTOCOL_VERSION },
        type: { const: SERVER_MESSAGE_STATE_UPDATE },
        events: {
          type: "array",
          items: { $ref: "game-event.schema.json" },
        },
        state: {
          $ref: "client-game-state.schema.json",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["protocolVersion", "type", "message"],
      properties: {
        protocolVersion: { const: NETWORK_PROTOCOL_VERSION },
        type: { const: SERVER_MESSAGE_ERROR },
        message: { type: "string", minLength: 1 },
        errorCode: { type: "string", minLength: 1 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["protocolVersion", "type", "gameId", "status", "playerIds", "maxPlayers"],
      properties: {
        protocolVersion: { const: NETWORK_PROTOCOL_VERSION },
        type: { const: SERVER_MESSAGE_LOBBY_STATE },
        gameId: { type: "string", minLength: 1 },
        status: { enum: ["lobby", "started"] },
        playerIds: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 },
        },
        maxPlayers: { type: "integer", minimum: 1 },
      },
    },
  ],
};

export const networkProtocolSchemasV1 = {
  protocolVersion: NETWORK_PROTOCOL_VERSION,
  clientToServerSchema: clientToServerSchemaV1,
  serverToClientSchema: serverToClientSchemaV1,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function invalid(code: ProtocolParseErrorCode, message: string): ParseResult<never> {
  return { ok: false, error: { code, message } };
}

function validateEnvelope(value: unknown): ParseResult<Record<string, unknown>> {
  if (!isRecord(value)) {
    return invalid(PROTOCOL_PARSE_ERROR_INVALID_ENVELOPE, "Message must be a JSON object.");
  }

  const type = value.type;
  if (typeof type !== "string" || type.length === 0) {
    return invalid(PROTOCOL_PARSE_ERROR_INVALID_ENVELOPE, "Message type must be a non-empty string.");
  }

  if (value.protocolVersion !== NETWORK_PROTOCOL_VERSION) {
    return invalid(
      PROTOCOL_PARSE_ERROR_UNSUPPORTED_VERSION,
      `Unsupported protocol version: ${String(value.protocolVersion)}.`
    );
  }

  return { ok: true, message: value };
}

export function parseClientMessage(value: unknown): ParseResult<ClientMessage> {
  const envelope = validateEnvelope(value);
  if (!envelope.ok) {
    return envelope;
  }

  switch (envelope.message.type) {
    case CLIENT_MESSAGE_ACTION: {
      const action = envelope.message.action;
      if (!isRecord(action) || typeof action.type !== "string" || action.type.length === 0) {
        return invalid(
          PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD,
          "Action message payload must include a non-empty action.type string."
        );
      }

      if (!KNOWN_ACTION_TYPES.has(action.type)) {
        return invalid(
          PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD,
          `Unknown action type: ${action.type}.`
        );
      }

      return { ok: true, message: envelope.message as ClientActionMessage };
    }
    case CLIENT_MESSAGE_LOBBY_SUBSCRIBE: {
      const gameId = envelope.message.gameId;
      const playerId = envelope.message.playerId;
      const sessionToken = envelope.message.sessionToken;

      if (typeof gameId !== "string" || gameId.length === 0) {
        return invalid(PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD, "lobby_subscribe requires gameId.");
      }

      if (typeof playerId !== "string" || playerId.length === 0) {
        return invalid(PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD, "lobby_subscribe requires playerId.");
      }

      if (sessionToken !== undefined && (typeof sessionToken !== "string" || sessionToken.length === 0)) {
        return invalid(
          PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD,
          "lobby_subscribe sessionToken must be a non-empty string when provided."
        );
      }

      return { ok: true, message: envelope.message as ClientLobbySubscribeMessage };
    }
    default:
      return invalid(
        PROTOCOL_PARSE_ERROR_UNKNOWN_MESSAGE_TYPE,
        `Unknown client message type: ${String(envelope.message.type)}.`
      );
  }
}

export function parseServerMessage(value: unknown): ParseResult<ServerMessage> {
  const envelope = validateEnvelope(value);
  if (!envelope.ok) {
    return envelope;
  }

  switch (envelope.message.type) {
    case SERVER_MESSAGE_STATE_UPDATE: {
      const events = envelope.message.events;
      const state = envelope.message.state;

      // TODO(protocol): parse nested GameEvent[] and ClientGameState shapes once deep schemas are available.
      if (!Array.isArray(events) || !isRecord(state)) {
        return invalid(
          PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD,
          "state_update requires events[] and state object."
        );
      }

      return { ok: true, message: envelope.message as StateUpdateMessage };
    }
    case SERVER_MESSAGE_ERROR: {
      const message = envelope.message.message;
      const errorCode = envelope.message.errorCode;
      if (typeof message !== "string" || message.length === 0) {
        return invalid(PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD, "error requires a non-empty message.");
      }

      if (errorCode !== undefined && (typeof errorCode !== "string" || errorCode.length === 0)) {
        return invalid(
          PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD,
          "errorCode must be a non-empty string when provided."
        );
      }

      return { ok: true, message: envelope.message as ErrorMessage };
    }
    case SERVER_MESSAGE_LOBBY_STATE: {
      const { gameId, status, playerIds, maxPlayers } = envelope.message;
      if (typeof gameId !== "string" || gameId.length === 0) {
        return invalid(PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD, "lobby_state requires gameId.");
      }

      if (status !== "lobby" && status !== "started") {
        return invalid(PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD, "lobby_state status must be lobby or started.");
      }

      if (!Array.isArray(playerIds) || playerIds.some((id) => typeof id !== "string" || id.length === 0)) {
        return invalid(PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD, "lobby_state requires playerIds[] of strings.");
      }

      if (typeof maxPlayers !== "number" || !Number.isInteger(maxPlayers) || maxPlayers <= 0) {
        return invalid(PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD, "lobby_state requires maxPlayers integer > 0.");
      }

      return { ok: true, message: envelope.message as LobbyStateMessage };
    }
    default:
      return invalid(
        PROTOCOL_PARSE_ERROR_UNKNOWN_MESSAGE_TYPE,
        `Unknown server message type: ${String(envelope.message.type)}.`
      );
  }
}
