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
from .invariants import (
    InvariantViolation,
    StateInvariantTracker,
    assert_action_not_rejected,
    is_terminal_events,
    is_terminal_state,
)
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
    subscribe_lobby_on_connect: bool = False
    forced_invalid_action_step: int | None = None
    allow_undo: bool = True
    stall_detection_no_draw_pile_change_turns: int = 20


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


@dataclass
class _StallDetector:
    no_draw_pile_change_turns: int
    last_draw_pile_by_player: dict[str, int | None]
    stagnant_turns_by_player: dict[str, int]
    last_action_key: str | None = None

    @classmethod
    def create(
        cls,
        *,
        no_draw_pile_change_turns: int,
    ) -> "_StallDetector":
        return cls(
            no_draw_pile_change_turns=max(1, no_draw_pile_change_turns),
            last_draw_pile_by_player={},
            stagnant_turns_by_player={},
        )

    def observe(
        self,
        *,
        step: int,
        player_id: str,
        action_key: str,
        action_type: str,
        state: dict[str, Any],
    ) -> dict[str, Any] | None:
        """
        Detect stall: N consecutive END_TURN actions by same player with no draw pile change.
        We only count END_TURN (game turns), not individual actions—a single turn can have
        15+ actions (play cards, move, combat) with an unchanged deck, which is normal.
        """
        self.last_action_key = action_key
        draw_pile_count = _draw_pile_count_for_player(state, player_id)
        previous_draw_pile = self.last_draw_pile_by_player.get(player_id)
        if previous_draw_pile is None or draw_pile_count != previous_draw_pile:
            self.last_draw_pile_by_player[player_id] = draw_pile_count
            self.stagnant_turns_by_player[player_id] = 0
            return None

        if action_type != "END_TURN":
            return None

        stagnant_turns = self.stagnant_turns_by_player.get(player_id, 0) + 1
        self.stagnant_turns_by_player[player_id] = stagnant_turns
        if stagnant_turns < self.no_draw_pile_change_turns:
            return None

        all_player_ids = _player_ids_from_state(state)
        if not all_player_ids:
            return {
                "reason": "Stalled loop detected (draw pile count unchanged)",
                "details": {
                    "step": step,
                    "playerId": player_id,
                    "drawPileCount": draw_pile_count,
                    "stagnantTurns": stagnant_turns,
                    "minStagnantTurns": self.no_draw_pile_change_turns,
                    "lastActionKey": self.last_action_key,
                },
            }

        min_required = self.no_draw_pile_change_turns
        if not all(
            self.stagnant_turns_by_player.get(pid, 0) >= min_required
            for pid in all_player_ids
        ):
            return None

        return {
            "reason": "Stalled loop detected (both players: draw pile count unchanged)",
            "details": {
                "step": step,
                "playerId": player_id,
                "drawPileCount": draw_pile_count,
                "stagnantTurnsByPlayer": {
                    pid: self.stagnant_turns_by_player.get(pid, 0)
                    for pid in all_player_ids
                },
                "minStagnantTurns": self.no_draw_pile_change_turns,
                "lastActionKey": self.last_action_key,
            },
        }


async def run_simulations(config: RunnerConfig) -> tuple[list[RunResult], RunSummary]:
    results: list[RunResult] = []
    for run_index in range(config.runs):
        run_seed = config.base_seed + run_index
        outcome = await _run_single_simulation(run_index=run_index, seed=run_seed, config=config)
        results.append(outcome.result)
    return results, summarize(results)


