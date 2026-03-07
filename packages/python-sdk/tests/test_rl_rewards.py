"""Tests for RL reward config and EpisodeTrainingStats."""
from __future__ import annotations

import unittest

from mage_knight_sdk.sim.rl.rewards import RewardConfig
from mage_knight_sdk.sim.rl.native_rl_runner import EpisodeTrainingStats
from mage_knight_sdk.sim.rl.policy_gradient import OptimizationStats


class RewardConfigTest(unittest.TestCase):
    def test_default_values(self) -> None:
        config = RewardConfig()
        self.assertAlmostEqual(config.fame_delta_scale, 1.0)
        self.assertAlmostEqual(config.step_penalty, 0.0)
        self.assertAlmostEqual(config.terminal_end_bonus, 0.0)
        self.assertAlmostEqual(config.terminal_max_steps_penalty, -0.5)
        self.assertAlmostEqual(config.terminal_failure_penalty, -1.0)

    def test_custom_values(self) -> None:
        config = RewardConfig(
            fame_delta_scale=2.0,
            step_penalty=-0.01,
            terminal_end_bonus=5.0,
        )
        self.assertAlmostEqual(config.fame_delta_scale, 2.0)
        self.assertAlmostEqual(config.step_penalty, -0.01)
        self.assertAlmostEqual(config.terminal_end_bonus, 5.0)


class EpisodeTrainingStatsDefaultsTest(unittest.TestCase):
    def test_defaults(self) -> None:
        stats = EpisodeTrainingStats(
            outcome="ended",
            steps=100,
            total_reward=5.0,
            optimization=OptimizationStats(
                loss=0.1, total_reward=5.0, mean_reward=0.05,
                entropy=0.5, action_count=100,
            ),
        )
        self.assertFalse(stats.scenario_triggered)
        self.assertAlmostEqual(stats.achievement_bonus, 0.0)
