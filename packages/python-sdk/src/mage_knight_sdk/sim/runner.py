from __future__ import annotations

import asyncio
import json
import random
from pathlib import Path
from time import perf_counter_ns
from typing import Any, Callable

from mage_knight_sdk.client import MageKnightClient
from mage_knight_sdk.protocol_models import ErrorMessage, StateUpdateMessage

from .bootstrap import BootstrapClient, create_game, join_game
from .config import AgentRuntime, RunnerConfig, SimulationOutcome
from .diagnostics import build_timeout_diagnostics
from .hooks import RunnerHooks, StepSample
from .invariants import (
    InvariantViolation,
    StateInvariantTracker,
    assert_action_not_rejected,
    is_terminal_events,
    is_terminal_state,
)
from .policy import Policy, RandomPolicy
from .random_policy import enumerate_valid_actions
from .reporting import (
    ActionTraceEntry,
    MessageLogEntry,
    OUTCOME_DISCONNECT,
    OUTCOME_ENDED,
    OUTCOME_INVARIANT_FAILURE,
    OUTCOME_MAX_STEPS,
    OUTCOME_PROTOCOL_ERROR,
    RunResult,
    RunSummary,
    StepTimings,
    summarize,
    write_failure_artifact,
    write_run_summary,
)
from .stall_detector import StallDetector
from .state_utils import action_key, mode


async def run_simulations(
    config: RunnerConfig,
    policy: Policy | None = None,
    hooks: RunnerHooks | None = None,
    return_messages: bool = False,
    return_traces: bool = False,
) -> (
    tuple[list[RunResult], RunSummary]
    | tuple[list[RunResult], RunSummary, list[list[MessageLogEntry]]]
    | tuple[list[RunResult], RunSummary, list[list[MessageLogEntry]], list[list[ActionTraceEntry]]]
):
    """
    Run multiple simulations.

    Args:
        config: Runner configuration
        policy: Action selection policy (defaults to RandomPolicy)
        hooks: Optional hooks for step/run events
        return_messages: If True, return message logs for each run
        return_traces: If True, also return action traces (implies return_messages)

    Returns:
        If return_messages=False and return_traces=False: (results, summary)
        If return_messages=True: (results, summary, message_logs)
        If return_traces=True: (results, summary, message_logs, action_traces)
    """
    if return_traces:
        return_messages = True
    if policy is None:
        policy = RandomPolicy()
    results: list[RunResult] = []
    all_messages: list[list[MessageLogEntry]] = []
    all_traces: list[list[ActionTraceEntry]] = []
    for run_index in range(config.runs):
        run_seed = config.base_seed + run_index
        outcome = await _run_single_simulation(
            run_index=run_index,
            seed=run_seed,
            config=config,
            policy=policy,
            hooks=hooks,
        )
        results.append(outcome.result)
        if return_messages:
            all_messages.append(outcome.messages)
        if return_traces:
            all_traces.append(outcome.trace)

    summary = summarize(results)
    if return_traces:
        return results, summary, all_messages, all_traces
    if return_messages:
        return results, summary, all_messages
    return results, summary


