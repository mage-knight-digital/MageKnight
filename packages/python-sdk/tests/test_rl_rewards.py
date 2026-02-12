"""Tests for RL reward config and composable reward components."""
from __future__ import annotations

import unittest

from mage_knight_sdk.sim.hooks import StepSample
from mage_knight_sdk.sim.reporting import RunResult
from mage_knight_sdk.sim.rl.rewards import (
    RewardComponent,
    RewardConfig,
    compute_step_reward,
    compute_terminal_reward,
)


class _FakeStepReward(RewardComponent):
    """Component that returns a fixed step reward."""

    def __init__(self, value: float = 1.0) -> None:
        self.value = value

    def step_reward(self, sample: StepSample) -> float:
        return self.value

    def terminal_reward(self, result: RunResult) -> float:
        return 0.0


class _FakeTerminalReward(RewardComponent):
    """Component that returns a fixed terminal reward."""

    def __init__(self, value: float = 0.5) -> None:
        self.value = value

    def step_reward(self, sample: StepSample) -> float:
        return 0.0

    def terminal_reward(self, result: RunResult) -> float:
        return self.value


class RewardConfigTest(unittest.TestCase):
    def test_default_config_has_no_components(self) -> None:
        config = RewardConfig()
        self.assertEqual(len(config.components), 0)

    def test_step_reward_sums_base_and_components(self) -> None:
        # State with fame 5 -> 10 (delta 5); step_penalty -0.001
        # Base = 1.0 * 5 - 0.001 = 4.999
        state = {"players": [{"id": "p1", "fame": 5}]}
        next_state = {"players": [{"id": "p1", "fame": 10}]}
        sample = StepSample(
            run_index=0,
            seed=1,
            step=0,
            player_id="p1",
            mode="main",
            state=state,
            action={"type": "END_TURN"},
            source="hand",
            next_state=next_state,
            events=[],
            candidate_count=1,
        )
        config = RewardConfig(
            fame_delta_scale=1.0,
            step_penalty=-0.001,
            components=(_FakeStepReward(1.0),),
        )
        reward = compute_step_reward(sample, config)
        self.assertAlmostEqual(reward, 4.999 + 1.0, places=5)

    def test_terminal_reward_sums_base_and_components(self) -> None:
        result = RunResult(
            run_index=0,
            seed=1,
            outcome="ended",
            steps=100,
            game_id="g1",
            reason=None,
            timeout_debug=None,
            failure_artifact_path=None,
        )
        config = RewardConfig(
            terminal_end_bonus=1.0,
            components=(_FakeTerminalReward(0.5),),
        )
        reward = compute_terminal_reward(result, config)
        self.assertAlmostEqual(reward, 1.0 + 0.5, places=5)
