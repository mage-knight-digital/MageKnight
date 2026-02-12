from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
import random
from typing import Any

import torch
from torch import nn
from torch.distributions import Categorical

from ..generated_action_enumerator import CandidateAction
from ..policy import Policy
from .features import FEATURE_DIM, encode_state_action


@dataclass(frozen=True)
class PolicyGradientConfig:
    gamma: float = 0.99
    learning_rate: float = 3e-4
    entropy_coefficient: float = 0.01
    hidden_size: int = 128
    normalize_returns: bool = True
    device: str = "auto"


@dataclass(frozen=True)
class OptimizationStats:
    loss: float
    total_reward: float
    mean_reward: float
    entropy: float
    action_count: int


class _ActionScoringNetwork(nn.Module):
    def __init__(self, hidden_size: int) -> None:
        super().__init__()
        self._layers = nn.Sequential(
            nn.Linear(FEATURE_DIM, hidden_size),
            nn.Tanh(),
            nn.Linear(hidden_size, hidden_size),
            nn.Tanh(),
            nn.Linear(hidden_size, 1),
        )

    def forward(self, inputs: torch.Tensor) -> torch.Tensor:
        return self._layers(inputs).squeeze(-1)


class ReinforcePolicy(Policy):
    """Candidate-ranking policy optimized with episodic REINFORCE."""

    def __init__(self, config: PolicyGradientConfig | None = None) -> None:
        self.config = config or PolicyGradientConfig()
        self._device = _resolve_device(self.config.device)
        self._network = _ActionScoringNetwork(self.config.hidden_size).to(self._device)
        self._optimizer = torch.optim.Adam(self._network.parameters(), lr=self.config.learning_rate)

        self._episode_log_probs: list[torch.Tensor] = []
        self._episode_entropies: list[torch.Tensor] = []
        self._episode_rewards: list[float] = []
        self._next_reward_index = 0

    def choose_action(
        self,
        state: dict[str, Any],
        player_id: str,
        valid_actions: list[CandidateAction],
        rng: random.Random,
    ) -> CandidateAction | None:
        del rng
        if not valid_actions:
            return None

        feature_rows = [
            encode_state_action(state, player_id, candidate.action, candidate.source)
            for candidate in valid_actions
        ]
        inputs = torch.tensor(feature_rows, dtype=torch.float32, device=self._device)

        self._network.train()
        logits = self._network(inputs)
        distribution = Categorical(logits=logits)
        selected_index_tensor = distribution.sample()
        selected_index = int(selected_index_tensor.item())

        self._episode_log_probs.append(distribution.log_prob(selected_index_tensor))
        self._episode_entropies.append(distribution.entropy())
        self._episode_rewards.append(0.0)

        return valid_actions[selected_index]

    def record_step_reward(self, reward: float) -> None:
        if self._next_reward_index >= len(self._episode_rewards):
            return
        self._episode_rewards[self._next_reward_index] += reward
        self._next_reward_index += 1

    def add_terminal_reward(self, reward: float) -> None:
        if not self._episode_rewards:
            return
        self._episode_rewards[-1] += reward

    def optimize_episode(self) -> OptimizationStats:
        if not self._episode_log_probs:
            self._reset_episode_buffers()
            return OptimizationStats(
                loss=0.0,
                total_reward=0.0,
                mean_reward=0.0,
                entropy=0.0,
                action_count=0,
            )

        returns = _discounted_returns(self._episode_rewards, gamma=self.config.gamma)
        returns_tensor = torch.tensor(returns, dtype=torch.float32, device=self._device)
        if self.config.normalize_returns and returns_tensor.numel() > 1:
            returns_mean = returns_tensor.mean()
            returns_std = returns_tensor.std(unbiased=False)
            if float(returns_std.item()) > 1e-8:
                returns_tensor = (returns_tensor - returns_mean) / returns_std

        log_probs = torch.stack(self._episode_log_probs)
        entropies = torch.stack(self._episode_entropies)
        policy_loss = -(log_probs * returns_tensor).sum()
        entropy_bonus = entropies.sum()
        loss = policy_loss - self.config.entropy_coefficient * entropy_bonus

        self._optimizer.zero_grad(set_to_none=True)
        loss.backward()
        self._optimizer.step()

        stats = OptimizationStats(
            loss=float(loss.detach().cpu().item()),
            total_reward=float(sum(self._episode_rewards)),
            mean_reward=float(sum(self._episode_rewards) / len(self._episode_rewards)),
            entropy=float(entropies.detach().cpu().mean().item()),
            action_count=len(self._episode_rewards),
        )
        self._reset_episode_buffers()
        return stats

    def save_checkpoint(self, path: str | Path, metadata: dict[str, Any] | None = None) -> None:
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        payload: dict[str, Any] = {
            "config": asdict(self.config),
            "model_state_dict": self._network.state_dict(),
            "optimizer_state_dict": self._optimizer.state_dict(),
        }
        if metadata is not None:
            payload["metadata"] = metadata
        torch.save(payload, target)

    @classmethod
    def load_checkpoint(
        cls,
        path: str | Path,
        device_override: str | None = None,
    ) -> tuple[ReinforcePolicy, dict[str, Any]]:
        """Load policy and optimizer from checkpoint. Returns (policy, metadata dict)."""
        payload = torch.load(Path(path), map_location="cpu", weights_only=True)
        config_dict = payload.get("config")
        if not isinstance(config_dict, dict):
            raise ValueError("Checkpoint missing or invalid 'config'")
        config = PolicyGradientConfig(**{k: v for k, v in config_dict.items() if k in PolicyGradientConfig.__dataclass_fields__})
        device = device_override if device_override is not None else config.device
        policy = cls(config=PolicyGradientConfig(**{**asdict(config), "device": device}))
        policy._network.load_state_dict(payload["model_state_dict"])
        if "optimizer_state_dict" in payload:
            policy._optimizer.load_state_dict(payload["optimizer_state_dict"])
        metadata = payload.get("metadata")
        if not isinstance(metadata, dict):
            metadata = {}
        return policy, metadata

    def _reset_episode_buffers(self) -> None:
        self._episode_log_probs.clear()
        self._episode_entropies.clear()
        self._episode_rewards.clear()
        self._next_reward_index = 0


def _discounted_returns(rewards: list[float], gamma: float) -> list[float]:
    running = 0.0
    out_reversed: list[float] = []
    for reward in reversed(rewards):
        running = reward + gamma * running
        out_reversed.append(running)
    return list(reversed(out_reversed))


def _resolve_device(requested: str) -> torch.device:
    if requested != "auto":
        return torch.device(requested)
    if torch.cuda.is_available():
        return torch.device("cuda")
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")
