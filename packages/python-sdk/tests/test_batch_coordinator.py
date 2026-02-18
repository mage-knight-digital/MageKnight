"""Tests for BatchInferenceCoordinator."""
from __future__ import annotations

import asyncio
import unittest

import torch

from mage_knight_sdk.sim.generated_action_enumerator import CandidateAction
from mage_knight_sdk.sim.rl.batch_coordinator import BatchInferenceCoordinator
from mage_knight_sdk.sim.rl.features import encode_step
from mage_knight_sdk.sim.rl.policy_gradient import (
    PolicyGradientConfig,
    ReinforcePolicy,
    StepInfo,
)


def _make_state() -> dict:
    return {
        "currentPlayerId": "player-1",
        "round": 2,
        "timeOfDay": "day",
        "endOfRoundAnnounced": False,
        "manaSource": {
            "dice": [
                {"color": "red"},
                {"color": "blue"},
                {"color": "green"},
            ],
        },
        "map": {
            "hexes": {
                "0,0": {
                    "coord": {"q": 0, "r": 0},
                    "terrain": "plains",
                },
                "1,0": {
                    "coord": {"q": 1, "r": 0},
                    "terrain": "forest",
                    "site": {"type": "village", "isConquered": False},
                    "enemies": [
                        {"color": "green", "isRevealed": True, "tokenId": "diggers"},
                    ],
                },
            },
            "tiles": [{"revealed": True}],
        },
        "players": [
            {
                "id": "player-1",
                "fame": 12,
                "level": 2,
                "reputation": 3,
                "armor": 2,
                "position": {"q": 0, "r": 0},
                "hand": [
                    {"id": "march", "name": "March"},
                    {"id": "rage", "name": "Rage"},
                ],
                "deckCount": 10,
                "discardPile": [],
                "units": [],
                "manaTokens": {"red": 1, "blue": 0, "green": 0, "white": 0, "gold": 0, "black": 0},
                "crystals": {"red": 0, "blue": 0, "green": 0, "white": 0},
                "movePoints": 3,
                "influencePoints": 0,
                "healingPoints": 0,
                "hasMovedThisTurn": False,
                "hasTakenActionThisTurn": False,
                "skills": [],
            },
        ],
        "validActions": {
            "mode": "normal_turn",
            "playCard": {
                "cards": [
                    {"cardId": "march", "canPlayBasic": True},
                    {"cardId": "rage", "canPlayBasic": True},
                ],
            },
        },
    }


def _make_candidates() -> list[CandidateAction]:
    return [
        CandidateAction(
            action={"type": "PLAY_CARD", "cardId": "march", "powered": False},
            source="normal.play_card.basic",
        ),
        CandidateAction(
            action={"type": "PLAY_CARD", "cardId": "rage", "powered": False},
            source="normal.play_card.basic",
        ),
        CandidateAction(
            action={"type": "END_TURN"},
            source="normal.turn.end_turn",
        ),
    ]


def _make_policy() -> ReinforcePolicy:
    config = PolicyGradientConfig(
        use_embeddings=True, embedding_dim=8, hidden_size=64, device="cpu",
    )
    return ReinforcePolicy(config)


