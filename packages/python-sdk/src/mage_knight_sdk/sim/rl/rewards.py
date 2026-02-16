from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol, runtime_checkable

from ..hooks import StepSample
from ..reporting import OUTCOME_ENDED, OUTCOME_MAX_STEPS, RunResult


@runtime_checkable
class RewardComponent(Protocol):
    """Optional extra reward terms (e.g. sparse rewards for conquest, level-up)."""

    def step_reward(self, sample: StepSample) -> float:
        """Reward for this step; 0.0 if this component does not apply."""
        ...

    def terminal_reward(self, result: RunResult) -> float:
        """Extra terminal reward; 0.0 if this component does not apply."""
        ...


@dataclass(frozen=True)
class RewardConfig:
    fame_delta_scale: float = 1.0
    step_penalty: float = -0.001
    terminal_end_bonus: float = 1.0
    terminal_max_steps_penalty: float = -0.5
    terminal_failure_penalty: float = -1.0
    """Optional extra reward components (sparse rewards, etc.). Summed on top of base rewards."""
    components: tuple[RewardComponent, ...] = ()


def compute_step_reward(sample: StepSample, config: RewardConfig) -> float:
    """Dense reward from fame delta + step penalty, plus any component step rewards."""
    before = _player_fame(sample.state, sample.player_id)
    after = _player_fame(sample.next_state or sample.state, sample.player_id)
    fame_delta = float(after - before)
    base = config.fame_delta_scale * fame_delta + config.step_penalty
    for comp in config.components:
        base += comp.step_reward(sample)
    return base


def compute_terminal_reward(result: RunResult, config: RewardConfig) -> float:
    if result.outcome == OUTCOME_ENDED:
        base = config.terminal_end_bonus
    elif result.outcome == OUTCOME_MAX_STEPS:
        base = config.terminal_max_steps_penalty
    else:
        base = config.terminal_failure_penalty
    for comp in config.components:
        base += comp.terminal_reward(result)
    return base


class VictoryRewardComponent:
    """Rewards for scenario objective completion and end-game achievements."""

    def __init__(
        self,
        scenario_trigger_bonus: float = 15.0,
        achievement_scale: float = 0.5,
    ) -> None:
        self.scenario_trigger_bonus = scenario_trigger_bonus
        self.achievement_scale = achievement_scale
        self._scenario_triggered = False
        self._achievement_bonus = 0.0

    def step_reward(self, sample: StepSample) -> float:
        reward = 0.0
        for event in sample.events:
            if not isinstance(event, dict):
                continue
            etype = event.get("type")
            if etype == "SCENARIO_END_TRIGGERED":
                self._scenario_triggered = True
                reward += self.scenario_trigger_bonus
            elif etype == "GAME_ENDED":
                self._achievement_bonus = _extract_achievement_bonus(
                    event, sample.player_id, self.achievement_scale,
                )
        return reward

    def terminal_reward(self, result: RunResult) -> float:
        bonus = self._achievement_bonus
        self._scenario_triggered = False
        self._achievement_bonus = 0.0
        return bonus

    @property
    def scenario_triggered(self) -> bool:
        return self._scenario_triggered

    @property
    def achievement_bonus(self) -> float:
        return self._achievement_bonus


def _extract_achievement_bonus(
    event: dict[str, Any], player_id: str, scale: float,
) -> float:
    """Extract achievement-only score from a GAME_ENDED event.

    Uses fullScoreResult.playerResults if available, falling back to
    finalScores minus fame (approximate).
    """
    # Try fullScoreResult path first
    full_result = event.get("fullScoreResult")
    if isinstance(full_result, dict):
        player_results = full_result.get("playerResults")
        if isinstance(player_results, dict):
            pr = player_results.get(player_id)
            if isinstance(pr, dict):
                total = pr.get("totalScore", 0)
                base = pr.get("baseScore", 0)
                if isinstance(total, (int, float)) and isinstance(base, (int, float)):
                    return float(total - base) * scale

    # Fallback: finalScores[player].score minus fame
    final_scores = event.get("finalScores")
    if isinstance(final_scores, dict):
        ps = final_scores.get(player_id)
        if isinstance(ps, dict):
            score = ps.get("score", 0)
            if isinstance(score, (int, float)):
                return float(score) * scale

    return 0.0


def _player_fame(state: dict[str, Any], player_id: str) -> int:
    players = state.get("players")
    if not isinstance(players, list):
        return 0
    for player in players:
        if not isinstance(player, dict):
            continue
        if player.get("id") != player_id:
            continue
        fame = player.get("fame")
        if isinstance(fame, (int, float)):
            return int(fame)
        return 0
    return 0