async def _run_single_simulation(
    run_index: int,
    seed: int,
    config: RunnerConfig,
    policy: Policy,
    hooks: RunnerHooks | None = None,
    bootstrap_client: BootstrapClient | None = None,
) -> SimulationOutcome:
    rng = random.Random(seed)

    trace: list[ActionTraceEntry] = []
    messages: list[MessageLogEntry] = []
    stall_detector = StallDetector.create(
        no_draw_pile_change_turns=config.stall_detection_no_draw_pile_change_turns,
    )
    timings = StepTimings() if config.collect_step_timings else None

    if bootstrap_client is not None:
        created = bootstrap_client.create_game(player_count=config.player_count, seed=seed)
        sessions = [created]
        for _ in range(config.player_count - 1):
            sessions.append(bootstrap_client.join_game(created.game_id))
    else:
        created = create_game(config.bootstrap_api_base_url, player_count=config.player_count, seed=seed)
        sessions = [created]
        for _ in range(config.player_count - 1):
            sessions.append(join_game(config.bootstrap_api_base_url, created.game_id))

    agents: list[AgentRuntime] = []
    listeners: list[asyncio.Task[None]] = []
    state_update_event = asyncio.Event()

    try:
        for session in sessions:
            client = MageKnightClient(
                server_url=config.ws_server_url,
                game_id=session.game_id,
                player_id=session.player_id,
                session_token=session.session_token,
                subscribe_lobby_on_connect=config.subscribe_lobby_on_connect,
            )
            await client.connect()

            runtime = AgentRuntime(
                session=session,
                client=client,
                state_tracker=StateInvariantTracker(),
            )
            agents.append(runtime)
            listeners.append(
                asyncio.create_task(_listen_for_messages(runtime, state_update_event, messages))
            )

        await _wait_for_initial_states(agents, state_update_event, timeout_seconds=config.action_timeout_seconds)

        step = 0
        while step < config.max_steps:
            if timings is not None:
                _t_step_start = perf_counter_ns()
            invariant_reason = _first_invariant_error(agents)
            if invariant_reason is not None:
                return _finish_run(
                    config=config,
                    run_index=run_index,
                    seed=seed,
                    game_id=created.game_id,
                    outcome=OUTCOME_INVARIANT_FAILURE,
                    steps=step,
                    reason=invariant_reason,
                    trace=trace,
                    messages=messages,
                    hooks=hooks,
                timings=timings,
                )

            actor = _find_actor_for_next_action(agents)
            if actor is None:
                try:
                    await _wait_for_state_update_event(
                        state_update_event, timeout_seconds=config.action_timeout_seconds
                    )
                except TimeoutError:
                    timeout_reason, timeout_debug = build_timeout_diagnostics(
                        base_reason="Timed out waiting for active player update",
                        agents=agents,
                        allow_undo=config.allow_undo,
                        trace=trace,
                    )
                    return _finish_run(
                        config=config,
                        run_index=run_index,
                        seed=seed,
                        game_id=created.game_id,
                        outcome=OUTCOME_DISCONNECT,
                        steps=step,
                        reason=timeout_reason,
                        timeout_debug=timeout_debug,
                        trace=trace,
                        messages=messages,
                        hooks=hooks,
                    timings=timings,
                    )
                actor = _find_actor_for_next_action(agents)
                invariant_reason = _first_invariant_error(agents)
                if invariant_reason is not None:
                    return _finish_run(
                        config=config,
                        run_index=run_index,
                        seed=seed,
                        game_id=created.game_id,
                        outcome=OUTCOME_INVARIANT_FAILURE,
                        steps=step,
                        reason=invariant_reason,
                        trace=trace,
                        messages=messages,
                        hooks=hooks,
                    timings=timings,
                    )

            if actor is None:
                return _finish_run(
                    config=config,
                    run_index=run_index,
                    seed=seed,
                    game_id=created.game_id,
                    outcome=OUTCOME_DISCONNECT,
                    steps=step,
                    reason="No active player state available before timeout",
                    trace=trace,
                    messages=messages,
                    hooks=hooks,
                timings=timings,
                )

            state = actor.latest_state
            if state is None:
                return _finish_run(
                    config=config,
                    run_index=run_index,
                    seed=seed,
                    game_id=created.game_id,
                    outcome=OUTCOME_DISCONNECT,
                    steps=step,
                    reason=f"Missing latest state for {actor.session.player_id}",
                    trace=trace,
                    messages=messages,
                    hooks=hooks,
                timings=timings,
                )

            current_mode = mode(state)
            if timings is not None:
                _t0 = perf_counter_ns()
            all_candidates = enumerate_valid_actions(state, actor.session.player_id)
            if timings is not None:
                _d_enum = perf_counter_ns() - _t0
            else:
                _d_enum = 0

            # If UNDO is disabled, filter it out. Some intermediate snapshots can
            # briefly expose only UNDO while follow-up state updates are in flight.
            # Treat this as temporarily non-actionable instead of an invariant failure.
            if not config.allow_undo:
                non_undo_candidates = [c for c in all_candidates if c.action.get("type") != "UNDO"]
                all_candidates = non_undo_candidates

            if not all_candidates:
                try:
                    await _wait_for_state_update_event(
                        state_update_event, timeout_seconds=config.action_timeout_seconds
                    )
                except TimeoutError:
                    timeout_reason, timeout_debug = build_timeout_diagnostics(
                        base_reason=f"Timed out waiting for actionable state (mode={current_mode})",
                        agents=agents,
                        allow_undo=config.allow_undo,
                        trace=trace,
                    )
                    return _finish_run(
                        config=config,
                        run_index=run_index,
                        seed=seed,
                        game_id=created.game_id,
                        outcome=OUTCOME_DISCONNECT,
                        steps=step,
                        reason=timeout_reason,
                        timeout_debug=timeout_debug,
                        trace=trace,
                        messages=messages,
                        hooks=hooks,
                    timings=timings,
                    )
                continue

            # Sort candidates by canonical action key for reproducible choice (seed-based RNG)
            if timings is not None:
                _t0 = perf_counter_ns()
            sorted_candidates = sorted(all_candidates, key=lambda c: action_key(c.action))
            if timings is not None:
                _d_sort = perf_counter_ns() - _t0
                _t0 = perf_counter_ns()
            else:
                _d_sort = 0
            candidate = policy.choose_action(
                state=state,
                player_id=actor.session.player_id,
                valid_actions=sorted_candidates,
                rng=rng,
            )
            # Capture step info immediately after choose_action, before any await.
            # This is critical for concurrent games: the policy's last_step_info
            # would be overwritten by another game's choose_action during the await.
            captured_step_info = getattr(policy, 'last_step_info', None)
            if timings is not None:
                _d_policy = perf_counter_ns() - _t0
            else:
                _d_policy = 0
            if candidate is None:
                return _finish_run(
                    config=config,
                    run_index=run_index,
                    seed=seed,
                    game_id=created.game_id,
                    outcome=OUTCOME_INVARIANT_FAILURE,
                    steps=step,
                    reason="Policy returned None despite valid actions being available",
                    trace=trace,
                    messages=messages,
                    hooks=hooks,
                timings=timings,
                )

            candidate_keys = {action_key(entry.action) for entry in all_candidates}
            chosen_key = action_key(candidate.action)
            if chosen_key not in candidate_keys:
                return _finish_run(
                    config=config,
                    run_index=run_index,
                    seed=seed,
                    game_id=created.game_id,
                    outcome=OUTCOME_INVARIANT_FAILURE,
                    steps=step,
                    reason="Chosen action was not present in valid action snapshot",
                    trace=trace,
                    messages=messages,
                    hooks=hooks,
                timings=timings,
                )

            action_to_send = candidate.action
            if config.forced_invalid_action_step is not None and step == config.forced_invalid_action_step:
                action_to_send = {"type": "NOT_A_REAL_ACTION"}

            trace.append(
                ActionTraceEntry(
                    step=step,
                    player_id=actor.session.player_id,
                    action=action_to_send,
                    source=candidate.source,
                    mode=current_mode,
                    current_player_id=str(state.get("currentPlayerId")),
                )
            )

            if timings is not None:
                _t0 = perf_counter_ns()
            pre_version = actor.message_version
            await actor.client.send_action(action_to_send)

            try:
                await _wait_for_player_update(
                    actor,
                    pre_version=pre_version,
                    state_update_event=state_update_event,
                    timeout_seconds=config.action_timeout_seconds,
                )
            except TimeoutError:
                timeout_reason, timeout_debug = build_timeout_diagnostics(
                    base_reason=f"Timed out waiting for update after action {action_to_send['type']}",
                    agents=agents,
                    allow_undo=config.allow_undo,
                    trace=trace,
                )
                return _finish_run(
                    config=config,
                    run_index=run_index,
                    seed=seed,
                    game_id=created.game_id,
                    outcome=OUTCOME_DISCONNECT,
                    steps=step + 1,
                    reason=timeout_reason,
                    timeout_debug=timeout_debug,
                    trace=trace,
                    messages=messages,
                    hooks=hooks,
                timings=timings,
                )
            except InvariantViolation as error:
                return _finish_run(
                    config=config,
                    run_index=run_index,
                    seed=seed,
                    game_id=created.game_id,
                    outcome=OUTCOME_INVARIANT_FAILURE,
                    steps=step + 1,
                    reason=str(error),
                    trace=trace,
                    messages=messages,
                    hooks=hooks,
                    timings=timings,
                )
            if timings is not None:
                _d_server = perf_counter_ns() - _t0
            else:
                _d_server = 0

            if timings is not None:
                _t0 = perf_counter_ns()
            if hooks is not None:
                hooks.on_step(
                    StepSample(
                        run_index=run_index,
                        seed=seed,
                        step=step,
                        player_id=actor.session.player_id,
                        mode=current_mode,
                        state=state,
                        action=action_to_send,
                        source=candidate.source,
                        next_state=actor.latest_state,
                        events=list(actor.last_events or []),
                        candidate_count=len(all_candidates),
                        policy_step_info=captured_step_info,
                    )
                )
            if timings is not None:
                _d_hooks = perf_counter_ns() - _t0
            else:
                _d_hooks = 0

            if actor.last_error_message is not None:
                return _finish_run(
                    config=config,
                    run_index=run_index,
                    seed=seed,
                    game_id=created.game_id,
                    outcome=OUTCOME_PROTOCOL_ERROR,
                    steps=step + 1,
                    reason=actor.last_error_message,
                    trace=trace,
                    messages=messages,
                    hooks=hooks,
                timings=timings,
                )

            if config.forced_invalid_action_step is None:
                try:
                    assert_action_not_rejected(
                        events=actor.last_events or [],
                        action_type=str(action_to_send.get("type", "")),
                        player_id=actor.session.player_id,
                    )
                except InvariantViolation as error:
                    return _finish_run(
                        config=config,
                        run_index=run_index,
                        seed=seed,
                        game_id=created.game_id,
                        outcome=OUTCOME_INVARIANT_FAILURE,
                        steps=step + 1,
                        reason=str(error),
                        trace=trace,
                        messages=messages,
                        hooks=hooks,
                    timings=timings,
                    )

            if any(
                (agent.latest_state is not None and is_terminal_state(agent.latest_state))
                or is_terminal_events(agent.last_events or [])
                for agent in agents
            ):
                return _finish_run(
                    config=config,
                    run_index=run_index,
                    seed=seed,
                    game_id=created.game_id,
                    outcome=OUTCOME_ENDED,
                    steps=step + 1,
                    reason=None,
                    trace=trace,
                    messages=messages,
                    hooks=hooks,
                timings=timings,
                )

            actor_state = actor.latest_state
            if actor_state is not None:
                stall = stall_detector.observe(
                    step=step + 1,
                    player_id=actor.session.player_id,
                    action_key=action_key(action_to_send),
                    action_type=str(action_to_send.get("type", "")),
                    state=actor_state,
                )
                if stall is not None:
                    return _finish_run(
                        config=config,
                        run_index=run_index,
                        seed=seed,
                        game_id=created.game_id,
                        outcome=OUTCOME_MAX_STEPS,
                        steps=step + 1,
                        reason=stall["reason"],
                        timeout_debug={
                            "baseReason": stall["reason"],
                            "stall": stall["details"],
                        },
                        trace=trace,
                        messages=messages,
                        hooks=hooks,
                    timings=timings,
                    )

            if timings is not None:
                _t_step_total = perf_counter_ns() - _t_step_start
                _d_accounted = _d_enum + _d_sort + _d_policy + _d_server + _d_hooks
                timings.enumerate_ns += _d_enum
                timings.sort_ns += _d_sort
                timings.policy_ns += _d_policy
                timings.server_ns += _d_server
                timings.hooks_ns += _d_hooks
                timings.overhead_ns += _t_step_total - _d_accounted
                timings.step_count += 1

            step += 1

        max_steps_reason, max_steps_debug = build_timeout_diagnostics(
            base_reason=f"Reached max steps ({config.max_steps}) without terminal state",
            agents=agents,
            allow_undo=config.allow_undo,
            trace=trace,
        )
        return _finish_run(
            config=config,
            run_index=run_index,
            seed=seed,
            game_id=created.game_id,
            outcome=OUTCOME_MAX_STEPS,
            steps=config.max_steps,
            reason=max_steps_reason,
            trace=trace,
            messages=messages,
            timeout_debug=max_steps_debug,
            hooks=hooks,
            timings=timings,
        )
    finally:
        for task in listeners:
            task.cancel()
        await asyncio.gather(*listeners, return_exceptions=True)
        for agent in agents:
            await agent.client.close()


