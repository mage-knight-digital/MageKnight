"""Batched inference coordinator for concurrent game simulations.

When multiple games run concurrently via asyncio.gather, each game independently
calls the policy network. The BatchInferenceCoordinator collects these requests
and dispatches a single batched forward pass for state encoding, action encoding,
and scoring — reducing inference time from O(N) to O(1) matmuls per batch.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

import torch

from .features import ACTION_SCALAR_DIM, EncodedStep
from .policy_gradient import StepInfo


@dataclass
class InferenceRequest:
    """A pending inference request from a game coroutine."""

    encoded_step: EncodedStep
    future: asyncio.Future[StepInfo]


class BatchInferenceCoordinator:
    """Collects inference requests from concurrent games and batches them.

    Usage:
        coordinator = BatchInferenceCoordinator(policy)
        task = asyncio.create_task(coordinator.run())
        # ... in each game coroutine:
        step_info = await coordinator.submit(encoded_step)
        # ... cleanup:
        task.cancel()
    """

    def __init__(self, policy: object) -> None:
        # Import here to avoid circular import at module level
        from .policy_gradient import _EmbeddingActionScoringNetwork

        self._policy = policy
        net = getattr(policy, "_network", None)
        if not isinstance(net, _EmbeddingActionScoringNetwork):
            raise TypeError("BatchInferenceCoordinator requires _EmbeddingActionScoringNetwork")
        self._network: _EmbeddingActionScoringNetwork = net
        self._device: torch.device = getattr(policy, "_device", torch.device("cpu"))
        self._pending: list[InferenceRequest] = []
        self._batch_event = asyncio.Event()
        self._batch_count = 0
        self._total_requests = 0

    async def submit(self, encoded_step: EncodedStep) -> StepInfo:
        """Called by each game coroutine. Appends request, awaits batched result."""
        loop = asyncio.get_running_loop()
        future: asyncio.Future[StepInfo] = loop.create_future()
        self._pending.append(InferenceRequest(encoded_step=encoded_step, future=future))
        self._batch_event.set()
        return await future

    async def run(self) -> None:
        """Background task: wait for requests, batch-infer, dispatch results."""
        try:
            while True:
                await self._batch_event.wait()
                self._batch_event.clear()
                # Yield once to let other ready coroutines submit their requests
                await asyncio.sleep(0)
                if not self._pending:
                    continue
                batch = self._pending[:]
                self._pending.clear()
                self._infer_batch(batch)
        except asyncio.CancelledError:
            # Resolve any remaining futures on cancellation
            for req in self._pending:
                if not req.future.done():
                    req.future.cancel()
            raise

    def _infer_batch(self, batch: list[InferenceRequest]) -> None:
        """Fully batched inference: state encoding, action encoding, scoring, sampling."""
        self._batch_count += 1
        self._total_requests += len(batch)

        net = self._network
        device = self._device
        bs = len(batch)
        emb_dim = net.emb_dim

        steps = [req.encoded_step for req in batch]

        with torch.no_grad():
            # --- Batched state encoding (B states → 1 matmul) ---
            state_reprs = net.encode_state_batch(steps, device)  # (B, hidden)

            # --- Batched value head ---
            values = net.value_head(state_reprs).squeeze(-1)  # (B,)

            # --- Batched action encoding (pad-and-batch) ---
            # Build Python lists first, then single torch.tensor() calls to
            # avoid per-action torch.tensor() overhead (was 35% of batch time).
            action_counts = [len(step.actions) for step in steps]
            max_a = max(action_counts)
            flat_size = bs * max_a

            # Pre-allocate Python lists (zeros for padding)
            ids_flat = [[0] * 6] * flat_size  # will be overwritten in-place
            ids_flat = [[0, 0, 0, 0, 0, 0] for _ in range(flat_size)]
            scalars_flat = [[0.0] * ACTION_SCALAR_DIM for _ in range(flat_size)]
            mask_flat = [[False] * max_a for _ in range(bs)]
            has_targets = False

            for i, step in enumerate(steps):
                n_a = action_counts[i]
                offset = i * max_a
                for j, a in enumerate(step.actions):
                    ids_flat[offset + j] = [
                        a.action_type_id, a.source_id, a.card_id,
                        a.unit_id, a.enemy_id, a.skill_id,
                    ]
                    scalars_flat[offset + j] = a.scalars
                    if a.target_enemy_ids:
                        has_targets = True
                mask_flat[i] = [j < n_a for j in range(max_a)]

            # Single torch.tensor() calls (instead of N*max_a individual calls)
            padded_ids = torch.tensor(ids_flat, dtype=torch.long, device=device)
            padded_scalars = torch.tensor(scalars_flat, dtype=torch.float32, device=device)
            mask = torch.tensor(mask_flat, dtype=torch.bool, device=device)

            # Target enemy pools (rare — only DECLARE_ATTACK_TARGETS)
            padded_targets = torch.zeros(flat_size, emb_dim, device=device)
            if has_targets:
                for i, step in enumerate(steps):
                    offset = i * max_a
                    for j, a in enumerate(step.actions):
                        if a.target_enemy_ids:
                            t_ids = torch.tensor(
                                a.target_enemy_ids, dtype=torch.long, device=device,
                            )
                            padded_targets[offset + j] = net.enemy_emb(t_ids).mean(dim=0)

            # Single batched embedding lookup + action encoder MLP
            flat_action_input = torch.cat([
                net.action_type_emb(padded_ids[:, 0]),
                net.source_emb(padded_ids[:, 1]),
                net.card_emb(padded_ids[:, 2]),
                net.unit_emb(padded_ids[:, 3]),
                net.enemy_emb(padded_ids[:, 4]),
                net.skill_emb(padded_ids[:, 5]),
                padded_targets,
                padded_scalars,
            ], dim=-1)  # (flat_size, 7*emb_dim + ACTION_SCALAR_DIM)

            flat_action_reprs = net.action_encoder(flat_action_input)  # (flat_size, hidden)
            action_reprs = flat_action_reprs.view(bs, max_a, -1)  # (bs, max_A, hidden)

            # --- Batched scoring head ---
            state_expanded = state_reprs.unsqueeze(1).expand(-1, max_a, -1)  # (bs, max_A, hidden)
            combined = torch.cat([state_expanded, action_reprs], dim=-1)  # (bs, max_A, 2*hidden)
            logits = net.scoring_head(
                combined.view(-1, combined.size(-1)),
            ).squeeze(-1).view(bs, max_a)  # (bs, max_A)

            # Masked log_softmax
            logits = logits.masked_fill(~mask, float("-inf"))
            log_probs = torch.log_softmax(logits, dim=-1)  # (bs, max_A)

            # Sample one action per game
            probs = log_probs.exp()  # (bs, max_A)
            selected = torch.multinomial(probs, 1).squeeze(-1)  # (bs,)

        # Dispatch results
        arange_bs = torch.arange(bs, device=device)
        selected_log_probs = log_probs[arange_bs, selected]  # (bs,)

        for i, req in enumerate(batch):
            try:
                req.future.set_result(StepInfo(
                    encoded_step=req.encoded_step,
                    action_index=int(selected[i].item()),
                    log_prob=float(selected_log_probs[i].item()),
                    value=float(values[i].item()),
                ))
            except Exception as exc:
                if not req.future.done():
                    req.future.set_exception(exc)

    @property
    def stats(self) -> dict[str, int]:
        """Return coordinator statistics."""
        return {
            "batch_count": self._batch_count,
            "total_requests": self._total_requests,
            "avg_batch_size": (
                self._total_requests / self._batch_count
                if self._batch_count > 0 else 0
            ),
        }
