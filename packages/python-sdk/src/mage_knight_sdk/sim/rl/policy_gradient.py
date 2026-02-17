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
    COMBAT_ENEMY_SCALAR_DIM,
    MAP_ENEMY_SCALAR_DIM,
    FEATURE_DIM,
    SITE_SCALAR_DIM,
    STATE_SCALAR_DIM,
    EncodedStep,
    encode_state_action,
    encode_step,
)
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
)


@dataclass(frozen=True)
class PolicyGradientConfig:
    gamma: float = 0.99
    learning_rate: float = 3e-4
    entropy_coefficient: float = 0.01
    critic_coefficient: float = 0.5
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
    critic_loss: float = 0.0


@dataclass(frozen=True)
class StepInfo:
    """Info from the last choose_action call, used by PPO trainer."""

    encoded_step: EncodedStep
    action_index: int
    log_prob: float
    value: float


@dataclass(frozen=True)
class Transition:
    """Single decision step stored for PPO optimization."""

    encoded_step: EncodedStep
    action_index: int
    log_prob: float
    value: float
    reward: float


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
        self.terrain_emb = nn.Embedding(TERRAIN_VOCAB.size, emb_dim)
        self.site_emb = nn.Embedding(SITE_VOCAB.size, emb_dim)
        self.skill_emb = nn.Embedding(SKILL_VOCAB.size, emb_dim)
        self.map_site_emb = nn.Embedding(SITE_VOCAB.size, emb_dim)  # separate weights for map sites

        # State encoder:
        # scalars(76) + 6×emb (mode, hand, units, terrain, site, skills)
        # + combat enemy pool (emb + COMBAT_ENEMY_SCALAR_DIM)
        # + visible sites pool (emb + SITE_SCALAR_DIM)
        # + map enemy pool (emb + MAP_ENEMY_SCALAR_DIM)
        state_input_dim = (
            STATE_SCALAR_DIM
            + 6 * emb_dim
            + (emb_dim + COMBAT_ENEMY_SCALAR_DIM)
            + (emb_dim + SITE_SCALAR_DIM)
            + (emb_dim + MAP_ENEMY_SCALAR_DIM)
        )
        self.state_encoder = nn.Sequential(
            nn.Linear(state_input_dim, hidden_size),
            nn.Tanh(),
        )

        # Action encoder: action_type_emb + source_emb + card_emb + unit_emb + enemy_emb + skill_emb
        #                 + target_enemy_pool(emb_dim) + scalars
        action_input_dim = 7 * emb_dim + ACTION_SCALAR_DIM
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

        # Value head: state_repr → scalar V(s)
        self.value_head = nn.Linear(hidden_size, 1)

        # Pre-allocated zero vectors to avoid repeated torch.zeros calls
        self.register_buffer("_zero_emb", torch.zeros(emb_dim))
        self.register_buffer("_zero_combat_enemy_pool", torch.zeros(emb_dim + COMBAT_ENEMY_SCALAR_DIM))
        self.register_buffer("_zero_site_pool", torch.zeros(emb_dim + SITE_SCALAR_DIM))
        self.register_buffer("_zero_map_enemy_pool", torch.zeros(emb_dim + MAP_ENEMY_SCALAR_DIM))

    def encode_state(self, step: EncodedStep, device: torch.device) -> torch.Tensor:
        """Encode state features into a single vector. Computed once per step."""
        sf = step.state
        scalars = torch.tensor(sf.scalars, dtype=torch.float32, device=device)

        # Standard single-lookup embeddings
        mode_vec = self.mode_emb(torch.tensor(sf.mode_id, device=device))
        terrain_vec = self.terrain_emb(torch.tensor(sf.current_terrain_id, device=device))
        site_vec = self.site_emb(torch.tensor(sf.current_site_type_id, device=device))

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

        # Mean-pool combat enemy embeddings + per-enemy scalars
        if sf.combat_enemy_ids:
            enemy_ids_t = torch.tensor(sf.combat_enemy_ids, dtype=torch.long, device=device)
            enemy_embs = self.enemy_emb(enemy_ids_t)  # (N, emb_dim)
            enemy_scalar_t = torch.tensor(sf.combat_enemy_scalars, dtype=torch.float32, device=device)  # (N, COMBAT_ENEMY_SCALAR_DIM)
            combined = torch.cat([enemy_embs, enemy_scalar_t], dim=1)  # (N, emb_dim + COMBAT_ENEMY_SCALAR_DIM)
            combat_enemy_pool = combined.mean(dim=0)  # (emb_dim + COMBAT_ENEMY_SCALAR_DIM,)
        else:
            combat_enemy_pool = self._zero_combat_enemy_pool

        # Mean-pool skill embeddings
        if sf.skill_ids:
            skill_ids_t = torch.tensor(sf.skill_ids, dtype=torch.long, device=device)
            skill_pool = self.skill_emb(skill_ids_t).mean(dim=0)
        else:
            skill_pool = self._zero_emb

        # Full map: visible sites pool (embedding + scalars, mean-pooled)
        if sf.visible_site_ids:
            site_ids_t = torch.tensor(sf.visible_site_ids, dtype=torch.long, device=device)
            site_embs = self.map_site_emb(site_ids_t)  # (N, emb_dim)
            site_scalar_t = torch.tensor(sf.visible_site_scalars, dtype=torch.float32, device=device)  # (N, 6)
            combined = torch.cat([site_embs, site_scalar_t], dim=1)  # (N, emb_dim + 6)
            visible_site_pool = combined.mean(dim=0)  # (emb_dim + 6,)
        else:
            visible_site_pool = self._zero_site_pool

        # Full map: per-enemy pool (shared enemy_emb + scalars, mean-pooled)
        if sf.map_enemy_ids:
            map_ids_t = torch.tensor(sf.map_enemy_ids, dtype=torch.long, device=device)
            map_embs = self.enemy_emb(map_ids_t)  # (N, emb_dim) — shared with combat
            map_scalar_t = torch.tensor(sf.map_enemy_scalars, dtype=torch.float32, device=device)  # (N, MAP_ENEMY_SCALAR_DIM)
            map_enemy_pool = torch.cat([map_embs, map_scalar_t], dim=1).mean(dim=0)  # (emb_dim + MAP_ENEMY_SCALAR_DIM,)
        else:
            map_enemy_pool = self._zero_map_enemy_pool

        state_input = torch.cat([
            scalars,
            mode_vec, hand_pool, unit_pool,
            terrain_vec, site_vec, combat_enemy_pool, skill_pool,
            visible_site_pool, map_enemy_pool,
        ])
        return self.state_encoder(state_input)

    def encode_actions(self, step: EncodedStep, device: torch.device) -> torch.Tensor:
        """Encode all candidate actions into (N, hidden) tensor."""
        # Pack all integer IDs into a single (N, 6) tensor — one torch.tensor call
        ids = torch.tensor(
            [
                [a.action_type_id, a.source_id, a.card_id, a.unit_id, a.enemy_id, a.skill_id]
                for a in step.actions
            ],
            dtype=torch.long,
            device=device,
        )
        action_scalars = torch.tensor(
            [a.scalars for a in step.actions], dtype=torch.float32, device=device
        )

        # Mean-pool target enemy embeddings per action (for DECLARE_ATTACK_TARGETS)
        n = len(step.actions)
        target_pools = torch.zeros(n, self.emb_dim, device=device)
        for i, a in enumerate(step.actions):
            if a.target_enemy_ids:
                t_ids = torch.tensor(a.target_enemy_ids, dtype=torch.long, device=device)
                target_pools[i] = self.enemy_emb(t_ids).mean(dim=0)

        action_input = torch.cat([
            self.action_type_emb(ids[:, 0]),
            self.source_emb(ids[:, 1]),
            self.card_emb(ids[:, 2]),
            self.unit_emb(ids[:, 3]),
            self.enemy_emb(ids[:, 4]),
            self.skill_emb(ids[:, 5]),
            target_pools,
            action_scalars,
        ], dim=-1)  # (N, 7*emb_dim + ACTION_SCALAR_DIM)

        return self.action_encoder(action_input)  # (N, hidden)

    def forward(
        self, step: EncodedStep, device: torch.device
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """Score all candidates and estimate state value.

        Returns (logits: (N,), value: scalar).
        """
        state_repr = self.encode_state(step, device)  # (hidden,)
        action_reprs = self.encode_actions(step, device)  # (N, hidden)
        n = action_reprs.size(0)

        # Broadcast state to all candidates
        state_broadcast = state_repr.unsqueeze(0).expand(n, -1)  # (N, hidden)
        combined = torch.cat([state_broadcast, action_reprs], dim=-1)  # (N, 2*hidden)
        logits = self.scoring_head(combined).squeeze(-1)  # (N,)

        value = self.value_head(state_repr).squeeze(-1)  # scalar
        return logits, value


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
        self._episode_values: list[torch.Tensor] = []
        self._next_reward_index = 0
        self.last_step_info: StepInfo | None = None

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

        value: torch.Tensor | None = None
        encoded_step: EncodedStep | None = None
        if self.config.use_embeddings:
            encoded_step = encode_step(state, player_id, valid_actions)
            logits, value = self._network(encoded_step, self._device)
        else:
            logits = self._choose_action_legacy(state, player_id, valid_actions)

        log_probs = torch.log_softmax(logits, dim=0)
        selected_index = int(torch.multinomial(log_probs.exp(), 1).item())

        self._episode_log_probs.append(log_probs[selected_index])
        # Entropy: -sum(p * log(p))
        probs = log_probs.exp()
        self._episode_entropies.append(-(probs * log_probs).sum())
        self._episode_rewards.append(0.0)
        if value is not None:
            self._episode_values.append(value)

        # Store for PPO collection
        if encoded_step is not None:
            self.last_step_info = StepInfo(
                encoded_step=encoded_step,
                action_index=selected_index,
                log_prob=float(log_probs[selected_index].detach().cpu().item()),
                value=float(value.detach().cpu().item()) if value is not None else 0.0,
            )
        else:
            self.last_step_info = None

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

        log_probs = torch.stack(self._episode_log_probs)
        entropies = torch.stack(self._episode_entropies)

        # Actor-Critic: use advantages instead of raw returns when value estimates exist
        critic_loss_val = 0.0
        has_values = len(self._episode_values) == len(self._episode_log_probs)
        if has_values:
            values = torch.stack(self._episode_values)
            # Critic loss: MSE between value predictions and actual returns
            critic_loss = nn.functional.mse_loss(values, returns_tensor.detach())
            critic_loss_val = float(critic_loss.detach().cpu().item())
            # Advantages: how much better the actual return was vs predicted
            advantages = (returns_tensor - values.detach())
            if self.config.normalize_returns and advantages.numel() > 1:
                adv_std = advantages.std(unbiased=False)
                if float(adv_std.item()) > 1e-8:
                    advantages = (advantages - advantages.mean()) / adv_std
            policy_loss = -(log_probs * advantages).sum()
        else:
            # Legacy REINFORCE: no value head, use normalized returns directly
            critic_loss = torch.tensor(0.0, device=self._device)
            if self.config.normalize_returns and returns_tensor.numel() > 1:
                returns_mean = returns_tensor.mean()
                returns_std = returns_tensor.std(unbiased=False)
                if float(returns_std.item()) > 1e-8:
                    returns_tensor = (returns_tensor - returns_mean) / returns_std
            policy_loss = -(log_probs * returns_tensor).sum()

        entropy_bonus = entropies.sum()
        loss = (
            policy_loss
            + self.config.critic_coefficient * critic_loss
            - self.config.entropy_coefficient * entropy_bonus
        )

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
            critic_loss=critic_loss_val,
        )
        self._reset_episode_buffers()
        return stats

    def optimize_ppo(
        self,
        transitions: list[Transition],
        advantages: list[float],
        returns: list[float],
        clip_epsilon: float = 0.2,
        ppo_epochs: int = 4,
        max_grad_norm: float = 0.5,
        mini_batch_size: int = 64,
    ) -> OptimizationStats:
        """Run PPO clipped surrogate update over collected transitions."""
        n = len(transitions)
        if n == 0:
            return OptimizationStats(
                loss=0.0, total_reward=0.0, mean_reward=0.0,
                entropy=0.0, action_count=0,
            )

        adv_t = torch.tensor(advantages, dtype=torch.float32, device=self._device)
        ret_t = torch.tensor(returns, dtype=torch.float32, device=self._device)
        old_lp = torch.tensor(
            [t.log_prob for t in transitions], dtype=torch.float32, device=self._device,
        )

        # Normalize advantages globally
        if adv_t.numel() > 1:
            std = adv_t.std(unbiased=False)
            if float(std.item()) > 1e-8:
                adv_t = (adv_t - adv_t.mean()) / std

        total_loss = 0.0
        total_critic = 0.0
        total_entropy = 0.0
        num_batches = 0

        indices = list(range(n))

        for _epoch in range(ppo_epochs):
            random.shuffle(indices)

            for start in range(0, n, mini_batch_size):
                batch = indices[start : start + mini_batch_size]
                bs = len(batch)

                self._optimizer.zero_grad(set_to_none=True)
                b_policy = torch.tensor(0.0, device=self._device)
                b_critic = torch.tensor(0.0, device=self._device)
                b_entropy = torch.tensor(0.0, device=self._device)

                for idx in batch:
                    t = transitions[idx]
                    logits, value = self._network(t.encoded_step, self._device)
                    log_probs = torch.log_softmax(logits, dim=0)
                    new_lp = log_probs[t.action_index]

                    ratio = torch.exp(new_lp - old_lp[idx])
                    surr1 = ratio * adv_t[idx]
                    surr2 = torch.clamp(
                        ratio, 1.0 - clip_epsilon, 1.0 + clip_epsilon,
                    ) * adv_t[idx]
                    b_policy = b_policy - torch.min(surr1, surr2)

                    b_critic = b_critic + nn.functional.mse_loss(value, ret_t[idx])

                    probs = log_probs.exp()
                    b_entropy = b_entropy - (probs * log_probs).sum()

                loss = (
                    b_policy / bs
                    + self.config.critic_coefficient * b_critic / bs
                    - self.config.entropy_coefficient * b_entropy / bs
                )
                loss.backward()
                nn.utils.clip_grad_norm_(self._network.parameters(), max_norm=max_grad_norm)
                self._optimizer.step()

                total_loss += float(loss.detach().cpu().item())
                total_critic += float(b_critic.detach().cpu().item()) / bs
                total_entropy += float(b_entropy.detach().cpu().item()) / bs
                num_batches += 1

        d = max(num_batches, 1)
        total_reward = sum(t.reward for t in transitions)
        return OptimizationStats(
            loss=total_loss / d,
            total_reward=total_reward,
            mean_reward=total_reward / n,
            entropy=total_entropy / d,
            action_count=n,
            critic_loss=total_critic / d,
        )

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
        # strict=False allows loading pre-Actor-Critic checkpoints that lack value_head weights
        policy._network.load_state_dict(payload["model_state_dict"], strict=False)
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
        self._episode_values.clear()
        self._next_reward_index = 0


