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
