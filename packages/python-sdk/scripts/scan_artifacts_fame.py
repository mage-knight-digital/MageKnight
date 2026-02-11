#!/usr/bin/env python3
"""
Scan sim-artifacts for games where any player earned fame (> 0).

Prefers run_summary.ndjson (written for ALL runs including successful ones).
If absent, falls back to scanning full failure artifacts.

Usage:
  python3 scripts/scan_artifacts_fame.py [--artifacts-dir DIR]
  python3 scripts/scan_artifacts_fame.py --benchmark [--sample N]
  python3 scripts/scan_artifacts_fame.py --profile
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SDK_SRC = REPO_ROOT / "packages/python-sdk/src"
sys.path.insert(0, str(SDK_SRC))


def extract_fame_from_state(state: dict) -> list[tuple[str, int]]:
    """Return [(player_id, fame), ...] from state."""
    out = []
    for p in state.get("players") or []:
        if isinstance(p, dict):
            pid = p.get("id")
            fame = p.get("fame")
            if pid is not None and isinstance(fame, (int, float)):
                out.append((str(pid), int(fame)))
    return out


def scan_artifact_streaming(path: Path) -> dict | None:
    """
    Use ijson to stream-parse and get last state's player fame.
    Returns None if parsing fails or no state found; else {seed, run, outcome, steps, fame_by_player, max_fame}.
    """
    try:
        import ijson
    except ImportError:
        return None

    run_info = {}
    last_fame: list[tuple[str, int]] = []

    with open(path, "rb") as f:
        # Parse run metadata first (small)
        try:
            run_info["seed"] = None
            run_info["outcome"] = None
            run_info["steps"] = None
            run_info["run_index"] = None
            for key, value in ijson.kvitems(f, "run"):
                if key == "seed":
                    run_info["seed"] = value
                elif key == "outcome":
                    run_info["outcome"] = value
                elif key == "steps":
                    run_info["steps"] = value
                elif key == "run_index":
                    run_info["run_index"] = value
        except ijson.JSONError:
            pass

        f.seek(0)
        # Iterate messageLog, keep last state's fame
        try:
            for msg in ijson.items(f, "messageLog.item"):
                if not isinstance(msg, dict):
                    continue
                payload = msg.get("payload") or {}
                if "state" not in payload:
                    continue
                state = payload.get("state")
                if not isinstance(state, dict):
                    continue
                last_fame = extract_fame_from_state(state)
        except ijson.JSONError:
            pass

    if not last_fame:
        return None
    max_fame = max(f for _, f in last_fame) if last_fame else 0
    return {
        **run_info,
        "fame_by_player": dict(last_fame),
        "max_fame": max_fame,
    }


def scan_artifact_load_full(path: Path) -> dict | None:
    """Load full JSON (for smaller files). Returns same structure as streaming."""
    try:
        data = json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return None

    run = data.get("run") or {}
    run_info = {
        "seed": run.get("seed"),
        "outcome": run.get("outcome"),
        "steps": run.get("steps"),
        "run_index": run.get("run_index"),
    }

    last_fame = []
    for msg in reversed(data.get("messageLog") or []):
        payload = (msg or {}).get("payload") or {}
        if payload.get("type") != "state_update":
            continue
        state = payload.get("state")
        if isinstance(state, dict):
            last_fame = extract_fame_from_state(state)
            break

    if not last_fame:
        return None
    max_fame = max(f for _, f in last_fame) if last_fame else 0
    return {
        **run_info,
        "fame_by_player": dict(last_fame),
        "max_fame": max_fame,
    }


def _print_benchmark(timings: list[tuple[str, float, int]], t_total: float) -> None:
    """Print timing breakdown."""
    n = len(timings)
    total_size = sum(s for _, _, s in timings)
    total_sec = sum(t for _, t, _ in timings)
    times = [t for _, t, _ in timings]
    times.sort()
    print("\n--- Benchmark ---")
    print(f"Files: {n}, Total size: {total_size / 1e6:.1f} MB")
    print(f"Wall time: {t_total:.2f}s, Parse time: {total_sec:.2f}s")
    print(f"Throughput: {total_size / total_sec / 1e6:.1f} MB/s" if total_sec > 0 else "")
    print(f"Per-file: p50={times[n//2]*1000:.0f}ms p95={times[int(n*0.95)]*1000:.0f}ms p99={times[int(n*0.99)]*1000:.0f}ms")
    # Show slowest 5
    by_time = sorted(timings, key=lambda x: -x[1])
    print("Slowest 5:")
    for name, sec, sz in by_time[:5]:
        mb = sz / 1e6
        mbps = mb / sec if sec > 0 else 0
        print(f"  {sec*1000:.0f}ms  {mb:.1f}MB  {mbps:.1f} MB/s  {name}")

def main() -> int:
    parser = argparse.ArgumentParser(description="Scan sim-artifacts for games with fame > 0")
    parser.add_argument("--artifacts-dir", default="./sim-artifacts", help="Artifacts directory")
    parser.add_argument("--streaming", action="store_true", help="Use streaming parse (ijson) for large files")
    parser.add_argument("--size-limit-mb", type=float, default=50.0, help="Files larger than this use streaming (default 50)")
    parser.add_argument("--benchmark", action="store_true", help="Report timing breakdown (per-file and total)")
    parser.add_argument("--sample", type=int, default=0, help="For benchmark: only process first N files (0=all)")
    parser.add_argument("--profile", action="store_true", help="Run with cProfile, print top 20 hotspots")
    args = parser.parse_args()

    if args.profile:
        import cProfile
        import pstats
        prof = cProfile.Profile()
        prof.enable()
        try:
            return _run_scan(args)
        finally:
            prof.disable()
            ps = pstats.Stats(prof)
            ps.sort_stats(pstats.SortKey.CUMULATIVE)
            ps.print_stats(20)
        return 0

    return _run_scan(args)


def _load_from_summary(summary_path: Path) -> tuple[list[dict], int]:
    """Load runs with fame > 0 from run_summary.ndjson. Returns (with_fame, total_runs)."""
    with_fame: list[dict] = []
    total = 0
    with open(summary_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            total += 1
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            if rec.get("max_fame", 0) > 0:
                with_fame.append(rec)
    return with_fame, total


def _print_fame_results(with_fame: list[dict], failed_parse: int = 0) -> None:
    """Print fame analysis output."""
    print(f"\nGames with fame > 0: {len(with_fame)}")
    if failed_parse:
        print(f"Failed to parse: {failed_parse}")
    print()
    if with_fame:
        with_fame.sort(key=lambda x: (-x.get("max_fame", 0), x.get("seed", 0)))
        print("Top seeds by fame:")
        for i, r in enumerate(with_fame[:30], 1):
            seed = r.get("seed", "?")
            steps = r.get("steps", "?")
            outcome = r.get("outcome", "?")
            fame = r.get("fame_by_player", {})
            print(f"  {i}. seed={seed} max_fame={r.get('max_fame', 0)} steps={steps} outcome={outcome}")
            print(f"      {fame}")
        if len(with_fame) > 30:
            print(f"  ... and {len(with_fame) - 30} more")
    else:
        print("No runs had players with fame > 0.")


def _run_scan(args: argparse.Namespace) -> int:
    artifacts_dir = Path(args.artifacts_dir)
    if not artifacts_dir.exists():
        print(f"Artifacts dir not found: {artifacts_dir}", file=sys.stderr)
        return 1

    summary_path = artifacts_dir / "run_summary.ndjson"
    if summary_path.exists():
        print(f"Using {summary_path} (all runs including successful)")
        t0 = time.perf_counter()
        with_fame, total = _load_from_summary(summary_path)
        elapsed = time.perf_counter() - t0
        print(f"Scanned {total} runs in {elapsed:.2f}s")
        print("-" * 60)
        _print_fame_results(with_fame)
        return 0

    files = sorted(artifacts_dir.glob("run_*_seed_*.json"))
    if args.sample and args.sample > 0:
        files = files[: args.sample]
    print(f"Scanning {len(files)} failure artifacts in {artifacts_dir} (no run_summary.ndjson)")
    print("-" * 60)

    have_ijson = False
    try:
        import ijson
        have_ijson = True
    except ImportError:
        print("(Install viewer deps for streaming: pip install '.[viewer]')", file=sys.stderr)

    with_fame: list[dict] = []
    failed_parse = 0
    size_limit_bytes = int(args.size_limit_mb * 1024 * 1024)

    timings: list[tuple[str, float, int]] = []  # (name, sec, size_bytes)
    t_start = time.perf_counter()

    for p in files:
        size = p.stat().st_size
        use_streaming = have_ijson and (args.streaming or size > size_limit_bytes)
        t0 = time.perf_counter()

        if use_streaming:
            info = scan_artifact_streaming(p)
        else:
            try:
                info = scan_artifact_load_full(p)
            except Exception:
                if have_ijson:
                    info = scan_artifact_streaming(p)
                else:
                    info = None

        if args.benchmark:
            timings.append((p.name, time.perf_counter() - t0, size))

        if info is None:
            failed_parse += 1
            continue
        if info.get("max_fame", 0) > 0:
            info["path"] = str(p.name)
            with_fame.append(info)

    t_total = time.perf_counter() - t_start

    if args.benchmark and timings:
        _print_benchmark(timings, t_total)

    _print_fame_results(with_fame, failed_parse)
    if not with_fame and not summary_path.exists():
        print("(Tip: run with sim scripts to generate run_summary.ndjson for all runs including successful.)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
