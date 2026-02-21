"""Tests for the native Rust engine runner."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
SDK_SRC = REPO_ROOT / "packages/python-sdk/src"
if str(SDK_SRC) not in sys.path:
    sys.path.insert(0, str(SDK_SRC))

from mage_knight_sdk.sim.native_runner import run_native_game, run_native_sweep
from mage_knight_sdk.sim.reporting import OUTCOME_ENDED


class TestGameEngine(unittest.TestCase):
    """Test the mk_python.GameEngine class directly."""

    def test_create_engine(self) -> None:
        from mk_python import GameEngine
        engine = GameEngine(seed=42, hero="arythea")
        self.assertFalse(engine.is_game_ended())
        self.assertGreater(engine.legal_action_count(), 0)

    def test_apply_action(self) -> None:
        from mk_python import GameEngine
        engine = GameEngine(seed=42, hero="arythea")
        initial_count = engine.legal_action_count()
        engine.apply_action(0)
        self.assertEqual(engine.step_count(), 1)

    def test_game_completes(self) -> None:
        from mk_python import GameEngine
        import random
        engine = GameEngine(seed=42, hero="arythea")
        rng = random.Random(42)
        steps = 0
        while steps < 10000 and not engine.is_game_ended():
            n = engine.legal_action_count()
            engine.apply_action(rng.randint(0, n - 1))
            steps += 1
        self.assertTrue(engine.is_game_ended())

    def test_all_heroes(self) -> None:
        from mk_python import GameEngine
        for hero in ("arythea", "tovak", "goldyx", "norowas", "wolfhawk", "krang", "braevalar"):
            engine = GameEngine(seed=1, hero=hero)
            self.assertFalse(engine.is_game_ended())
            self.assertGreater(engine.legal_action_count(), 0)

    def test_invalid_hero_raises(self) -> None:
        from mk_python import GameEngine
        with self.assertRaises(ValueError):
            GameEngine(seed=1, hero="nonexistent")

    def test_action_out_of_range_raises(self) -> None:
        from mk_python import GameEngine
        engine = GameEngine(seed=42)
        with self.assertRaises(ValueError):
            engine.apply_action(9999)

    def test_repr(self) -> None:
        from mk_python import GameEngine
        engine = GameEngine(seed=42)
        r = repr(engine)
        self.assertIn("GameEngine", r)
        self.assertIn("round=", r)

    def test_client_state_json(self) -> None:
        from mk_python import GameEngine
        import json
        engine = GameEngine(seed=42)
        state_json = engine.client_state_json()
        state = json.loads(state_json)
        self.assertIn("players", state)
        self.assertIn("round", state)

    def test_legal_actions_json(self) -> None:
        from mk_python import GameEngine
        import json
        engine = GameEngine(seed=42)
        actions_json = engine.legal_actions_json()
        actions = json.loads(actions_json)
        self.assertIsInstance(actions, list)
        self.assertGreater(len(actions), 0)


class TestNativeRunner(unittest.TestCase):
    """Test the Python-level native runner."""

    def test_single_game(self) -> None:
        result = run_native_game(42, max_steps=10000)
        self.assertEqual(result.outcome, OUTCOME_ENDED)
        self.assertGreater(result.steps, 0)

    def test_sweep(self) -> None:
        seeds = list(range(1, 11))
        results, summary = run_native_sweep(seeds, max_steps=10000, verbose=False)
        self.assertEqual(len(results), 10)
        self.assertEqual(summary.total_runs, 10)
        self.assertEqual(summary.ended, 10)

    def test_reproducible(self) -> None:
        r1 = run_native_game(42, max_steps=10000)
        r2 = run_native_game(42, max_steps=10000)
        self.assertEqual(r1.steps, r2.steps)
        self.assertEqual(r1.outcome, r2.outcome)


if __name__ == "__main__":
    unittest.main()