async def _listen_for_messages(
    runtime: AgentRuntime,
    state_update_event: asyncio.Event,
    messages: list[MessageLogEntry],
) -> None:
    async for message in runtime.client.messages():
        if isinstance(message, StateUpdateMessage):
            payload = {
                "protocolVersion": message.protocolVersion,
                "type": message.type,
                "events": message.events,
                "state": message.state,
            }
            messages.append(
                MessageLogEntry(
                    player_id=runtime.session.player_id,
                    message_type=message.type,
                    payload=payload,
                )
            )
            runtime.latest_state = message.state
            runtime.last_events = list(message.events)
            runtime.message_version += 1
            try:
                runtime.state_tracker.check_state(runtime.latest_state)
            except InvariantViolation as error:
                runtime.invariant_error = str(error)
            state_update_event.set()
        elif isinstance(message, ErrorMessage):
            payload = {
                "protocolVersion": message.protocolVersion,
                "type": message.type,
                "message": message.message,
                "errorCode": message.errorCode,
            }
            messages.append(
                MessageLogEntry(
                    player_id=runtime.session.player_id,
                    message_type=message.type,
                    payload=payload,
                )
            )
            runtime.last_error_message = f"Server error: {message.message} ({message.errorCode})"
            runtime.message_version += 1
            state_update_event.set()


