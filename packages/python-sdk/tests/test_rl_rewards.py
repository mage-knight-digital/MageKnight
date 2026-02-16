"""Tests for RL reward config and composable reward components."""
from __future__ import annotations

import unittest

from mage_knight_sdk.sim.hooks import StepSample
from mage_knight_sdk.sim.reporting import RunResult
from mage_knight_sdk.sim.rl.rewards import (
    RewardComponent,
    RewardConfig,
    VictoryRewardComponent,
    _extract_achievement_bonus,
    compute_step_reward,
    compute_terminal_reward,
)
from mage_knight_sdk.sim.rl.trainer import EpisodeTrainingStats


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


def _make_sample(events: list, player_id: str = "p1") -> StepSample:
    """Helper to create a StepSample with given events."""
    return StepSample(
        run_index=0,
        seed=1,
        step=0,
        player_id=player_id,
        mode="main",
        state={"players": [{"id": player_id, "fame": 0}]},
        action={"type": "END_TURN"},
        source="hand",
        next_state={"players": [{"id": player_id, "fame": 0}]},
        events=events,
        candidate_count=1,
    )


def _make_result() -> RunResult:
    return RunResult(
        run_index=0,
        seed=1,
        outcome="ended",
        steps=100,
        game_id="g1",
        reason=None,
        timeout_debug=None,
        failure_artifact_path=None,
    )


class VictoryRewardComponentTest(unittest.TestCase):
    def test_scenario_trigger_gives_step_reward(self) -> None:
        comp = VictoryRewardComponent(scenario_trigger_bonus=15.0)
        sample = _make_sample([{"type": "SCENARIO_END_TRIGGERED"}])
        reward = comp.step_reward(sample)
        self.assertAlmostEqual(reward, 15.0)
        self.assertTrue(comp.scenario_triggered)

    def test_no_events_gives_zero(self) -> None:
        comp = VictoryRewardComponent()
        sample = _make_sample([])
        reward = comp.step_reward(sample)
        self.assertAlmostEqual(reward, 0.0)
        self.assertFalse(comp.scenario_triggered)

    def test_game_ended_extracts_achievement_bonus(self) -> None:
        comp = VictoryRewardComponent(achievement_scale=0.5)
        event = {
            "type": "GAME_ENDED",
            "fullScoreResult": {
                "playerResults": {
                    "p1": {"totalScore": 30, "baseScore": 10},
                },
            },
        }
        sample = _make_sample([event])
        comp.step_reward(sample)
        self.assertAlmostEqual(comp.achievement_bonus, 10.0)  # (30 - 10) * 0.5

    def test_terminal_reward_returns_achievement_and_resets(self) -> None:
        comp = VictoryRewardComponent(achievement_scale=0.5)
        event = {
            "type": "GAME_ENDED",
            "fullScoreResult": {
                "playerResults": {
                    "p1": {"totalScore": 30, "baseScore": 10},
                },
            },
        }
        sample = _make_sample([{"type": "SCENARIO_END_TRIGGERED"}, event])
        comp.step_reward(sample)
        self.assertTrue(comp.scenario_triggered)

        result = _make_result()
        terminal = comp.terminal_reward(result)
        self.assertAlmostEqual(terminal, 10.0)  # (30-10)*0.5

        # After terminal_reward, state is reset
        self.assertFalse(comp.scenario_triggered)
        self.assertAlmostEqual(comp.achievement_bonus, 0.0)

    def test_non_dict_events_are_ignored(self) -> None:
        comp = VictoryRewardComponent()
        sample = _make_sample(["string_event", 42, None])
        reward = comp.step_reward(sample)
        self.assertAlmostEqual(reward, 0.0)


class ExtractAchievementBonusTest(unittest.TestCase):
    def test_full_score_result_path(self) -> None:
        event = {
            "type": "GAME_ENDED",
            "fullScoreResult": {
                "playerResults": {
                    "p1": {"totalScore": 50, "baseScore": 20},
                },
            },
        }
        bonus = _extract_achievement_bonus(event, "p1", 0.5)
        self.assertAlmostEqual(bonus, 15.0)  # (50-20)*0.5

    def test_fallback_to_final_scores(self) -> None:
        event = {
            "type": "GAME_ENDED",
            "finalScores": {
                "p1": {"score": 40},
            },
        }
        bonus = _extract_achievement_bonus(event, "p1", 0.5)
        self.assertAlmostEqual(bonus, 20.0)  # 40 * 0.5

    def test_missing_player_returns_zero(self) -> None:
        event = {
            "type": "GAME_ENDED",
            "fullScoreResult": {
                "playerResults": {
                    "p2": {"totalScore": 50, "baseScore": 20},
                },
            },
        }
        bonus = _extract_achievement_bonus(event, "p1", 0.5)
        self.assertAlmostEqual(bonus, 0.0)

    def test_empty_event_returns_zero(self) -> None:
        bonus = _extract_achievement_bonus({"type": "GAME_ENDED"}, "p1", 0.5)
        self.assertAlmostEqual(bonus, 0.0)


class EpisodeTrainingStatsDefaultsTest(unittest.TestCase):
    def test_defaults(self) -> None:
        from mage_knight_sdk.sim.rl.policy_gradient import OptimizationStats
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