async def _run_single_simulation(run_index: int, seed: int, config: RunnerConfig) -> SimulationOutcome:
    rng = random.Random(seed)

    trace: list[ActionTraceEntry] = []
    messages: list[MessageLogEntry] = []
    stall_detector = _StallDetector.create(
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
                    timeout_reason, timeout_debug = _build_timeout_diagnostics(
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

            mode = _mode(state)
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
                    timeout_reason, timeout_debug = _build_timeout_diagnostics(
                        base_reason=f"Timed out waiting for actionable state (mode={mode})",
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

            candidate = rng.choice(all_candidates)
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
                timeout_reason, timeout_debug = _build_timeout_diagnostics(
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
                    action_key=_action_key(action_to_send),
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

        max_steps_reason, max_steps_debug = _build_timeout_diagnostics(
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
    artifact_path: str | None = None
    if outcome in artifact_outcomes and config.write_failure_artifacts:
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


def _draw_pile_count_for_player(state: dict[str, Any], player_id: str) -> int | None:
    players = state.get("players")
    if not isinstance(players, list):
        return None
    for player in players:
        if not isinstance(player, dict):
            continue
        if player.get("id") != player_id:
            continue
        deck_count = player.get("deckCount")
        return int(deck_count) if isinstance(deck_count, int) else None
    return None


def _player_ids_from_state(state: dict[str, Any]) -> list[str]:
    """Return player ids from state, for stall detection across all players."""
    players = state.get("players")
    if not isinstance(players, list):
        return []
    ids: list[str] = []
    for player in players:
        if isinstance(player, dict):
            pid = player.get("id")
            if isinstance(pid, str):
                ids.append(pid)
    return ids


def _build_timeout_diagnostics(
    base_reason: str,
    agents: list[AgentRuntime],
    allow_undo: bool,
    trace: list[ActionTraceEntry],
) -> tuple[str, dict[str, Any]]:
    last_trace = trace[-1] if trace else None
    last_action_debug: dict[str, Any] | None = None
    if last_trace is not None:
        last_action_debug = {
            "step": last_trace.step,
            "playerId": last_trace.player_id,
            "mode": last_trace.mode,
            "actionType": str(last_trace.action.get("type")),
            "source": last_trace.source,
        }

    player_snapshots = [_runtime_timeout_snapshot(agent, allow_undo) for agent in agents]
    timeout_debug = {
        "baseReason": base_reason,
        "lastAction": last_action_debug,
        "players": player_snapshots,
    }

    if last_action_debug is None:
        last_action_fragment = "none"
    else:
        last_action_fragment = (
            f"step={last_action_debug['step']},player={last_action_debug['playerId']},"
            f"mode={last_action_debug['mode']},action={last_action_debug['actionType']}"
        )

    player_fragments = [_format_timeout_player_snapshot(snapshot) for snapshot in player_snapshots]
    players_fragment = " || ".join(player_fragments) if player_fragments else "none"
    return (
        f"{base_reason}; last_action={last_action_fragment}; players={players_fragment}",
        timeout_debug,
    )


def _runtime_timeout_snapshot(runtime: AgentRuntime, allow_undo: bool) -> dict[str, Any]:
    state = runtime.latest_state
    if state is None:
        return {
            "playerId": runtime.session.player_id,
            "state": "missing",
            "messageVersion": runtime.message_version,
            "lastError": runtime.last_error_message,
            "invariantError": runtime.invariant_error,
        }

    mode = _mode(state)
    current_player_id = state.get("currentPlayerId")
    valid_actions = state.get("validActions")
    turn = valid_actions.get("turn") if isinstance(valid_actions, dict) else None
    turn_flags = "none"
    if isinstance(turn, dict):
        turn_flags = (
            f"undo={bool(turn.get('canUndo'))},end={bool(turn.get('canEndTurn'))},"
            f"declare_rest={bool(turn.get('canDeclareRest'))},complete_rest={bool(turn.get('canCompleteRest'))},"
            f"rest={bool(turn.get('canRest'))},announce={bool(turn.get('canAnnounceEndOfRound'))}"
        )

    all_candidates = enumerate_valid_actions(state, runtime.session.player_id)
    non_undo_candidates = [c for c in all_candidates if c.action.get("type") != "UNDO"]
    effective_candidates = all_candidates if allow_undo else non_undo_candidates
    candidate_types = sorted({str(c.action.get("type", "?")) for c in effective_candidates})
    return {
        "playerId": runtime.session.player_id,
        "state": "present",
        "mode": mode,
        "currentPlayerId": current_player_id,
        "messageVersion": runtime.message_version,
        "rawActionCount": len(all_candidates),
        "effectiveActionCount": len(effective_candidates),
        "effectiveActionTypes": candidate_types,
        "turnFlags": turn_flags,
        "lastError": runtime.last_error_message,
        "invariantError": runtime.invariant_error,
    }


def _format_timeout_player_snapshot(snapshot: dict[str, Any]) -> str:
    if snapshot.get("state") == "missing":
        return (
            f"{snapshot['playerId']}:state=missing,msg_version={snapshot['messageVersion']},"
            f"last_error={snapshot.get('lastError')},invariant={snapshot.get('invariantError')}"
        )

    candidate_types = snapshot.get("effectiveActionTypes")
    candidate_preview = ",".join(candidate_types[:6]) if isinstance(candidate_types, list) and candidate_types else "none"
    return (
        f"{snapshot['playerId']}:mode={snapshot.get('mode')},current={snapshot.get('currentPlayerId')},"
        f"msg_version={snapshot.get('messageVersion')},raw_actions={snapshot.get('rawActionCount')},"
        f"effective_actions={snapshot.get('effectiveActionCount')},types={candidate_preview},"
        f"turn={snapshot.get('turnFlags')},last_error={snapshot.get('lastError')},"
        f"invariant={snapshot.get('invariantError')}"
    )


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
