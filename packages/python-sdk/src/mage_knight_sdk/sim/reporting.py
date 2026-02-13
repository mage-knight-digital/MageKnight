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


@dataclass
class StepTimings:
    """Accumulated wall-clock nanoseconds across all steps in a game."""

    enumerate_ns: int = 0
    sort_ns: int = 0
    policy_ns: int = 0
    server_ns: int = 0
    hooks_ns: int = 0
    overhead_ns: int = 0
    step_count: int = 0

    def total_ns(self) -> int:
        return (
            self.enumerate_ns
            + self.sort_ns
            + self.policy_ns
            + self.server_ns
            + self.hooks_ns
            + self.overhead_ns
        )

    def summary(self) -> dict[str, Any]:
        """Return human-readable summary with ms values and percentages."""
        total = self.total_ns()
        rows: dict[str, Any] = {}
        for name in ("enumerate", "sort", "policy", "server", "hooks", "overhead"):
            ns = getattr(self, f"{name}_ns")
            rows[name] = {
                "total_ms": ns / 1_000_000,
                "per_step_ms": (ns / self.step_count / 1_000_000) if self.step_count else 0,
                "pct": (ns / total * 100) if total else 0,
            }
        rows["total"] = {
            "total_ms": total / 1_000_000,
            "per_step_ms": (total / self.step_count / 1_000_000) if self.step_count else 0,
            "pct": 100.0 if total else 0,
        }
        rows["step_count"] = self.step_count
        return rows


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
    step_timings: StepTimings | None = None


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


def build_run_summary_record(
    run_result: RunResult,
    message_log: list[MessageLogEntry],
    *,
    git_sha: str | None = None,
) -> dict[str, Any]:
    """
    Build a summary record dict for a single run.

    Args:
        run_result: Result metadata from the run
        message_log: Messages received during the run
        git_sha: Optional git commit hash to tag the record with

    Returns:
        Summary record dict (ready for NDJSON serialization)
    """
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
    if git_sha is not None:
        record["git_sha"] = git_sha
    return record


def write_run_summary(
    output_dir: str,
    run_result: RunResult,
    message_log: list[MessageLogEntry],
    *,
    git_sha: str | None = None,
) -> None:
    """Append one NDJSON line for every run (all outcomes). Enables fame analysis across all runs."""
    record = build_run_summary_record(run_result, message_log, git_sha=git_sha)
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