async def _wait_for_initial_states(
    agents: list[AgentRuntime],
    state_update_event: asyncio.Event,
    timeout_seconds: float,
) -> None:
    while any(agent.latest_state is None for agent in agents):
        try:
            await _wait_for_state_update_event(state_update_event, timeout_seconds=timeout_seconds)
        except TimeoutError:
            client_errors = [
                f"  {a.session.player_id}: {a.client.last_error}"
                for a in agents
                if a.client.last_error is not None
            ]
            if client_errors:
                detail = "\n".join(client_errors)
                raise TimeoutError(
                    f"Timed out waiting for initial state. Client connection errors:\n{detail}"
                )
            raise


async def _wait_for_player_update(
    actor: AgentRuntime,
    pre_version: int,
    state_update_event: asyncio.Event,
    timeout_seconds: float,
) -> None:
    while actor.message_version <= pre_version:
        await _wait_for_state_update_event(state_update_event, timeout_seconds=timeout_seconds)


async def _wait_for_state_update_event(state_update_event: asyncio.Event, timeout_seconds: float) -> None:
    try:
        await asyncio.wait_for(state_update_event.wait(), timeout=timeout_seconds)
    except asyncio.TimeoutError as error:
        raise TimeoutError("Timed out waiting for state update") from error
    finally:
        state_update_event.clear()


