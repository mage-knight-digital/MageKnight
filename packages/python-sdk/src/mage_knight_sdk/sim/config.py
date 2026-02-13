from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from mage_knight_sdk.client import MageKnightClient

from .bootstrap import BootstrapSession
from .invariants import StateInvariantTracker
from .reporting import ActionTraceEntry, MessageLogEntry, RunResult, StepTimings


@dataclass(frozen=True)
class RunnerConfig:
    bootstrap_api_base_url: str
    ws_server_url: str
    player_count: int = 2
    runs: int = 1
    max_steps: int = 250
    base_seed: int = 1
    action_timeout_seconds: float = 5.0
    artifacts_dir: str = "sim_artifacts"
    write_failure_artifacts: bool = False
    write_full_artifact: bool = False
    subscribe_lobby_on_connect: bool = False
    forced_invalid_action_step: int | None = None
    allow_undo: bool = True
    stall_detection_no_draw_pile_change_turns: int = 20
    collect_step_timings: bool = False
    git_sha: str | None = None


@dataclass
class AgentRuntime:
    session: BootstrapSession
    client: MageKnightClient
    state_tracker: StateInvariantTracker
    latest_state: dict[str, Any] | None = None
    last_events: list[Any] | None = None
    message_version: int = 0
    last_error_message: str | None = None
    invariant_error: str | None = None


@dataclass
class SimulationOutcome:
    result: RunResult
    trace: list[ActionTraceEntry]
    messages: list[MessageLogEntry]
    step_timings: StepTimings | None = None
