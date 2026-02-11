from __future__ import annotations

import random
from typing import Any, Protocol, runtime_checkable

from .generated_action_enumerator import CandidateAction


@runtime_checkable
class Policy(Protocol):
    """Action selection policy interface.

    Implementations receive the full game state, acting player ID,
    and pre-enumerated valid actions. The runner calls enumerate_valid_actions()
    once per step and passes the result here — policies just pick.
    """

    def choose_action(
        self,
        state: dict[str, Any],
        player_id: str,
        valid_actions: list[CandidateAction],
        rng: random.Random,
    ) -> CandidateAction | None: ...


class RandomPolicy:
    """Uniform random action selection."""

    def choose_action(
        self,
        state: dict[str, Any],
        player_id: str,
        valid_actions: list[CandidateAction],
        rng: random.Random,
    ) -> CandidateAction | None:
        if not valid_actions:
            return None
        return rng.choice(valid_actions)
