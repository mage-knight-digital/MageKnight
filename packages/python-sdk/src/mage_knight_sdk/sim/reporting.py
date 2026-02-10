from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


OUTCOME_ENDED = "ended"
OUTCOME_MAX_STEPS = "max_steps"
OUTCOME_DISCONNECT = "disconnect"
OUTCOME_PROTOCOL_ERROR = "protocol_error"
OUTCOME_INVARIANT_FAILURE = "invariant_failure"


@dataclass(frozen=True)
class ActionTraceEntry:
    step: int
    player_id: str
    action: dict[str, Any]
    source: str
    mode: str
    current_player_id: str


@dataclass(frozen=True)
class MessageLogEntry:
    player_id: str
    message_type: str
    payload: dict[str, Any]


@dataclass(frozen=True)
class RunResult:
    run_index: int
    seed: int
    outcome: str
    steps: int
    game_id: str
    reason: str | None = None
    failure_artifact_path: str | None = None


@dataclass(frozen=True)
class RunSummary:
    total_runs: int
    ended: int
    max_steps: int
    disconnect: int
    protocol_error: int
    invariant_failure: int


def summarize(results: list[RunResult]) -> RunSummary:
    counts = {
        OUTCOME_ENDED: 0,
        OUTCOME_MAX_STEPS: 0,
        OUTCOME_DISCONNECT: 0,
        OUTCOME_PROTOCOL_ERROR: 0,
        OUTCOME_INVARIANT_FAILURE: 0,
    }
    for result in results:
        counts[result.outcome] = counts.get(result.outcome, 0) + 1

    return RunSummary(
        total_runs=len(results),
        ended=counts[OUTCOME_ENDED],
        max_steps=counts[OUTCOME_MAX_STEPS],
        disconnect=counts[OUTCOME_DISCONNECT],
        protocol_error=counts[OUTCOME_PROTOCOL_ERROR],
        invariant_failure=counts[OUTCOME_INVARIANT_FAILURE],
    )


def write_failure_artifact(
    output_dir: str,
    run_result: RunResult,
    action_trace: list[ActionTraceEntry],
    message_log: list[MessageLogEntry],
) -> str:
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    target_dir = Path(output_dir)
    target_dir.mkdir(parents=True, exist_ok=True)

    path = target_dir / f"run_{run_result.run_index}_seed_{run_result.seed}_{timestamp}.json"
    payload = {
        "run": asdict(run_result),
        "actionTrace": [asdict(entry) for entry in action_trace],
        "messageLog": [asdict(entry) for entry in message_log],
    }
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    return str(path)
