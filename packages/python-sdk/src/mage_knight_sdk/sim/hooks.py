from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol, runtime_checkable

from .reporting import MessageLogEntry, RunResult


@dataclass(frozen=True)
class StepSample:
    run_index: int
    seed: int
    step: int
    player_id: str
    mode: str
    state: dict[str, Any]
    action: dict[str, Any]
    source: str
    next_state: dict[str, Any] | None
    events: list[Any]
    candidate_count: int
    policy_step_info: Any | None = None


@runtime_checkable
class RunnerHooks(Protocol):
    def on_step(self, sample: StepSample) -> None: ...

    def on_run_end(self, result: RunResult, messages: list[MessageLogEntry]) -> None: ...
