from __future__ import annotations

import asyncio
import json
import random
from pathlib import Path
from typing import Any

from mage_knight_sdk.client import MageKnightClient
from mage_knight_sdk.protocol_models import ErrorMessage, StateUpdateMessage

from .bootstrap import create_game, join_game
from .config import AgentRuntime, RunnerConfig, SimulationOutcome
from .diagnostics import build_timeout_diagnostics
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
    summarize,
    write_failure_artifact,
    write_run_summary,
)
from .stall_detector import StallDetector
from .state_utils import action_key, mode


async def run_simulations(
    config: RunnerConfig,
    policy: Policy | None = None,
) -> tuple[list[RunResult], RunSummary]:
    if policy is None:
        policy = RandomPolicy()
    results: list[RunResult] = []
    for run_index in range(config.runs):
        run_seed = config.base_seed + run_index
        outcome = await _run_single_simulation(
            run_index=run_index, seed=run_seed, config=config, policy=policy,
        )
        results.append(outcome.result)
    return results, summarize(results)


async def _run_single_simulation(
    run_index: int,
    seed: int,
    config: RunnerConfig,
    policy: Policy,
) -> SimulationOutcome:
    rng = random.Random(seed)

    trace: list[ActionTraceEntry] = []
    messages: list[MessageLogEntry] = []
    stall_detector = StallDetector.create(
        no_draw_pile_change_turns=config.stall_detection_no_draw_pile_change_turns,
    )

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
                )

            current_mode = mode(state)
            all_candidates = enumerate_valid_actions(state, actor.session.player_id)

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
                    )
                continue

            # Sort candidates by canonical action key for reproducible choice (seed-based RNG)
            sorted_candidates = sorted(all_candidates, key=lambda c: action_key(c.action))
            candidate = policy.choose_action(
                state=state,
                player_id=actor.session.player_id,
                valid_actions=sorted_candidates,
                rng=rng,
            )
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
                )

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
                    )

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
        await _wait_for_state_update_event(state_update_event, timeout_seconds=timeout_seconds)


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
) -> SimulationOutcome:
    run_result = RunResult(
        run_index=run_index,
        seed=seed,
        outcome=outcome,
        steps=steps,
        game_id=game_id,
        reason=reason,
        timeout_debug=timeout_debug,
    )

    write_run_summary(
        output_dir=config.artifacts_dir,
        run_result=run_result,
        message_log=messages,
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
        )

    return SimulationOutcome(result=run_result, trace=trace, messages=messages)


def run_simulations_sync(
    config: RunnerConfig,
    policy: Policy | None = None,
) -> tuple[list[RunResult], RunSummary]:
    return asyncio.run(run_simulations(config, policy=policy))


def save_summary(path: str, results: list[RunResult], summary: RunSummary) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "summary": summary.__dict__,
        "runs": [result.__dict__ for result in results],
    }
    target.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
