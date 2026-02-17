"""Tests for RL vocabularies, structured features, and encode_step."""
from __future__ import annotations

import unittest

from mage_knight_sdk.sim.generated_action_enumerator import CandidateAction
from mage_knight_sdk.sim.rl.features import (
    ACTION_SCALAR_DIM,
    COMBAT_ENEMY_SCALAR_DIM,
    MAP_ENEMY_SCALAR_DIM,
    SITE_SCALAR_DIM,
    STATE_SCALAR_DIM,
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
    SITE_VOCAB,
    SKILL_VOCAB,
    SOURCE_VOCAB,
    TERRAIN_VOCAB,
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


class TerrainVocabTest(unittest.TestCase):
    def test_known_terrains(self) -> None:
        self.assertGreater(TERRAIN_VOCAB.encode("plains"), 0)
        self.assertGreater(TERRAIN_VOCAB.encode("forest"), 0)
        self.assertGreater(TERRAIN_VOCAB.encode("mountain"), 0)
        self.assertGreater(TERRAIN_VOCAB.encode("ocean"), 0)

    def test_size(self) -> None:
        self.assertEqual(TERRAIN_VOCAB.size, 10)  # 9 terrains + UNK


class SkillVocabTest(unittest.TestCase):
    def test_known_skills(self) -> None:
        self.assertGreater(SKILL_VOCAB.encode("arythea_dark_paths"), 0)
        self.assertGreater(SKILL_VOCAB.encode("tovak_double_time"), 0)
        self.assertGreater(SKILL_VOCAB.encode("braevalar_shapeshift"), 0)

    def test_size(self) -> None:
        self.assertEqual(SKILL_VOCAB.size, 71)  # 70 skills + UNK


# ---------------------------------------------------------------------------
# Build test state + candidates
# ---------------------------------------------------------------------------


def _make_state() -> dict:
    return {
        "currentPlayerId": "player-1",
        "round": 2,
        "timeOfDay": "day",
        "endOfRoundAnnounced": False,
        "manaSource": {
            "dice": [
                {"color": "red"},
                {"color": "blue"},
                {"color": "green"},
            ],
        },
        "map": {
            "hexes": {
                "0,0": {
                    "coord": {"q": 0, "r": 0},
                    "terrain": "plains",
                },
                "1,0": {
                    "coord": {"q": 1, "r": 0},
                    "terrain": "forest",
                    "site": {"type": "village", "isConquered": False},
                    "enemies": [
                        {"color": "green", "isRevealed": True, "tokenId": "diggers"},
                    ],
                },
                "0,-1": {
                    "coord": {"q": 0, "r": -1},
                    "terrain": "hills",
                },
                "0,1": {
                    "coord": {"q": 0, "r": 1},
                    "terrain": "mountain",
                    "site": {"type": "dungeon", "isConquered": True},
                },
                "-1,0": {
                    "coord": {"q": -1, "r": 0},
                    "terrain": "swamp",
                    "rampagingEnemies": ["wolf_riders"],
                },
                "2,0": {
                    "coord": {"q": 2, "r": 0},
                    "terrain": "desert",
                    "site": {"type": "mage_tower", "isConquered": False},
                },
            },
            "tiles": [{"revealed": True}, {"revealed": True}],
        },
        "players": [
            {
                "id": "player-1",
                "fame": 12,
                "level": 2,
                "reputation": 3,
                "armor": 2,
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
                "manaTokens": {"red": 1, "blue": 0, "green": 0, "white": 0, "gold": 0, "black": 0},
                "crystals": {"red": 0, "blue": 1, "green": 0, "white": 0},
                "movePoints": 3,
                "influencePoints": 0,
                "healingPoints": 0,
                "hasMovedThisTurn": True,
                "hasTakenActionThisTurn": False,
                "skills": [
                    {"id": "arythea_dark_paths"},
                    {"id": "arythea_burning_power"},
                ],
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
        self.assertEqual(len(result.state.scalars), STATE_SCALAR_DIM)

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

    def test_terrain_id(self) -> None:
        result = encode_step(_make_state(), "player-1", _make_candidates())
        self.assertEqual(result.state.current_terrain_id, TERRAIN_VOCAB.encode("plains"))
        self.assertGreater(result.state.current_terrain_id, 0)

    def test_site_type_id_no_site(self) -> None:
        """Player at 0,0 which has no site → site_type_id = 0."""
        result = encode_step(_make_state(), "player-1", _make_candidates())
        self.assertEqual(result.state.current_site_type_id, 0)

    def test_site_type_id_with_site(self) -> None:
        """Move player to a hex with a site."""
        state = _make_state()
        state["players"][0]["position"] = {"q": 1, "r": 0}
        result = encode_step(state, "player-1", _make_candidates())
        self.assertEqual(result.state.current_site_type_id, SITE_VOCAB.encode("village"))

    def test_skill_ids(self) -> None:
        result = encode_step(_make_state(), "player-1", _make_candidates())
        self.assertEqual(len(result.state.skill_ids), 2)
        self.assertEqual(result.state.skill_ids[0], SKILL_VOCAB.encode("arythea_dark_paths"))
        self.assertEqual(result.state.skill_ids[1], SKILL_VOCAB.encode("arythea_burning_power"))

    def test_combat_enemy_ids_no_combat(self) -> None:
        result = encode_step(_make_state(), "player-1", _make_candidates())
        self.assertEqual(result.state.combat_enemy_ids, [])

    def test_combat_enemy_ids_in_combat(self) -> None:
        state = _make_state()
        state["combat"] = {
            "phase": "ranged_siege",
            "isFortified": False,
            "enemies": [
                {"id": "diggers", "instanceId": "enemy_0", "armor": 3, "attack": 2},
                {"id": "prowlers", "instanceId": "enemy_1", "armor": 2, "attack": 3},
            ],
        }
        result = encode_step(state, "player-1", _make_candidates())
        self.assertEqual(len(result.state.combat_enemy_ids), 2)
        self.assertEqual(result.state.combat_enemy_ids[0], ENEMY_VOCAB.encode("diggers"))
        self.assertEqual(result.state.combat_enemy_ids[1], ENEMY_VOCAB.encode("prowlers"))
        # Per-enemy scalars should have COMBAT_ENEMY_SCALAR_DIM floats
        self.assertEqual(len(result.state.combat_enemy_scalars), 2)
        for scalars in result.state.combat_enemy_scalars:
            self.assertEqual(len(scalars), COMBAT_ENEMY_SCALAR_DIM)

    def test_visible_sites(self) -> None:
        result = encode_step(_make_state(), "player-1", _make_candidates())
        # 3 sites: village at (1,0), dungeon at (0,1), mage_tower at (2,0)
        self.assertEqual(len(result.state.visible_site_ids), 3)
        self.assertEqual(len(result.state.visible_site_scalars), 3)
        for scalars in result.state.visible_site_scalars:
            self.assertEqual(len(scalars), SITE_SCALAR_DIM)

    def test_map_enemies(self) -> None:
        result = encode_step(_make_state(), "player-1", _make_candidates())
        # 2 map enemies: diggers at (1,0), wolf_riders rampaging at (-1,0)
        self.assertEqual(len(result.state.map_enemy_ids), 2)
        self.assertEqual(len(result.state.map_enemy_scalars), 2)
        for scalars in result.state.map_enemy_scalars:
            self.assertEqual(len(scalars), MAP_ENEMY_SCALAR_DIM)

    def test_empty_map(self) -> None:
        """No sites and no enemies → empty pools."""
        state = _make_state()
        state["map"]["hexes"] = {
            "0,0": {"coord": {"q": 0, "r": 0}, "terrain": "plains"},
        }
        result = encode_step(state, "player-1", _make_candidates())
        self.assertEqual(result.state.visible_site_ids, [])
        self.assertEqual(result.state.visible_site_scalars, [])
        self.assertEqual(result.state.map_enemy_ids, [])
        self.assertEqual(result.state.map_enemy_scalars, [])

    def test_action_features_card_id(self) -> None:
        result = encode_step(_make_state(), "player-1", _make_candidates())
        self.assertEqual(result.actions[0].card_id, CARD_VOCAB.encode("march"))
        self.assertEqual(result.actions[1].card_id, CARD_VOCAB.encode("rage"))
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
        self.assertEqual(result.state.scalars, [0.0] * STATE_SCALAR_DIM)
        self.assertEqual(result.state.hand_card_ids, [])
        self.assertEqual(result.state.unit_ids, [])
        self.assertEqual(result.state.current_terrain_id, 0)
        self.assertEqual(result.state.current_site_type_id, 0)
        self.assertEqual(result.state.combat_enemy_ids, [])
        self.assertEqual(result.state.skill_ids, [])
        self.assertEqual(result.state.visible_site_ids, [])
        self.assertEqual(result.state.visible_site_scalars, [])
        self.assertEqual(result.state.map_enemy_ids, [])
        self.assertEqual(result.state.map_enemy_scalars, [])

    def test_mana_source_features(self) -> None:
        """Verify mana source dice are captured in scalars."""
        result = encode_step(_make_state(), "player-1", _make_candidates())
        # Last 6 scalars are mana source features
        mana_source = result.state.scalars[-6:]
        # available_dice_count: 3/10 = 0.3
        self.assertAlmostEqual(mana_source[0], 0.3, places=4)
        # dice_has_red, blue, green = 1.0; white, gold = 0.0
        self.assertEqual(mana_source[1], 1.0)  # red
        self.assertEqual(mana_source[2], 1.0)  # blue
        self.assertEqual(mana_source[3], 1.0)  # green
        self.assertEqual(mana_source[4], 0.0)  # white
        self.assertEqual(mana_source[5], 0.0)  # gold

    def test_map_enemies_unrevealed(self) -> None:
        """Unrevealed enemy: color one-hot set, enemy_id=0, is_revealed=0."""
        state = _make_state()
        state["map"]["hexes"] = {
            "0,0": {"coord": {"q": 0, "r": 0}, "terrain": "plains"},
            "1,0": {
                "coord": {"q": 1, "r": 0},
                "terrain": "forest",
                "enemies": [
                    {"color": "brown", "isRevealed": False},
                ],
            },
        }
        result = encode_step(state, "player-1", _make_candidates())
        self.assertEqual(len(result.state.map_enemy_ids), 1)
        self.assertEqual(result.state.map_enemy_ids[0], 0)  # UNK — no tokenId
        scalars = result.state.map_enemy_scalars[0]
        # color one-hot: brown is index 2
        self.assertEqual(scalars[0], 0.0)  # green
        self.assertEqual(scalars[1], 0.0)  # gray
        self.assertEqual(scalars[2], 1.0)  # brown
        self.assertEqual(scalars[3], 0.0)  # violet
        self.assertEqual(scalars[4], 0.0)  # red
        self.assertEqual(scalars[5], 0.0)  # white
        self.assertEqual(scalars[9], 0.0)  # is_revealed = False
        self.assertEqual(scalars[10], 0.0)  # is_rampaging = False

    def test_map_enemies_revealed(self) -> None:
        """Revealed enemy: correct enemy_id + color one-hot."""
        state = _make_state()
        state["map"]["hexes"] = {
            "0,0": {"coord": {"q": 0, "r": 0}, "terrain": "plains"},
            "1,0": {
                "coord": {"q": 1, "r": 0},
                "terrain": "forest",
                "enemies": [
                    {"color": "green", "isRevealed": True, "tokenId": "diggers"},
                ],
            },
        }
        result = encode_step(state, "player-1", _make_candidates())
        self.assertEqual(len(result.state.map_enemy_ids), 1)
        self.assertEqual(result.state.map_enemy_ids[0], ENEMY_VOCAB.encode("diggers"))
        self.assertGreater(result.state.map_enemy_ids[0], 0)
        scalars = result.state.map_enemy_scalars[0]
        # color one-hot: green is index 0
        self.assertEqual(scalars[0], 1.0)  # green
        self.assertEqual(scalars[1], 0.0)  # gray
        self.assertEqual(scalars[9], 1.0)  # is_revealed = True
        self.assertEqual(scalars[10], 0.0)  # is_rampaging = False

    def test_map_enemies_rampaging(self) -> None:
        """Rampaging enemy: enemy_id from string, is_rampaging=1, color all-zeros."""
        state = _make_state()
        state["map"]["hexes"] = {
            "0,0": {"coord": {"q": 0, "r": 0}, "terrain": "plains"},
            "-1,0": {
                "coord": {"q": -1, "r": 0},
                "terrain": "swamp",
                "rampagingEnemies": ["wolf_riders"],
            },
        }
        result = encode_step(state, "player-1", _make_candidates())
        self.assertEqual(len(result.state.map_enemy_ids), 1)
        self.assertEqual(result.state.map_enemy_ids[0], ENEMY_VOCAB.encode("wolf_riders"))
        scalars = result.state.map_enemy_scalars[0]
        # color one-hot: all zeros for rampaging
        for i in range(6):
            self.assertEqual(scalars[i], 0.0, f"color_oh[{i}] should be 0.0 for rampaging")
        self.assertEqual(scalars[9], 1.0)  # is_revealed = True (rampaging always revealed)
        self.assertEqual(scalars[10], 1.0)  # is_rampaging = True

    def test_map_enemies_empty(self) -> None:
        """No enemies on map → empty lists."""
        state = _make_state()
        state["map"]["hexes"] = {
            "0,0": {"coord": {"q": 0, "r": 0}, "terrain": "plains"},
            "1,0": {"coord": {"q": 1, "r": 0}, "terrain": "forest"},
        }
        result = encode_step(state, "player-1", _make_candidates())
        self.assertEqual(result.state.map_enemy_ids, [])
        self.assertEqual(result.state.map_enemy_scalars, [])

    def test_map_enemy_scalar_dimension(self) -> None:
        """Each map enemy has MAP_ENEMY_SCALAR_DIM scalars."""
        result = encode_step(_make_state(), "player-1", _make_candidates())
        self.assertGreater(len(result.state.map_enemy_scalars), 0)
        for scalars in result.state.map_enemy_scalars:
            self.assertEqual(len(scalars), MAP_ENEMY_SCALAR_DIM)

    def test_neighbor_features_hex_exists(self) -> None:
        """Neighbors that exist should have hex_exists = 1.0."""
        result = encode_step(_make_state(), "player-1", _make_candidates())
        # Neighbors are at indices 28-51 (after player_core(10) + resources(13) + tempo(5) +
        # combat(10) + current_hex(3) = 41, then 24 neighbor floats at indices 41-64)
        # Each neighbor has 4 features: [terrain_difficulty, has_site, has_enemies, hex_exists]
        # Direction E = (1,0) → forest with village and enemies → exists
        neighbor_start = 41  # 10 + 13 + 5 + 10 + 3
        e_neighbor = result.state.scalars[neighbor_start:neighbor_start + 4]
        self.assertGreater(e_neighbor[0], 0.0)  # terrain_difficulty > 0 (forest)
        self.assertEqual(e_neighbor[1], 1.0)    # has_site (village)
        self.assertEqual(e_neighbor[2], 1.0)    # has_enemies
        self.assertEqual(e_neighbor[3], 1.0)    # hex_exists


class CombatProgressTest(unittest.TestCase):
    """Tests for combat progress per-enemy scalars (indices 13-19)."""

    def test_combat_enemy_attack_progress(self) -> None:
        """Verify totalEffectiveDamage, canDefeat, damage_progress from validActions."""
        state = _make_state()
        state["combat"] = {
            "phase": "attack",
            "isFortified": False,
            "enemies": [
                {"id": "diggers", "instanceId": "enemy_0", "armor": 5, "attack": 3},
            ],
        }
        state["validActions"]["mode"] = "combat"
        state["validActions"]["combat"] = {
            "phase": "attack",
            "canEndPhase": True,
            "enemies": [
                {
                    "enemyInstanceId": "enemy_0",
                    "armor": 5,
                    "totalEffectiveDamage": 3,
                    "canDefeat": False,
                },
            ],
        }
        result = encode_step(state, "player-1", _make_candidates())
        scalars = result.state.combat_enemy_scalars[0]
        self.assertAlmostEqual(scalars[13], 3.0 / 20.0, places=4)  # totalEffectiveDamage / 20
        self.assertEqual(scalars[14], 0.0)  # canDefeat = False
        self.assertAlmostEqual(scalars[15], 3.0 / 5.0, places=4)  # damage_progress = 3/5

    def test_combat_enemy_attack_progress_can_defeat(self) -> None:
        """When canDefeat is True, verify the signal."""
        state = _make_state()
        state["combat"] = {
            "phase": "attack",
            "isFortified": False,
            "enemies": [
                {"id": "diggers", "instanceId": "enemy_0", "armor": 5, "attack": 3},
            ],
        }
        state["validActions"]["mode"] = "combat"
        state["validActions"]["combat"] = {
            "phase": "attack",
            "canEndPhase": True,
            "enemies": [
                {
                    "enemyInstanceId": "enemy_0",
                    "armor": 5,
                    "totalEffectiveDamage": 6,
                    "canDefeat": True,
                },
            ],
        }
        result = encode_step(state, "player-1", _make_candidates())
        scalars = result.state.combat_enemy_scalars[0]
        self.assertAlmostEqual(scalars[13], 6.0 / 20.0, places=4)  # totalEffectiveDamage / 20
        self.assertEqual(scalars[14], 1.0)  # canDefeat = True
        self.assertAlmostEqual(scalars[15], 1.0, places=4)  # damage_progress clamped to 1.0

    def test_combat_enemy_block_progress(self) -> None:
        """Verify block features from enemyBlockStates."""
        state = _make_state()
        state["combat"] = {
            "phase": "block",
            "isFortified": False,
            "enemies": [
                {"id": "diggers", "instanceId": "enemy_0", "armor": 5, "attack": 4},
            ],
        }
        state["validActions"]["mode"] = "combat"
        state["validActions"]["combat"] = {
            "phase": "block",
            "canEndPhase": True,
            "enemyBlockStates": [
                {
                    "enemyInstanceId": "enemy_0",
                    "requiredBlock": 4,
                    "effectiveBlock": 2,
                    "canBlock": False,
                },
            ],
        }
        result = encode_step(state, "player-1", _make_candidates())
        scalars = result.state.combat_enemy_scalars[0]
        self.assertAlmostEqual(scalars[16], 2.0 / 20.0, places=4)  # effectiveBlock / 20
        self.assertEqual(scalars[17], 0.0)  # canBlock = False
        self.assertAlmostEqual(scalars[18], 4.0 / 20.0, places=4)  # requiredBlock / 20
        self.assertAlmostEqual(scalars[19], 0.5, places=4)  # block_progress = 2/4

    def test_combat_multi_attack_block_aggregation(self) -> None:
        """Multi-attack enemy: sum requiredBlock/effectiveBlock, AND canBlock."""
        state = _make_state()
        state["combat"] = {
            "phase": "block",
            "isFortified": False,
            "enemies": [
                {"id": "fire_dragon", "instanceId": "enemy_0", "armor": 7, "attack": 6},
            ],
        }
        state["validActions"]["mode"] = "combat"
        state["validActions"]["combat"] = {
            "phase": "block",
            "canEndPhase": True,
            "enemyBlockStates": [
                {
                    "enemyInstanceId": "enemy_0",
                    "attackIndex": 0,
                    "requiredBlock": 6,
                    "effectiveBlock": 6,
                    "canBlock": True,
                },
                {
                    "enemyInstanceId": "enemy_0",
                    "attackIndex": 1,
                    "requiredBlock": 4,
                    "effectiveBlock": 2,
                    "canBlock": False,
                },
            ],
        }
        result = encode_step(state, "player-1", _make_candidates())
        scalars = result.state.combat_enemy_scalars[0]
        # effectiveBlock = 6 + 2 = 8
        self.assertAlmostEqual(scalars[16], 8.0 / 20.0, places=4)
        # canBlock = False (one attack not fully blocked)
        self.assertEqual(scalars[17], 0.0)
        # requiredBlock = 6 + 4 = 10
        self.assertAlmostEqual(scalars[18], 10.0 / 20.0, places=4)
        # block_progress = 8 / 10 = 0.8
        self.assertAlmostEqual(scalars[19], 0.8, places=4)

    def test_combat_progress_defaults_no_data(self) -> None:
        """All 7 new scalars default to 0.0 when no validActions combat data."""
        state = _make_state()
        state["combat"] = {
            "phase": "ranged_siege",
            "isFortified": False,
            "enemies": [
                {"id": "diggers", "instanceId": "enemy_0", "armor": 5, "attack": 3},
            ],
        }
        # No validActions.combat — just normal_turn mode
        result = encode_step(state, "player-1", _make_candidates())
        scalars = result.state.combat_enemy_scalars[0]
        # Indices 13-19 should all be 0.0
        for i in range(13, 20):
            self.assertEqual(scalars[i], 0.0, f"scalar[{i}] should be 0.0 but was {scalars[i]}")


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