def _find_actor_for_next_action(agents: list[AgentRuntime]) -> AgentRuntime | None:
    # Prefer whichever actor owns the global turn and has actionable choices.
    for runtime in agents:
        state = runtime.latest_state
        if state is None:
            continue
        current_player_id = state.get("currentPlayerId")
        if current_player_id == runtime.session.player_id:
            if enumerate_valid_actions(state, runtime.session.player_id):
                return runtime

    # During tactics selection and certain interstitial phases, a non-current
    # player may still need to act. Fall back to any actionable player state.
    for runtime in agents:
        state = runtime.latest_state
        if state is None:
            continue
        if enumerate_valid_actions(state, runtime.session.player_id):
            return runtime

    return None


def _first_invariant_error(agents: list[AgentRuntime]) -> str | None:
    for runtime in agents:
        if runtime.invariant_error is not None:
            return runtime.invariant_error
    return None


def _finish_run(
    config: RunnerConfig,
    run_index: int,
    seed: int,
    game_id: str,
    outcome: str,
    steps: int,
    reason: str | None,
    trace: list[ActionTraceEntry],
    messages: list[MessageLogEntry],
    timeout_debug: dict[str, Any] | None = None,
    hooks: RunnerHooks | None = None,
    timings: StepTimings | None = None,
) -> SimulationOutcome:
    run_result = RunResult(
        run_index=run_index,
        seed=seed,
        outcome=outcome,
        steps=steps,
        game_id=game_id,
        reason=reason,
        timeout_debug=timeout_debug,
        step_timings=timings,
    )

    if not config.skip_run_summary:
        write_run_summary(
            output_dir=config.artifacts_dir,
            run_result=run_result,
            message_log=messages,
            git_sha=config.git_sha,
        )

    artifact_outcomes = {
        OUTCOME_DISCONNECT,
        OUTCOME_PROTOCOL_ERROR,
        OUTCOME_INVARIANT_FAILURE,
        OUTCOME_MAX_STEPS,
    }
    write_artifact = config.write_full_artifact or (
        outcome in artifact_outcomes and config.write_failure_artifacts
    )
    artifact_path: str | None = None
    if write_artifact:
        artifact_path = write_failure_artifact(
            output_dir=config.artifacts_dir,
            run_result=run_result,
            action_trace=trace,
            message_log=messages,
        )
        run_result = RunResult(
            run_index=run_result.run_index,
            seed=run_result.seed,
            outcome=run_result.outcome,
            steps=run_result.steps,
            game_id=run_result.game_id,
            reason=run_result.reason,
            timeout_debug=run_result.timeout_debug,
            failure_artifact_path=artifact_path,
            step_timings=run_result.step_timings,
        )

    if hooks is not None:
        hooks.on_run_end(run_result, messages)

    return SimulationOutcome(result=run_result, trace=trace, messages=messages, step_timings=timings)


