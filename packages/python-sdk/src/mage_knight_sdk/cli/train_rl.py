#!/usr/bin/env python3
"""Train a simple REINFORCE policy against the Mage Knight simulation harness."""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
import sys
from typing import Any

from mage_knight_sdk.sim import RunnerConfig, run_simulations_sync


def main() -> int:
    parser = argparse.ArgumentParser(description="Train a policy-gradient agent from live game simulations")
    parser.add_argument("--episodes", type=int, default=100, help="Number of episodes to train")
    parser.add_argument("--seed", type=int, default=1, help="Base seed for bootstrap game creation")
    parser.add_argument("--max-steps", type=int, default=10000, help="Max steps per episode")
    parser.add_argument("--player-count", type=int, default=2, help="Number of players in each simulated game")
    parser.add_argument("--bootstrap-url", default="http://127.0.0.1:3001", help="Bootstrap API base URL")
    parser.add_argument("--ws-url", default="ws://127.0.0.1:3001", help="WebSocket server URL")
    parser.add_argument("--artifacts-dir", default="./sim-artifacts", help="Run artifacts directory")
    parser.add_argument("--save-failures", action="store_true", help="Write full action/message artifacts for failed runs")
    parser.add_argument("--no-undo", action="store_true", help="Disable UNDO actions")

    parser.add_argument("--learning-rate", type=float, default=3e-4, help="Adam learning rate")
    parser.add_argument("--gamma", type=float, default=0.99, help="Discount factor")
    parser.add_argument("--entropy-coef", type=float, default=0.01, help="Entropy regularization coefficient")
    parser.add_argument("--hidden-size", type=int, default=128, help="Hidden size for action scoring network")
    parser.add_argument("--device", default="auto", help="Torch device (auto, cpu, cuda, mps)")

    parser.add_argument("--fame-delta-scale", type=float, default=1.0, help="Reward multiplier for fame deltas")
    parser.add_argument("--step-penalty", type=float, default=-0.001, help="Per-step reward penalty")
    parser.add_argument("--terminal-end-bonus", type=float, default=1.0, help="Bonus when game ends normally")
    parser.add_argument("--terminal-max-steps-penalty", type=float, default=-0.5, help="Penalty when episode hits max steps")
    parser.add_argument("--terminal-failure-penalty", type=float, default=-1.0, help="Penalty for protocol/disconnect/invariant failures")

    parser.add_argument("--checkpoint-dir", default="./sim-artifacts/rl-checkpoints", help="Directory for model checkpoints + logs")
    parser.add_argument("--checkpoint-every", type=int, default=25, help="Save checkpoint every N episodes")
    parser.add_argument("--no-final-checkpoint", action="store_true", help="Do not save a final checkpoint at the end")
    parser.add_argument("--resume", metavar="PATH", help="Resume from checkpoint (load policy + optimizer); run --episodes more from here")

    args = parser.parse_args()
    if args.episodes < 1:
        print("--episodes must be >= 1", file=sys.stderr)
        return 2

    components = _load_rl_components()
    if components is None:
        return 2

    PolicyGradientConfig = components["PolicyGradientConfig"]
    ReinforcePolicy = components["ReinforcePolicy"]
    RewardConfig = components["RewardConfig"]
    ReinforceTrainer = components["ReinforceTrainer"]

    if args.resume:
        policy, resume_meta = ReinforcePolicy.load_checkpoint(
            args.resume,
            device_override=args.device,
        )
        print(f"Resumed from {args.resume} (episode {resume_meta.get('episode', '?')})")
    else:
        policy_config = PolicyGradientConfig(
            gamma=args.gamma,
            learning_rate=args.learning_rate,
            entropy_coefficient=args.entropy_coef,
            hidden_size=args.hidden_size,
            device=args.device,
        )
        policy = ReinforcePolicy(policy_config)

    reward_config = RewardConfig(
        fame_delta_scale=args.fame_delta_scale,
        step_penalty=args.step_penalty,
        terminal_end_bonus=args.terminal_end_bonus,
        terminal_max_steps_penalty=args.terminal_max_steps_penalty,
        terminal_failure_penalty=args.terminal_failure_penalty,
    )
    trainer = ReinforceTrainer(policy=policy, reward_config=reward_config)

    checkpoint_dir = Path(args.checkpoint_dir)
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    metrics_path = checkpoint_dir / "training_log.ndjson"

    if not args.resume:
        _write_run_manifest(checkpoint_dir, args, policy, reward_config)

    print(f"Training episodes={args.episodes} seed={args.seed} max_steps={args.max_steps}")
    print(
        "Rewards: "
        f"fame_delta_scale={args.fame_delta_scale} "
        f"step_penalty={args.step_penalty} "
        f"end_bonus={args.terminal_end_bonus} "
        f"max_steps_penalty={args.terminal_max_steps_penalty} "
        f"failure_penalty={args.terminal_failure_penalty}"
    )
    print("-" * 88)

    for episode in range(args.episodes):
        seed = args.seed + episode
        config = RunnerConfig(
            bootstrap_api_base_url=args.bootstrap_url,
            ws_server_url=args.ws_url,
            player_count=args.player_count,
            runs=1,
            max_steps=args.max_steps,
            base_seed=seed,
            artifacts_dir=args.artifacts_dir,
            write_failure_artifacts=args.save_failures,
            allow_undo=not args.no_undo,
        )

        results, _summary = run_simulations_sync(config, policy=policy, hooks=trainer)
        result = results[0]
        stats = trainer.last_stats
        if stats is None:
            print("Training hook did not emit episode stats", file=sys.stderr)
            return 1

        _append_metrics_log(
            path=metrics_path,
            episode=episode,
            seed=seed,
            result=result,
            total_reward=stats.total_reward,
            optimization={
                "loss": stats.optimization.loss,
                "total_reward": stats.optimization.total_reward,
                "mean_reward": stats.optimization.mean_reward,
                "entropy": stats.optimization.entropy,
                "action_count": stats.optimization.action_count,
            },
        )

        print(
            f"ep={episode + 1:04d} seed={seed} outcome={result.outcome:<17} "
            f"steps={result.steps:<6} reward={stats.total_reward:>8.3f} "
            f"loss={stats.optimization.loss:>9.4f} entropy={stats.optimization.entropy:>7.4f}"
        )

        if args.checkpoint_every > 0 and (episode + 1) % args.checkpoint_every == 0:
            checkpoint_path = checkpoint_dir / f"policy_ep_{episode + 1:04d}.pt"
            policy.save_checkpoint(
                checkpoint_path,
                metadata={
                    "episode": episode + 1,
                    "seed": seed,
                    "timestamp": datetime.now(UTC).isoformat(),
                },
            )

    if not args.no_final_checkpoint:
        final_path = checkpoint_dir / "policy_final.pt"
        policy.save_checkpoint(
            final_path,
            metadata={
                "episode": args.episodes,
                "seed": args.seed + args.episodes - 1,
                "timestamp": datetime.now(UTC).isoformat(),
            },
        )
        print(f"Final checkpoint: {final_path}")

    print(f"Metrics log: {metrics_path}")
    return 0


