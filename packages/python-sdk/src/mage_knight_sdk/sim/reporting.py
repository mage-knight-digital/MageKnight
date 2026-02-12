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
    timeout_debug: dict[str, Any] | None = None
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


def _extract_fame_from_state(state: dict[str, Any]) -> dict[str, int]:
    """Extract {player_id: fame} from game state."""
    out: dict[str, int] = {}
    for p in state.get("players") or []:
        if isinstance(p, dict):
            pid = p.get("id")
            fame = p.get("fame")
            if pid is not None and isinstance(fame, (int, float)):
                out[str(pid)] = int(fame)
    return out


def _last_state_from_messages(message_log: list[MessageLogEntry]) -> dict[str, Any] | None:
    """Get the last state from message log (from last state_update)."""
    for entry in reversed(message_log):
        payload = getattr(entry, "payload", None) or {}
        if isinstance(payload, dict) and "state" in payload:
            state = payload.get("state")
            if isinstance(state, dict):
                return state
    return None


def write_run_summary(
    output_dir: str,
    run_result: RunResult,
    message_log: list[MessageLogEntry],
) -> None:
    """Append one NDJSON line for every run (all outcomes). Enables fame analysis across all runs."""
    state = _last_state_from_messages(message_log)
    fame_by_player = _extract_fame_from_state(state) if state else {}
    max_fame = max(fame_by_player.values(), default=0)
    record = {
        "seed": run_result.seed,
        "run_index": run_result.run_index,
        "outcome": run_result.outcome,
        "steps": run_result.steps,
        "game_id": run_result.game_id,
        "fame_by_player": fame_by_player,
        "max_fame": max_fame,
    }
    if run_result.reason is not None:
        record["reason"] = run_result.reason
    target = Path(output_dir) / "run_summary.ndjson"
    target.parent.mkdir(parents=True, exist_ok=True)
    with open(target, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, sort_keys=True) + "\n")


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
    if run_result.timeout_debug is not None:
        payload["timeoutDebug"] = run_result.timeout_debug
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    return str(path)
