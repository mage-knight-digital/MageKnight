from __future__ import annotations

import asyncio
import json
import sys
import time
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
SDK_SRC = REPO_ROOT / "packages/python-sdk/src"
if str(SDK_SRC) not in sys.path:
    sys.path.insert(0, str(SDK_SRC))

from mage_knight_sdk.client import MageKnightClient


class _FakeWebSocket:
    def __init__(self, recv_error: Exception | None = None) -> None:
        self.sent: list[str] = []
        self.closed = False
        self._recv_error = recv_error

    async def send(self, message: str) -> None:
        self.sent.append(message)

    async def recv(self) -> str:
        if self._recv_error is not None:
            raise self._recv_error
        await asyncio.sleep(3600)
        return ""

    async def close(self) -> None:
        self.closed = True


class MageKnightClientUnitTest(unittest.IsolatedAsyncioTestCase):
    async def test_send_lobby_subscribe_omits_null_session_token(self) -> None:
        client = MageKnightClient(
            server_url="ws://127.0.0.1:3001",
            game_id="g_test",
            player_id="player-1",
            session_token=None,
        )
        fake_ws = _FakeWebSocket()
        client._ws = fake_ws

        await client.send_lobby_subscribe()

        payload = json.loads(fake_ws.sent[0])
        self.assertNotIn("sessionToken", payload)
        self.assertEqual(payload["type"], "lobby_subscribe")

    async def test_close_cancels_reconnect_backoff_sleep(self) -> None:
        client = MageKnightClient(
            server_url="ws://127.0.0.1:3001",
            game_id="g_test",
            player_id="player-1",
            reconnect_base_delay=5.0,
            max_reconnect_attempts=2,
        )
        client._ws = _FakeWebSocket(recv_error=RuntimeError("boom"))
        client._receiver_task = asyncio.create_task(client._run_receiver())

        await asyncio.sleep(0.05)

        started = time.monotonic()
        await client.close()
        elapsed = time.monotonic() - started

        self.assertLess(elapsed, 1.0)


if __name__ == "__main__":
    unittest.main()
