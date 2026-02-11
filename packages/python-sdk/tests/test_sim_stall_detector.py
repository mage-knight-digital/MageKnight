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
            {"id": "player-1", "level": 1, "fame": 0, "reputation": 0},
            {"id": "player-2", "level": 1, "fame": 0, "reputation": 0},
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
    def test_no_stall_when_progress_signature_changes(self) -> None:
        detector = _StallDetector.create(
            window_size=64,
            no_progress_steps=20,
        )
        action_key = _action_key({"type": "END_TURN"})

        stalled = None
        for step in range(40):
            state = _state(round_number=1 if step < 20 else 2)
            stalled = detector.observe(step=step, action_key=action_key, state=state)

        self.assertIsNone(stalled)

    def test_stall_detected_for_repeated_actions_without_progress(self) -> None:
        detector = _StallDetector.create(
            window_size=32,
            no_progress_steps=200,
        )
        action_key = _action_key({"type": "CHALLENGE_RAMPAGING", "targetHex": {"q": 1, "r": -2}})
        state = _state()

        stalled = None
        for step in range(260):
            stalled = detector.observe(step=step, action_key=action_key, state=state)
            if stalled is not None:
                break

        self.assertIsNotNone(stalled)
        assert stalled is not None
        self.assertEqual(
            "Stalled loop detected (low macro progress + repeated actions)",
            stalled["reason"],
        )
        self.assertGreaterEqual(stalled["details"]["stagnantSteps"], 200)


if __name__ == "__main__":
    unittest.main()
