from __future__ import annotations

from dataclasses import dataclass
from typing import Any


INVALID_ACTION_EVENT = "INVALID_ACTION"
GAME_ENDED_EVENT = "GAME_ENDED"
PHASE_END = "end"


class InvariantViolation(RuntimeError):
    pass


@dataclass
class StateInvariantTracker:
    previous_state: dict[str, Any] | None = None

    def check_state(self, state: dict[str, Any]) -> None:
        current_player = state.get("currentPlayerId")
        turn_order = state.get("turnOrder")

        if not isinstance(turn_order, list) or not turn_order:
            raise InvariantViolation("turnOrder must be a non-empty list")

        if not isinstance(current_player, str) or current_player not in turn_order:
            raise InvariantViolation(
                f"currentPlayerId must exist in turnOrder (current={current_player!r}, turnOrder={turn_order!r})"
            )

        if len(set(turn_order)) != len(turn_order):
            raise InvariantViolation(f"turnOrder contains duplicates: {turn_order!r}")

        if self.previous_state is not None:
            previous_turn_order = self.previous_state.get("turnOrder")
            previous_current_player = self.previous_state.get("currentPlayerId")
            if isinstance(previous_turn_order, list) and previous_turn_order:
                if isinstance(previous_current_player, str) and previous_current_player in previous_turn_order:
                    if current_player not in previous_turn_order and current_player not in turn_order:
                        raise InvariantViolation(
                            "currentPlayerId changed to an unknown player across state transition"
                        )

        self.previous_state = state


def assert_action_not_rejected(events: list[Any], action_type: str, player_id: str) -> None:
    for event in events:
        if not isinstance(event, dict):
            continue
        if event.get("type") != INVALID_ACTION_EVENT:
            continue
        if event.get("playerId") == player_id and event.get("actionType") == action_type:
            reason = event.get("reason", "Unknown reason")
            raise InvariantViolation(
                f"Server rejected action {action_type} for {player_id} despite it being advertised valid: {reason}"
            )


def is_terminal_state(state: dict[str, Any]) -> bool:
    return state.get("phase") == PHASE_END


def is_terminal_events(events: list[Any]) -> bool:
    for event in events:
        if isinstance(event, dict) and event.get("type") == GAME_ENDED_EVENT:
            return True
    return False
