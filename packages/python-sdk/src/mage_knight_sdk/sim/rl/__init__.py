"""Reinforcement-learning utilities for Mage Knight simulation training."""

from .features import ActionFeatures, EncodedStep, StateFeatures, encode_step
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
from .vocabularies import (
    CARD_VOCAB,
    ENEMY_VOCAB,
    MODE_VOCAB,
    SOURCE_VOCAB,
    UNIT_VOCAB,
    ACTION_TYPE_VOCAB,
    SITE_VOCAB,
    Vocabulary,
)

__all__ = [
    "ActionFeatures",
    "ACTION_TYPE_VOCAB",
    "CARD_VOCAB",
    "ENEMY_VOCAB",
    "EncodedStep",
    "EpisodeTrainingStats",
    "MODE_VOCAB",
    "OptimizationStats",
    "PolicyGradientConfig",
    "ReinforcePolicy",
    "ReinforceTrainer",
    "RewardComponent",
    "RewardConfig",
    "SITE_VOCAB",
    "SOURCE_VOCAB",
    "StateFeatures",
    "UNIT_VOCAB",
    "Vocabulary",
    "compute_step_reward",
    "compute_terminal_reward",
    "encode_step",
]
