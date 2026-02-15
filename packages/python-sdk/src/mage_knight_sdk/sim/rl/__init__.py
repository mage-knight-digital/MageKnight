"""Reinforcement-learning utilities for Mage Knight simulation training."""

from .distributed_trainer import (
    DistributedPPOTrainer,
    DistributedReinforceTrainer,
)
from .features import ActionFeatures, EncodedStep, StateFeatures, encode_step
from .policy_gradient import (
    OptimizationStats,
    PolicyGradientConfig,
    ReinforcePolicy,
    StepInfo,
    Transition,
    compute_gae,
)
from .rewards import (
    RewardComponent,
    RewardConfig,
    compute_step_reward,
    compute_terminal_reward,
)
from .trainer import EpisodeTrainingStats, PPOTrainer, ReinforceTrainer
from .vocabularies import (
    ACTION_TYPE_VOCAB,
    CARD_VOCAB,
    ENEMY_VOCAB,
    MODE_VOCAB,
    SITE_VOCAB,
    SKILL_VOCAB,
    SOURCE_VOCAB,
    TERRAIN_VOCAB,
    UNIT_VOCAB,
    Vocabulary,
)

__all__ = [
    "ActionFeatures",
    "ACTION_TYPE_VOCAB",
    "CARD_VOCAB",
    "DistributedPPOTrainer",
    "DistributedReinforceTrainer",
    "ENEMY_VOCAB",
    "EncodedStep",
    "EpisodeTrainingStats",
    "MODE_VOCAB",
    "OptimizationStats",
    "PPOTrainer",
    "PolicyGradientConfig",
    "ReinforcePolicy",
    "ReinforceTrainer",
    "RewardComponent",
    "RewardConfig",
    "SITE_VOCAB",
    "SKILL_VOCAB",
    "SOURCE_VOCAB",
    "StateFeatures",
    "TERRAIN_VOCAB",
    "StepInfo",
    "Transition",
    "UNIT_VOCAB",
    "Vocabulary",
    "compute_gae",
    "compute_step_reward",
    "compute_terminal_reward",
    "encode_step",
]
