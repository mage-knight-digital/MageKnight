from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
import random
from typing import Any

import torch
from torch import nn
from ..generated_action_enumerator import CandidateAction
from ..policy import Policy
from .features import (
    ACTION_SCALAR_DIM,
    FEATURE_DIM,
    EncodedStep,
    encode_state_action,
    encode_step,
)
from .vocabularies import (
    ACTION_TYPE_VOCAB,
    CARD_VOCAB,
    ENEMY_VOCAB,
    MODE_VOCAB,
    SOURCE_VOCAB,
    UNIT_VOCAB,
)


@dataclass(frozen=True)
class PolicyGradientConfig:
    gamma: float = 0.99
    learning_rate: float = 3e-4
    entropy_coefficient: float = 0.01
    hidden_size: int = 128
    normalize_returns: bool = True
    device: str = "auto"
    embedding_dim: int = 16
    use_embeddings: bool = True


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


# Number of scalar features in state encoding (STATE_SCALAR_DIM + MAP_SCALAR_DIM)
_STATE_SCALAR_DIM = 24


class _EmbeddingActionScoringNetwork(nn.Module):
    """Network that uses learned embeddings for entity IDs."""

    def __init__(self, hidden_size: int, emb_dim: int) -> None:
        super().__init__()
        self.emb_dim = emb_dim

        # Embedding tables
        self.card_emb = nn.Embedding(CARD_VOCAB.size, emb_dim)
        self.unit_emb = nn.Embedding(UNIT_VOCAB.size, emb_dim)
        self.enemy_emb = nn.Embedding(ENEMY_VOCAB.size, emb_dim)
        self.action_type_emb = nn.Embedding(ACTION_TYPE_VOCAB.size, emb_dim)
        self.source_emb = nn.Embedding(SOURCE_VOCAB.size, emb_dim)
        self.mode_emb = nn.Embedding(MODE_VOCAB.size, emb_dim)

        # State encoder: scalars(24) + mode_emb + hand_mean_pool + unit_mean_pool
        state_input_dim = _STATE_SCALAR_DIM + 3 * emb_dim
        self.state_encoder = nn.Sequential(
            nn.Linear(state_input_dim, hidden_size),
            nn.Tanh(),
        )

        # Action encoder: action_type_emb + source_emb + card_emb + unit_emb + enemy_emb + scalars(6)
        action_input_dim = 5 * emb_dim + ACTION_SCALAR_DIM
        self.action_encoder = nn.Sequential(
            nn.Linear(action_input_dim, hidden_size),
            nn.Tanh(),
        )

        # Score: concat state_repr + action_repr → hidden → 1
        self.scoring_head = nn.Sequential(
            nn.Linear(2 * hidden_size, hidden_size),
            nn.Tanh(),
            nn.Linear(hidden_size, 1),
        )

        # Pre-allocated zero vector to avoid repeated torch.zeros calls
        self.register_buffer("_zero_emb", torch.zeros(emb_dim))

    def encode_state(self, step: EncodedStep, device: torch.device) -> torch.Tensor:
        """Encode state features into a single vector. Computed once per step."""
        sf = step.state
        scalars = torch.tensor(sf.scalars, dtype=torch.float32, device=device)

        mode_vec = self.mode_emb(torch.tensor(sf.mode_id, device=device))

        # Mean-pool hand card embeddings
        if sf.hand_card_ids:
            hand_ids = torch.tensor(sf.hand_card_ids, dtype=torch.long, device=device)
            hand_pool = self.card_emb(hand_ids).mean(dim=0)
        else:
            hand_pool = self._zero_emb

        # Mean-pool unit embeddings
        if sf.unit_ids:
            unit_ids_t = torch.tensor(sf.unit_ids, dtype=torch.long, device=device)
            unit_pool = self.unit_emb(unit_ids_t).mean(dim=0)
        else:
            unit_pool = self._zero_emb

        state_input = torch.cat([scalars, mode_vec, hand_pool, unit_pool])
        return self.state_encoder(state_input)

    def encode_actions(self, step: EncodedStep, device: torch.device) -> torch.Tensor:
        """Encode all candidate actions into (N, hidden) tensor."""
        # Pack all integer IDs into a single (N, 5) tensor — one torch.tensor call
        ids = torch.tensor(
            [
                [a.action_type_id, a.source_id, a.card_id, a.unit_id, a.enemy_id]
                for a in step.actions
            ],
            dtype=torch.long,
            device=device,
        )
        action_scalars = torch.tensor(
            [a.scalars for a in step.actions], dtype=torch.float32, device=device
        )

        action_input = torch.cat([
            self.action_type_emb(ids[:, 0]),
            self.source_emb(ids[:, 1]),
            self.card_emb(ids[:, 2]),
            self.unit_emb(ids[:, 3]),
            self.enemy_emb(ids[:, 4]),
            action_scalars,
        ], dim=-1)  # (N, 5*emb_dim + 6)

        return self.action_encoder(action_input)  # (N, hidden)

    def forward(self, step: EncodedStep, device: torch.device) -> torch.Tensor:
        """Score all candidates. Returns (N,) logits."""
        state_repr = self.encode_state(step, device)  # (hidden,)
        action_reprs = self.encode_actions(step, device)  # (N, hidden)
        n = action_reprs.size(0)

        # Broadcast state to all candidates
        state_broadcast = state_repr.unsqueeze(0).expand(n, -1)  # (N, hidden)
        combined = torch.cat([state_broadcast, action_reprs], dim=-1)  # (N, 2*hidden)
        return self.scoring_head(combined).squeeze(-1)  # (N,)


