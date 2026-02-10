"""Auto-generated protocol dataclasses. Do not edit by hand."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, TypeAlias

NETWORK_PROTOCOL_VERSION: Literal["1.0.0"] = "1.0.0"

@dataclass(frozen=True)
class ClientActionMessage:
    action: dict[str, Any]
    protocolVersion: Literal["1.0.0"]
    type: Literal["action"]
@dataclass(frozen=True)
class ClientLobbySubscribeMessage:
    gameId: str
    playerId: str
    protocolVersion: Literal["1.0.0"]
    sessionToken: str | None
    type: Literal["lobby_subscribe"]

@dataclass(frozen=True)
class StateUpdateMessage:
    events: list[Any]
    protocolVersion: Literal["1.0.0"]
    state: dict[str, Any]
    type: Literal["state_update"]
@dataclass(frozen=True)
class ErrorMessage:
    errorCode: str | None
    message: str
    protocolVersion: Literal["1.0.0"]
    type: Literal["error"]
@dataclass(frozen=True)
class LobbyStateMessage:
    gameId: str
    maxPlayers: int
    playerIds: list[str]
    protocolVersion: Literal["1.0.0"]
    status: Literal["lobby", "started"]
    type: Literal["lobby_state"]

ClientMessage: TypeAlias = ClientActionMessage | ClientLobbySubscribeMessage
ServerMessage: TypeAlias = StateUpdateMessage | ErrorMessage | LobbyStateMessage
KNOWN_CLIENT_MESSAGE_TYPES: tuple[str, ...] = ("action", "lobby_subscribe",)
KNOWN_SERVER_MESSAGE_TYPES: tuple[str, ...] = ("state_update", "error", "lobby_state",)
