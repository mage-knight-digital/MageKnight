from __future__ import annotations

import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
SDK_SRC = REPO_ROOT / "packages/python-sdk/src"
if str(SDK_SRC) not in sys.path:
    sys.path.insert(0, str(SDK_SRC))

from mage_knight_sdk.sim.random_policy import enumerate_valid_actions


class RandomPolicyTest(unittest.TestCase):
    def test_enumerate_valid_actions_includes_explore_for_string_direction(self) -> None:
        state = {
            "players": [{"id": "player-1"}],
            "validActions": {
                "mode": "normal_turn",
                "turn": {
                    "canEndTurn": False,
                    "canAnnounceEndOfRound": False,
                    "canUndo": False,
                    "canDeclareRest": False,
                },
                "explore": {
                    "directions": [
                        {
                            "direction": "NE",
                            "fromTileCoord": {"q": 0, "r": 0},
                            "targetCoord": {"q": 1, "r": -1},
                        }
                    ]
                },
            },
        }

        actions = enumerate_valid_actions(state, "player-1")
        explore_actions = [a.action for a in actions if a.action.get("type") == "EXPLORE"]

        self.assertEqual(1, len(explore_actions))
        self.assertEqual("NE", explore_actions[0]["direction"])

    def test_enumerate_valid_actions_includes_midnight_meditation_decision(self) -> None:
        state = {
            "players": [{"id": "player-1"}],
            "validActions": {
                "mode": "pending_tactic_decision",
                "tacticDecision": {
                    "type": "midnight_meditation",
                    "availableCardIds": ["march", "swiftness"],
                    "maxCards": 2,
                },
            },
        }

        actions = enumerate_valid_actions(state, "player-1")
        tactic_actions = [a.action for a in actions if a.action.get("type") == "RESOLVE_TACTIC_DECISION"]

        self.assertEqual(1, len(tactic_actions))
        self.assertEqual(
            {
                "type": "RESOLVE_TACTIC_DECISION",
                "decision": {"type": "midnight_meditation", "cardIds": []},
            },
            tactic_actions[0],
        )

    def test_enumerate_valid_actions_includes_complete_rest(self) -> None:
        state = {
            "players": [{"id": "player-1"}],
            "validActions": {
                "mode": "normal_turn",
                "turn": {
                    "canEndTurn": False,
                    "canAnnounceEndOfRound": False,
                    "canUndo": True,
                    "canDeclareRest": False,
                    "canCompleteRest": True,
                    "restDiscard": {
                        "allowEmptyDiscard": False,
                        "discardableCardIds": ["march"],
                        "restType": "standard",
                    },
                },
            },
        }

        actions = enumerate_valid_actions(state, "player-1")
        complete_rest_actions = [a.action for a in actions if a.action.get("type") == "COMPLETE_REST"]

        self.assertEqual(1, len(complete_rest_actions))
        self.assertEqual(["march"], complete_rest_actions[0]["discardCardIds"])

    def test_enumerate_valid_actions_complete_rest_standard_picks_non_wound(self) -> None:
        state = {
            "players": [{"id": "player-1"}],
            "validActions": {
                "mode": "normal_turn",
                "turn": {
                    "canEndTurn": False,
                    "canAnnounceEndOfRound": False,
                    "canUndo": True,
                    "canDeclareRest": False,
                    "canCompleteRest": True,
                    "restDiscard": {
                        "allowEmptyDiscard": False,
                        "discardableCardIds": ["wound", "rage"],
                        "restType": "standard",
                    },
                },
            },
        }

        actions = enumerate_valid_actions(state, "player-1")
        complete_rest_actions = [a.action for a in actions if a.action.get("type") == "COMPLETE_REST"]

        self.assertEqual(1, len(complete_rest_actions))
        self.assertEqual(["rage"], complete_rest_actions[0]["discardCardIds"])

    def test_enumerate_valid_actions_reroll_uses_required_first_dice_ids(self) -> None:
        state = {
            "players": [{"id": "player-1"}],
            "source": {
                "dice": [
                    {"id": "die_0", "color": "blue", "isDepleted": False},
                    {"id": "die_1", "color": "gold", "isDepleted": True},
                    {"id": "die_2", "color": "white", "isDepleted": False},
                ]
            },
            "validActions": {
                "mode": "normal_turn",
                "turn": {
                    "canEndTurn": False,
                    "canAnnounceEndOfRound": False,
                    "canUndo": False,
                    "canDeclareRest": False,
                },
                "tacticEffects": {
                    "canRerollSourceDice": {
                        "availableDiceIds": ["die_0", "die_1", "die_2"],
                        "requiredFirstDiceIds": ["die_1"],
                        "maxDice": 2,
                        "mustPickDepletedFirst": True,
                    }
                },
            },
        }

        actions = enumerate_valid_actions(state, "player-1")
        reroll_actions = [a.action for a in actions if a.action.get("type") == "REROLL_SOURCE_DICE"]

        self.assertEqual(1, len(reroll_actions))
        self.assertEqual(["die_1"], reroll_actions[0]["dieIds"])

    def test_enumerate_valid_actions_reroll_fallback_uses_depleted_when_required(self) -> None:
        state = {
            "players": [{"id": "player-1"}],
            "source": {
                "dice": [
                    {"id": "die_0", "color": "blue", "isDepleted": False},
                    {"id": "die_1", "color": "gold", "isDepleted": True},
                    {"id": "die_2", "color": "white", "isDepleted": False},
                ]
            },
            "validActions": {
                "mode": "normal_turn",
                "turn": {
                    "canEndTurn": False,
                    "canAnnounceEndOfRound": False,
                    "canUndo": False,
                    "canDeclareRest": False,
                },
                "tacticEffects": {
                    "canRerollSourceDice": {
                        "availableDiceIds": ["die_0", "die_1", "die_2"],
                        "maxDice": 2,
                        "mustPickDepletedFirst": True,
                    }
                },
            },
        }

        actions = enumerate_valid_actions(state, "player-1")
        reroll_actions = [a.action for a in actions if a.action.get("type") == "REROLL_SOURCE_DICE"]

        self.assertEqual(1, len(reroll_actions))
        self.assertEqual(["die_1"], reroll_actions[0]["dieIds"])

    def test_enumerate_valid_actions_includes_pending_tactic_decision_in_normal_turn(self) -> None:
        state = {
            "players": [{"id": "player-1"}],
            "validActions": {
                "mode": "normal_turn",
                "turn": {
                    "canEndTurn": False,
                    "canAnnounceEndOfRound": False,
                    "canUndo": False,
                    "canDeclareRest": False,
                },
                "tacticEffects": {
                    "pendingDecision": {
                        "type": "midnight_meditation",
                        "availableCardIds": [],
                        "maxCards": 5,
                    }
                },
            },
        }

        actions = enumerate_valid_actions(state, "player-1")
        tactic_actions = [a.action for a in actions if a.action.get("type") == "RESOLVE_TACTIC_DECISION"]

        self.assertEqual(1, len(tactic_actions))
        self.assertEqual(
            {
                "type": "RESOLVE_TACTIC_DECISION",
                "decision": {"type": "midnight_meditation", "cardIds": []},
            },
            tactic_actions[0],
        )


if __name__ == "__main__":
    unittest.main()
