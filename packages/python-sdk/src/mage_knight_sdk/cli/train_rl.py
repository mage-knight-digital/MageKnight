#!/usr/bin/env python3
"""Train a policy-gradient agent against the native Rust Mage Knight engine."""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
import sys
from typing import Any

from mage_knight_sdk.sim.hero_selection import resolve_hero


_METRIC_DESCRIPTIONS: dict[str, str] = {
    "reward/total": "Total shaped reward for the episode. Includes fame, step penalty, end bonus, and victory bonuses.",
    "reward/fame": "Fame earned this episode (total_reward - 1.0, floored at 0). The core game objective.",
    "reward/fame_max": "Running max fame across all episodes. Tracks the best game so far.",
    "episode/steps": "Number of game steps (actions taken) in the episode. Longer = surviving more turns.",
    "episode/fame_binary": "1.0 if total_reward > 1.5, else 0.0. Tracks what fraction of games earn meaningful fame.",
    "optimization/loss": "PPO clipped surrogate policy loss. Negative = policy improving. Should hover near zero, not diverge.",
    "optimization/entropy": "Action distribution entropy. High = exploring, low = exploiting. Should gradually decline, not collapse to zero.",
    "optimization/critic_loss": "MSE between value head predictions and actual returns. Lower = better state value estimates.",
    "optimization/action_count": "Total actions across all games in the sync batch. More = longer games = more training signal.",
    "episode/scenario_ended": "1.0 if the game ended naturally (scenario complete), 0.0 if hit max steps or error. Tracks completion rate.",
}


