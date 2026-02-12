"""Tests for run_sweep CLI."""
from __future__ import annotations

import unittest

from mage_knight_sdk.cli.run_sweep import _build_seed_list


class RunSweepTest(unittest.TestCase):
    """Test run_sweep CLI seed list builder."""

    def test_random_mode_generates_seeds(self) -> None:
        """Test that --runs generates random seeds."""
        seeds = _build_seed_list(runs=10, start_seed=None, end_seed=None, count=None)
        self.assertEqual(len(seeds), 10)
        # All seeds should be non-negative integers
        for seed in seeds:
            self.assertIsInstance(seed, int)
            self.assertGreaterEqual(seed, 0)

    def test_random_mode_different_each_call(self) -> None:
        """Test that random mode generates different seeds each call."""
        seeds1 = _build_seed_list(runs=5, start_seed=None, end_seed=None, count=None)
        seeds2 = _build_seed_list(runs=5, start_seed=None, end_seed=None, count=None)
        # Extremely unlikely to be identical (probability ~1/2^155)
        self.assertNotEqual(seeds1, seeds2)

    def test_deterministic_mode_with_count(self) -> None:
        """Test --start-seed with --count."""
        seeds = _build_seed_list(runs=None, start_seed=100, end_seed=None, count=5)
        self.assertEqual(seeds, [100, 101, 102, 103, 104])

    def test_deterministic_mode_with_end_seed(self) -> None:
        """Test --start-seed with --end-seed."""
        seeds = _build_seed_list(runs=None, start_seed=100, end_seed=105, count=None)
        self.assertEqual(seeds, [100, 101, 102, 103, 104, 105])

    def test_mutually_exclusive_runs_and_start_seed(self) -> None:
        """Test that --runs cannot be combined with --start-seed."""
        with self.assertRaises(ValueError) as ctx:
            _build_seed_list(runs=10, start_seed=100, end_seed=None, count=None)
        self.assertIn("cannot be combined", str(ctx.exception))

    def test_mutually_exclusive_runs_and_count(self) -> None:
        """Test that --runs cannot be combined with --count."""
        with self.assertRaises(ValueError) as ctx:
            _build_seed_list(runs=10, start_seed=None, end_seed=None, count=5)
        self.assertIn("cannot be combined", str(ctx.exception))

    def test_requires_either_mode(self) -> None:
        """Test that at least one mode must be specified."""
        with self.assertRaises(ValueError) as ctx:
            _build_seed_list(runs=None, start_seed=None, end_seed=None, count=None)
        self.assertIn("Provide either --runs", str(ctx.exception))

    def test_deterministic_mode_requires_count_or_end_seed(self) -> None:
        """Test that --start-seed requires --count or --end-seed."""
        with self.assertRaises(ValueError) as ctx:
            _build_seed_list(runs=None, start_seed=100, end_seed=None, count=None)
        self.assertIn("provide either --end-seed or --count", str(ctx.exception))

    def test_invalid_runs_count(self) -> None:
        """Test that --runs must be >= 1."""
        with self.assertRaises(ValueError) as ctx:
            _build_seed_list(runs=0, start_seed=None, end_seed=None, count=None)
        self.assertIn("must be >= 1", str(ctx.exception))

    def test_invalid_deterministic_count(self) -> None:
        """Test that --count must be >= 1."""
        with self.assertRaises(ValueError) as ctx:
            _build_seed_list(runs=None, start_seed=100, end_seed=None, count=0)
        self.assertIn("must be >= 1", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
