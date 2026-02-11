from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .state_utils import draw_pile_count_for_player, player_ids_from_state


@dataclass
class StallDetector:
    no_draw_pile_change_turns: int
    last_draw_pile_by_player: dict[str, int | None] = field(default_factory=dict)
    stagnant_turns_by_player: dict[str, int] = field(default_factory=dict)
    last_action_key: str | None = None

    @classmethod
    def create(
        cls,
        *,
        no_draw_pile_change_turns: int,
    ) -> StallDetector:
        return cls(
            no_draw_pile_change_turns=max(1, no_draw_pile_change_turns),
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
        draw_pile_count = draw_pile_count_for_player(state, player_id)
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

        all_player_ids = player_ids_from_state(state)
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
