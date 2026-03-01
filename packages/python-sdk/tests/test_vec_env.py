"""Tests for vectorized environment (PyVecEnv) and batched forward pass."""

from __future__ import annotations

import unittest

import numpy as np


class TestPyVecEnv(unittest.TestCase):
    """Tests for the PyVecEnv Rust-backed vectorized environment."""

    def setUp(self) -> None:
        from mk_python import PyVecEnv
        self.PyVecEnv = PyVecEnv

    def test_creation(self) -> None:
        env = self.PyVecEnv(num_envs=4, base_seed=42, hero="arythea", max_steps=100)
        self.assertEqual(env.num_envs(), 4)

    def test_encode_batch_returns_dict(self) -> None:
        env = self.PyVecEnv(num_envs=4, base_seed=42)
        batch = env.encode_batch()
        self.assertIsInstance(batch, dict)

    def test_encode_batch_shapes(self) -> None:
        n = 8
        env = self.PyVecEnv(num_envs=n, base_seed=1)
        batch = env.encode_batch()

        # State scalars: (N, STATE_SCALAR_DIM=84)
        self.assertEqual(batch["state_scalars"].shape, (n, 84))
        self.assertEqual(batch["state_scalars"].dtype, np.float32)

        # State IDs: (N, 3)
        self.assertEqual(batch["state_ids"].shape, (n, 3))
        self.assertEqual(batch["state_ids"].dtype, np.int32)

        # Action counts: (N,)
        self.assertEqual(batch["action_counts"].shape, (n,))
        for c in batch["action_counts"]:
            self.assertGreater(c, 0, "Game start should have legal actions")

        # Hand card IDs: (N, max_H)
        self.assertEqual(batch["hand_card_ids"].shape[0], n)
        self.assertEqual(batch["hand_counts"].shape, (n,))

        # Fames: (N,)
        self.assertEqual(batch["fames"].shape, (n,))

    def test_step_batch_with_zeros(self) -> None:
        """Step all envs with action index 0 (always valid)."""
        n = 4
        env = self.PyVecEnv(num_envs=n, base_seed=42, max_steps=100)
        actions = np.zeros(n, dtype=np.int32)
        result = env.step_batch(actions)

        self.assertIn("fame_deltas", result)
        self.assertIn("dones", result)
        self.assertIn("fames", result)
        self.assertEqual(result["fame_deltas"].shape, (n,))
        self.assertEqual(result["dones"].shape, (n,))
        self.assertEqual(result["fames"].shape, (n,))

    def test_multiple_steps(self) -> None:
        """Run several steps and verify no crashes."""
        n = 4
        env = self.PyVecEnv(num_envs=n, base_seed=42, max_steps=50)

        for _ in range(20):
            batch = env.encode_batch()
            actions = np.zeros(n, dtype=np.int32)
            result = env.step_batch(actions)
            # After step, encode should still work
            batch2 = env.encode_batch()
            self.assertEqual(batch2["state_scalars"].shape[0], n)

    def test_auto_reset_produces_valid_obs(self) -> None:
        """After an env is done, the auto-reset should produce valid observations."""
        n = 2
        env = self.PyVecEnv(num_envs=n, base_seed=42, max_steps=5)

        found_done = False
        for _ in range(50):
            batch = env.encode_batch()
            actions = np.zeros(n, dtype=np.int32)
            result = env.step_batch(actions)
            if any(result["dones"]):
                found_done = True
                # After done + auto-reset, encode should work
                batch2 = env.encode_batch()
                for i in range(n):
                    self.assertGreater(
                        batch2["action_counts"][i], 0,
                        "Reset env should have legal actions",
                    )
                break

        self.assertTrue(found_done, "Expected at least one done within 50 steps with max_steps=5")

    def test_action_ids_shape(self) -> None:
        """Action IDs should be (N*max_M, 6) from Rust, reshaped on Python side."""
        n = 4
        env = self.PyVecEnv(num_envs=n, base_seed=42)
        batch = env.encode_batch()

        max_m = int(batch["action_counts"].max())
        # action_ids comes as (N*max_M, 6)
        self.assertEqual(batch["action_ids"].shape[0], n * max_m)
        self.assertEqual(batch["action_ids"].shape[1], 6)

        # action_scalars: (N*max_M, 34)
        self.assertEqual(batch["action_scalars"].shape[0], n * max_m)
        self.assertEqual(batch["action_scalars"].shape[1], 34)