class _TBWriter:
    """Thin wrapper around TensorBoard SummaryWriter. No-op if tensorboard is unavailable."""

    def __init__(self, log_dir: Path | None, initial_max_fame: float = 0.0) -> None:
        self._writer = None
        self._max_fame: float = initial_max_fame
        self._wrote_guide = False
        if log_dir is None:
            return
        try:
            from torch.utils.tensorboard import SummaryWriter
            self._writer = SummaryWriter(log_dir=str(log_dir))
        except ImportError:
            print("tensorboard not installed — skipping TensorBoard logging", file=sys.stderr)

    def _write_metric_guide(self) -> None:
        """Write a markdown guide to the TEXT tab (once per run)."""
        if self._wrote_guide or self._writer is None:
            return
        self._wrote_guide = True
        rows = "\n".join(
            f"| `{tag}` | {desc} |" for tag, desc in _METRIC_DESCRIPTIONS.items()
        )
        md = f"| Metric | Description |\n|--------|-------------|\n{rows}"
        self._writer.add_text("metric_guide", md, 0)

    def log_episode(self, episode: int, stats: Any) -> None:
        if self._writer is None:
            return
        self._write_metric_guide()
        self._writer.add_scalar("reward/total", stats.total_reward, episode)
        fame = getattr(stats, "achievement_bonus", 0.0)
        self._max_fame = max(self._max_fame, stats.total_reward)
        self._writer.add_scalar("reward/fame", stats.total_reward, episode)
        self._writer.add_scalar("reward/fame_max", self._max_fame, episode)
        self._writer.add_scalar("episode/steps", stats.steps, episode)
        self._writer.add_scalar("episode/fame_binary", 1.0 if stats.total_reward > 1.5 else 0.0, episode)
        self._writer.add_scalar("episode/scenario_ended", 1.0 if getattr(stats, "scenario_triggered", False) else 0.0, episode)
        self._writer.add_scalar("optimization/loss", stats.optimization.loss, episode)
        self._writer.add_scalar("optimization/entropy", stats.optimization.entropy, episode)
        self._writer.add_scalar("optimization/critic_loss", stats.optimization.critic_loss, episode)
        self._writer.add_scalar("optimization/action_count", stats.optimization.action_count, episode)

    def close(self) -> None:
        if self._writer is not None:
            self._writer.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Train a policy-gradient agent using the native Rust engine")
    parser.add_argument("--episodes", type=int, default=100, help="Number of episodes to train")
    parser.add_argument("--seed", type=int, default=1, help="Base seed for game creation")
    parser.add_argument("--fixed-seed", action="store_true", help="Use the same seed every episode (for memorization tests)")
    parser.add_argument("--max-steps", type=int, default=10000, help="Max steps per episode")
    parser.add_argument("--hero", default="random", help="Hero to play, or 'random' for seeded rotation (default: random)")

    parser.add_argument("--learning-rate", type=float, default=3e-4, help="Adam learning rate")
    parser.add_argument("--gamma", type=float, default=0.99, help="Discount factor")
    parser.add_argument("--entropy-coef", type=float, default=0.01, help="Entropy regularization coefficient")
    parser.add_argument("--critic-coef", type=float, default=0.5, help="Critic (value) loss coefficient")
    parser.add_argument("--hidden-size", type=int, default=128, help="Hidden size for action scoring network")
    parser.add_argument("--device", default="auto", help="Torch device (auto, cpu, cuda, mps)")
    parser.add_argument("--embedding-dim", type=int, default=16, help="Embedding dimension for entity IDs (default: 16)")
    parser.add_argument("--num-hidden-layers", type=int, default=1, help="Number of hidden layers in state/action encoders (default: 1)")

    parser.add_argument("--fame-delta-scale", type=float, default=1.0, help="Reward multiplier for fame deltas")
    parser.add_argument("--step-penalty", type=float, default=0.0, help="Per-step reward penalty")
    parser.add_argument("--terminal-end-bonus", type=float, default=0.0, help="Bonus when game ends normally")
    parser.add_argument("--terminal-max-steps-penalty", type=float, default=-0.5, help="Penalty when episode hits max steps")
    parser.add_argument("--terminal-failure-penalty", type=float, default=-1.0, help="Penalty for engine failures")
    parser.add_argument("--movement-bonus", type=float, default=0.02, help="Reward for changing position (dense shaping)")
    parser.add_argument("--exploration-bonus", type=float, default=0.5, help="Reward per new tile explored (dense shaping)")

    parser.add_argument("--checkpoint-dir", default=None, help="Run directory for checkpoints + logs (default: auto-generated under training/runs/)")
    parser.add_argument("--checkpoint-every", type=int, default=25, help="Save checkpoint every N episodes")
    parser.add_argument("--no-final-checkpoint", action="store_true", help="Do not save a final checkpoint at the end")
    parser.add_argument("--resume", metavar="PATH", help="Resume from checkpoint (load policy + optimizer); run --episodes more from here")

    # PPO flags
    parser.add_argument("--ppo", action="store_true", help="Use PPO instead of REINFORCE")
    parser.add_argument("--batch-episodes", type=int, default=16, help="Episodes per PPO update batch (default: 16)")
    parser.add_argument("--ppo-epochs", type=int, default=4, help="PPO optimization epochs per batch (default: 4)")
    parser.add_argument("--clip-epsilon", type=float, default=0.2, help="PPO clip ratio (default: 0.2)")
    parser.add_argument("--gae-lambda", type=float, default=0.95, help="GAE lambda (default: 0.95)")
    parser.add_argument("--max-grad-norm", type=float, default=0.5, help="Gradient clipping max norm (default: 0.5)")
    parser.add_argument("--mini-batch-size", type=int, default=256, help="PPO mini-batch size (default: 256)")

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

    resume_episode_offset = 0
    if args.resume:
        policy, resume_meta = ReinforcePolicy.load_checkpoint(
            args.resume,
            device_override=args.device,
        )
        resume_episode_offset = resume_meta.get("episode", 0)
        print(f"Resumed from {args.resume} (episode {resume_episode_offset})")
    else:
        policy_config = PolicyGradientConfig(
            gamma=args.gamma,
            learning_rate=args.learning_rate,
            entropy_coefficient=args.entropy_coef,
            critic_coefficient=args.critic_coef,
            hidden_size=args.hidden_size,
            device=args.device,
            embedding_dim=args.embedding_dim,
            num_hidden_layers=args.num_hidden_layers,
        )
        policy = ReinforcePolicy(policy_config)

    reward_config = RewardConfig(
        fame_delta_scale=args.fame_delta_scale,
        step_penalty=args.step_penalty,
        terminal_end_bonus=args.terminal_end_bonus,
        terminal_max_steps_penalty=args.terminal_max_steps_penalty,
        terminal_failure_penalty=args.terminal_failure_penalty,
        movement_bonus=args.movement_bonus,
        exploration_bonus=args.exploration_bonus,
    )

    run_dir = _resolve_run_dir(args.checkpoint_dir, args.resume)
    run_dir.mkdir(parents=True, exist_ok=True)
    checkpoint_dir = run_dir / "checkpoints"
    checkpoint_dir.mkdir(exist_ok=True)
    metrics_path = run_dir / "training_log.ndjson"

    if not args.resume:
        _write_run_manifest(run_dir, args, policy, reward_config)

    algo = "PPO" if args.ppo else "REINFORCE"
    hero_display = args.hero if args.hero.lower() != "random" else "random (seeded rotation)"
    seed_display = f"{args.seed} (FIXED)" if args.fixed_seed else str(args.seed)
    print(f"Training episodes={args.episodes} seed={seed_display} max_steps={args.max_steps} algorithm={algo} hero={hero_display}")
    print(
        "Rewards: "
        f"fame_delta_scale={args.fame_delta_scale} "
        f"step_penalty={args.step_penalty} "
        f"end_bonus={args.terminal_end_bonus} "
        f"max_steps_penalty={args.terminal_max_steps_penalty} "
        f"failure_penalty={args.terminal_failure_penalty} "
        f"movement_bonus={args.movement_bonus} "
        f"exploration_bonus={args.exploration_bonus}"
    )

    if args.ppo:
        print(f"PPO: batch_episodes={args.batch_episodes} ppo_epochs={args.ppo_epochs} clip={args.clip_epsilon} gae_lambda={args.gae_lambda}")

    # Recover running max fame from existing NDJSON so fame_max doesn't reset on resume.
    initial_max_fame = 0.0
    if args.resume and metrics_path.exists():
        try:
            with open(metrics_path, encoding="utf-8") as mf:
                for line in mf:
                    rec = json.loads(line)
                    initial_max_fame = max(initial_max_fame, rec.get("total_reward", 0.0) - 1.0)
            initial_max_fame = max(0.0, initial_max_fame)
        except Exception:
            pass  # best-effort

    tb = _TBWriter(run_dir / "tensorboard", initial_max_fame=initial_max_fame)
    print(f"TensorBoard: tensorboard --logdir {run_dir / 'tensorboard'}")

    print("-" * 88)

    try:
        if args.ppo:
            return _train_ppo_native(args, policy, reward_config, checkpoint_dir, metrics_path, tb, resume_episode_offset)
        return _train_native_sequential(args, policy, reward_config, checkpoint_dir, metrics_path, tb, resume_episode_offset)
    finally:
        tb.close()


