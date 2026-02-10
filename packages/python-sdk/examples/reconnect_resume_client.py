from __future__ import annotations

import asyncio

from mage_knight_sdk import MageKnightClient


async def print_states(client: MageKnightClient) -> None:
    async for state in client.state_changes():
        print(
            {
                "status": state.status,
                "occurred_at": state.occurred_at.isoformat(),
                "error": state.error,
                "reconnect_attempt": state.reconnect_attempt,
            }
        )


async def main() -> None:
    game_id = "g_replace_me"
    player_id = "player-1"
    session_token = "session_token_from_bootstrap"

    client = MageKnightClient(
        server_url="ws://127.0.0.1:3001",
        game_id=game_id,
        player_id=player_id,
        session_token=session_token,
        reconnect_base_delay=0.25,
        max_reconnect_attempts=8,
        subscribe_lobby_on_connect=True,
    )

    state_task = asyncio.create_task(print_states(client))

    await client.connect()
    await client.send_action({"type": "end_turn"})

    try:
        async for message in client.messages():
            print(message)
    finally:
        await client.close()
        await state_task


if __name__ == "__main__":
    asyncio.run(main())