class BatchInferenceCoordinatorTest(unittest.TestCase):

    def test_single_request(self) -> None:
        """A single request should be processed as batch=1."""
        policy = _make_policy()
        coordinator = BatchInferenceCoordinator(policy)

        async def _run() -> StepInfo:
            task = asyncio.create_task(coordinator.run())
            try:
                step = encode_step(_make_state(), "player-1", _make_candidates())
                return await coordinator.submit(step)
            finally:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

        result = asyncio.run(_run())
        self.assertIsInstance(result, StepInfo)
        self.assertIn(result.action_index, [0, 1, 2])
        self.assertIsInstance(result.log_prob, float)
        self.assertIsInstance(result.value, float)
        self.assertEqual(coordinator.stats["batch_count"], 1)
        self.assertEqual(coordinator.stats["total_requests"], 1)

    def test_multiple_concurrent_requests(self) -> None:
        """Multiple concurrent requests should be batched together."""
        policy = _make_policy()
        coordinator = BatchInferenceCoordinator(policy)
        n_games = 5

        async def _run() -> list[StepInfo]:
            task = asyncio.create_task(coordinator.run())
            try:
                steps = [
                    encode_step(_make_state(), "player-1", _make_candidates())
                    for _ in range(n_games)
                ]
                results = await asyncio.gather(*[
                    coordinator.submit(step) for step in steps
                ])
                return list(results)
            finally:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

        results = asyncio.run(_run())
        self.assertEqual(len(results), n_games)
        for r in results:
            self.assertIsInstance(r, StepInfo)
            self.assertIn(r.action_index, [0, 1, 2])
            self.assertIsInstance(r.log_prob, float)
            self.assertIsInstance(r.value, float)
        # All concurrent requests should be batched in one call
        self.assertEqual(coordinator.stats["batch_count"], 1)
        self.assertEqual(coordinator.stats["total_requests"], n_games)

    def test_sequential_requests_create_separate_batches(self) -> None:
        """Sequential await-then-submit should create separate batches."""
        policy = _make_policy()
        coordinator = BatchInferenceCoordinator(policy)

        async def _run() -> list[StepInfo]:
            task = asyncio.create_task(coordinator.run())
            try:
                results = []
                for _ in range(3):
                    step = encode_step(_make_state(), "player-1", _make_candidates())
                    r = await coordinator.submit(step)
                    results.append(r)
                return results
            finally:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

        results = asyncio.run(_run())
        self.assertEqual(len(results), 3)
        # Each sequential request creates its own batch
        self.assertEqual(coordinator.stats["batch_count"], 3)
        self.assertEqual(coordinator.stats["total_requests"], 3)

    def test_result_matches_direct_forward(self) -> None:
        """Batched inference should produce valid log probs consistent with the network."""
        policy = _make_policy()
        coordinator = BatchInferenceCoordinator(policy)

        state = _make_state()
        candidates = _make_candidates()
        step = encode_step(state, "player-1", candidates)

        async def _run() -> StepInfo:
            task = asyncio.create_task(coordinator.run())
            try:
                return await coordinator.submit(step)
            finally:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

        result = asyncio.run(_run())

        # Verify: log_prob should be negative (log of probability < 1)
        self.assertLess(result.log_prob, 0.0)
        # Value should be finite
        self.assertTrue(abs(result.value) < 1000)
        # Action index should be in range
        self.assertLess(result.action_index, len(candidates))

    def test_coordinator_cleanup_on_cancel(self) -> None:
        """Cancelling the coordinator task should not leave dangling futures."""
        policy = _make_policy()
        coordinator = BatchInferenceCoordinator(policy)

        async def _run() -> None:
            task = asyncio.create_task(coordinator.run())
            # Let it start
            await asyncio.sleep(0)
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        asyncio.run(_run())
        # Should complete without error

    def test_requires_embedding_network(self) -> None:
        """Coordinator should reject non-embedding policies."""
        config = PolicyGradientConfig(
            use_embeddings=False, hidden_size=64, device="cpu",
        )
        policy = ReinforcePolicy(config)
        with self.assertRaises(TypeError):
            BatchInferenceCoordinator(policy)

    def test_encoded_step_preserved_in_result(self) -> None:
        """The StepInfo should contain the original encoded step."""
        policy = _make_policy()
        coordinator = BatchInferenceCoordinator(policy)

        step = encode_step(_make_state(), "player-1", _make_candidates())

        async def _run() -> StepInfo:
            task = asyncio.create_task(coordinator.run())
            try:
                return await coordinator.submit(step)
            finally:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

        result = asyncio.run(_run())
        self.assertIs(result.encoded_step, step)


if __name__ == "__main__":
    unittest.main()