# ---------------------------------------------------------------------------
# REINFORCE native training loop
# ---------------------------------------------------------------------------


def _train_native_sequential(
    args: argparse.Namespace,
    policy: Any,
    reward_config: Any,
    checkpoint_dir: Path,
    metrics_path: Path,
    tb: _TBWriter | None = None,
    resume_episode_offset: int = 0,
) -> int:
    """Native Rust engine training loop — no WebSocket server needed."""
    from mage_knight_sdk.sim.rl.native_rl_runner import run_native_rl_game

    for episode in range(args.episodes):
        global_ep = resume_episode_offset + episode + 1
        seed = args.seed if args.fixed_seed else args.seed + resume_episode_offset + episode
        hero = resolve_hero(args.hero, seed)

        result, stats = run_native_rl_game(
            seed=seed,
            hero=hero,
            policy=policy,
            reward_config=reward_config,
            max_steps=args.max_steps,
        )

        if stats is None:
            print(f"ep={global_ep:04d} seed={seed} hero={hero} ERROR: {result.reason}", file=sys.stderr)
            continue

        _append_metrics_log(
            path=metrics_path,
            episode=global_ep - 1,
            seed=seed,
            stats=stats,
        )

        print(
            f"ep={global_ep:04d} seed={seed} outcome={result.outcome:<17} "
            f"steps={result.steps:<6} fame={result.fame:<4} reward={stats.total_reward:>8.3f} "
            f"loss={stats.optimization.loss:>9.4f} entropy={stats.optimization.entropy:>7.4f}"
        )

        if tb is not None:
            tb.log_episode(global_ep, stats)

        if args.checkpoint_every > 0 and global_ep % args.checkpoint_every == 0:
            checkpoint_path = checkpoint_dir / f"policy_ep_{global_ep:06d}.pt"
            policy.save_checkpoint(
                checkpoint_path,
                metadata={
                    "episode": global_ep,
                    "seed": seed,
                    "timestamp": datetime.now(UTC).isoformat(),
                },
            )

    if not args.no_final_checkpoint:
        final_ep = resume_episode_offset + args.episodes
        final_path = checkpoint_dir / "policy_final.pt"
        policy.save_checkpoint(
            final_path,
            metadata={
                "episode": final_ep,
                "seed": args.seed + resume_episode_offset + args.episodes - 1,
                "timestamp": datetime.now(UTC).isoformat(),
            },
        )
        print(f"Final checkpoint: {final_path}")

    print(f"Metrics log: {metrics_path}")
    return 0


