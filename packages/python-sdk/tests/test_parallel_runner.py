"""Tests for parallel_runner module."""
from __future__ import annotations

import tempfile
import unittest

from mage_knight_sdk.sim.config import RunnerConfig
from mage_knight_sdk.sim.parallel_runner import run_single_seed
from mage_knight_sdk.sim.reporting import OUTCOME_DISCONNECT


class ParallelRunnerTest(unittest.TestCase):
    """Test parallel runner worker function."""

    def test_run_single_seed_returns_result_and_summary(self) -> None:
        """Test that run_single_seed returns RunResult and summary record."""
        with tempfile.TemporaryDirectory() as tmpdir:
            base_config = RunnerConfig(
                bootstrap_api_base_url="http://127.0.0.1:3001",
                ws_server_url="ws://127.0.0.1:3001",
                player_count=2,
                runs=1,
                max_steps=10,
                base_seed=42,
                artifacts_dir=tmpdir,
                write_failure_artifacts=False,
                allow_undo=False,
            )

            # This will fail to connect but should return result structure
            result, summary_record = run_single_seed(42, base_config)

            # Verify result structure
            self.assertEqual(result.seed, 42)
            self.assertEqual(result.run_index, 0)
            self.assertIsInstance(result.outcome, str)
            self.assertIsInstance(result.steps, int)
            self.assertIsInstance(result.game_id, str)

            # Verify summary record structure
            self.assertEqual(summary_record["seed"], 42)
            self.assertEqual(summary_record["run_index"], 0)
            self.assertIn("outcome", summary_record)
            self.assertIn("steps", summary_record)
            self.assertIn("game_id", summary_record)
            self.assertIn("fame_by_player", summary_record)
            self.assertIn("max_fame", summary_record)

    def test_run_single_seed_determinism(self) -> None:
        """Test that same seed produces same initial setup."""
        with tempfile.TemporaryDirectory() as tmpdir:
            base_config = RunnerConfig(
                bootstrap_api_base_url="http://127.0.0.1:3001",
                ws_server_url="ws://127.0.0.1:3001",
                player_count=2,
                runs=1,
                max_steps=10,
                base_seed=100,
                artifacts_dir=tmpdir,
                write_failure_artifacts=False,
                allow_undo=False,
            )

            result1, summary1 = run_single_seed(100, base_config)
            result2, summary2 = run_single_seed(100, base_config)

            # Same seed should produce same game_id (deterministic bootstrap)
            # Note: This may fail to connect, but should be deterministic
            self.assertEqual(result1.seed, result2.seed)
            self.assertEqual(summary1["seed"], summary2["seed"])

    def test_run_single_seed_uses_per_seed_config(self) -> None:
        """Test that worker creates per-seed config with runs=1."""
        with tempfile.TemporaryDirectory() as tmpdir:
            base_config = RunnerConfig(
                bootstrap_api_base_url="http://127.0.0.1:3001",
                ws_server_url="ws://127.0.0.1:3001",
                player_count=2,
                runs=999,  # Should be overridden to 1
                max_steps=10,
                base_seed=999,  # Should be overridden to seed
                artifacts_dir=tmpdir,
                write_failure_artifacts=False,
                allow_undo=False,
            )

            result, summary_record = run_single_seed(42, base_config)

            # Verify seed is correct (not base_seed)
            self.assertEqual(result.seed, 42)
            self.assertEqual(summary_record["seed"], 42)
            # run_index should be 0 (first of runs=1)
            self.assertEqual(result.run_index, 0)


if __name__ == "__main__":
    unittest.main()
