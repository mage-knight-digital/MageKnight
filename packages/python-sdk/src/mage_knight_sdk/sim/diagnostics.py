from __future__ import annotations

from typing import Any

from .config import AgentRuntime
from .random_policy import enumerate_valid_actions
from .reporting import ActionTraceEntry
from .state_utils import mode


def build_timeout_diagnostics(
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

    m = mode(state)
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
        "mode": m,
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
