"""Tests for the embedding-based action scoring network and checkpoint compat."""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import torch

from mage_knight_sdk.sim.generated_action_enumerator import CandidateAction
from mage_knight_sdk.sim.rl.features import (
    COMBAT_ENEMY_SCALAR_DIM,
    MAP_ENEMY_SCALAR_DIM,
    SITE_SCALAR_DIM,
    STATE_SCALAR_DIM,
    encode_step,
)
from mage_knight_sdk.sim.rl.policy_gradient import (
    PolicyGradientConfig,
    ReinforcePolicy,
    _EmbeddingActionScoringNetwork,
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
                "0,-1": {
                    "coord": {"q": 0, "r": -1},
                    "terrain": "hills",
                },
                "0,1": {
                    "coord": {"q": 0, "r": 1},
                    "terrain": "mountain",
                    "site": {"type": "dungeon", "isConquered": True},
                },
                "-1,0": {
                    "coord": {"q": -1, "r": 0},
                    "terrain": "swamp",
                    "rampagingEnemies": ["wolf_riders"],
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
                    {"id": "wound", "name": "Wound"},
                ],
                "deckCount": 10,
                "discardPile": [],
                "units": [
                    {"id": "peasants", "isExhausted": False},
                ],
                "manaTokens": {"red": 1, "blue": 0, "green": 0, "white": 0, "gold": 0, "black": 0},
                "crystals": {"red": 0, "blue": 1, "green": 0, "white": 0},
                "movePoints": 3,
                "influencePoints": 0,
                "healingPoints": 0,
                "hasMovedThisTurn": True,
                "hasTakenActionThisTurn": False,
                "skills": [
                    {"id": "arythea_dark_paths"},
                    {"id": "arythea_burning_power"},
                ],
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
        logits, value = net(step, device)
        self.assertEqual(logits.shape, (3,))

    def test_forward_produces_finite_values(self) -> None:
        net = _EmbeddingActionScoringNetwork(hidden_size=64, emb_dim=8)
        step = encode_step(_make_state(), "player-1", _make_candidates())
        device = torch.device("cpu")
        logits, value = net(step, device)
        self.assertTrue(torch.isfinite(logits).all())

    def test_value_head_returns_scalar(self) -> None:
        net = _EmbeddingActionScoringNetwork(hidden_size=64, emb_dim=8)
        step = encode_step(_make_state(), "player-1", _make_candidates())
        device = torch.device("cpu")
        logits, value = net(step, device)
        self.assertEqual(value.shape, ())
        self.assertTrue(torch.isfinite(value))

    def test_different_cards_different_logits(self) -> None:
        """Play march vs play rage should produce different scores."""
        net = _EmbeddingActionScoringNetwork(hidden_size=64, emb_dim=8)
        step = encode_step(_make_state(), "player-1", _make_candidates())
        device = torch.device("cpu")
        logits, _ = net(step, device)
        self.assertFalse(torch.allclose(logits, logits[0].expand_as(logits), atol=1e-6))

    def test_encode_state_returns_correct_shape(self) -> None:
        net = _EmbeddingActionScoringNetwork(hidden_size=64, emb_dim=8)
        step = encode_step(_make_state(), "player-1", _make_candidates())
        device = torch.device("cpu")
        state_repr = net.encode_state(step, device)
        self.assertEqual(state_repr.shape, (64,))

    def test_state_input_dim(self) -> None:
        """Verify the network's actual state input dimension matches formula."""
        emb_dim = 8
        expected_dim = (
            STATE_SCALAR_DIM
            + 6 * emb_dim
            + (emb_dim + COMBAT_ENEMY_SCALAR_DIM)
            + (emb_dim + SITE_SCALAR_DIM)
            + (emb_dim + MAP_ENEMY_SCALAR_DIM)
        )
        net = _EmbeddingActionScoringNetwork(hidden_size=64, emb_dim=emb_dim)
        self.assertEqual(net.state_encoder[0].in_features, expected_dim)

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
        logits, value = net(step, torch.device("cpu"))
        self.assertEqual(logits.shape, (3,))

    def test_empty_units_doesnt_crash(self) -> None:
        state = _make_state()
        state["players"][0]["units"] = []
        step = encode_step(state, "player-1", _make_candidates())
        net = _EmbeddingActionScoringNetwork(hidden_size=64, emb_dim=8)
        logits, value = net(step, torch.device("cpu"))
        self.assertEqual(logits.shape, (3,))

    def test_empty_map_doesnt_crash(self) -> None:
        """No sites, no enemies → zero vector pools should work."""
        state = _make_state()
        state["map"]["hexes"] = {
            "0,0": {"coord": {"q": 0, "r": 0}, "terrain": "plains"},
        }
        step = encode_step(state, "player-1", _make_candidates())
        net = _EmbeddingActionScoringNetwork(hidden_size=64, emb_dim=8)
        logits, value = net(step, torch.device("cpu"))
        self.assertEqual(logits.shape, (3,))
        self.assertTrue(torch.isfinite(logits).all())

    def test_combat_state_doesnt_crash(self) -> None:
        """Combat with enemies should encode without errors."""
        state = _make_state()
        state["combat"] = {
            "phase": "ranged_siege",
            "isFortified": True,
            "enemies": [
                {"id": "diggers", "armor": 3, "attack": 2},
                {"id": "prowlers", "armor": 2, "attack": 3},
            ],
        }
        step = encode_step(state, "player-1", _make_candidates())
        net = _EmbeddingActionScoringNetwork(hidden_size=64, emb_dim=8)
        logits, value = net(step, torch.device("cpu"))
        self.assertEqual(logits.shape, (3,))
        self.assertTrue(torch.isfinite(logits).all())

    def test_empty_skills_doesnt_crash(self) -> None:
        state = _make_state()
        state["players"][0]["skills"] = []
        step = encode_step(state, "player-1", _make_candidates())
        net = _EmbeddingActionScoringNetwork(hidden_size=64, emb_dim=8)
        logits, value = net(step, torch.device("cpu"))
        self.assertEqual(logits.shape, (3,))

    def test_visible_site_pool_affects_state(self) -> None:
        """Adding more sites to the map should change state encoding."""
        net = _EmbeddingActionScoringNetwork(hidden_size=64, emb_dim=8)
        device = torch.device("cpu")

        state1 = _make_state()
        step1 = encode_step(state1, "player-1", _make_candidates())
        repr1 = net.encode_state(step1, device)

        # Add extra site to map
        state2 = _make_state()
        state2["map"]["hexes"]["3,0"] = {
            "coord": {"q": 3, "r": 0},
            "terrain": "plains",
            "site": {"type": "keep", "isConquered": False},
        }
        step2 = encode_step(state2, "player-1", _make_candidates())
        repr2 = net.encode_state(step2, device)

        self.assertFalse(torch.allclose(repr1, repr2, atol=1e-6))

    def test_map_enemy_pool_affects_state(self) -> None:
        """Adding map enemies should change state encoding."""
        net = _EmbeddingActionScoringNetwork(hidden_size=64, emb_dim=8)
        device = torch.device("cpu")

        # State with no rampaging enemies
        state1 = _make_state()
        del state1["map"]["hexes"]["-1,0"]["rampagingEnemies"]
        step1 = encode_step(state1, "player-1", _make_candidates())
        repr1 = net.encode_state(step1, device)

        # State with rampaging enemy added
        state2 = _make_state()
        step2 = encode_step(state2, "player-1", _make_candidates())
        repr2 = net.encode_state(step2, device)

        self.assertFalse(torch.allclose(repr1, repr2, atol=1e-6))

    def test_encode_state_batch_matches_individual(self) -> None:
        """Batch state encoding must produce same results as individual calls."""
        net = _EmbeddingActionScoringNetwork(hidden_size=64, emb_dim=8)
        net.eval()
        device = torch.device("cpu")

        # Create multiple distinct states
        state1 = _make_state()
        state2 = _make_state()
        state2["players"][0]["fame"] = 99
        state2["players"][0]["hand"] = []

        step1 = encode_step(state1, "player-1", _make_candidates())
        step2 = encode_step(state2, "player-1", _make_candidates())

        with torch.no_grad():
            individual_1 = net.encode_state(step1, device)
            individual_2 = net.encode_state(step2, device)
            batched = net.encode_state_batch([step1, step2], device)

        self.assertEqual(batched.shape, (2, 64))
        self.assertTrue(torch.allclose(individual_1, batched[0], atol=1e-6))
        self.assertTrue(torch.allclose(individual_2, batched[1], atol=1e-6))

    def test_encode_state_batch_single_item(self) -> None:
        """Batch with a single item should match individual encode."""
        net = _EmbeddingActionScoringNetwork(hidden_size=64, emb_dim=8)
        net.eval()
        device = torch.device("cpu")
        step = encode_step(_make_state(), "player-1", _make_candidates())

        with torch.no_grad():
            individual = net.encode_state(step, device)
            batched = net.encode_state_batch([step], device)

        self.assertEqual(batched.shape, (1, 64))
        self.assertTrue(torch.allclose(individual, batched[0], atol=1e-6))

    def test_multi_layer_forward(self) -> None:
        """2-layer encoder should produce correct output shapes and finite values."""
        net = _EmbeddingActionScoringNetwork(hidden_size=64, emb_dim=8, num_hidden_layers=2)
        step = encode_step(_make_state(), "player-1", _make_candidates())
        device = torch.device("cpu")
        logits, value = net(step, device)
        self.assertEqual(logits.shape, (3,))
        self.assertTrue(torch.isfinite(logits).all())
        self.assertEqual(value.shape, ())
        self.assertTrue(torch.isfinite(value))

    def test_multi_layer_state_input_dim(self) -> None:
        """state_encoder[0].in_features should be unchanged by depth."""
        emb_dim = 8
        hidden = 64
        expected_dim = (
            STATE_SCALAR_DIM
            + 6 * emb_dim
            + (emb_dim + COMBAT_ENEMY_SCALAR_DIM)
            + (emb_dim + SITE_SCALAR_DIM)
            + (emb_dim + MAP_ENEMY_SCALAR_DIM)
        )
        net1 = _EmbeddingActionScoringNetwork(hidden_size=hidden, emb_dim=emb_dim, num_hidden_layers=1)
        net3 = _EmbeddingActionScoringNetwork(hidden_size=hidden, emb_dim=emb_dim, num_hidden_layers=3)
        # First layer input dim unchanged
        self.assertEqual(net1.state_encoder[0].in_features, expected_dim)
        self.assertEqual(net3.state_encoder[0].in_features, expected_dim)
        # Intermediate layers are hidden→hidden (layer indices: 0=Linear, 1=Tanh, 2=Linear, 3=Tanh, ...)
        self.assertEqual(net3.state_encoder[2].in_features, hidden)
        self.assertEqual(net3.state_encoder[2].out_features, hidden)
        # Action encoder also scales with depth
        self.assertEqual(net3.action_encoder[2].in_features, hidden)
        self.assertEqual(net3.action_encoder[2].out_features, hidden)


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

    def test_num_hidden_layers_checkpoint_round_trip(self) -> None:
        config = PolicyGradientConfig(
            use_embeddings=True, embedding_dim=8, hidden_size=64, device="cpu",
            num_hidden_layers=3,
        )
        policy = ReinforcePolicy(config)
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.pt"
            policy.save_checkpoint(path, metadata={"episode": 1})
            loaded_policy, _ = ReinforcePolicy.load_checkpoint(path, device_override="cpu")
            self.assertEqual(loaded_policy.config.num_hidden_layers, 3)
            # Verify the loaded network actually has 3 layers (6 modules: 3 Linear + 3 Tanh)
            self.assertEqual(len(loaded_policy._network.state_encoder), 6)

    def test_old_checkpoint_defaults_num_hidden_layers(self) -> None:
        """Simulate loading a checkpoint saved before num_hidden_layers existed."""
        config = PolicyGradientConfig(
            use_embeddings=True, embedding_dim=8, hidden_size=64, device="cpu",
        )
        policy = ReinforcePolicy(config)
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.pt"
            policy.save_checkpoint(path)
            # Manually remove num_hidden_layers from saved config to simulate old checkpoint
            payload = torch.load(path, map_location="cpu", weights_only=True)
            del payload["config"]["num_hidden_layers"]
            torch.save(payload, path)
            loaded_policy, _ = ReinforcePolicy.load_checkpoint(path, device_override="cpu")
            self.assertEqual(loaded_policy.config.num_hidden_layers, 1)

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


class BatchedActionEncodingTest(unittest.TestCase):
    """Test that batched action encoding in optimize_ppo matches individual calls."""

    def test_batched_scoring_matches_individual(self) -> None:
        """Padded batched scoring must produce same logits as individual forward."""
        from mage_knight_sdk.sim.rl.features import ACTION_SCALAR_DIM

        net = _EmbeddingActionScoringNetwork(hidden_size=64, emb_dim=8)
        net.eval()
        device = torch.device("cpu")

        # Create two distinct steps with different action counts
        state = _make_state()
        step1 = encode_step(state, "player-1", _make_candidates())  # 3 actions
        step2 = encode_step(state, "player-1", _make_candidates()[:2])  # 2 actions

        with torch.no_grad():
            # Individual forward passes
            logits1, _ = net(step1, device)
            logits2, _ = net(step2, device)

            # Batched approach (matching optimize_ppo logic)
            state_reprs = net.encode_state_batch([step1, step2], device)  # (2, 64)
            action_counts = [len(step1.actions), len(step2.actions)]
            max_A = max(action_counts)
            bs = 2
            flat_size = bs * max_A

            padded_ids = torch.zeros(flat_size, 6, dtype=torch.long)
            padded_scalars = torch.zeros(flat_size, ACTION_SCALAR_DIM)
            padded_targets = torch.zeros(flat_size, net.emb_dim)

            for i, step in enumerate([step1, step2]):
                n_a = len(step.actions)
                offset = i * max_A
                ids = torch.tensor(
                    [[a.action_type_id, a.source_id, a.card_id,
                      a.unit_id, a.enemy_id, a.skill_id] for a in step.actions],
                    dtype=torch.long,
                )
                scalars = torch.tensor([a.scalars for a in step.actions])
                padded_ids[offset:offset + n_a] = ids
                padded_scalars[offset:offset + n_a] = scalars

            flat_action_input = torch.cat([
                net.action_type_emb(padded_ids[:, 0]),
                net.source_emb(padded_ids[:, 1]),
                net.card_emb(padded_ids[:, 2]),
                net.unit_emb(padded_ids[:, 3]),
                net.enemy_emb(padded_ids[:, 4]),
                net.skill_emb(padded_ids[:, 5]),
                padded_targets,
                padded_scalars,
            ], dim=-1)
            flat_action_reprs = net.action_encoder(flat_action_input)
            action_reprs = flat_action_reprs.view(bs, max_A, -1)

            state_expanded = state_reprs.unsqueeze(1).expand(-1, max_A, -1)
            combined = torch.cat([state_expanded, action_reprs], dim=-1)
            logits_batched = net.scoring_head(
                combined.view(-1, combined.size(-1)),
            ).squeeze(-1).view(bs, max_A)

        # Compare: first 3 logits for step1, first 2 for step2
        self.assertTrue(torch.allclose(logits1, logits_batched[0, :3], atol=1e-5))
        self.assertTrue(torch.allclose(logits2, logits_batched[1, :2], atol=1e-5))

    def test_optimize_ppo_batched(self) -> None:
        """optimize_ppo with batched encoding runs without error."""
        from mage_knight_sdk.sim.rl.policy_gradient import Transition

        config = PolicyGradientConfig(
            use_embeddings=True, embedding_dim=8, hidden_size=64, device="cpu",
        )
        policy = ReinforcePolicy(config)
        import random
        rng = random.Random(42)

        # Simulate a short episode and collect transitions
        transitions = []
        for step_i in range(5):
            candidate = policy.choose_action(
                _make_state(), "player-1", _make_candidates(), rng,
            )
            policy.record_step_reward(0.1 * step_i)
            info = policy.last_step_info
            if info is not None:
                transitions.append(Transition(
                    encoded_step=info.encoded_step,
                    action_index=info.action_index,
                    log_prob=info.log_prob,
                    value=info.value,
                    reward=0.1 * step_i,
                ))

        advantages = [0.5] * len(transitions)
        returns = [1.0] * len(transitions)

        stats = policy.optimize_ppo(
            transitions, advantages, returns,
            ppo_epochs=2, mini_batch_size=3,
        )
        self.assertEqual(stats.action_count, len(transitions))
        self.assertIsInstance(stats.loss, float)
        self.assertTrue(abs(stats.loss) < 1000)  # sanity
        self.assertGreater(stats.entropy, 0.0)
        self.assertGreater(stats.critic_loss, 0.0)


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

    def test_actor_critic_produces_critic_loss(self) -> None:
        """With embeddings, optimizer should report non-zero critic loss."""
        config = PolicyGradientConfig(
            use_embeddings=True, embedding_dim=8, hidden_size=64, device="cpu",
            critic_coefficient=0.5,
        )
        policy = ReinforcePolicy(config)
        import random
        rng = random.Random(42)

        for _ in range(5):
            policy.choose_action(_make_state(), "player-1", _make_candidates(), rng)
            policy.record_step_reward(0.1)
        policy.add_terminal_reward(1.0)

        stats = policy.optimize_episode()
        self.assertGreater(stats.critic_loss, 0.0)
        self.assertEqual(stats.action_count, 5)

    def test_legacy_no_critic_loss(self) -> None:
        """Legacy (no embeddings) path should report zero critic loss."""
        config = PolicyGradientConfig(
            use_embeddings=False, hidden_size=64, device="cpu",
        )
        policy = ReinforcePolicy(config)
        import random
        rng = random.Random(42)

        for _ in range(3):
            policy.choose_action(_make_state(), "player-1", _make_candidates(), rng)
            policy.record_step_reward(0.5)
        policy.add_terminal_reward(1.0)

        stats = policy.optimize_episode()
        self.assertEqual(stats.critic_loss, 0.0)

    def test_value_head_gradients_flow(self) -> None:
        """Value head parameters should receive gradients during Actor-Critic training."""
        config = PolicyGradientConfig(
            use_embeddings=True, embedding_dim=8, hidden_size=64, device="cpu",
            critic_coefficient=0.5,
        )
        policy = ReinforcePolicy(config)
        import random
        rng = random.Random(42)

        for _ in range(3):
            policy.choose_action(_make_state(), "player-1", _make_candidates(), rng)
            policy.record_step_reward(0.5)
        policy.add_terminal_reward(1.0)

        # Get value head weights before optimization
        vh_weight_before = policy._network.value_head.weight.data.clone()
        policy.optimize_episode()
        vh_weight_after = policy._network.value_head.weight.data

        # Weights should have changed
        self.assertFalse(torch.allclose(vh_weight_before, vh_weight_after))


if __name__ == "__main__":
    unittest.main()
