#!/usr/bin/env python3
"""Compare training runs side-by-side with percentile breakdowns.

Usage:
  python scripts/compare_runs.py                          # all runs, auto-detect max episodes
  python scripts/compare_runs.py encoding-v1 commerce-v1  # specific runs
  python scripts/compare_runs.py --max-ep 50000           # limit episode range
  python scripts/compare_runs.py --bucket 5               # 5k episode buckets (default: 10k)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from pathlib import Path

RUNS_DIR = Path(__file__).resolve().parent.parent / "training" / "runs"


def load_run(name: str) -> list[dict]:
    path = RUNS_DIR / name / "training_log.ndjson"
    if not path.exists():
        print(f"Warning: {path} not found, skipping {name}", file=sys.stderr)
        return []
    with open(path) as f:
        return [json.loads(line) for line in f]


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    values = sorted(values)
    idx = int(len(values) * p / 100)
    return values[min(idx, len(values) - 1)]


def print_comparison(runs: dict[str, list[dict]], bucket_size_k: int, max_ep: int | None):
    # Find common episode range
    max_episodes = {}
    for name, lines in runs.items():
        if lines:
            max_episodes[name] = max(l["episode"] for l in lines)

    if max_ep:
        limit = max_ep
    else:
        limit = min(max_episodes.values()) if max_episodes else 0

    bucket_size = bucket_size_k * 1000
    buckets_range = range(0, int(limit) + 1, bucket_size)

    run_names = list(runs.keys())

    # === Fame comparison ===
    print("\n" + "=" * 100)
    print("FAME (avg | p50 | p80 | p95)")
    print("=" * 100)
    header = f"{'Ep(k)':>6}"
    for name in run_names:
        header += f" | {name:>28}"
    print(header)
    print("-" * (8 + 31 * len(run_names)))

    for bucket_start in buckets_range:
        row = f"{bucket_start // 1000:>6}"
        for name in run_names:
            lines = runs[name]
            bucket = [l for l in lines if bucket_start <= l["episode"] < bucket_start + bucket_size]
            if bucket:
                fames = [l["fame"] for l in bucket]
                avg = sum(fames) / len(fames)
                p50 = percentile(fames, 50)
                p80 = percentile(fames, 80)
                p95 = percentile(fames, 95)
                row += f" | {avg:>5.1f}  p50={p50:>2.0f} p80={p80:>2.0f} p95={p95:>2.0f}"
            else:
                row += f" | {'—':>28}"
        print(row)

    # === Game Score comparison ===
    print("\n" + "=" * 100)
    print("GAME SCORE (avg | p50 | p80 | p95)")
    print("=" * 100)
    header = f"{'Ep(k)':>6}"
    for name in run_names:
        header += f" | {name:>28}"
    print(header)
    print("-" * (8 + 31 * len(run_names)))

    for bucket_start in buckets_range:
        row = f"{bucket_start // 1000:>6}"
        for name in run_names:
            lines = runs[name]
            bucket = [l for l in lines if bucket_start <= l["episode"] < bucket_start + bucket_size]
            if bucket:
                scores = [l["game_score"] for l in bucket]
                avg = sum(scores) / len(scores)
                p50 = percentile(scores, 50)
                p80 = percentile(scores, 80)
                p95 = percentile(scores, 95)
                row += f" | {avg:>5.1f}  p50={p50:>2.0f} p80={p80:>2.0f} p95={p95:>2.0f}"
            else:
                row += f" | {'—':>28}"
        print(row)

    # === Achievement breakdown (latest bucket only, if available) ===
    print("\n" + "=" * 100)
    print("ACHIEVEMENTS (latest bucket avg)")
    print("=" * 100)
    categories = ["conqueror", "adventurer", "knowledge", "loot", "leader", "beating"]
    header = f"{'Category':<12}"
    for name in run_names:
        header += f" | {name:>12}"
    print(header)
    print("-" * (14 + 15 * len(run_names)))

    for cat in categories:
        row = f"{cat:<12}"
        for name in run_names:
            lines = runs[name]
            # Use last 5k episodes
            recent = lines[-5000:] if len(lines) >= 5000 else lines
            has_ach = recent and "achievement_breakdown" in recent[0]
            if has_ach:
                total = sum(l.get("achievement_breakdown", {}).get(cat, 0) for l in recent)
                avg = total / len(recent)
                row += f" | {avg:>+12.1f}"
            else:
                row += f" | {'—':>12}"
        print(row)

    # === Summary stats ===
    print("\n" + "=" * 100)
    print("SUMMARY (latest 5k episodes)")
    print("=" * 100)
    metrics = [
        ("Episodes", lambda lines: len(lines)),
        ("Avg Fame", lambda lines: sum(l["fame"] for l in lines[-5000:]) / min(len(lines), 5000)),
        ("Avg Score", lambda lines: sum(l["game_score"] for l in lines[-5000:]) / min(len(lines), 5000)),
        ("Avg Reward", lambda lines: sum(l["total_reward"] for l in lines[-5000:]) / min(len(lines), 5000)),
        ("Combat Fame", lambda lines: sum(l.get("combat_fame", 0) for l in lines[-5000:]) / min(len(lines), 5000)),
    ]

    header = f"{'Metric':<14}"
    for name in run_names:
        header += f" | {name:>12}"
    print(header)
    print("-" * (16 + 15 * len(run_names)))

    for metric_name, fn in metrics:
        row = f"{metric_name:<14}"
        for name in run_names:
            lines = runs[name]
            if lines:
                val = fn(lines)
                if metric_name == "Episodes":
                    row += f" | {val:>12,}"
                else:
                    row += f" | {val:>12.1f}"
            else:
                row += f" | {'—':>12}"
        print(row)


def main():
    parser = argparse.ArgumentParser(description="Compare training runs")
    parser.add_argument("runs", nargs="*", help="Run names (default: all)")
    parser.add_argument("--max-ep", type=int, default=None, help="Max episode to compare")
    parser.add_argument("--bucket", type=int, default=10, help="Bucket size in thousands (default: 10)")
    args = parser.parse_args()

    if args.runs:
        run_names = args.runs
    else:
        # Auto-discover all runs
        run_names = sorted(
            d for d in os.listdir(RUNS_DIR)
            if (RUNS_DIR / d / "training_log.ndjson").exists()
        )

    runs = {}
    for name in run_names:
        lines = load_run(name)
        if lines:
            runs[name] = lines

    if not runs:
        print("No runs found!", file=sys.stderr)
        return 1

    print_comparison(runs, args.bucket, args.max_ep)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
