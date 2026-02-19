#!/usr/bin/env python3
"""Import an existing training_log.ndjson into TensorBoard format.

Useful for visualizing training runs that were started before TensorBoard
logging was added to the training loop.

Usage:
  mage-knight-import-tb /tmp/rl-512h-1M/training_log.ndjson
  mage-knight-import-tb /tmp/rl-512h-1M/training_log.ndjson --logdir /tmp/tb-512h
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Import training_log.ndjson into TensorBoard format",
    )
    parser.add_argument("ndjson", type=Path, help="Path to training_log.ndjson")
    parser.add_argument(
        "--logdir",
        type=Path,
        default=None,
        help="TensorBoard log directory (default: <ndjson_dir>/tensorboard)",
    )
    args = parser.parse_args()

    ndjson_path: Path = args.ndjson
    if not ndjson_path.exists():
        print(f"File not found: {ndjson_path}", file=sys.stderr)
        return 1

    logdir: Path = args.logdir or ndjson_path.parent / "tensorboard"

    try:
        from torch.utils.tensorboard import SummaryWriter
    except ImportError:
        print(
            "tensorboard is not installed. Install RL extras first:\n"
            "  pip install -e '.[rl]'",
            file=sys.stderr,
        )
        return 2

    logdir.mkdir(parents=True, exist_ok=True)
    writer = SummaryWriter(log_dir=str(logdir))

    count = 0
    errors = 0
    max_fame: float = 0.0
    with open(ndjson_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                errors += 1
                continue

            ep = rec.get("episode", count + 1)
            total_reward = rec.get("total_reward", 0.0)
            steps = rec.get("steps", 0)
            opt = rec.get("optimization", {})

            fame = max(0, total_reward - 1.0)
            max_fame = max(max_fame, fame)
            writer.add_scalar("reward/total", total_reward, ep)
            writer.add_scalar("reward/fame", fame, ep)
            writer.add_scalar("reward/fame_max", max_fame, ep)
            writer.add_scalar("episode/steps", steps, ep)
            writer.add_scalar(
                "episode/fame_binary", 1.0 if total_reward > 1.5 else 0.0, ep,
            )

            if opt:
                writer.add_scalar("optimization/loss", opt.get("loss", 0.0), ep)
                writer.add_scalar("optimization/entropy", opt.get("entropy", 0.0), ep)
                writer.add_scalar(
                    "optimization/critic_loss", opt.get("critic_loss", 0.0), ep,
                )
                writer.add_scalar(
                    "optimization/action_count", opt.get("action_count", 0), ep,
                )

            writer.add_scalar(
                "victory/scenario_triggered",
                1.0 if rec.get("scenario_triggered", False) else 0.0, ep,
            )
            writer.add_scalar(
                "victory/achievement_bonus",
                rec.get("achievement_bonus", 0.0), ep,
            )

            count += 1

    writer.close()

    print(f"Imported {count} episodes into {logdir}")
    if errors:
        print(f"  ({errors} lines skipped due to parse errors)")
    print(f"\nLaunch TensorBoard:\n  tensorboard --logdir {logdir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
