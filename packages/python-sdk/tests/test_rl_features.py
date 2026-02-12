"""Tests for RL vocabularies, structured features, and encode_step."""
from __future__ import annotations

import unittest

from mage_knight_sdk.sim.generated_action_enumerator import CandidateAction
from mage_knight_sdk.sim.rl.features import (
    ACTION_SCALAR_DIM,
    ActionFeatures,
    EncodedStep,
    StateFeatures,
    encode_state_action,
    encode_step,
)
from mage_knight_sdk.sim.rl.vocabularies import (
    ACTION_TYPE_VOCAB,
    CARD_VOCAB,
    ENEMY_VOCAB,
    MODE_VOCAB,
    SOURCE_VOCAB,
    SITE_VOCAB,
    UNIT_VOCAB,
    Vocabulary,
    _build_vocab,
)


# ---------------------------------------------------------------------------
# Vocabulary tests
# ---------------------------------------------------------------------------


class VocabularyTest(unittest.TestCase):
    def test_build_vocab_size(self) -> None:
        vocab = _build_vocab("test", ("a", "b", "c"))
        self.assertEqual(vocab.size, 4)  # 3 + 1 for <UNK>

    def test_encode_known(self) -> None:
        vocab = _build_vocab("test", ("a", "b", "c"))
        self.assertEqual(vocab.encode("a"), 1)
        self.assertEqual(vocab.encode("b"), 2)
        self.assertEqual(vocab.encode("c"), 3)

    def test_encode_unknown_returns_zero(self) -> None:
        vocab = _build_vocab("test", ("a", "b"))
        self.assertEqual(vocab.encode("unknown_value"), 0)

    def test_contains(self) -> None:
        vocab = _build_vocab("test", ("a", "b"))
        self.assertIn("a", vocab)
        self.assertNotIn("z", vocab)


class CardVocabTest(unittest.TestCase):
    def test_known_cards(self) -> None:
        self.assertGreater(CARD_VOCAB.encode("march"), 0)
        self.assertGreater(CARD_VOCAB.encode("rage"), 0)
        self.assertGreater(CARD_VOCAB.encode("wound"), 0)
        self.assertGreater(CARD_VOCAB.encode("fireball"), 0)

    def test_unknown_card(self) -> None:
        self.assertEqual(CARD_VOCAB.encode("nonexistent_card"), 0)

    def test_size_reasonable(self) -> None:
        self.assertGreater(CARD_VOCAB.size, 100)
        self.assertLess(CARD_VOCAB.size, 200)


class UnitVocabTest(unittest.TestCase):
    def test_known_units(self) -> None:
        self.assertGreater(UNIT_VOCAB.encode("peasants"), 0)
        self.assertGreater(UNIT_VOCAB.encode("foresters"), 0)
        self.assertGreater(UNIT_VOCAB.encode("fire_mages"), 0)


class EnemyVocabTest(unittest.TestCase):
    def test_known_enemies(self) -> None:
        self.assertGreater(ENEMY_VOCAB.encode("diggers"), 0)
        self.assertGreater(ENEMY_VOCAB.encode("fire_dragon"), 0)


class ActionTypeVocabTest(unittest.TestCase):
    def test_known_action_types(self) -> None:
        self.assertGreater(ACTION_TYPE_VOCAB.encode("PLAY_CARD"), 0)
        self.assertGreater(ACTION_TYPE_VOCAB.encode("MOVE"), 0)
        self.assertGreater(ACTION_TYPE_VOCAB.encode("END_TURN"), 0)


class ModeVocabTest(unittest.TestCase):
    def test_known_modes(self) -> None:
        self.assertGreater(MODE_VOCAB.encode("normal_turn"), 0)
        self.assertGreater(MODE_VOCAB.encode("combat"), 0)


class SourceVocabTest(unittest.TestCase):
    def test_known_sources(self) -> None:
        self.assertGreater(SOURCE_VOCAB.encode("normal.play_card.basic"), 0)
        self.assertGreater(SOURCE_VOCAB.encode("normal.move"), 0)
        self.assertGreater(SOURCE_VOCAB.encode("turn.undo"), 0)


class SiteVocabTest(unittest.TestCase):
    def test_known_sites(self) -> None:
        self.assertGreater(SITE_VOCAB.encode("village"), 0)
        self.assertGreater(SITE_VOCAB.encode("dungeon"), 0)


# ---------------------------------------------------------------------------
# Build test state + candidates
# ---------------------------------------------------------------------------


def _make_state() -> dict:
    return {
        "currentPlayerId": "player-1",
        "round": 1,
        "timeOfDay": "day",
        "map": {
            "hexes": {
                "0,0": {"coord": {"q": 0, "r": 0}, "terrain": "plains"},
                "1,0": {"coord": {"q": 1, "r": 0}, "terrain": "forest",
                         "site": {"type": "village", "isConquered": False}},
            },
            "tiles": [{"revealed": True}],
        },
        "players": [
            {
                "id": "player-1",
                "fame": 12,
                "level": 2,
                "reputation": 3,
                "position": {"q": 0, "r": 0},
                "hand": [
                    {"id": "march", "name": "March"},
                    {"id": "rage", "name": "Rage"},
                    {"id": "wound", "name": "Wound"},
                ],
                "deckCount": 10,
                "discardPile": [],
                "units": [
                    {"id": "peasants", "isExhausted": False},
                ],
                "manaTokens": {"red": 1, "blue": 0, "green": 0, "white": 0},
                "crystals": {"red": 0, "blue": 0, "green": 0, "white": 0},
            },
        ],
        "validActions": {
            "mode": "normal_turn",
            "playCard": {
                "cards": [
                    {"cardId": "march", "canPlayBasic": True},
                    {"cardId": "rage", "canPlayBasic": True},
                ],
            },
        },
    }


