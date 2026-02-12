"""Tests for writer_process module."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from mage_knight_sdk.sim.writer_process import start_writer_process, stop_writer_process


class WriterProcessTest(unittest.TestCase):
    """Test writer process for parallel sim sweep."""

    def test_writer_process_writes_records(self) -> None:
        """Test that writer process correctly writes NDJSON records."""
        with tempfile.TemporaryDirectory() as tmpdir:
            process, queue = start_writer_process(tmpdir)

            try:
                # Submit records
                queue.put({"seed": 1, "outcome": "ended"})
                queue.put({"seed": 2, "outcome": "max_steps"})
                queue.put({"seed": 3, "outcome": "ended"})

                # Stop writer
                stop_writer_process(process, queue)

                # Verify file contents
                output_file = Path(tmpdir) / "run_summary.ndjson"
                self.assertTrue(output_file.exists())

                lines = output_file.read_text(encoding="utf-8").strip().split("\n")
                self.assertEqual(len(lines), 3)

                # Parse and verify records
                records = [json.loads(line) for line in lines]
                self.assertEqual(records[0]["seed"], 1)
                self.assertEqual(records[0]["outcome"], "ended")
                self.assertEqual(records[1]["seed"], 2)
                self.assertEqual(records[1]["outcome"], "max_steps")
                self.assertEqual(records[2]["seed"], 3)
                self.assertEqual(records[2]["outcome"], "ended")

            finally:
                if process.is_alive():
                    process.terminate()
                    process.join(timeout=1.0)

    def test_writer_process_creates_directory(self) -> None:
        """Test that writer process creates output directory if needed."""
        with tempfile.TemporaryDirectory() as tmpdir:
            nested_dir = str(Path(tmpdir) / "nested" / "output")
            process, queue = start_writer_process(nested_dir)

            try:
                queue.put({"seed": 1, "outcome": "ended"})
                stop_writer_process(process, queue)

                output_file = Path(nested_dir) / "run_summary.ndjson"
                self.assertTrue(output_file.exists())

            finally:
                if process.is_alive():
                    process.terminate()
                    process.join(timeout=1.0)

    def test_writer_process_graceful_shutdown(self) -> None:
        """Test that writer process shuts down gracefully."""
        with tempfile.TemporaryDirectory() as tmpdir:
            process, queue = start_writer_process(tmpdir)

            queue.put({"seed": 1, "outcome": "ended"})
            stop_writer_process(process, queue)

            # Process should be stopped
            self.assertFalse(process.is_alive())


if __name__ == "__main__":
    unittest.main()
