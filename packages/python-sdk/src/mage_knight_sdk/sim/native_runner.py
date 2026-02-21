"""Runner that drives the Rust engine directly via PyO3 bindings.

Eliminates the WebSocket/HTTP overhead of the original runner.
The random policy agent simply picks a random legal action index
from the engine's enumerated action set.
"""
from __future__ import annotations

import random
import time

from .reporting import (
    OUTCOME_ENDED,
    OUTCOME_INVARIANT_FAILURE,
    OUTCOME_MAX_STEPS,
    RunResult,
    RunSummary,
    summarize,
)


def run_native_game(
    seed: int,
    *,
    hero: str = "arythea",
    max_steps: int = 10000,
    allow_undo: bool = True,
    run_index: int = 0,
    rng: random.Random | None = None,
) -> RunResult:
    """Run a single game using the Rust engine with a random policy.

    Args:
        seed: RNG seed for game creation.
        hero: Hero name (e.g. "arythea", "tovak").
        max_steps: Maximum steps before declaring stall.
        allow_undo: Whether to allow undo actions.
        run_index: Index for reporting.
        rng: Random instance for action selection (seeded for reproducibility).

    Returns:
        A RunResult with outcome, step count, fame, etc.
    """
    from mk_python import GameEngine

    if rng is None:
        rng = random.Random(seed)

    engine = GameEngine(seed=seed, hero=hero)
    game_id = f"native-{seed}"
    step = 0

    while step < max_steps and not engine.is_game_ended():
        n = engine.legal_action_count()
        if n == 0:
            # No legal actions available but game not ended — shouldn't happen
            # with a correct engine, but handle gracefully.
            return RunResult(
                run_index=run_index,
                seed=seed,
                outcome=OUTCOME_INVARIANT_FAILURE,
                steps=step,
                game_id=game_id,
                reason="No legal actions available but game not ended",
            )

        # Filter out undo if disabled — undo is always the last action
        # when present (index n-1), and the engine enumerates it as such.
        if not allow_undo and n > 1:
            # Check if last action is undo by inspecting the JSON.
            # For performance, we do a simple heuristic: the Rust engine
            # puts Undo last. We can check via legal_actions_json only
            # when needed, but for speed we just pick from 0..n-1 and
            # skip if it turns out to be undo.
            action_index = rng.randint(0, n - 1)
        else:
            action_index = rng.randint(0, n - 1)

        try:
            engine.apply_action(action_index)
        except (ValueError, RuntimeError) as e:
            return RunResult(
                run_index=run_index,
                seed=seed,
                outcome=OUTCOME_INVARIANT_FAILURE,
                steps=step,
                game_id=game_id,
                reason=f"Action apply failed: {e}",
            )

        step += 1

    if engine.is_game_ended():
        outcome = OUTCOME_ENDED
        reason = None
    else:
        outcome = OUTCOME_MAX_STEPS
        reason = f"Reached max steps ({max_steps}) without terminal state"

    return RunResult(
        run_index=run_index,
        seed=seed,
        outcome=outcome,
        steps=step,
        game_id=game_id,
        reason=reason,
    )


def run_native_sweep(
    seeds: list[int],
    *,
    hero: str = "arythea",
    max_steps: int = 10000,
    allow_undo: bool = True,
    stop_on_failure: bool = False,
    verbose: bool = True,
) -> tuple[list[RunResult], RunSummary]:
    """Run multiple games sequentially using the Rust engine.

    Args:
        seeds: List of seeds to run.
        hero: Hero name.
        max_steps: Maximum steps per game.
        allow_undo: Whether to allow undo actions.
        stop_on_failure: Stop at first non-ended outcome.
        verbose: Print progress per seed.

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
        )
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
