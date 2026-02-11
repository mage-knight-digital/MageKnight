from __future__ import annotations

import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
SDK_SRC = REPO_ROOT / "packages/python-sdk/src"
if str(SDK_SRC) not in sys.path:
    sys.path.insert(0, str(SDK_SRC))

from mage_knight_sdk.sim.runner import _StallDetector, _action_key


def _state(round_number: int = 1) -> dict[str, object]:
    return {
        "round": round_number,
        "roundPhase": "player_turns",
        "timeOfDay": "day",
        "currentPlayerId": "player-1",
        "validActions": {"mode": "normal_turn"},
        "combat": None,
        "players": [
            {"id": "player-1", "level": 1, "fame": 0, "reputation": 0, "deckCount": 16},
            {"id": "player-2", "level": 1, "fame": 0, "reputation": 0, "deckCount": 16},
        ],
        "map": {
            "tiles": [{"revealed": True}],
            "hexes": {
                "0,0": {
                    "site": {"isConquered": False},
                    "enemies": [],
                    "rampagingEnemies": ["orc_marauder"],
                }
            },
        },
    }


class StallDetectorTest(unittest.TestCase):
    def test_no_stall_when_draw_pile_changes(self) -> None:
        detector = _StallDetector.create(
            no_draw_pile_change_turns=20,
        )
        action_key = _action_key({"type": "END_TURN"})

        stalled = None
        for step in range(40):
            state = _state(round_number=1 if step < 20 else 2)
            if step >= 15:
                players = state["players"]
                assert isinstance(players, list)
                player = players[0]
                assert isinstance(player, dict)
                player["deckCount"] = 15 if step % 2 == 0 else 16
            stalled = detector.observe(
                step=step,
                player_id="player-1",
                action_key=action_key,
                action_type="END_TURN",
                state=state,
            )

        self.assertIsNone(stalled)

    def test_stall_detected_when_both_players_draw_pile_unchanged(self) -> None:
        detector = _StallDetector.create(
            no_draw_pile_change_turns=20,
        )
        action_key = _action_key({"type": "END_TURN"})
        state = _state()

        stalled = None
        for step in range(50):
            player_id = "player-1" if step % 2 == 0 else "player-2"
            stalled = detector.observe(
                step=step,
                player_id=player_id,
                action_key=action_key,
                action_type="END_TURN",
                state=state,
            )
            if stalled is not None:
                break

        self.assertIsNotNone(stalled)
        assert stalled is not None
        self.assertIn(
            "Stalled loop detected",
            stalled["reason"],
        )
        self.assertIn("both players", stalled["reason"])
        by_player = stalled["details"]["stagnantTurnsByPlayer"]
        self.assertGreaterEqual(by_player.get("player-1", 0), 20)
        self.assertGreaterEqual(by_player.get("player-2", 0), 20)
        self.assertEqual(action_key, stalled["details"]["lastActionKey"])

    def test_no_stall_when_only_one_player_stalled(self) -> None:
        detector = _StallDetector.create(
            no_draw_pile_change_turns=20,
        )
        action_key = _action_key({"type": "END_TURN"})
        state = _state()

        for step in range(25):
            stalled = detector.observe(
                step=step,
                player_id="player-1",
                action_key=action_key,
                action_type="END_TURN",
                state=state,
            )
            self.assertIsNone(stalled, "Only player-1 stalled; should not terminate")

    def test_stall_counters_are_per_player(self) -> None:
        detector = _StallDetector.create(
            no_draw_pile_change_turns=20,
        )
        state = _state()
        end_turn_key = _action_key({"type": "END_TURN"})

        stalled = None
        for step in range(19):
            stalled = detector.observe(
                step=step,
                player_id="player-1",
                action_key=end_turn_key,
                action_type="END_TURN",
                state=state,
            )
        self.assertIsNone(stalled)

        players = state["players"]
        assert isinstance(players, list)
        player1 = players[0]
        assert isinstance(player1, dict)
        player1["deckCount"] = 15
        stalled = detector.observe(
            step=19,
            player_id="player-1",
            action_key=end_turn_key,
            action_type="END_TURN",
            state=state,
        )
        self.assertIsNone(stalled)

        for step in range(20, 39):
            stalled = detector.observe(
                step=step,
                player_id="player-2",
                action_key=end_turn_key,
                action_type="END_TURN",
                state=state,
            )
            if stalled is not None:
                break

        self.assertIsNone(stalled)


if __name__ == "__main__":
    unittest.main()
