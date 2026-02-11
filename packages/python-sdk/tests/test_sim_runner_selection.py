from __future__ import annotations

import random
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
SDK_SRC = REPO_ROOT / "packages/python-sdk/src"
if str(SDK_SRC) not in sys.path:
    sys.path.insert(0, str(SDK_SRC))

from mage_knight_sdk.sim.generated_action_enumerator import CandidateAction
from mage_knight_sdk.sim.reporting import ActionTraceEntry
from mage_knight_sdk.sim.runner import _choose_candidate_with_repeat_avoidance


class RunnerSelectionTest(unittest.TestCase):
    def test_returns_only_candidate_when_single_option(self) -> None:
        only = CandidateAction(action={"type": "END_TURN"}, source="turn.end_turn")
        chosen = _choose_candidate_with_repeat_avoidance(
            rng=random.Random(1),
            candidates=[only],
            trace=[],
            player_id="player-1",
            mode="normal_turn",
        )
        self.assertEqual(only, chosen)

    def test_avoids_repeated_challenge_target_when_alternatives_exist(self) -> None:
        repeat = CandidateAction(
            action={"type": "CHALLENGE_RAMPAGING", "targetHex": {"q": 1, "r": -2}},
            source="normal.challenge",
        )
        alternate = CandidateAction(action={"type": "END_TURN"}, source="turn.end_turn")

        trace = [
            ActionTraceEntry(
                step=i,
                player_id="player-1",
                action={"type": "CHALLENGE_RAMPAGING", "targetHex": {"q": 1, "r": -2}},
                source="normal.challenge",
                mode="normal_turn",
                current_player_id="player-1",
            )
            for i in range(30)
        ]

        chosen = _choose_candidate_with_repeat_avoidance(
            rng=random.Random(7),
            candidates=[repeat, alternate],
            trace=trace,
            player_id="player-1",
            mode="normal_turn",
        )
        self.assertEqual(alternate, chosen)

    def test_ignores_other_players_history(self) -> None:
        repeat = CandidateAction(action={"type": "DECLARE_REST"}, source="normal.turn.declare_rest")
        alternate = CandidateAction(action={"type": "END_TURN"}, source="turn.end_turn")

        trace = [
            ActionTraceEntry(
                step=i,
                player_id="player-2",
                action={"type": "DECLARE_REST"},
                source="normal.turn.declare_rest",
                mode="normal_turn",
                current_player_id="player-2",
            )
            for i in range(20)
        ]

        rng = random.Random(11)
        selections = {"repeat": 0, "alternate": 0}
        for _ in range(200):
            chosen = _choose_candidate_with_repeat_avoidance(
                rng=rng,
                candidates=[repeat, alternate],
                trace=trace,
                player_id="player-1",
                mode="normal_turn",
            )
            if chosen == repeat:
                selections["repeat"] += 1
            else:
                selections["alternate"] += 1

        # With no same-player history, this should still include challenges.
        self.assertGreater(selections["repeat"], 60)
        self.assertGreater(selections["alternate"], 60)


if __name__ == "__main__":
    unittest.main()
