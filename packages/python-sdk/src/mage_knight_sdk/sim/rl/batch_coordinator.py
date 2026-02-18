"""Batched inference coordinator for concurrent game simulations.

When multiple games run concurrently via asyncio.gather, each game independently
calls the policy network. The BatchInferenceCoordinator collects these requests
and dispatches a single batched forward pass for the state encoder, reducing
inference time from O(N) to O(1) matmuls.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

import torch
from torch import nn

from .features import EncodedStep
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
        """Batched state encoding + per-game action scoring and sampling."""
        self._batch_count += 1
        self._total_requests += len(batch)

        net = self._network
        device = self._device
        net.train()

        steps = [req.encoded_step for req in batch]

        # Batch state encoding (the main win: B states in one matmul)
        with torch.no_grad():
            state_reprs = net.encode_state_batch(steps, device)  # (B, hidden)

        # Per-game: action encoding + scoring + sampling
        for i, req in enumerate(batch):
            try:
                with torch.no_grad():
                    action_reprs = net.encode_actions(req.encoded_step, device)
                    n = action_reprs.size(0)
                    state_broadcast = state_reprs[i].unsqueeze(0).expand(n, -1)
                    combined = torch.cat([state_broadcast, action_reprs], dim=-1)
                    logits = net.scoring_head(combined).squeeze(-1)
                    value = net.value_head(state_reprs[i]).squeeze(-1)

                    log_probs = torch.log_softmax(logits, dim=0)
                    selected = int(torch.multinomial(log_probs.exp(), 1).item())

                req.future.set_result(StepInfo(
                    encoded_step=req.encoded_step,
                    action_index=selected,
                    log_prob=float(log_probs[selected].item()),
                    value=float(value.item()),
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