class ReinforcePolicy(Policy):
    """Candidate-ranking policy optimized with episodic REINFORCE."""

    def __init__(self, config: PolicyGradientConfig | None = None) -> None:
        self.config = config or PolicyGradientConfig()
        self._device = _resolve_device(self.config.device)

        if self.config.use_embeddings:
            self._network = _EmbeddingActionScoringNetwork(
                self.config.hidden_size, self.config.embedding_dim,
            ).to(self._device)
        else:
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

        self._network.train()

        if self.config.use_embeddings:
            logits = self._choose_action_embeddings(state, player_id, valid_actions)
        else:
            logits = self._choose_action_legacy(state, player_id, valid_actions)

        log_probs = torch.log_softmax(logits, dim=0)
        selected_index = int(torch.multinomial(log_probs.exp(), 1).item())

        self._episode_log_probs.append(log_probs[selected_index])
        # Entropy: -sum(p * log(p))
        probs = log_probs.exp()
        self._episode_entropies.append(-(probs * log_probs).sum())
        self._episode_rewards.append(0.0)

        return valid_actions[selected_index]

    def _choose_action_legacy(
        self,
        state: dict[str, Any],
        player_id: str,
        valid_actions: list[CandidateAction],
    ) -> torch.Tensor:
        """Legacy path: flat feature vector per candidate."""
        feature_rows = [
            encode_state_action(state, player_id, candidate.action, candidate.source)
            for candidate in valid_actions
        ]
        inputs = torch.tensor(feature_rows, dtype=torch.float32, device=self._device)
        return self._network(inputs)

    def _choose_action_embeddings(
        self,
        state: dict[str, Any],
        player_id: str,
        valid_actions: list[CandidateAction],
    ) -> torch.Tensor:
        """Embedding path: structured features, state computed once."""
        step = encode_step(state, player_id, valid_actions)
        return self._network(step, self._device)

    def record_step_reward(self, reward: float) -> None:
        if self._next_reward_index >= len(self._episode_rewards):
            return
        self._episode_rewards[self._next_reward_index] += reward
        self._next_reward_index += 1

    def add_terminal_reward(self, reward: float) -> None:
        if not self._episode_rewards:
            return
        self._episode_rewards[-1] += reward

    def optimize_episode(self, compute_gradients_only: bool = False) -> OptimizationStats:
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
        if not compute_gradients_only:
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

    def extract_gradients(self) -> dict[str, torch.Tensor]:
        """Return a dict of parameter gradients (after backward). Used by workers."""
        return {
            name: p.grad.clone()
            for name, p in self._network.named_parameters()
            if p.grad is not None
        }

    def apply_averaged_gradients(self, gradient_dicts: list[dict[str, torch.Tensor]]) -> None:
        """Average gradients from N workers and apply a single optimizer step."""
        n = len(gradient_dicts)
        self._optimizer.zero_grad(set_to_none=True)
        for name, param in self._network.named_parameters():
            grads_for_param = [gd[name] for gd in gradient_dicts if name in gd]
            if not grads_for_param:
                continue
            avg_grad = sum(grads_for_param) / n
            param.grad = avg_grad
        self._optimizer.step()

    def get_weights(self) -> dict[str, torch.Tensor]:
        """Return network state_dict (for broadcasting to workers)."""
        return {k: v.cpu() for k, v in self._network.state_dict().items()}

    def set_weights(self, state_dict: dict[str, torch.Tensor]) -> None:
        """Load weights (from main process broadcast)."""
        self._network.load_state_dict(state_dict)

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
    # MPS (Apple GPU) is deliberately excluded from auto-detection:
    # the CPU↔GPU sync overhead per step far exceeds compute savings
    # for our small network (~60K params) and tiny batch sizes (5-25).
    # CPU is ~6x faster end-to-end. Use --device mps to force it.
    return torch.device("cpu")
