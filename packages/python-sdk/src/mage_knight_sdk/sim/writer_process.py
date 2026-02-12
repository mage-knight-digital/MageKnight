"""
Writer process for parallel sim sweep.

Provides a dedicated process that owns the run_summary.ndjson file,
preventing file corruption when multiple workers write concurrently.
"""
from __future__ import annotations

import json
import multiprocessing as mp
from pathlib import Path
from typing import Any


_SENTINEL = None


def writer_process_target(queue: mp.Queue[dict[str, Any] | None], output_dir: str) -> None:
    """
    Writer process entry point. Owns the run_summary.ndjson file.

    Args:
        queue: Queue of summary records (dict) or None sentinel to stop
        output_dir: Directory containing run_summary.ndjson
    """
    target = Path(output_dir) / "run_summary.ndjson"
    target.parent.mkdir(parents=True, exist_ok=True)

    with open(target, "a", encoding="utf-8") as f:
        while True:
            record = queue.get()
            if record is _SENTINEL:
                break
            f.write(json.dumps(record, sort_keys=True) + "\n")
            f.flush()  # Ensure immediate write for real-time progress tracking


def start_writer_process(output_dir: str) -> tuple[mp.Process, mp.Queue[dict[str, Any] | None]]:
    """
    Start the writer process.

    Args:
        output_dir: Directory for run_summary.ndjson

    Returns:
        (process, queue) tuple. Submit records via queue.put(record).
    """
    queue: mp.Queue[dict[str, Any] | None] = mp.Queue()
    process = mp.Process(target=writer_process_target, args=(queue, output_dir))
    process.start()
    return process, queue


def stop_writer_process(process: mp.Process, queue: mp.Queue[dict[str, Any] | None]) -> None:
    """
    Gracefully stop the writer process.

    Args:
        process: Writer process from start_writer_process()
        queue: Queue from start_writer_process()
    """
    queue.put(_SENTINEL)
    process.join(timeout=5.0)
    if process.is_alive():
        process.terminate()
        process.join(timeout=1.0)