def _discounted_returns(rewards: list[float], gamma: float) -> list[float]:
    running = 0.0
    out_reversed: list[float] = []
    for reward in reversed(rewards):
        running = reward + gamma * running
        out_reversed.append(running)
    return list(reversed(out_reversed))


def compute_gae(
    episodes: list[list[Transition]],
    gamma: float,
    gae_lambda: float,
) -> tuple[list[Transition], list[float], list[float]]:
    """Compute GAE advantages and target returns for collected episodes.

    Returns (flat_transitions, advantages, returns) — all aligned lists.
    """
    all_transitions: list[Transition] = []
    all_advantages: list[float] = []
    all_returns: list[float] = []

    for episode in episodes:
        if not episode:
            continue
        values = [t.value for t in episode]
        rewards = [t.reward for t in episode]
        n = len(episode)

        advantages = [0.0] * n
        gae = 0.0
        for t in reversed(range(n)):
            next_value = values[t + 1] if t < n - 1 else 0.0
            delta = rewards[t] + gamma * next_value - values[t]
            gae = delta + gamma * gae_lambda * gae
            advantages[t] = gae

        returns = [adv + val for adv, val in zip(advantages, values)]
        all_transitions.extend(episode)
        all_advantages.extend(advantages)
        all_returns.extend(returns)

    return all_transitions, all_advantages, all_returns


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
