"""Runner that drives the Rust engine directly via PyO3 bindings.

Eliminates the WebSocket/HTTP overhead of the original runner.
The random policy agent simply picks a random legal action index
from the engine's enumerated action set.
"""
from __future__ import annotations

import json
import random
import time
from dataclasses import dataclass
from typing import Any

from .reporting import (
    ActionTraceEntry,
    MessageLogEntry,
    OUTCOME_ENDED,
    OUTCOME_INVARIANT_FAILURE,
    OUTCOME_MAX_STEPS,
    RunResult,
    RunSummary,
    summarize,
    write_failure_artifact,
    write_run_summary,
)


@dataclass(frozen=True)
class NativeRunResult:
    """Extended result that includes artifact data from native engine runs."""

    run_result: RunResult
    message_log: list[MessageLogEntry]
    action_trace: list[ActionTraceEntry]


def _record_frame(
    engine: Any,
    player_id: str,
    message_log: list[MessageLogEntry],
) -> None:
    """Record a state_update frame from the engine's current state."""
    events = json.loads(engine.events_json())
    state = json.loads(engine.client_state_json())
    message_log.append(
        MessageLogEntry(
            player_id=player_id,
            message_type="state_update",
            payload={"events": events, "state": state},
        )
    )


def run_native_game(
    seed: int,
    *,
    hero: str = "arythea",
    max_steps: int = 10000,
    allow_undo: bool = True,
    run_index: int = 0,
    rng: random.Random | None = None,
    record_artifact: bool = False,
    artifacts_dir: str | None = None,
    git_sha: str | None = None,
) -> RunResult | NativeRunResult:
    """Run a single game using the Rust engine with a random policy.

    Args:
        seed: RNG seed for game creation.
        hero: Hero name (e.g. "arythea", "tovak").
        max_steps: Maximum steps before declaring stall.
        allow_undo: Whether to allow undo actions.
        run_index: Index for reporting.
        rng: Random instance for action selection (seeded for reproducibility).
        record_artifact: Whether to record message_log and action_trace for
            replay artifacts. Adds overhead from JSON serialization each step.
        artifacts_dir: Directory to write artifacts to (on failure or when
            record_artifact is True). If None, artifacts are returned but not
            written to disk.
        git_sha: Optional git SHA to tag run summaries with.

    Returns:
        A RunResult (when record_artifact=False) or NativeRunResult (when True)
        with outcome, step count, and optional artifact data.
    """
    from mk_python import GameEngine

    if rng is None:
        rng = random.Random(seed)

    engine = GameEngine(seed=seed, hero=hero)
    game_id = f"native-{seed}"
    player_id = "player_0"
    step = 0

    message_log: list[MessageLogEntry] = []
    action_trace: list[ActionTraceEntry] = []

    # Record initial frame (GameStarted + TurnStarted events + initial state)
    if record_artifact:
        _record_frame(engine, player_id, message_log)

    while step < max_steps and not engine.is_game_ended():
        n = engine.legal_action_count()
        if n == 0:
            # No legal actions available but game not ended — shouldn't happen
            # with a correct engine, but handle gracefully.
            run_result = RunResult(
                run_index=run_index,
                seed=seed,
                outcome=OUTCOME_INVARIANT_FAILURE,
                steps=step,
                game_id=game_id,
                reason="No legal actions available but game not ended",
            )
            return _finalize(
                run_result, message_log, action_trace,
                record_artifact, artifacts_dir, git_sha,
            )

        # Filter out undo if disabled — undo is always the last action
        # when present (index n-1), and the engine enumerates it as such.
        if not allow_undo and n > 1:
            action_index = rng.randint(0, n - 1)
        else:
            action_index = rng.randint(0, n - 1)

        # Record action trace before applying
        if record_artifact:
            action_json = json.loads(engine.legal_action_json(action_index))
            action_trace.append(
                ActionTraceEntry(
                    step=step,
                    player_id=player_id,
                    action=action_json,
                    source="random",
                    mode="native",
                    current_player_id=player_id,
                )
            )

        try:
            engine.apply_action(action_index)
        except (ValueError, RuntimeError) as e:
            run_result = RunResult(
                run_index=run_index,
                seed=seed,
                outcome=OUTCOME_INVARIANT_FAILURE,
                steps=step,
                game_id=game_id,
                reason=f"Action apply failed: {e}",
            )
            return _finalize(
                run_result, message_log, action_trace,
                record_artifact, artifacts_dir, git_sha,
            )

        # Record frame after action
        if record_artifact:
            _record_frame(engine, player_id, message_log)

        step += 1

    if engine.is_game_ended():
        outcome = OUTCOME_ENDED
        reason = None
    else:
        outcome = OUTCOME_MAX_STEPS
        reason = f"Reached max steps ({max_steps}) without terminal state"

    run_result = RunResult(
        run_index=run_index,
        seed=seed,
        outcome=outcome,
        steps=step,
        game_id=game_id,
        reason=reason,
    )
    return _finalize(
        run_result, message_log, action_trace,
        record_artifact, artifacts_dir, git_sha,
    )