class TestBatchedForward(unittest.TestCase):
    """Tests for the batched forward pass on _EmbeddingActionScoringNetwork."""

    def setUp(self) -> None:
        from mage_knight_sdk.sim.rl.policy_gradient import (
            PolicyGradientConfig,
            ReinforcePolicy,
        )
        self.config = PolicyGradientConfig(
            hidden_size=64,
            embedding_dim=8,
            device="cpu",
        )
        self.policy = ReinforcePolicy(self.config)

    def test_forward_batch_shapes(self) -> None:
        """forward_batch should produce (N, max_M) logits and (N,) values."""
        from mk_python import PyVecEnv

        n = 4
        env = PyVecEnv(num_envs=n, base_seed=42)
        batch = env.encode_batch()

        import torch
        net = self.policy._network
        with torch.no_grad():
            logits, values = net.forward_batch(batch, torch.device("cpu"))

        self.assertEqual(values.shape, (n,))
        max_m = int(batch["action_counts"].max())
        self.assertEqual(logits.shape, (n, max_m))

        # Invalid positions should be -inf
        for i in range(n):
            ac = int(batch["action_counts"][i])
            if ac < max_m:
                self.assertTrue(
                    logits[i, ac:].eq(float("-inf")).all(),
                    f"Env {i}: positions after action_count should be -inf",
                )

    def test_choose_actions_batch(self) -> None:
        """choose_actions_batch should return valid action indices."""
        from mk_python import PyVecEnv

        n = 8
        env = PyVecEnv(num_envs=n, base_seed=1)
        batch = env.encode_batch()

        actions, log_probs, values = self.policy.choose_actions_batch(batch)

        self.assertEqual(actions.shape, (n,))
        self.assertEqual(log_probs.shape, (n,))
        self.assertEqual(values.shape, (n,))
        self.assertEqual(actions.dtype, np.int32)
        self.assertEqual(log_probs.dtype, np.float32)

        # All actions should be within valid range
        for i in range(n):
            ac = int(batch["action_counts"][i])
            self.assertGreaterEqual(actions[i], 0)
            self.assertLess(actions[i], ac, f"Env {i}: action {actions[i]} >= count {ac}")

    def test_choose_actions_batch_log_probs_finite(self) -> None:
        """Log probs should be finite (no NaN or -inf for selected actions)."""
        from mk_python import PyVecEnv

        n = 16
        env = PyVecEnv(num_envs=n, base_seed=100)
        batch = env.encode_batch()

        actions, log_probs, values = self.policy.choose_actions_batch(batch)

        self.assertTrue(
            np.all(np.isfinite(log_probs)),
            f"Non-finite log_probs: {log_probs}",
        )
        self.assertTrue(
            np.all(np.isfinite(values)),
            f"Non-finite values: {values}",
        )


class TestVecEnvRunner(unittest.TestCase):
    """Tests for the VecEnv collection loop."""

    def test_collect_rollout(self) -> None:
        """Collect a small rollout and verify structure."""
        from mk_python import PyVecEnv
        from mage_knight_sdk.sim.rl.policy_gradient import (
            PolicyGradientConfig,
            ReinforcePolicy,
        )
        from mage_knight_sdk.sim.rl.rewards import RewardConfig
        from mage_knight_sdk.sim.rl.vec_env_runner import collect_vecenv_rollout

        policy = ReinforcePolicy(PolicyGradientConfig(
            hidden_size=32, embedding_dim=8, device="cpu",
        ))
        reward_config = RewardConfig()
        env = PyVecEnv(num_envs=4, base_seed=42, max_steps=50)

        result = collect_vecenv_rollout(env, policy, reward_config, total_steps=200)

        self.assertGreater(result.total_steps, 0)
        self.assertGreaterEqual(result.total_steps, 200)
        # With max_steps=50 and 200 total steps, we should have some episodes
        self.assertGreater(result.total_episodes, 0)

        # Check first episode structure
        ep = result.episodes[0]
        self.assertGreater(len(ep), 0)

        vt = ep[0]
        self.assertEqual(vt.state_scalars.shape, (84,))
        self.assertEqual(vt.state_ids.shape, (3,))
        self.assertGreater(vt.action_ids.shape[0], 0)

    def test_vec_transition_to_transition(self) -> None:
        """VecTransition should convert to Transition for optimize_ppo."""
        from mk_python import PyVecEnv
        from mage_knight_sdk.sim.rl.policy_gradient import (
            PolicyGradientConfig,
            ReinforcePolicy,
        )
        from mage_knight_sdk.sim.rl.rewards import RewardConfig
        from mage_knight_sdk.sim.rl.vec_env_runner import (
            collect_vecenv_rollout,
            vec_transition_to_transition,
        )

        policy = ReinforcePolicy(PolicyGradientConfig(
            hidden_size=32, embedding_dim=8, device="cpu",
        ))
        env = PyVecEnv(num_envs=2, base_seed=42, max_steps=20)

        result = collect_vecenv_rollout(env, policy, RewardConfig(), total_steps=100)
        self.assertGreater(len(result.episodes), 0)

        vt = result.episodes[0][0]
        t = vec_transition_to_transition(vt)

        self.assertEqual(len(t.encoded_step.state.scalars), 84)
        self.assertGreater(len(t.encoded_step.actions), 0)
        self.assertIsInstance(t.reward, float)


if __name__ == "__main__":
    unittest.main()
