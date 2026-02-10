from __future__ import annotations

from dataclasses import asdict
from typing import Any, Mapping

from .protocol_models import (
    KNOWN_CLIENT_MESSAGE_TYPES,
    KNOWN_SERVER_MESSAGE_TYPES,
    NETWORK_PROTOCOL_VERSION,
    ClientActionMessage,
    ClientLobbySubscribeMessage,
    ClientMessage,
    ErrorMessage,
    LobbyStateMessage,
    ServerMessage,
    StateUpdateMessage,
)

PROTOCOL_PARSE_ERROR_INVALID_ENVELOPE = "invalid_envelope"
PROTOCOL_PARSE_ERROR_UNSUPPORTED_VERSION = "unsupported_version"
PROTOCOL_PARSE_ERROR_UNKNOWN_MESSAGE_TYPE = "unknown_message_type"
PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD = "invalid_payload"


class ProtocolParseError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class ProtocolValidationError(ValueError):
    pass


def serialize_client_message(message: ClientMessage) -> dict[str, Any]:
    return asdict(message)


def parse_client_message(value: Any) -> ClientMessage:
    envelope = _validate_envelope(value, KNOWN_CLIENT_MESSAGE_TYPES)
    message_type = envelope["type"]

    if message_type == "action":
        action = envelope.get("action")
        if not isinstance(action, Mapping) or not _non_empty_string(action.get("type")):
            raise ProtocolParseError(
                PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD,
                "Action message payload must include a non-empty action.type string.",
            )

        return ClientActionMessage(
            protocolVersion=NETWORK_PROTOCOL_VERSION,
            type="action",
            action=dict(action),
        )

    if message_type == "lobby_subscribe":
        game_id = envelope.get("gameId")
        player_id = envelope.get("playerId")
        session_token = envelope.get("sessionToken")

        if not _non_empty_string(game_id):
            raise ProtocolParseError(PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD, "lobby_subscribe requires gameId.")

        if not _non_empty_string(player_id):
            raise ProtocolParseError(PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD, "lobby_subscribe requires playerId.")

        if session_token is not None and not _non_empty_string(session_token):
            raise ProtocolParseError(
                PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD,
                "lobby_subscribe sessionToken must be a non-empty string when provided.",
            )

        return ClientLobbySubscribeMessage(
            protocolVersion=NETWORK_PROTOCOL_VERSION,
            type="lobby_subscribe",
            gameId=game_id,
            playerId=player_id,
            sessionToken=session_token,
        )

    raise ProtocolParseError(
        PROTOCOL_PARSE_ERROR_UNKNOWN_MESSAGE_TYPE,
        f"Unknown client message type: {message_type}.",
    )


def parse_server_message(value: Any) -> ServerMessage:
    envelope = _validate_envelope(value, KNOWN_SERVER_MESSAGE_TYPES)
    message_type = envelope["type"]

    if message_type == "state_update":
        events = envelope.get("events")
        state = envelope.get("state")
        if not isinstance(events, list) or not isinstance(state, Mapping):
            raise ProtocolParseError(
                PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD,
                "state_update requires events[] and state object.",
            )

        return StateUpdateMessage(
            protocolVersion=NETWORK_PROTOCOL_VERSION,
            type="state_update",
            events=list(events),
            state=dict(state),
        )

    if message_type == "error":
        message = envelope.get("message")
        error_code = envelope.get("errorCode")

        if not _non_empty_string(message):
            raise ProtocolParseError(
                PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD,
                "error requires a non-empty message.",
            )

        if error_code is not None and not _non_empty_string(error_code):
            raise ProtocolParseError(
                PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD,
                "errorCode must be a non-empty string when provided.",
            )

        return ErrorMessage(
            protocolVersion=NETWORK_PROTOCOL_VERSION,
            type="error",
            message=message,
            errorCode=error_code,
        )

    if message_type == "lobby_state":
        game_id = envelope.get("gameId")
        status = envelope.get("status")
        player_ids = envelope.get("playerIds")
        max_players = envelope.get("maxPlayers")

        if not _non_empty_string(game_id):
            raise ProtocolParseError(PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD, "lobby_state requires gameId.")

        if status not in {"lobby", "started"}:
            raise ProtocolParseError(
                PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD,
                "lobby_state status must be lobby or started.",
            )

        if not isinstance(player_ids, list) or any(not _non_empty_string(item) for item in player_ids):
            raise ProtocolParseError(
                PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD,
                "lobby_state requires playerIds[] of strings.",
            )

        if not isinstance(max_players, int) or max_players <= 0:
            raise ProtocolParseError(
                PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD,
                "lobby_state requires maxPlayers integer > 0.",
            )

        return LobbyStateMessage(
            protocolVersion=NETWORK_PROTOCOL_VERSION,
            type="lobby_state",
            gameId=game_id,
            status=status,
            playerIds=list(player_ids),
            maxPlayers=max_players,
        )

    raise ProtocolParseError(
        PROTOCOL_PARSE_ERROR_UNKNOWN_MESSAGE_TYPE,
        f"Unknown server message type: {message_type}.",
    )


def _validate_envelope(value: Any, known_types: tuple[str, ...]) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ProtocolParseError(PROTOCOL_PARSE_ERROR_INVALID_ENVELOPE, "Message must be a JSON object.")

    message_type = value.get("type")
    if not _non_empty_string(message_type):
        raise ProtocolParseError(
            PROTOCOL_PARSE_ERROR_INVALID_ENVELOPE,
            "Message type must be a non-empty string.",
        )

    if value.get("protocolVersion") != NETWORK_PROTOCOL_VERSION:
        raise ProtocolParseError(
            PROTOCOL_PARSE_ERROR_UNSUPPORTED_VERSION,
            f"Unsupported protocol version: {value.get('protocolVersion')}.",
        )

    if message_type not in known_types:
        raise ProtocolParseError(
            PROTOCOL_PARSE_ERROR_UNKNOWN_MESSAGE_TYPE,
            f"Unknown message type: {message_type}.",
        )

    return value


def validate_action_payload(action: Mapping[str, Any]) -> None:
    if not _non_empty_string(action.get("type")):
        raise ProtocolValidationError("action must include a non-empty 'type' field")


def _non_empty_string(value: Any) -> bool:
    return isinstance(value, str) and len(value) > 0