# ---------------------------------------------------------------------------
# PPO native training loop
# ---------------------------------------------------------------------------


def _train_ppo_native(
    args: argparse.Namespace,
    policy: Any,
    reward_config: Any,
    checkpoint_dir: Path,
    metrics_path: Path,
    tb: _TBWriter | None = None,
    resume_episode_offset: int = 0,
) -> int:
    """Native PPO training: collect batch of episodes, compute GAE, optimize, repeat."""
    from mage_knight_sdk.sim.rl.native_rl_runner import EpisodeTrainingStats, run_native_rl_game_ppo
    from mage_knight_sdk.sim.rl.policy_gradient import OptimizationStats, compute_gae

    episode_num = 0

    while episode_num < args.episodes:
        batch_size = min(args.batch_episodes, args.episodes - episode_num)

        # Collect batch_size episodes
        episodes_data: list[list[Any]] = []
        batch_terminated: list[bool] = []
        batch_bootstrap_values: list[float] = []
        batch_stats: list[EpisodeTrainingStats] = []
        batch_fames: list[int] = []

        for i in range(batch_size):
            seed = args.seed if args.fixed_seed else args.seed + resume_episode_offset + episode_num + i
            hero = resolve_hero(args.hero, seed)

            result, transitions, terminated, bootstrap_value = run_native_rl_game_ppo(
                seed=seed,
                hero=hero,
                policy=policy,
                reward_config=reward_config,
                max_steps=args.max_steps,
            )

            if result.outcome == "engine_error" or not transitions:
                print(f"  seed={seed} hero={hero} ERROR: {result.reason}", file=sys.stderr)
                # Still count toward episode_num to avoid infinite loop
                batch_stats.append(EpisodeTrainingStats(
                    outcome=result.outcome,
                    steps=result.steps,
                    total_reward=0.0,
                    optimization=OptimizationStats(
                        loss=0.0, total_reward=0.0, mean_reward=0.0,
                        entropy=0.0, action_count=0,
                    ),
                    scenario_triggered=result.scenario_end_triggered,
                ))
                batch_fames.append(result.fame)
                continue

            episode_total_reward = sum(t.reward for t in transitions)
            episodes_data.append(transitions)
            batch_terminated.append(terminated)
            batch_bootstrap_values.append(bootstrap_value)
            batch_stats.append(EpisodeTrainingStats(
                outcome=result.outcome,
                steps=result.steps,
                total_reward=episode_total_reward,
                optimization=OptimizationStats(
                    loss=0.0, total_reward=episode_total_reward,
                    mean_reward=episode_total_reward / max(len(transitions), 1),
                    entropy=0.0, action_count=len(transitions),
                ),
                scenario_triggered=result.scenario_end_triggered,
            ))
            batch_fames.append(result.fame)

        # PPO optimization
        if episodes_data:
            transitions_flat, advantages, returns = compute_gae(
                episodes_data, args.gamma, args.gae_lambda,
                terminated=batch_terminated,
                bootstrap_values=batch_bootstrap_values,
            )
            opt_stats = policy.optimize_ppo(
                transitions_flat, advantages, returns,
                clip_epsilon=args.clip_epsilon,
                ppo_epochs=args.ppo_epochs,
                max_grad_norm=args.max_grad_norm,
                mini_batch_size=args.mini_batch_size,
            )
        else:
            opt_stats = OptimizationStats(
                loss=0.0, total_reward=0.0, mean_reward=0.0,
                entropy=0.0, action_count=0,
            )

        # Log each episode in the batch
        for i, stats in enumerate(batch_stats):
            global_ep = resume_episode_offset + episode_num + i + 1
            seed = args.seed if args.fixed_seed else args.seed + resume_episode_offset + episode_num + i

            logged_stats = _with_opt(stats, opt_stats)
            _append_metrics_log(
                path=metrics_path, episode=global_ep - 1, seed=seed,
                stats=logged_stats,
            )

            print(
                f"ep={global_ep:04d} seed={seed} outcome={stats.outcome:<17} "
                f"steps={stats.steps:<6} fame={batch_fames[i]:<4} reward={stats.total_reward:>8.3f} "
                f"loss={opt_stats.loss:>9.4f} entropy={opt_stats.entropy:>7.4f}"
            )

            if tb is not None:
                tb.log_episode(global_ep, logged_stats)

        episode_num += len(batch_stats)

        # Checkpoint
        global_ep_end = resume_episode_offset + episode_num
        if args.checkpoint_every > 0 and global_ep_end % args.checkpoint_every < len(batch_stats):
            checkpoint_path = checkpoint_dir / f"policy_ep_{global_ep_end:06d}.pt"
            policy.save_checkpoint(
                checkpoint_path,
                metadata={
                    "episode": global_ep_end,
                    "seed": args.seed + resume_episode_offset + episode_num - 1,
                    "timestamp": datetime.now(UTC).isoformat(),
                },
            )

    if not args.no_final_checkpoint:
        final_ep = resume_episode_offset + args.episodes
        final_path = checkpoint_dir / "policy_final.pt"
        policy.save_checkpoint(
            final_path,
            metadata={
                "episode": final_ep,
                "seed": args.seed + resume_episode_offset + args.episodes - 1,
                "timestamp": datetime.now(UTC).isoformat(),
            },
        )
        print(f"Final checkpoint: {final_path}")

    print(f"Metrics log: {metrics_path}")
    return 0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _with_opt(stats: Any, opt: Any) -> Any:
    """Return EpisodeTrainingStats with updated optimization info."""
    from mage_knight_sdk.sim.rl.native_rl_runner import EpisodeTrainingStats
    return EpisodeTrainingStats(
        outcome=stats.outcome,
        steps=stats.steps,
        total_reward=stats.total_reward,
        optimization=opt,
        scenario_triggered=getattr(stats, "scenario_triggered", False),
        achievement_bonus=getattr(stats, "achievement_bonus", 0.0),
    )


