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

        # Should enumerate: {march}, {swiftness}, {march,swiftness}, {} = 4 actions
        self.assertEqual(4, len(tactic_actions))
        card_id_sets = [tuple(a["decision"]["cardIds"]) for a in tactic_actions]
        self.assertIn(("march",), card_id_sets)
        self.assertIn(("swiftness",), card_id_sets)
        self.assertIn(("march", "swiftness"), card_id_sets)
        self.assertIn((), card_id_sets)  # discard nothing

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

        self.assertEqual(2, len(complete_rest_actions))
        discard_sets = [tuple(a["discardCardIds"]) for a in complete_rest_actions]
        self.assertIn(("rage",), discard_sets)  # non-wound only
        self.assertIn(("rage", "wound"), discard_sets)  # non-wound + wound

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

        # No available cards, so only the empty discard option
        self.assertEqual(1, len(tactic_actions))
        self.assertEqual(
            {
                "type": "RESOLVE_TACTIC_DECISION",
                "decision": {"type": "midnight_meditation", "cardIds": []},
            },
            tactic_actions[0],
        )


    def test_enumerate_valid_actions_includes_powered_play_for_action_card(self) -> None:
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
                "playCard": {
                    "cards": [
                        {
                            "cardId": "rage",
                            "name": "Rage",
                            "canPlayBasic": True,
                            "canPlayPowered": True,
                            "requiredMana": "red",
                            "canPlaySideways": False,
                            "basicEffectDescription": "Attack 2",
                            "poweredEffectDescription": "Attack 4",
                            "poweredManaOptions": [{"type": "die", "color": "red", "dieId": "die_0"}],
                        }
                    ]
                },
            },
        }

        actions = enumerate_valid_actions(state, "player-1")
        powered = [a.action for a in actions if a.action.get("powered") is True]

        self.assertEqual(1, len(powered))
        self.assertEqual("PLAY_CARD", powered[0]["type"])
        self.assertEqual("rage", powered[0]["cardId"])
        self.assertEqual({"type": "die", "color": "red", "dieId": "die_0"}, powered[0]["manaSource"])
        self.assertNotIn("manaSources", powered[0])

    def test_enumerate_valid_actions_includes_powered_play_for_spell(self) -> None:
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
                "playCard": {
                    "cards": [
                        {
                            "cardId": "fireball",
                            "name": "Fireball",
                            "canPlayBasic": True,
                            "canPlayPowered": True,
                            "isSpell": True,
                            "requiredMana": "red",
                            "canPlaySideways": False,
                            "basicEffectDescription": "Attack 3 Fire Ranged",
                            "poweredEffectDescription": "Attack 5 Fire Siege",
                            "poweredManaOptions": [
                                {"type": "die", "color": "black", "dieId": "die_1"},
                                {"type": "crystal", "color": "red"},
                            ],
                        }
                    ]
                },
            },
        }

        actions = enumerate_valid_actions(state, "player-1")
        powered = [a.action for a in actions if a.action.get("powered") is True]

        self.assertEqual(1, len(powered))
        self.assertEqual("PLAY_CARD", powered[0]["type"])
        self.assertEqual("fireball", powered[0]["cardId"])
        self.assertEqual(2, len(powered[0]["manaSources"]))
        self.assertNotIn("manaSource", powered[0])

    def test_enumerate_combat_includes_card_plays(self) -> None:
        """Combat mode should enumerate PLAY_CARD actions from playCard field."""
        state = {
            "players": [{"id": "player-1"}],
            "validActions": {
                "mode": "combat",
                "turn": {"canUndo": False},
                "combat": {
                    "phase": "attack",
                    "canEndPhase": True,
                },
                "playCard": {
                    "cards": [
                        {
                            "cardId": "rage",
                            "name": "Rage",
                            "canPlayBasic": True,
                            "canPlayPowered": False,
                            "canPlaySideways": True,
                            "sidewaysOptions": [{"as": "attack_1"}],
                        },
                        {
                            "cardId": "swiftness",
                            "name": "Swiftness",
                            "canPlayBasic": True,
                            "canPlayPowered": False,
                            "canPlaySideways": False,
                        },
                    ]
                },
            },
        }

        actions = enumerate_valid_actions(state, "player-1")
        play_actions = [a.action for a in actions if a.action.get("type") in ("PLAY_CARD", "PLAY_CARD_SIDEWAYS")]

        # Should have: rage basic, rage sideways, swiftness basic = 3 card plays
        self.assertGreaterEqual(len(play_actions), 3)
        basic_card_ids = [a["cardId"] for a in play_actions if a["type"] == "PLAY_CARD"]
        self.assertIn("rage", basic_card_ids)
        self.assertIn("swiftness", basic_card_ids)
        sideways_actions = [a for a in play_actions if a["type"] == "PLAY_CARD_SIDEWAYS"]
        self.assertEqual(1, len(sideways_actions))
        self.assertEqual("rage", sideways_actions[0]["cardId"])

        # End phase should also be present
        end_phase = [a.action for a in actions if a.action.get("type") == "END_COMBAT_PHASE"]
        self.assertEqual(1, len(end_phase))

    def test_enumerate_combat_includes_unit_activations(self) -> None:
        """Combat mode should enumerate ACTIVATE_UNIT actions from units field."""
        state = {
            "players": [{"id": "player-1"}],
            "validActions": {
                "mode": "combat",
                "turn": {"canUndo": False},
                "combat": {
                    "phase": "attack",
                    "canEndPhase": True,
                },
                "units": {
                    "activatable": [
                        {
                            "unitInstanceId": "unit_0",
                            "abilities": [
                                {"index": 0, "canActivate": True},
                                {"index": 1, "canActivate": False},
                            ],
                        }
                    ]
                },
            },
        }

        actions = enumerate_valid_actions(state, "player-1")
        unit_actions = [a.action for a in actions if a.action.get("type") == "ACTIVATE_UNIT"]

        self.assertEqual(1, len(unit_actions))
        self.assertEqual("unit_0", unit_actions[0]["unitInstanceId"])
        self.assertEqual(0, unit_actions[0]["abilityIndex"])

    def test_enumerate_combat_includes_skills(self) -> None:
        """Combat mode should enumerate USE_SKILL actions from skills field."""
        state = {
            "players": [{"id": "player-1"}],
            "validActions": {
                "mode": "combat",
                "turn": {"canUndo": False},
                "combat": {
                    "phase": "attack",
                    "canEndPhase": True,
                },
                "skills": {
                    "activatable": [
                        {"skillId": "battle_versatility"},
                    ]
                },
            },
        }

        actions = enumerate_valid_actions(state, "player-1")
        skill_actions = [a.action for a in actions if a.action.get("type") == "USE_SKILL"]

        self.assertEqual(1, len(skill_actions))
        self.assertEqual("battle_versatility", skill_actions[0]["skillId"])

    def test_enumerate_valid_actions_skips_powered_when_no_mana_options(self) -> None:
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
                "playCard": {
                    "cards": [
                        {
                            "cardId": "rage",
                            "name": "Rage",
                            "canPlayBasic": True,
                            "canPlayPowered": True,
                            "requiredMana": "red",
                            "canPlaySideways": False,
                            "basicEffectDescription": "Attack 2",
                            "poweredEffectDescription": "Attack 4",
                            # No poweredManaOptions — engine couldn't compute a source
                        }
                    ]
                },
            },
        }

        actions = enumerate_valid_actions(state, "player-1")
        powered = [a.action for a in actions if a.action.get("powered") is True]

        self.assertEqual(0, len(powered))


if __name__ == "__main__":
    unittest.main()
