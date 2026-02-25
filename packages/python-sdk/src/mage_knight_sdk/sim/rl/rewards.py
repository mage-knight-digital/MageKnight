"""Reward configuration for RL training.

The native Rust engine path computes rewards directly from fame deltas.
This module provides the scalar reward parameters.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RewardConfig:
    fame_delta_scale: float = 1.0
    step_penalty: float = -0.001
    terminal_end_bonus: float = 1.0
    terminal_max_steps_penalty: float = -0.5
    terminal_failure_penalty: float = -1.0
    scenario_trigger_bonus: float = 0.0
