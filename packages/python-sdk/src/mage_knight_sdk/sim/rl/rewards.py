"""Reward configuration for RL training.

The native Rust engine path computes rewards directly from fame deltas.
This module provides the scalar reward parameters.

Reward shaping: The game's natural reward (fame) is extremely sparse —
random play earns zero fame on most seeds. The movement_bonus and
exploration_bonus provide dense intermediate signals that guide the agent
toward productive play (move around the map → explore tiles → earn fame).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RewardConfig:
    fame_delta_scale: float = 1.0
    step_penalty: float = 0.0
    terminal_end_bonus: float = 0.0
    terminal_max_steps_penalty: float = -0.5
    terminal_failure_penalty: float = -1.0
    scenario_trigger_bonus: float = 0.0
    # Dense reward shaping: movement and exploration
    movement_bonus: float = 0.02
    exploration_bonus: float = 0.5
