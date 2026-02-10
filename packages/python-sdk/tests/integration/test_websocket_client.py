from __future__ import annotations

import asyncio
import json
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
SDK_SRC = REPO_ROOT / "packages/python-sdk/src"
if str(SDK_SRC) not in sys.path:
    sys.path.insert(0, str(SDK_SRC))

from mage_knight_sdk import (
    CONNECTION_STATUS_CONNECTED,
    CONNECTION_STATUS_CONNECTING,
    CONNECTION_STATUS_DISCONNECTED,
    CONNECTION_STATUS_ERROR,
    CONNECTION_STATUS_RECONNECTING,
    MageKnightClient,
    StateUpdateMessage,
)


class WebSocketClientIntegrationTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.repo_root = REPO_ROOT
        self.server_script = self.repo_root / "packages/python-sdk/tests/integration/ws_test_server.ts"

        self.server = await asyncio.create_subprocess_exec(
            "bun",
            "run",
            str(self.server_script),
            cwd=str(self.repo_root),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        assert self.server.stdout is not None
        line = await asyncio.wait_for(self.server.stdout.readline(), timeout=10)
        if not line:
            stderr = await self._read_stderr()
            raise RuntimeError(f"Test server failed to start. stderr: {stderr}")

        payload = json.loads(line.decode("utf-8"))
        self.port = payload["port"]
        self.game_id = payload["gameId"]
        self.player_id = payload["playerId"]

    async def asyncTearDown(self) -> None:
        if self.server.returncode is None:
            self.server.terminate()
            try:
                await asyncio.wait_for(self.server.wait(), timeout=5)
            except asyncio.TimeoutError:
                self.server.kill()
                await self.server.wait()

    async def test_connect_send_action_and_receive_state_updates(self) -> None:
        client = MageKnightClient(
            server_url=f"ws://127.0.0.1:{self.port}",
            game_id=self.game_id,
            player_id=self.player_id,
            reconnect_base_delay=0.05,
            max_reconnect_attempts=3,
        )

        await client.connect()

        message_stream = client.messages()
        initial = await asyncio.wait_for(anext(message_stream), timeout=10)
        self.assertIsInstance(initial, StateUpdateMessage)

        await client.send_action({"type": "END_TURN"})

        found_action_update = False
        for _ in range(8):
            message = await asyncio.wait_for(anext(message_stream), timeout=5)
            if isinstance(message, StateUpdateMessage) and len(message.events) > 0:
                found_action_update = True
                break

        self.assertTrue(found_action_update)
        await client.close()

    async def test_emits_reconnect_and_error_states_on_interruption(self) -> None:
        client = MageKnightClient(
            server_url=f"ws://127.0.0.1:{self.port}",
            game_id=self.game_id,
            player_id=self.player_id,
            reconnect_base_delay=0.05,
            max_reconnect_attempts=2,
        )

        await client.connect()

        self.server.terminate()
        await asyncio.wait_for(self.server.wait(), timeout=5)

        states: list[str] = []
        async for state in client.state_changes():
            states.append(state.status)
            if state.status in {CONNECTION_STATUS_ERROR, CONNECTION_STATUS_DISCONNECTED}:
                break

        await client.close()

        self.assertIn(CONNECTION_STATUS_CONNECTING, states)
        self.assertIn(CONNECTION_STATUS_CONNECTED, states)
        self.assertIn(CONNECTION_STATUS_RECONNECTING, states)
        self.assertIn(CONNECTION_STATUS_ERROR, states)

    async def _read_stderr(self) -> str:
        if self.server.stderr is None:
            return ""

        chunks: list[str] = []
        while True:
            line = await self.server.stderr.readline()
            if not line:
                break
            chunks.append(line.decode("utf-8"))

        return "".join(chunks)


if __name__ == "__main__":
    unittest.main()
