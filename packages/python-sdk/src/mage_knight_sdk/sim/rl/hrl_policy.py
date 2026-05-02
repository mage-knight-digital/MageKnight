"""CEO policy network for Hierarchical RL.

The CEO picks strategic goals (10 types) from a simple classifier.
Much simpler than the Worker — no per-action scoring needed.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import torch
import torch.nn as nn

from .features import (
    STATE_SCALAR_DIM, SITE_SCALAR_DIM, MAP_ENEMY_SCALAR_DIM,
    COMBAT_ENEMY_SCALAR_DIM, UNIT_SCALAR_DIM, HEX_SCALAR_DIM,
)
from .goal_tracker import NUM_GOAL_TYPES
from .vocabularies import (
    CARD_VOCAB, UNIT_VOCAB, ENEMY_VOCAB, MODE_VOCAB, TERRAIN_VOCAB,
    SITE_VOCAB, SKILL_VOCAB,
)


@dataclass(frozen=True)
class CEOConfig:
    hidden_size: int = 128
    embedding_dim: int = 16
    learning_rate: float = 3e-4
    device: str = "auto"


@dataclass(frozen=True)
class CEOTransition:
    """One CEO decision: state at goal selection time + outcome."""
    state_scalars: np.ndarray   # (STATE_SCALAR_DIM,) float32
    state_ids: np.ndarray       # (3,) int32
    goal_index: int             # which goal was selected (0-9)
    log_prob: float             # CEO's log_prob for the selected goal
    value: float                # CEO's value estimate at decision time
    reward: float               # cumulative game reward during goal lifetime


def _resolve_device(device: str) -> torch.device:
    if device == "auto":
        if torch.cuda.is_available():
            return torch.device("cuda")
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return torch.device("mps")
        return torch.device("cpu")
    return torch.device(device)


class CEONetwork(nn.Module):
    """Simple goal classifier network for the CEO policy.

    Uses mean-pooling over entity pools (not attention) since the CEO
    only makes ~10-15 decisions per game over 10 goal classes.
    """

    def __init__(self, config: CEOConfig) -> None:
        super().__init__()
        emb = config.embedding_dim
        hidden = config.hidden_size

        # Embedding tables (separate from Worker — CEO has its own weights)
        self.mode_emb = nn.Embedding(MODE_VOCAB.size, emb)
        self.terrain_emb = nn.Embedding(TERRAIN_VOCAB.size, emb)
        self.site_emb = nn.Embedding(SITE_VOCAB.size, emb)

        # Mean-pooling projections for entity pools
        self.card_emb = nn.Embedding(CARD_VOCAB.size, emb)
        self.unit_emb = nn.Embedding(UNIT_VOCAB.size, emb)
        self.enemy_emb = nn.Embedding(ENEMY_VOCAB.size, emb)
        self.skill_emb = nn.Embedding(SKILL_VOCAB.size, emb)
        self.map_site_emb = nn.Embedding(SITE_VOCAB.size, emb)
        self.map_enemy_emb = nn.Embedding(ENEMY_VOCAB.size, emb)
        self.hex_terrain_emb = nn.Embedding(TERRAIN_VOCAB.size, emb)

        # Pool projection layers (entity embedding + scalars → fixed dim)
        pool_dim = emb  # mean-pooled output dim per pool
        self.unit_proj = nn.Linear(emb + UNIT_SCALAR_DIM, pool_dim)
        self.combat_enemy_proj = nn.Linear(emb + COMBAT_ENEMY_SCALAR_DIM, pool_dim)
        self.site_proj = nn.Linear(emb + SITE_SCALAR_DIM, pool_dim)
        self.map_enemy_proj = nn.Linear(emb + MAP_ENEMY_SCALAR_DIM, pool_dim)
        self.hex_proj = nn.Linear(emb + HEX_SCALAR_DIM, pool_dim)

        # 9 pools: hand, deck, discard, units, combat_enemies, skills, sites, map_enemies, hexes
        # Simple pools (ID only): hand, deck, discard, skills → emb dim each
        # Complex pools (ID + scalars): units, combat_enemies, sites, map_enemies, hexes → pool_dim each
        state_input_dim = STATE_SCALAR_DIM + 3 * emb + 4 * emb + 5 * pool_dim

        self.state_encoder = nn.Sequential(
            nn.Linear(state_input_dim, hidden),
            nn.Tanh(),
            nn.Linear(hidden, hidden),
            nn.Tanh(),
        )

        self.goal_head = nn.Linear(hidden, NUM_GOAL_TYPES)
        self.value_head = nn.Linear(hidden, 1)

    def forward(
        self,
        state_scalars: torch.Tensor,  # (N, STATE_SCALAR_DIM)
        state_ids: torch.Tensor,      # (N, 3) int
        # Entity pools (padded, with counts)
        hand_ids: torch.Tensor, hand_counts: torch.Tensor,
        deck_ids: torch.Tensor, deck_counts: torch.Tensor,
        discard_ids: torch.Tensor, discard_counts: torch.Tensor,
        unit_ids: torch.Tensor, unit_counts: torch.Tensor, unit_scalars: torch.Tensor,
        combat_enemy_ids: torch.Tensor, combat_enemy_counts: torch.Tensor, combat_enemy_scalars: torch.Tensor,
        skill_ids: torch.Tensor, skill_counts: torch.Tensor,
        site_ids: torch.Tensor, site_counts: torch.Tensor, site_scalars: torch.Tensor,
        map_enemy_ids: torch.Tensor, map_enemy_counts: torch.Tensor, map_enemy_scalars: torch.Tensor,
        hex_ids: torch.Tensor, hex_counts: torch.Tensor, hex_scalars: torch.Tensor,
        goal_mask: torch.Tensor,      # (N, NUM_GOAL_TYPES) bool
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """Forward pass.

        Returns:
            goal_logits: (N, NUM_GOAL_TYPES) with -inf for illegal goals
            values: (N,) state value estimates
        """
        # Fixed embeddings
        mode_vec = self.mode_emb(state_ids[:, 0])      # (N, emb)
        terrain_vec = self.terrain_emb(state_ids[:, 1]) # (N, emb)
        site_vec = self.site_emb(state_ids[:, 2])       # (N, emb)

        # Mean-pool simple ID pools
        hand_pool = self._mean_pool_ids(self.card_emb, hand_ids, hand_counts)       # (N, emb)
        deck_pool = self._mean_pool_ids(self.card_emb, deck_ids, deck_counts)       # (N, emb)
        discard_pool = self._mean_pool_ids(self.card_emb, discard_ids, discard_counts) # (N, emb)
        skill_pool = self._mean_pool_ids(self.skill_emb, skill_ids, skill_counts)   # (N, emb)

        # Mean-pool complex pools (ID + scalars)
        unit_pool = self._mean_pool_complex(self.unit_emb, self.unit_proj, unit_ids, unit_counts, unit_scalars)
        ce_pool = self._mean_pool_complex(self.enemy_emb, self.combat_enemy_proj, combat_enemy_ids, combat_enemy_counts, combat_enemy_scalars)
        site_pool = self._mean_pool_complex(self.map_site_emb, self.site_proj, site_ids, site_counts, site_scalars)
        me_pool = self._mean_pool_complex(self.map_enemy_emb, self.map_enemy_proj, map_enemy_ids, map_enemy_counts, map_enemy_scalars)
        hex_pool = self._mean_pool_complex(self.hex_terrain_emb, self.hex_proj, hex_ids, hex_counts, hex_scalars)

        # Concatenate everything
        state_input = torch.cat([
            state_scalars,
            mode_vec, terrain_vec, site_vec,
            hand_pool, deck_pool, discard_pool, skill_pool,
            unit_pool, ce_pool, site_pool, me_pool, hex_pool,
        ], dim=-1)

        state_repr = self.state_encoder(state_input)  # (N, hidden)
        goal_logits = self.goal_head(state_repr)       # (N, NUM_GOAL_TYPES)
        values = self.value_head(state_repr).squeeze(-1)  # (N,)

        # Mask illegal goals
        goal_logits = goal_logits.masked_fill(~goal_mask, float("-inf"))

        return goal_logits, values

    def _mean_pool_ids(
        self, emb_table: nn.Embedding, ids: torch.Tensor, counts: torch.Tensor,
    ) -> torch.Tensor:
        """Mean-pool an ID-only entity pool. (N, max_K) → (N, emb_dim)."""
        embedded = emb_table(ids)  # (N, max_K, emb)
        # Create mask from counts
        n, max_k = ids.shape
        mask = torch.arange(max_k, device=ids.device).unsqueeze(0) < counts.unsqueeze(1)  # (N, max_K)
        masked = embedded * mask.unsqueeze(-1).float()
        safe_counts = counts.clamp(min=1).unsqueeze(-1).float()
        return masked.sum(dim=1) / safe_counts  # (N, emb)

    def _mean_pool_complex(
        self, emb_table: nn.Embedding, proj: nn.Linear,
        ids: torch.Tensor, counts: torch.Tensor, scalars: torch.Tensor,
    ) -> torch.Tensor:
        """Mean-pool a complex entity pool (ID + scalars). → (N, pool_dim)."""
        n, max_k = ids.shape
        embedded = emb_table(ids)  # (N, max_K, emb)
        # scalars come as (N*max_K, scalar_dim) — reshape
        scalar_dim = scalars.shape[-1]
        scalars_3d = scalars.reshape(n, max_k, scalar_dim)
        combined = torch.cat([embedded, scalars_3d], dim=-1)  # (N, max_K, emb+scalar_dim)
        projected = proj(combined)  # (N, max_K, pool_dim)
        mask = torch.arange(max_k, device=ids.device).unsqueeze(0) < counts.unsqueeze(1)
        masked = projected * mask.unsqueeze(-1).float()
        safe_counts = counts.clamp(min=1).unsqueeze(-1).float()
        return masked.sum(dim=1) / safe_counts  # (N, pool_dim)


class CEOPolicy:
    """CEO policy for HRL — selects goals from the goal space."""

    def __init__(self, config: CEOConfig | None = None) -> None:
        self.config = config or CEOConfig()
        self._device = _resolve_device(self.config.device)
        self._network = CEONetwork(self.config).to(self._device)
        self._optimizer = torch.optim.Adam(
            self._network.parameters(), lr=self.config.learning_rate,
        )

    def choose_goals_batch(
        self,
        batch_dict: dict[str, np.ndarray],
        goal_masks: np.ndarray,  # (N, NUM_GOAL_TYPES) bool
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Choose goals for all envs that need them.

        Args:
            batch_dict: from PyVecEnv.encode_batch()
            goal_masks: (N, NUM_GOAL_TYPES) bool — which goals are legal

        Returns:
            (goals, log_probs, values) all (N,) numpy arrays
        """
        self._network.train()
        device = self._device

        # Prepare tensors
        state_scalars = torch.tensor(batch_dict["state_scalars"], dtype=torch.float32, device=device)
        state_ids = torch.tensor(batch_dict["state_ids"], dtype=torch.long, device=device)

        def _pool_ids(key: str) -> tuple[torch.Tensor, torch.Tensor]:
            ids = torch.tensor(batch_dict[key], dtype=torch.long, device=device)
            # Handle naming convention differences
            if key == "hand_card_ids":
                counts = torch.tensor(batch_dict["hand_counts"], dtype=torch.long, device=device)
            elif key == "deck_card_ids":
                counts = torch.tensor(batch_dict["deck_counts"], dtype=torch.long, device=device)
            elif key == "discard_card_ids":
                counts = torch.tensor(batch_dict["discard_counts"], dtype=torch.long, device=device)
            elif key == "revealed_hex_terrain_ids":
                counts = torch.tensor(batch_dict["revealed_hex_counts"], dtype=torch.long, device=device)
            else:
                ck = key.replace("_ids", "_counts")
                counts = torch.tensor(batch_dict[ck], dtype=torch.long, device=device)
            return ids, counts

        hand_ids, hand_counts = _pool_ids("hand_card_ids")
        deck_ids, deck_counts = _pool_ids("deck_card_ids")
        discard_ids, discard_counts = _pool_ids("discard_card_ids")
        unit_ids, unit_counts = _pool_ids("unit_ids")
        ce_ids, ce_counts = _pool_ids("combat_enemy_ids")
        skill_ids, skill_counts = _pool_ids("skill_ids")
        site_ids, site_counts = _pool_ids("visible_site_ids")
        me_ids, me_counts = _pool_ids("map_enemy_ids")
        hex_ids, hex_counts = _pool_ids("revealed_hex_terrain_ids")

        # Scalar pools
        unit_scalars = torch.tensor(batch_dict["unit_scalars"], dtype=torch.float32, device=device)
        ce_scalars = torch.tensor(batch_dict["combat_enemy_scalars"], dtype=torch.float32, device=device)
        site_scalars = torch.tensor(batch_dict["visible_site_scalars"], dtype=torch.float32, device=device)
        me_scalars = torch.tensor(batch_dict["map_enemy_scalars"], dtype=torch.float32, device=device)
        hex_scalars = torch.tensor(batch_dict["revealed_hex_scalars"], dtype=torch.float32, device=device)

        goal_mask_t = torch.tensor(goal_masks, dtype=torch.bool, device=device)

        goal_logits, values = self._network(
            state_scalars, state_ids,
            hand_ids, hand_counts,
            deck_ids, deck_counts,
            discard_ids, discard_counts,
            unit_ids, unit_counts, unit_scalars,
            ce_ids, ce_counts, ce_scalars,
            skill_ids, skill_counts,
            site_ids, site_counts, site_scalars,
            me_ids, me_counts, me_scalars,
            hex_ids, hex_counts, hex_scalars,
            goal_mask_t,
        )

        # Sample goals
        goal_logits = goal_logits.clamp(min=-50.0, max=50.0)
        finite_mask = goal_logits != float("-inf")
        goal_logits = goal_logits.masked_fill(~finite_mask, float("-inf"))
        log_probs_all = torch.log_softmax(goal_logits, dim=-1)
        probs = log_probs_all.exp()
        selected = torch.multinomial(probs, 1).squeeze(-1)  # (N,)
        selected_log_probs = log_probs_all.gather(1, selected.unsqueeze(1)).squeeze(1)

        return (
            selected.detach().cpu().numpy().astype(np.int32),
            selected_log_probs.detach().cpu().numpy().astype(np.float32),
            values.detach().cpu().numpy().astype(np.float32),
        )

    def optimize_ppo(
        self,
        transitions: list[CEOTransition],
        advantages: np.ndarray,
        returns: np.ndarray,
        clip_epsilon: float = 0.2,
        ppo_epochs: int = 4,
        max_grad_norm: float = 0.5,
        mini_batch_size: int = 32,
        entropy_coef: float = 0.03,
        critic_coef: float = 0.5,
    ) -> dict:
        """PPO optimization for CEO transitions.

        Returns dict with loss, entropy stats.
        """
        if not transitions:
            return {"loss": 0.0, "entropy": 0.0}

        device = self._device
        n = len(transitions)

        # Tensorize
        state_scalars = torch.tensor(
            np.array([t.state_scalars for t in transitions]),
            dtype=torch.float32, device=device,
        )
        state_ids = torch.tensor(
            np.array([t.state_ids for t in transitions]),
            dtype=torch.long, device=device,
        )
        old_goals = torch.tensor(
            [t.goal_index for t in transitions],
            dtype=torch.long, device=device,
        )
        old_log_probs = torch.tensor(
            [t.log_prob for t in transitions],
            dtype=torch.float32, device=device,
        )
        adv_t = torch.tensor(advantages, dtype=torch.float32, device=device)
        ret_t = torch.tensor(returns, dtype=torch.float32, device=device)

        # Normalize advantages
        if adv_t.numel() > 1:
            adv_t = (adv_t - adv_t.mean()) / (adv_t.std() + 1e-8)

        total_loss = 0.0
        total_entropy = 0.0

        for _ in range(ppo_epochs):
            indices = torch.randperm(n, device=device)
            for start in range(0, n, mini_batch_size):
                batch = indices[start:start + mini_batch_size]
                b_scalars = state_scalars[batch]
                b_ids = state_ids[batch]
                b_goals = old_goals[batch]
                b_old_lp = old_log_probs[batch]
                b_adv = adv_t[batch]
                b_ret = ret_t[batch]

                # Forward pass — CEO needs all entity pools but we only stored scalars + ids
                # For simplicity, use a minimal forward with just scalars + fixed embs
                # (entity pools not stored in CEOTransition to keep it lightweight)
                b_n = b_scalars.shape[0]
                empty_ids = torch.zeros(b_n, 1, dtype=torch.long, device=device)
                empty_counts = torch.zeros(b_n, dtype=torch.long, device=device)
                empty_scalars_2 = torch.zeros(b_n, 1, UNIT_SCALAR_DIM, dtype=torch.float32, device=device).reshape(b_n, UNIT_SCALAR_DIM)
                empty_scalars_ce = torch.zeros(b_n, COMBAT_ENEMY_SCALAR_DIM, dtype=torch.float32, device=device)
                empty_scalars_site = torch.zeros(b_n, SITE_SCALAR_DIM, dtype=torch.float32, device=device)
                empty_scalars_me = torch.zeros(b_n, MAP_ENEMY_SCALAR_DIM, dtype=torch.float32, device=device)
                empty_scalars_hex = torch.zeros(b_n, HEX_SCALAR_DIM, dtype=torch.float32, device=device)

                # All goals are legal during PPO (we already selected them)
                all_legal = torch.ones(b_n, NUM_GOAL_TYPES, dtype=torch.bool, device=device)

                logits, values = self._network(
                    b_scalars, b_ids,
                    empty_ids, empty_counts,   # hand
                    empty_ids, empty_counts,   # deck
                    empty_ids, empty_counts,   # discard
                    empty_ids, empty_counts, empty_scalars_2,  # units
                    empty_ids, empty_counts, empty_scalars_ce,  # combat enemies
                    empty_ids, empty_counts,   # skills
                    empty_ids, empty_counts, empty_scalars_site,  # sites
                    empty_ids, empty_counts, empty_scalars_me,  # map enemies
                    empty_ids, empty_counts, empty_scalars_hex,  # hexes
                    all_legal,
                )

                new_log_probs = torch.log_softmax(logits, dim=-1)
                new_lp = new_log_probs.gather(1, b_goals.unsqueeze(1)).squeeze(1)

                # PPO clipped surrogate
                ratios = torch.exp(new_lp - b_old_lp)
                surr1 = ratios * b_adv
                surr2 = torch.clamp(ratios, 1.0 - clip_epsilon, 1.0 + clip_epsilon) * b_adv
                policy_loss = -torch.min(surr1, surr2).mean()

                # Value loss
                value_loss = nn.functional.mse_loss(values, b_ret)

                # Entropy
                probs = new_log_probs.exp()
                entropy = -(probs * new_log_probs).sum(dim=-1).mean()

                loss = policy_loss + critic_coef * value_loss - entropy_coef * entropy

                self._optimizer.zero_grad()
                loss.backward()
                nn.utils.clip_grad_norm_(self._network.parameters(), max_grad_norm)
                self._optimizer.step()

                total_loss += loss.item()
                total_entropy += entropy.item()

        num_updates = max(1, ppo_epochs * ((n + mini_batch_size - 1) // mini_batch_size))
        return {
            "loss": total_loss / num_updates,
            "entropy": total_entropy / num_updates,
        }