def _write_run_manifest(
    checkpoint_dir: Path,
    args: argparse.Namespace,
    policy: Any,
    reward_config: Any,
) -> None:
    """Write run_config.json with policy/reward config and CLI args for reproducibility."""
    manifest = {
        "started_at": datetime.now(UTC).isoformat(),
        "policy_config": asdict(policy.config),
        "reward": {
            "fame_delta_scale": reward_config.fame_delta_scale,
            "step_penalty": reward_config.step_penalty,
            "terminal_end_bonus": reward_config.terminal_end_bonus,
            "terminal_max_steps_penalty": reward_config.terminal_max_steps_penalty,
            "terminal_failure_penalty": reward_config.terminal_failure_penalty,
            "component_count": len(reward_config.components),
        },
        "cli": vars(args),
    }
    path = checkpoint_dir / "run_config.json"
    path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")


def _load_rl_components() -> dict[str, Any] | None:
    try:
        from mage_knight_sdk.sim.rl.policy_gradient import PolicyGradientConfig, ReinforcePolicy
        from mage_knight_sdk.sim.rl.rewards import RewardConfig
        from mage_knight_sdk.sim.rl.trainer import ReinforceTrainer
    except ModuleNotFoundError as error:
        if error.name == "torch":
            print(
                "PyTorch is not installed. Install RL extras first:\n"
                "  python3 -m pip install -e '.[rl]'",
                file=sys.stderr,
            )
            return None
        raise

    return {
        "PolicyGradientConfig": PolicyGradientConfig,
        "ReinforcePolicy": ReinforcePolicy,
        "RewardConfig": RewardConfig,
        "ReinforceTrainer": ReinforceTrainer,
    }


def _append_metrics_log(
    path: Path,
    episode: int,
    seed: int,
    result: Any,
    total_reward: float,
    optimization: dict[str, float],
) -> None:
    record = {
        "episode": episode + 1,
        "seed": seed,
        "outcome": result.outcome,
        "steps": result.steps,
        "reason": result.reason,
        "timestamp": datetime.now(UTC).isoformat(),
        "total_reward": total_reward,
        "optimization": optimization,
    }
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, sort_keys=True) + "\n")


if __name__ == "__main__":
    raise SystemExit(main())
