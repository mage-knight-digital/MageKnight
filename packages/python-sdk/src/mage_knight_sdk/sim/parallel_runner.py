"""
Parallel runner for sim sweeps.

Worker function for ProcessPoolExecutor-based parallelization.
"""
from __future__ import annotations

from typing import Any, Callable

from .config import RunnerConfig
from .policy import Policy, RandomPolicy
from .reporting import RunResult, build_run_summary_record
from .runner import run_simulations_sync


def run_single_seed(
    seed: int,
    base_config: RunnerConfig,
    policy_factory: Callable[[], Policy] | None = None,
    worker_id: int = 0,
    server_urls: list[tuple[str, str]] | None = None,
) -> tuple[RunResult, dict[str, Any]]:
    """
    Worker function for parallel seed execution.

    Args:
        seed: Seed for this run
        base_config: Base configuration (will be modified with seed and runs=1)
        policy_factory: Optional callable that returns a fresh Policy instance.
                       If None, uses RandomPolicy. Required for custom policies
                       to avoid pickling issues across processes.
        worker_id: Worker index (used for server selection in cluster mode)
        server_urls: Optional list of (bootstrap_url, ws_url) tuples for cluster mode.
                    If provided, worker_id is used to select the server via round-robin.

    Returns:
        (RunResult, summary_record_dict) tuple
    """
    # Select server URLs based on worker_id (round-robin for cluster mode)
    if server_urls:
        bootstrap_url, ws_url = server_urls[worker_id % len(server_urls)]
    else:
        bootstrap_url = base_config.bootstrap_api_base_url
        ws_url = base_config.ws_server_url

    # Create per-seed config with runs=1
    config = RunnerConfig(
        bootstrap_api_base_url=bootstrap_url,
        ws_server_url=ws_url,
        player_count=base_config.player_count,
        runs=1,
        max_steps=base_config.max_steps,
        base_seed=seed,
        artifacts_dir=base_config.artifacts_dir,
        write_failure_artifacts=base_config.write_failure_artifacts,
        allow_undo=base_config.allow_undo,
        action_timeout_seconds=base_config.action_timeout_seconds,
        stall_detection_no_draw_pile_change_turns=base_config.stall_detection_no_draw_pile_change_turns,
        write_full_artifact=base_config.write_full_artifact,
        subscribe_lobby_on_connect=base_config.subscribe_lobby_on_connect,
        forced_invalid_action_step=base_config.forced_invalid_action_step,
    )

    policy = policy_factory() if policy_factory is not None else RandomPolicy()

    results, _, message_logs = run_simulations_sync(config, policy=policy, return_messages=True)
    result = results[0]
    messages = message_logs[0]

    summary_record = build_run_summary_record(result, messages)

    return result, summary_record
