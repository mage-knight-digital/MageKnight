"""Reinforcement-learning utilities for Mage Knight simulation training."""

from .policy_gradient import (
    OptimizationStats,
    PolicyGradientConfig,
    ReinforcePolicy,
)
from .rewards import (
    RewardComponent,
    RewardConfig,
    compute_step_reward,
    compute_terminal_reward,
)
from .trainer import EpisodeTrainingStats, ReinforceTrainer

__all__ = [
    "EpisodeTrainingStats",
    "OptimizationStats",
    "PolicyGradientConfig",
    "ReinforcePolicy",
    "ReinforceTrainer",
    "RewardComponent",
    "RewardConfig",
    "compute_step_reward",
    "compute_terminal_reward",
]
