from __future__ import annotations

import random
from typing import Any

from .generated_action_enumerator import CandidateAction, enumerate_valid_actions_from_state


class RandomValidActionPolicy:
    def choose_action(self, state: dict[str, Any], player_id: str, rng: random.Random) -> CandidateAction | None:
        candidates = enumerate_valid_actions(state, player_id)
        if not candidates:
            return None
        return rng.choice(candidates)


def enumerate_valid_actions(state: dict[str, Any], player_id: str) -> list[CandidateAction]:
    return enumerate_valid_actions_from_state(state, player_id)
