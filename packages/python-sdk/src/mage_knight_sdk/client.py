from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, AsyncIterator, Mapping
from urllib.parse import urlencode, urlparse, urlunparse

import websockets
from websockets.exceptions import ConnectionClosed

from .protocol import (
    NETWORK_PROTOCOL_VERSION,
    ProtocolParseError,
    ProtocolValidationError,
    parse_server_message,
    serialize_client_message,
    validate_action_payload,
)
from .protocol_models import ClientActionMessage, ClientLobbySubscribeMessage, ServerMessage

CONNECTION_STATUS_CONNECTING = "connecting"
CONNECTION_STATUS_CONNECTED = "connected"
CONNECTION_STATUS_RECONNECTING = "reconnecting"
CONNECTION_STATUS_DISCONNECTED = "disconnected"
CONNECTION_STATUS_ERROR = "error"


@dataclass(frozen=True)
class ConnectionState:
    status: str
    occurred_at: datetime
    error: str | None = None
    reconnect_attempt: int | None = None
    max_reconnect_attempts: int | None = None


class MageKnightClient:
    def __init__(
        self,
        server_url: str,
        game_id: str,
        player_id: str,
        session_token: str | None = None,
        reconnect_base_delay: float = 0.5,
        max_reconnect_attempts: int = 5,
        subscribe_lobby_on_connect: bool = False,
    ) -> None:
        self._server_url = server_url
        self._game_id = game_id
        self._player_id = player_id
        self._session_token = session_token
        self._reconnect_base_delay = reconnect_base_delay
        self._max_reconnect_attempts = max_reconnect_attempts
        self._subscribe_lobby_on_connect = subscribe_lobby_on_connect

        self._ws: Any = None
        self._receiver_task: asyncio.Task[None] | None = None
        self._messages: asyncio.Queue[ServerMessage | None] = asyncio.Queue()
        self._states: asyncio.Queue[ConnectionState | None] = asyncio.Queue()
        self._close_requested = False
        self._terminated = False

    async def __aenter__(self) -> MageKnightClient:
        await self.connect()
        return self

    async def __aexit__(self, exc_type: object, exc: object, tb: object) -> None:
        await self.close()

    async def connect(self) -> None:
        if self._receiver_task and not self._receiver_task.done():
            return

        self._close_requested = False
        self._terminated = False
        await self._open_connection(is_reconnect=False)
        self._receiver_task = asyncio.create_task(self._run_receiver())

    async def close(self) -> None:
        self._close_requested = True

        if self._ws is not None:
            await self._ws.close()

        if self._receiver_task is not None:
            await self._receiver_task
            self._receiver_task = None

        if not self._terminated:
            self._terminated = True
            await self._emit_state(CONNECTION_STATUS_DISCONNECTED)
            await self._messages.put(None)
            await self._states.put(None)

    async def send_action(self, action: Mapping[str, Any]) -> None:
        validate_action_payload(action)
        if self._ws is None:
            raise ConnectionError("WebSocket is not connected")

        message = ClientActionMessage(
            protocolVersion=NETWORK_PROTOCOL_VERSION,
            type="action",
            action=dict(action),
        )
        await self._ws.send(json.dumps(serialize_client_message(message)))

    async def send_lobby_subscribe(self) -> None:
        if self._ws is None:
            raise ConnectionError("WebSocket is not connected")

        message = ClientLobbySubscribeMessage(
            protocolVersion=NETWORK_PROTOCOL_VERSION,
            type="lobby_subscribe",
            gameId=self._game_id,
            playerId=self._player_id,
            sessionToken=self._session_token,
        )
        await self._ws.send(json.dumps(serialize_client_message(message)))

    async def messages(self) -> AsyncIterator[ServerMessage]:
        while True:
            message = await self._messages.get()
            if message is None:
                break
            yield message

    async def state_changes(self) -> AsyncIterator[ConnectionState]:
        while True:
            state = await self._states.get()
            if state is None:
                break
            yield state

    async def _open_connection(self, is_reconnect: bool, reconnect_attempt: int | None = None) -> None:
        status = CONNECTION_STATUS_RECONNECTING if is_reconnect else CONNECTION_STATUS_CONNECTING
        await self._emit_state(
            status,
            reconnect_attempt=reconnect_attempt,
            max_reconnect_attempts=self._max_reconnect_attempts if is_reconnect else None,
        )

        self._ws = await websockets.connect(self._build_ws_url())

        if self._subscribe_lobby_on_connect:
            await self.send_lobby_subscribe()

        await self._emit_state(CONNECTION_STATUS_CONNECTED)

    async def _run_receiver(self) -> None:
        while not self._close_requested:
            try:
                if self._ws is None:
                    raise ConnectionError("WebSocket unavailable")

                raw = await self._ws.recv()
                payload = json.loads(raw)
                message = parse_server_message(payload)
                await self._messages.put(message)
            except ProtocolParseError as error:
                await self._emit_state(CONNECTION_STATUS_ERROR, f"{error.code}: {error}")
                break
            except (ProtocolValidationError, json.JSONDecodeError) as error:
                await self._emit_state(CONNECTION_STATUS_ERROR, str(error))
                break
            except ConnectionClosed:
                if self._close_requested:
                    break

                if not await self._attempt_reconnect():
                    break
            except Exception as error:  # pragma: no cover - defensive branch
                if self._close_requested:
                    break
                if not await self._attempt_reconnect(str(error)):
                    break

        if not self._terminated:
            self._terminated = True
            await self._emit_state(CONNECTION_STATUS_DISCONNECTED)
            await self._messages.put(None)
            await self._states.put(None)

    async def _attempt_reconnect(self, reason: str | None = None) -> bool:
        last_error = reason

        for attempt in range(1, self._max_reconnect_attempts + 1):
            delay = self._reconnect_base_delay * (2 ** (attempt - 1))
            await asyncio.sleep(delay)

            try:
                await self._open_connection(is_reconnect=True, reconnect_attempt=attempt)
                return True
            except Exception as error:  # pragma: no cover - exercised via integration flow
                last_error = str(error)

        await self._emit_state(
            CONNECTION_STATUS_ERROR,
            last_error or f"Failed to reconnect after {self._max_reconnect_attempts} attempts",
            reconnect_attempt=self._max_reconnect_attempts,
            max_reconnect_attempts=self._max_reconnect_attempts,
        )
        return False

    async def _emit_state(
        self,
        status: str,
        error: str | None = None,
        reconnect_attempt: int | None = None,
        max_reconnect_attempts: int | None = None,
    ) -> None:
        await self._states.put(
            ConnectionState(
                status=status,
                occurred_at=datetime.now(UTC),
                error=error,
                reconnect_attempt=reconnect_attempt,
                max_reconnect_attempts=max_reconnect_attempts,
            )
        )

    def _build_ws_url(self) -> str:
        parsed = urlparse(self._server_url)
        query_items: dict[str, str] = {
            "gameId": self._game_id,
            "playerId": self._player_id,
        }
        if self._session_token:
            query_items["sessionToken"] = self._session_token

        query = urlencode(query_items)
        return urlunparse(parsed._replace(query=query))
