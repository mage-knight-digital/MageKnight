from __future__ import annotations

import asyncio

from mage_knight_sdk import MageKnightClient


async def main() -> None:
    # Replace with values returned by room bootstrap.
    game_id = "g_replace_me"
    player_id = "player-1"

    async with MageKnightClient(
        server_url="ws://127.0.0.1:3001",
        game_id=game_id,
        player_id=player_id,
    ) as client:
        await client.send_action({"type": "END_TURN"})

        async for message in client.messages():
            print(message)


if __name__ == "__main__":
    asyncio.run(main())