def run_simulations_sync(
    config: RunnerConfig,
    policy: Policy | None = None,
    hooks: RunnerHooks | None = None,
    return_messages: bool = False,
    return_traces: bool = False,
) -> (
    tuple[list[RunResult], RunSummary]
    | tuple[list[RunResult], RunSummary, list[list[MessageLogEntry]]]
    | tuple[list[RunResult], RunSummary, list[list[MessageLogEntry]], list[list[ActionTraceEntry]]]
):
    """
    Synchronous wrapper for run_simulations.

    Args:
        config: Runner configuration
        policy: Action selection policy (defaults to RandomPolicy)
        hooks: Optional hooks for step/run events
        return_messages: If True, return message logs for each run
        return_traces: If True, also return action traces (implies return_messages)

    Returns:
        If return_messages=False and return_traces=False: (results, summary)
        If return_messages=True: (results, summary, message_logs)
        If return_traces=True: (results, summary, message_logs, action_traces)
    """
    return asyncio.run(run_simulations(config, policy=policy, hooks=hooks, return_messages=return_messages, return_traces=return_traces))


# ---------------------------------------------------------------------------
# Batch runner: multiple simulations sharing one event loop
# ---------------------------------------------------------------------------

_HooksFactory = Callable[[], RunnerHooks]


async def _run_simulations_batch(
    configs: list[RunnerConfig],
    policy: Policy,
    hooks_factory: _HooksFactory | None = None,
    return_traces: bool = False,
    concurrent: bool = False,
) -> list[tuple[SimulationOutcome, RunnerHooks | None]]:
    """Run multiple simulations sharing one event loop and HTTP connection.

    When concurrent=True, simulations run via asyncio.gather, overlapping
    I/O waits with CPU work. Bootstrap stays sequential (HTTP not concurrent-safe).
    """
    if not configs:
        return []
    client = BootstrapClient(configs[0].bootstrap_api_base_url)
    try:
        # Prepare hooks and configs (sequential — fast)
        prepared: list[tuple[RunnerConfig, RunnerHooks | None]] = []
        for config in configs:
            hooks = hooks_factory() if hooks_factory else None
            prepared.append((config, hooks))

        if concurrent:
            # Launch all simulations concurrently via asyncio.gather
            tasks = [
                _run_single_simulation(
                    run_index=0,
                    seed=config.base_seed,
                    config=config,
                    policy=policy,
                    hooks=hooks,
                    bootstrap_client=client,
                )
                for config, hooks in prepared
            ]
            outcomes = await asyncio.gather(*tasks)
            return [
                (outcome, hooks)
                for outcome, (_, hooks) in zip(outcomes, prepared)
            ]
        else:
            results: list[tuple[SimulationOutcome, RunnerHooks | None]] = []
            for config, hooks in prepared:
                outcome = await _run_single_simulation(
                    run_index=0,
                    seed=config.base_seed,
                    config=config,
                    policy=policy,
                    hooks=hooks,
                    bootstrap_client=client,
                )
                results.append((outcome, hooks))
            return results
    finally:
        client.close()


def run_simulations_batch_sync(
    configs: list[RunnerConfig],
    policy: Policy,
    hooks_factory: _HooksFactory | None = None,
    return_traces: bool = False,
    concurrent: bool = False,
) -> list[tuple[SimulationOutcome, RunnerHooks | None]]:
    """Run multiple simulations in a single event loop (sync wrapper)."""
    return asyncio.run(_run_simulations_batch(
        configs, policy, hooks_factory=hooks_factory,
        return_traces=return_traces, concurrent=concurrent,
    ))


def save_summary(path: str, results: list[RunResult], summary: RunSummary) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "summary": summary.__dict__,
        "runs": [result.__dict__ for result in results],
    }
    target.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
