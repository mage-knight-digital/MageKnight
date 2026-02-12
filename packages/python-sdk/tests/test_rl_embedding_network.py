"""Tests for the embedding-based action scoring network and checkpoint compat."""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import torch

from mage_knight_sdk.sim.generated_action_enumerator import CandidateAction
from mage_knight_sdk.sim.rl.features import encode_step
from mage_knight_sdk.sim.rl.policy_gradient import (
    PolicyGradientConfig,
    ReinforcePolicy,
    _EmbeddingActionScoringNetwork,
)


def _make_state() -> dict:
    return {
        "currentPlayerId": "player-1",
        "round": 1,
        "timeOfDay": "day",
        "map": {
            "hexes": {
                "0,0": {"coord": {"q": 0, "r": 0}, "terrain": "plains"},
                "1,0": {"coord": {"q": 1, "r": 0}, "terrain": "forest",
                         "site": {"type": "village", "isConquered": False}},
            },
            "tiles": [{"revealed": True}],
        },
        "players": [
            {
                "id": "player-1",
                "fame": 12,
                "level": 2,
                "reputation": 3,
                "position": {"q": 0, "r": 0},
                "hand": [
                    {"id": "march", "name": "March"},
                    {"id": "rage", "name": "Rage"},
                    {"id": "wound", "name": "Wound"},
                ],
                "deckCount": 10,
                "discardPile": [],
                "units": [
                    {"id": "peasants", "isExhausted": False},
                ],
                "manaTokens": {"red": 1, "blue": 0, "green": 0, "white": 0},
                "crystals": {"red": 0, "blue": 0, "green": 0, "white": 0},
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


class EmbeddingNetworkForwardTest(unittest.TestCase):
    def test_forward_returns_correct_shape(self) -> None:
        net = _EmbeddingActionScoringNetwork(hidden_size=64, emb_dim=8)
        step = encode_step(_make_state(), "player-1", _make_candidates())
        device = torch.device("cpu")
        logits = net(step, device)
        self.assertEqual(logits.shape, (3,))

    def test_forward_produces_finite_values(self) -> None:
        net = _EmbeddingActionScoringNetwork(hidden_size=64, emb_dim=8)
        step = encode_step(_make_state(), "player-1", _make_candidates())
        device = torch.device("cpu")
        logits = net(step, device)
        self.assertTrue(torch.isfinite(logits).all())

    def test_different_cards_different_logits(self) -> None:
        """Play march vs play rage should produce different scores."""
        net = _EmbeddingActionScoringNetwork(hidden_size=64, emb_dim=8)
        step = encode_step(_make_state(), "player-1", _make_candidates())
        device = torch.device("cpu")
        logits = net(step, device)
        # Not all the same (would be extremely unlikely by chance)
        self.assertFalse(torch.allclose(logits, logits[0].expand_as(logits), atol=1e-6))

    def test_encode_state_returns_correct_shape(self) -> None:
        net = _EmbeddingActionScoringNetwork(hidden_size=64, emb_dim=8)
        step = encode_step(_make_state(), "player-1", _make_candidates())
        device = torch.device("cpu")
        state_repr = net.encode_state(step, device)
        self.assertEqual(state_repr.shape, (64,))

    def test_encode_actions_returns_correct_shape(self) -> None:
        net = _EmbeddingActionScoringNetwork(hidden_size=64, emb_dim=8)
        step = encode_step(_make_state(), "player-1", _make_candidates())
        device = torch.device("cpu")
        action_reprs = net.encode_actions(step, device)
        self.assertEqual(action_reprs.shape, (3, 64))

    def test_empty_hand_doesnt_crash(self) -> None:
        state = _make_state()
        state["players"][0]["hand"] = []
        step = encode_step(state, "player-1", _make_candidates())
        net = _EmbeddingActionScoringNetwork(hidden_size=64, emb_dim=8)
        logits = net(step, torch.device("cpu"))
        self.assertEqual(logits.shape, (3,))

    def test_empty_units_doesnt_crash(self) -> None:
        state = _make_state()
        state["players"][0]["units"] = []
        step = encode_step(state, "player-1", _make_candidates())
        net = _EmbeddingActionScoringNetwork(hidden_size=64, emb_dim=8)
        logits = net(step, torch.device("cpu"))
        self.assertEqual(logits.shape, (3,))


class ReinforcePolicyEmbeddingTest(unittest.TestCase):
    def test_choose_action_with_embeddings(self) -> None:
        config = PolicyGradientConfig(
            use_embeddings=True, embedding_dim=8, hidden_size=64, device="cpu",
        )
        policy = ReinforcePolicy(config)
        import random
        rng = random.Random(42)
        result = policy.choose_action(
            _make_state(), "player-1", _make_candidates(), rng,
        )
        self.assertIsNotNone(result)
        self.assertIsInstance(result, CandidateAction)

    def test_choose_action_legacy_fallback(self) -> None:
        config = PolicyGradientConfig(
            use_embeddings=False, hidden_size=64, device="cpu",
        )
        policy = ReinforcePolicy(config)
        import random
        rng = random.Random(42)
        result = policy.choose_action(
            _make_state(), "player-1", _make_candidates(), rng,
        )
        self.assertIsNotNone(result)
        self.assertIsInstance(result, CandidateAction)

    def test_choose_action_empty_actions(self) -> None:
        config = PolicyGradientConfig(
            use_embeddings=True, embedding_dim=8, device="cpu",
        )
        policy = ReinforcePolicy(config)
        import random
        result = policy.choose_action(
            _make_state(), "player-1", [], random.Random(42),
        )
        self.assertIsNone(result)


class CheckpointRoundTripTest(unittest.TestCase):
    def test_embedding_checkpoint_save_load(self) -> None:
        config = PolicyGradientConfig(
            use_embeddings=True, embedding_dim=8, hidden_size=64, device="cpu",
        )
        policy = ReinforcePolicy(config)
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.pt"
            policy.save_checkpoint(path, metadata={"episode": 5})
            loaded_policy, meta = ReinforcePolicy.load_checkpoint(path, device_override="cpu")
            self.assertEqual(meta["episode"], 5)
            self.assertTrue(loaded_policy.config.use_embeddings)
            self.assertEqual(loaded_policy.config.embedding_dim, 8)

    def test_legacy_checkpoint_save_load(self) -> None:
        config = PolicyGradientConfig(
            use_embeddings=False, hidden_size=64, device="cpu",
        )
        policy = ReinforcePolicy(config)
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.pt"
            policy.save_checkpoint(path, metadata={"episode": 3})
            loaded_policy, meta = ReinforcePolicy.load_checkpoint(path, device_override="cpu")
            self.assertEqual(meta["episode"], 3)
            self.assertFalse(loaded_policy.config.use_embeddings)

    def test_loaded_policy_can_choose_action(self) -> None:
        config = PolicyGradientConfig(
            use_embeddings=True, embedding_dim=8, hidden_size=64, device="cpu",
        )
        policy = ReinforcePolicy(config)
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.pt"
            policy.save_checkpoint(path)
            loaded_policy, _ = ReinforcePolicy.load_checkpoint(path, device_override="cpu")
            import random
            result = loaded_policy.choose_action(
                _make_state(), "player-1", _make_candidates(), random.Random(42),
            )
            self.assertIsNotNone(result)


class OptimizeEpisodeTest(unittest.TestCase):
    def test_optimize_with_embeddings(self) -> None:
        config = PolicyGradientConfig(
            use_embeddings=True, embedding_dim=8, hidden_size=64, device="cpu",
        )
        policy = ReinforcePolicy(config)
        import random
        rng = random.Random(42)

        # Simulate a short episode
        for _ in range(3):
            policy.choose_action(_make_state(), "player-1", _make_candidates(), rng)
            policy.record_step_reward(0.5)
        policy.add_terminal_reward(1.0)

        stats = policy.optimize_episode()
        self.assertEqual(stats.action_count, 3)
        self.assertIsInstance(stats.loss, float)
        self.assertIsInstance(stats.entropy, float)


if __name__ == "__main__":
    unittest.main()