def _make_candidates() -> list[CandidateAction]:
    return [
        CandidateAction(
            action={"type": "PLAY_CARD", "cardId": "march", "powered": False},
            source="normal.play_card.basic",
        ),
        CandidateAction(
            action={"type": "PLAY_CARD", "cardId": "rage", "powered": False},
            source="normal.play_card.basic",
        ),
        CandidateAction(
            action={"type": "END_TURN"},
            source="normal.turn.end_turn",
        ),
    ]


# ---------------------------------------------------------------------------
# encode_step tests
# ---------------------------------------------------------------------------


class EncodeStepTest(unittest.TestCase):
    def test_returns_encoded_step(self) -> None:
        state = _make_state()
        candidates = _make_candidates()
        result = encode_step(state, "player-1", candidates)
        self.assertIsInstance(result, EncodedStep)
        self.assertIsInstance(result.state, StateFeatures)
        self.assertEqual(len(result.actions), 3)

    def test_state_scalars_dimension(self) -> None:
        result = encode_step(_make_state(), "player-1", _make_candidates())
        self.assertEqual(len(result.state.scalars), 24)  # 12 state + 12 map

    def test_state_mode_id(self) -> None:
        result = encode_step(_make_state(), "player-1", _make_candidates())
        self.assertEqual(result.state.mode_id, MODE_VOCAB.encode("normal_turn"))
        self.assertGreater(result.state.mode_id, 0)

    def test_hand_card_ids(self) -> None:
        result = encode_step(_make_state(), "player-1", _make_candidates())
        self.assertEqual(len(result.state.hand_card_ids), 3)
        self.assertEqual(result.state.hand_card_ids[0], CARD_VOCAB.encode("march"))
        self.assertEqual(result.state.hand_card_ids[1], CARD_VOCAB.encode("rage"))
        self.assertEqual(result.state.hand_card_ids[2], CARD_VOCAB.encode("wound"))

    def test_unit_ids(self) -> None:
        result = encode_step(_make_state(), "player-1", _make_candidates())
        self.assertEqual(len(result.state.unit_ids), 1)
        self.assertEqual(result.state.unit_ids[0], UNIT_VOCAB.encode("peasants"))

    def test_action_features_card_id(self) -> None:
        result = encode_step(_make_state(), "player-1", _make_candidates())
        # First action: PLAY_CARD march
        self.assertEqual(result.actions[0].card_id, CARD_VOCAB.encode("march"))
        # Second action: PLAY_CARD rage
        self.assertEqual(result.actions[1].card_id, CARD_VOCAB.encode("rage"))
        # Third action: END_TURN (no cardId)
        self.assertEqual(result.actions[2].card_id, 0)

    def test_action_features_type_and_source(self) -> None:
        result = encode_step(_make_state(), "player-1", _make_candidates())
        self.assertEqual(
            result.actions[0].action_type_id,
            ACTION_TYPE_VOCAB.encode("PLAY_CARD"),
        )
        self.assertEqual(
            result.actions[0].source_id,
            SOURCE_VOCAB.encode("normal.play_card.basic"),
        )

    def test_action_scalars_dimension(self) -> None:
        result = encode_step(_make_state(), "player-1", _make_candidates())
        for af in result.actions:
            self.assertEqual(len(af.scalars), ACTION_SCALAR_DIM)

    def test_empty_candidates(self) -> None:
        result = encode_step(_make_state(), "player-1", [])
        self.assertEqual(len(result.actions), 0)
        self.assertIsInstance(result.state, StateFeatures)

    def test_missing_player(self) -> None:
        state = _make_state()
        result = encode_step(state, "nonexistent-player", _make_candidates())
        self.assertEqual(result.state.scalars, [0.0] * 24)
        self.assertEqual(result.state.hand_card_ids, [])
        self.assertEqual(result.state.unit_ids, [])


class LegacyEncodeBackwardCompatTest(unittest.TestCase):
    """Verify encode_state_action still works unchanged."""

    def test_returns_correct_length(self) -> None:
        state = _make_state()
        action = {"type": "PLAY_CARD", "cardId": "march", "powered": False}
        result = encode_state_action(state, "player-1", action, "playCard")
        from mage_knight_sdk.sim.rl.features import FEATURE_DIM
        self.assertEqual(len(result), FEATURE_DIM)

    def test_all_floats(self) -> None:
        state = _make_state()
        action = {"type": "MOVE", "target": {"q": 1, "r": 0}}
        result = encode_state_action(state, "player-1", action, "move")
        for val in result:
            self.assertIsInstance(val, float)


if __name__ == "__main__":
    unittest.main()