def _finalize(
    run_result: RunResult,
    message_log: list[MessageLogEntry],
    action_trace: list[ActionTraceEntry],
    record_artifact: bool,
    artifacts_dir: str | None,
    git_sha: str | None,
) -> RunResult | NativeRunResult:
    """Write artifacts if configured and return the appropriate result type."""
    if artifacts_dir is not None:
        write_run_summary(
            output_dir=artifacts_dir,
            run_result=run_result,
            message_log=message_log,
            git_sha=git_sha,
        )

        # Write failure artifacts (or all artifacts when recording)
        if run_result.outcome != OUTCOME_ENDED or record_artifact:
            artifact_path = write_failure_artifact(
                output_dir=artifacts_dir,
                run_result=run_result,
                action_trace=action_trace,
                message_log=message_log,
            )
            run_result = RunResult(
                run_index=run_result.run_index,
                seed=run_result.seed,
                outcome=run_result.outcome,
                steps=run_result.steps,
                game_id=run_result.game_id,
                reason=run_result.reason,
                failure_artifact_path=artifact_path,
            )

    if record_artifact:
        return NativeRunResult(
            run_result=run_result,
            message_log=message_log,
            action_trace=action_trace,
        )
    return run_result


def run_native_sweep(
    seeds: list[int],
    *,
    hero: str = "arythea",
    max_steps: int = 10000,
    allow_undo: bool = True,
    stop_on_failure: bool = False,
    verbose: bool = True,
    record_artifact: bool = False,
    artifacts_dir: str | None = None,
    git_sha: str | None = None,
) -> tuple[list[RunResult], RunSummary]:
    """Run multiple games sequentially using the Rust engine.

    Args:
        seeds: List of seeds to run.
        hero: Hero name.
        max_steps: Maximum steps per game.
        allow_undo: Whether to allow undo actions.
        stop_on_failure: Stop at first non-ended outcome.
        verbose: Print progress per seed.
        record_artifact: Record artifacts for each run (adds overhead).
        artifacts_dir: Directory to write artifacts and run summaries.
        git_sha: Optional git SHA for run summary tagging.

    Returns:
        (results, summary) tuple.
    """
    results: list[RunResult] = []
    t_start = time.perf_counter()

    for index, seed in enumerate(seeds):
        rng = random.Random(seed)
        result = run_native_game(
            seed,
            hero=hero,
            max_steps=max_steps,
            allow_undo=allow_undo,
            run_index=index,
            rng=rng,
            record_artifact=record_artifact,
            artifacts_dir=artifacts_dir,
            git_sha=git_sha,
        )
        # Extract RunResult from NativeRunResult if needed
        if isinstance(result, NativeRunResult):
            result = result.run_result
        results.append(result)

        if verbose:
            status = "OK" if result.outcome == OUTCOME_ENDED else "FAIL"
            reason = f" reason={result.reason}" if result.reason else ""
            print(
                f"[{index + 1}/{len(seeds)}] seed={seed} "
                f"outcome={result.outcome} steps={result.steps} "
                f"[{status}]{reason}"
            )

        if result.outcome != OUTCOME_ENDED and stop_on_failure:
            break

    summary = summarize(results)
    return results, summary
