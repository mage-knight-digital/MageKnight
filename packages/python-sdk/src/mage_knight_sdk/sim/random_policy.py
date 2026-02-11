from __future__ import annotations

from typing import Any

from .generated_action_enumerator import CandidateAction, enumerate_valid_actions_from_state


def enumerate_valid_actions(state: dict[str, Any], player_id: str) -> list[CandidateAction]:
    return enumerate_valid_actions_from_state(state, player_id)