def _resolve_run_dir(explicit_dir: str | None, resume_path: str | None) -> Path:
    """Determine the run directory.

    Priority:
    1. Explicit --checkpoint-dir: use as-is.
    2. --resume: derive from the .pt file (if parent is ``checkpoints/``, go one more level up).
    3. Neither: auto-generate ``training/runs/run-YYYYMMDDTHHMMSS``.
    """
    if explicit_dir is not None:
        return Path(explicit_dir)
    if resume_path is not None:
        pt = Path(resume_path).resolve()
        parent = pt.parent
        if parent.name == "checkpoints":
            return parent.parent
        return parent
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S")
    return Path(f"./training/runs/run-{stamp}")


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
            "movement_bonus": reward_config.movement_bonus,
            "exploration_bonus": reward_config.exploration_bonus,
        },
        "cli": vars(args),
    }
    path = checkpoint_dir / "run_config.json"
    path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")


def _load_rl_components() -> dict[str, Any] | None:
    try:
        from mage_knight_sdk.sim.rl.policy_gradient import (
            PolicyGradientConfig,
            ReinforcePolicy,
        )
        from mage_knight_sdk.sim.rl.rewards import RewardConfig
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
    }


def _append_metrics_log(
    path: Path,
    episode: int,
    seed: int,
    stats: Any,
) -> None:
    """Write metrics from EpisodeTrainingStats."""
    record = {
        "episode": episode + 1,
        "seed": seed,
        "outcome": stats.outcome,
        "steps": stats.steps,
        "reason": None,
        "scenario_triggered": getattr(stats, "scenario_triggered", False),
        "timestamp": datetime.now(UTC).isoformat(),
        "total_reward": stats.total_reward,
        "optimization": {
            "loss": stats.optimization.loss,
            "total_reward": stats.optimization.total_reward,
            "mean_reward": stats.optimization.mean_reward,
            "entropy": stats.optimization.entropy,
            "action_count": stats.optimization.action_count,
            "critic_loss": stats.optimization.critic_loss,
        },
    }
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, sort_keys=True) + "\n")


if __name__ == "__main__":
    raise SystemExit(main())
