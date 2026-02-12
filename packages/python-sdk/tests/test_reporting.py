"""Tests for reporting module."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from mage_knight_sdk.sim.reporting import (
    MessageLogEntry,
    RunResult,
    build_run_summary_record,
    write_run_summary,
)


class ReportingTest(unittest.TestCase):
    """Test reporting functions."""

    def test_build_run_summary_record_basic(self) -> None:
        """Test building summary record without state."""
        result = RunResult(
            run_index=0,
            seed=42,
            outcome="ended",
            steps=100,
            game_id="test-game",
            reason=None,
        )
        messages: list[MessageLogEntry] = []

        record = build_run_summary_record(result, messages)

        self.assertEqual(record["seed"], 42)
        self.assertEqual(record["run_index"], 0)
        self.assertEqual(record["outcome"], "ended")
        self.assertEqual(record["steps"], 100)
        self.assertEqual(record["game_id"], "test-game")
        self.assertEqual(record["fame_by_player"], {})
        self.assertEqual(record["max_fame"], 0)
        self.assertNotIn("reason", record)

    def test_build_run_summary_record_with_reason(self) -> None:
        """Test building summary record with failure reason."""
        result = RunResult(
            run_index=1,
            seed=43,
            outcome="max_steps",
            steps=10000,
            game_id="test-game-2",
            reason="Reached max steps without terminal state",
        )
        messages: list[MessageLogEntry] = []

        record = build_run_summary_record(result, messages)

        self.assertEqual(record["reason"], "Reached max steps without terminal state")

    def test_build_run_summary_record_with_fame(self) -> None:
        """Test building summary record with fame from state."""
        result = RunResult(
            run_index=0,
            seed=44,
            outcome="ended",
            steps=200,
            game_id="test-game-3",
        )
        messages = [
            MessageLogEntry(
                player_id="player1",
                message_type="state_update",
                payload={
                    "state": {
                        "players": [
                            {"id": "player1", "fame": 15},
                            {"id": "player2", "fame": 20},
                        ]
                    }
                },
            )
        ]

        record = build_run_summary_record(result, messages)

        self.assertEqual(record["fame_by_player"], {"player1": 15, "player2": 20})
        self.assertEqual(record["max_fame"], 20)

    def test_write_run_summary_creates_file(self) -> None:
        """Test that write_run_summary creates NDJSON file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            result = RunResult(
                run_index=0,
                seed=45,
                outcome="ended",
                steps=50,
                game_id="test-game-4",
            )
            messages: list[MessageLogEntry] = []

            write_run_summary(tmpdir, result, messages)

            output_file = Path(tmpdir) / "run_summary.ndjson"
            self.assertTrue(output_file.exists())

            lines = output_file.read_text(encoding="utf-8").strip().split("\n")
            self.assertEqual(len(lines), 1)

            record = json.loads(lines[0])
            self.assertEqual(record["seed"], 45)

    def test_write_run_summary_appends_to_existing(self) -> None:
        """Test that write_run_summary appends to existing file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            result1 = RunResult(
                run_index=0,
                seed=46,
                outcome="ended",
                steps=50,
                game_id="test-game-5",
            )
            result2 = RunResult(
                run_index=1,
                seed=47,
                outcome="ended",
                steps=60,
                game_id="test-game-6",
            )
            messages: list[MessageLogEntry] = []

            write_run_summary(tmpdir, result1, messages)
            write_run_summary(tmpdir, result2, messages)

            output_file = Path(tmpdir) / "run_summary.ndjson"
            lines = output_file.read_text(encoding="utf-8").strip().split("\n")
            self.assertEqual(len(lines), 2)

            records = [json.loads(line) for line in lines]
            self.assertEqual(records[0]["seed"], 46)
            self.assertEqual(records[1]["seed"], 47)


if __name__ == "__main__":
    unittest.main()
