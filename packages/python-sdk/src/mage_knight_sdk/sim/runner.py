from __future__ import annotations

import asyncio
import json
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from mage_knight_sdk.client import MageKnightClient
from mage_knight_sdk.protocol_models import ErrorMessage, StateUpdateMessage

from .bootstrap import BootstrapSession, create_game, join_game
from .invariants import InvariantViolation, StateInvariantTracker, assert_action_not_rejected, is_terminal_state
from .random_policy import CandidateAction, RandomValidActionPolicy, enumerate_valid_actions
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
)


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
    subscribe_lobby_on_connect: bool = False
    forced_invalid_action_step: int | None = None


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


async def run_simulations(config: RunnerConfig) -> tuple[list[RunResult], RunSummary]:
    results: list[RunResult] = []
    for run_index in range(config.runs):
        run_seed = config.base_seed + run_index
        outcome = await _run_single_simulation(run_index=run_index, seed=run_seed, config=config)
        results.append(outcome.result)
    return results, summarize(results)


async def _run_single_simulation(run_index: int, seed: int, config: RunnerConfig) -> SimulationOutcome:
    rng = random.Random(seed)
    policy = RandomValidActionPolicy()

    trace: list[ActionTraceEntry] = []
    messages: list[MessageLogEntry] = []

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
                    return _finish_run(
                        config=config,
                        run_index=run_index,
                        seed=seed,
                        game_id=created.game_id,
                        outcome=OUTCOME_DISCONNECT,
                        steps=step,
                        reason="Timed out waiting for active player update",
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

            mode = _mode(state)
            candidate = policy.choose_action(state, actor.session.player_id, rng)
            if candidate is None:
                try:
                    await _wait_for_state_update_event(
                        state_update_event, timeout_seconds=config.action_timeout_seconds
                    )
                except TimeoutError:
                    return _finish_run(
                        config=config,
                        run_index=run_index,
                        seed=seed,
                        game_id=created.game_id,
                        outcome=OUTCOME_DISCONNECT,
                        steps=step,
                        reason=f"Timed out waiting for actionable state (mode={mode})",
                        trace=trace,
                        messages=messages,
                    )
                continue

            all_candidates = enumerate_valid_actions(state, actor.session.player_id)
            candidate_keys = {_action_key(entry.action) for entry in all_candidates}
            chosen_key = _action_key(candidate.action)
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
                    mode=mode,
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
                return _finish_run(
                    config=config,
                    run_index=run_index,
                    seed=seed,
                    game_id=created.game_id,
                    outcome=OUTCOME_DISCONNECT,
                    steps=step + 1,
                    reason=f"Timed out waiting for update after action {action_to_send['type']}",
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

            if any(agent.latest_state is not None and is_terminal_state(agent.latest_state) for agent in agents):
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

            step += 1

        return _finish_run(
            config=config,
            run_index=run_index,
            seed=seed,
            game_id=created.game_id,
            outcome=OUTCOME_MAX_STEPS,
            steps=config.max_steps,
            reason=None,
            trace=trace,
            messages=messages,
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
) -> SimulationOutcome:
    run_result = RunResult(
        run_index=run_index,
        seed=seed,
        outcome=outcome,
        steps=steps,
        game_id=game_id,
        reason=reason,
    )

    artifact_outcomes = {
        OUTCOME_DISCONNECT,
        OUTCOME_PROTOCOL_ERROR,
        OUTCOME_INVARIANT_FAILURE,
    }
    if outcome in artifact_outcomes:
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
            failure_artifact_path=artifact_path,
        )

    return SimulationOutcome(result=run_result, trace=trace, messages=messages)


def _mode(state: dict[str, Any]) -> str:
    valid_actions = state.get("validActions")
    if not isinstance(valid_actions, dict):
        return "unknown"
    mode = valid_actions.get("mode")
    if isinstance(mode, str):
        return mode
    return "unknown"


def _action_key(action: dict[str, Any]) -> str:
    return json.dumps(action, sort_keys=True, separators=(",", ":"))


def run_simulations_sync(config: RunnerConfig) -> tuple[list[RunResult], RunSummary]:
    return asyncio.run(run_simulations(config))


def save_summary(path: str, results: list[RunResult], summary: RunSummary) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "summary": summary.__dict__,
        "runs": [result.__dict__ for result in results],
    }
    target.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
