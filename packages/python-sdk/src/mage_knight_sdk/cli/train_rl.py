#!/usr/bin/env python3
"""Train a policy-gradient agent against the Mage Knight simulation harness."""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
import sys
from typing import Any

from mage_knight_sdk.sim import RunnerConfig, StepTimings, run_simulations_sync


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
    "victory/scenario_triggered": "1.0 if the victory scenario was triggered this episode, else 0.0.",
    "victory/achievement_bonus": "Bonus reward from in-game achievements (e.g. conquering sites, leveling up).",
}


class _TBWriter:
    """Thin wrapper around TensorBoard SummaryWriter. No-op if tensorboard is unavailable."""

    def __init__(self, log_dir: Path | None) -> None:
        self._writer = None
        self._max_fame: float = 0.0
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
        fame = max(0, stats.total_reward - 1.0)
        self._max_fame = max(self._max_fame, fame)
        self._writer.add_scalar("reward/total", stats.total_reward, episode)
        self._writer.add_scalar("reward/fame", fame, episode)
        self._writer.add_scalar("reward/fame_max", self._max_fame, episode)
        self._writer.add_scalar("episode/steps", stats.steps, episode)
        self._writer.add_scalar("episode/fame_binary", 1.0 if stats.total_reward > 1.5 else 0.0, episode)
        self._writer.add_scalar("optimization/loss", stats.optimization.loss, episode)
        self._writer.add_scalar("optimization/entropy", stats.optimization.entropy, episode)
        self._writer.add_scalar("optimization/critic_loss", stats.optimization.critic_loss, episode)
        self._writer.add_scalar("optimization/action_count", stats.optimization.action_count, episode)
        self._writer.add_scalar("victory/scenario_triggered", 1.0 if getattr(stats, "scenario_triggered", False) else 0.0, episode)
        self._writer.add_scalar("victory/achievement_bonus", getattr(stats, "achievement_bonus", 0.0), episode)

    def close(self) -> None:
        if self._writer is not None:
            self._writer.close()


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
    parser.add_argument("--critic-coef", type=float, default=0.5, help="Critic (value) loss coefficient")
    parser.add_argument("--hidden-size", type=int, default=128, help="Hidden size for action scoring network")
    parser.add_argument("--device", default="auto", help="Torch device (auto, cpu, cuda, mps)")
    parser.add_argument("--embedding-dim", type=int, default=16, help="Embedding dimension for entity IDs (default: 16)")
    parser.add_argument("--no-embeddings", action="store_true", help="Disable learned embeddings, use legacy flat encoding")
    parser.add_argument("--num-hidden-layers", type=int, default=1, help="Number of hidden layers in state/action encoders (default: 1)")

    parser.add_argument("--fame-delta-scale", type=float, default=1.0, help="Reward multiplier for fame deltas")
    parser.add_argument("--step-penalty", type=float, default=-0.001, help="Per-step reward penalty")
    parser.add_argument("--terminal-end-bonus", type=float, default=1.0, help="Bonus when game ends normally")
    parser.add_argument("--terminal-max-steps-penalty", type=float, default=-0.5, help="Penalty when episode hits max steps")
    parser.add_argument("--terminal-failure-penalty", type=float, default=-1.0, help="Penalty for protocol/disconnect/invariant failures")

    parser.add_argument("--victory-trigger-bonus", type=float, default=15.0, help="One-time reward when scenario end is triggered")
    parser.add_argument("--achievement-scale", type=float, default=0.5, help="Multiplier for end-game achievement score bonus")

    parser.add_argument("--checkpoint-dir", default="./sim-artifacts/rl-checkpoints", help="Directory for model checkpoints + logs")
    parser.add_argument("--checkpoint-every", type=int, default=25, help="Save checkpoint every N episodes")
    parser.add_argument("--no-final-checkpoint", action="store_true", help="Do not save a final checkpoint at the end")
    parser.add_argument("--resume", metavar="PATH", help="Resume from checkpoint (load policy + optimizer); run --episodes more from here")
    parser.add_argument("--benchmark", action="store_true", help="Report per-step timing breakdown at the end")

    parser.add_argument("--save-top-games", type=float, default=None, metavar="THRESHOLD",
                        help="Save full game replay for episodes with total_reward >= THRESHOLD")

    parser.add_argument("--workers", type=int, default=1, help="Number of parallel worker processes (default: 1 = sequential)")
    parser.add_argument("--episodes-per-sync", type=int, default=1, help="Episodes each worker runs before gradient sync (default: 1)")
    parser.add_argument("--base-port", type=int, default=None, metavar="PORT",
                        help="Base port for per-worker game servers (e.g. 3001 → workers use 3001,3002,...). "
                             "Start servers with: bun packages/server/cluster.ts --workers N --base-port PORT")

    # PPO flags
    parser.add_argument("--ppo", action="store_true", help="Use PPO instead of REINFORCE")
    parser.add_argument("--batch-episodes", type=int, default=16, help="Episodes per PPO update batch (sequential, default: 16)")
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
    VictoryRewardComponent = components["VictoryRewardComponent"]

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
            use_embeddings=not args.no_embeddings,
            num_hidden_layers=args.num_hidden_layers,
        )
        policy = ReinforcePolicy(policy_config)

    victory = VictoryRewardComponent(
        scenario_trigger_bonus=args.victory_trigger_bonus,
        achievement_scale=args.achievement_scale,
    )
    reward_config = RewardConfig(
        fame_delta_scale=args.fame_delta_scale,
        step_penalty=args.step_penalty,
        terminal_end_bonus=args.terminal_end_bonus,
        terminal_max_steps_penalty=args.terminal_max_steps_penalty,
        terminal_failure_penalty=args.terminal_failure_penalty,
        components=(victory,),
    )

    checkpoint_dir = Path(args.checkpoint_dir)
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    metrics_path = checkpoint_dir / "training_log.ndjson"

    if not args.resume:
        _write_run_manifest(checkpoint_dir, args, policy, reward_config)

    algo = "PPO" if args.ppo else "REINFORCE"
    print(f"Training episodes={args.episodes} seed={args.seed} max_steps={args.max_steps} algorithm={algo}")
    print(
        "Rewards: "
        f"fame_delta_scale={args.fame_delta_scale} "
        f"step_penalty={args.step_penalty} "
        f"end_bonus={args.terminal_end_bonus} "
        f"max_steps_penalty={args.terminal_max_steps_penalty} "
        f"failure_penalty={args.terminal_failure_penalty} "
        f"victory_trigger={args.victory_trigger_bonus} "
        f"achievement_scale={args.achievement_scale}"
    )

    if args.ppo:
        if args.workers > 1:
            batch = args.workers * args.episodes_per_sync
            print(f"PPO distributed: workers={args.workers} eps_per_sync={args.episodes_per_sync} batch={batch} ppo_epochs={args.ppo_epochs} clip={args.clip_epsilon} gae_lambda={args.gae_lambda}")
        else:
            print(f"PPO sequential: batch_episodes={args.batch_episodes} ppo_epochs={args.ppo_epochs} clip={args.clip_epsilon} gae_lambda={args.gae_lambda}")
    elif args.workers > 1:
        print(f"Distributed REINFORCE: workers={args.workers} episodes_per_sync={args.episodes_per_sync}")

    replay_dir: Path | None = None
    if args.save_top_games is not None:
        replay_dir = checkpoint_dir / "replays"
        replay_dir.mkdir(parents=True, exist_ok=True)
        print(f"Saving replays for reward >= {args.save_top_games} -> {replay_dir}")

    tb = _TBWriter(checkpoint_dir / "tensorboard")
    print(f"TensorBoard: tensorboard --logdir {checkpoint_dir / 'tensorboard'}")

    print("-" * 88)

    try:
        if args.ppo:
            if args.workers > 1:
                return _train_ppo_distributed(args, policy, reward_config, checkpoint_dir, metrics_path, components, replay_dir, tb, resume_episode_offset)
            return _train_ppo_sequential(args, policy, reward_config, checkpoint_dir, metrics_path, components, replay_dir, tb, resume_episode_offset)
        if args.workers > 1:
            return _train_distributed(args, policy, reward_config, checkpoint_dir, metrics_path, components, replay_dir, tb, resume_episode_offset)
        return _train_sequential(args, policy, reward_config, checkpoint_dir, metrics_path, components["ReinforceTrainer"], replay_dir, tb, resume_episode_offset)
    finally:
        tb.close()


# ---------------------------------------------------------------------------
# REINFORCE training loops (existing)
# ---------------------------------------------------------------------------


def _train_sequential(
    args: argparse.Namespace,
    policy: Any,
    reward_config: Any,
    checkpoint_dir: Path,
    metrics_path: Path,
    ReinforceTrainer: type,
    replay_dir: Path | None = None,
    tb: _TBWriter | None = None,
    resume_episode_offset: int = 0,
) -> int:
    """Original sequential training loop."""
    trainer = ReinforceTrainer(policy=policy, reward_config=reward_config)

    agg_step_timings = StepTimings() if args.benchmark else None

    for episode in range(args.episodes):
        global_ep = resume_episode_offset + episode + 1
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
            collect_step_timings=args.benchmark,
        )

        capture = replay_dir is not None
        sim_output = run_simulations_sync(config, policy=policy, hooks=trainer, return_traces=capture)
        if capture:
            results, _summary, msg_logs, trace_logs = sim_output
        else:
            results, _summary = sim_output
            msg_logs = None
            trace_logs = None
        result = results[0]
        if agg_step_timings is not None and result.step_timings is not None:
            agg_step_timings.enumerate_ns += result.step_timings.enumerate_ns
            agg_step_timings.sort_ns += result.step_timings.sort_ns
            agg_step_timings.policy_ns += result.step_timings.policy_ns
            agg_step_timings.server_ns += result.step_timings.server_ns
            agg_step_timings.hooks_ns += result.step_timings.hooks_ns
            agg_step_timings.overhead_ns += result.step_timings.overhead_ns
            agg_step_timings.step_count += result.step_timings.step_count
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
                "critic_loss": stats.optimization.critic_loss,
            },
        )

        print(
            f"ep={global_ep:04d} seed={seed} outcome={result.outcome:<17} "
            f"steps={result.steps:<6} reward={stats.total_reward:>8.3f} "
            f"loss={stats.optimization.loss:>9.4f} entropy={stats.optimization.entropy:>7.4f}"
        )

        if tb is not None:
            tb.log_episode(global_ep, stats)

        if (replay_dir is not None
                and msg_logs is not None
                and trace_logs is not None
                and args.save_top_games is not None
                and stats.total_reward >= args.save_top_games):
            _save_replay(replay_dir, global_ep, seed, stats, msg_logs[0], trace_logs[0])
            _prune_replays(replay_dir, keep=50)

        if args.checkpoint_every > 0 and global_ep % args.checkpoint_every == 0:
            checkpoint_path = checkpoint_dir / f"policy_ep_{global_ep:04d}.pt"
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
                "seed": args.seed + args.episodes - 1,
                "timestamp": datetime.now(UTC).isoformat(),
            },
        )
        print(f"Final checkpoint: {final_path}")

    if agg_step_timings is not None and agg_step_timings.step_count > 0:
        _print_step_timings(agg_step_timings, args.episodes)

    print(f"Metrics log: {metrics_path}")
    return 0


def _train_distributed(
    args: argparse.Namespace,
    policy: Any,
    reward_config: Any,
    checkpoint_dir: Path,
    metrics_path: Path,
    components: dict[str, Any],
    replay_dir: Path | None = None,
    tb: _TBWriter | None = None,
    resume_episode_offset: int = 0,
) -> int:
    """Distributed REINFORCE training via data-parallel gradient accumulation."""
    DistributedReinforceTrainer = components["DistributedReinforceTrainer"]

    runner_config = RunnerConfig(
        bootstrap_api_base_url=args.bootstrap_url,
        ws_server_url=args.ws_url,
        player_count=args.player_count,
        runs=1,
        max_steps=args.max_steps,
        base_seed=args.seed,
        artifacts_dir=args.artifacts_dir,
        write_failure_artifacts=args.save_failures,
        allow_undo=not args.no_undo,
    )

    server_urls = _build_server_urls(args.base_port, args.workers)
    dist_trainer = DistributedReinforceTrainer(
        policy=policy,
        reward_config=reward_config,
        runner_config=runner_config,
        num_workers=args.workers,
        episodes_per_sync=args.episodes_per_sync,
        replay_dir=replay_dir,
        replay_threshold=args.save_top_games,
        server_urls=server_urls,
    )

    episode = 0
    for stats in dist_trainer.train(total_episodes=args.episodes, start_seed=args.seed):
        global_ep = resume_episode_offset + episode + 1
        seed = args.seed + episode

        _append_metrics_log_from_stats(
            path=metrics_path,
            episode=global_ep - 1,
            seed=seed,
            stats=stats,
        )

        print(
            f"ep={global_ep:04d} seed={seed} outcome={stats.outcome:<17} "
            f"steps={stats.steps:<6} reward={stats.total_reward:>8.3f} "
            f"loss={stats.optimization.loss:>9.4f} entropy={stats.optimization.entropy:>7.4f}"
        )

        if tb is not None:
            tb.log_episode(global_ep, stats)

        if args.checkpoint_every > 0 and global_ep % args.checkpoint_every == 0:
            checkpoint_path = checkpoint_dir / f"policy_ep_{global_ep:04d}.pt"
            policy.save_checkpoint(
                checkpoint_path,
                metadata={
                    "episode": global_ep,
                    "seed": seed,
                    "timestamp": datetime.now(UTC).isoformat(),
                },
            )

        episode += 1

    if not args.no_final_checkpoint:
        final_ep = resume_episode_offset + args.episodes
        final_path = checkpoint_dir / "policy_final.pt"
        policy.save_checkpoint(
            final_path,
            metadata={
                "episode": final_ep,
                "seed": args.seed + args.episodes - 1,
                "timestamp": datetime.now(UTC).isoformat(),
            },
        )
        print(f"Final checkpoint: {final_path}")

    print(f"Metrics log: {metrics_path}")
    return 0


# ---------------------------------------------------------------------------
# PPO training loops
# ---------------------------------------------------------------------------


def _train_ppo_sequential(
    args: argparse.Namespace,
    policy: Any,
    reward_config: Any,
    checkpoint_dir: Path,
    metrics_path: Path,
    components: dict[str, Any],
    replay_dir: Path | None = None,
    tb: _TBWriter | None = None,
    resume_episode_offset: int = 0,
) -> int:
    """Sequential PPO training: collect batch, optimize, repeat."""
    PPOTrainer = components["PPOTrainer"]
    compute_gae = components["compute_gae"]

    ppo_trainer = PPOTrainer(policy=policy, reward_config=reward_config)
    episode_num = 0

    while episode_num < args.episodes:
        batch_size = min(args.batch_episodes, args.episodes - episode_num)

        # Collect batch_size episodes
        for i in range(batch_size):
            seed = args.seed + episode_num + i
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

            capture = replay_dir is not None
            sim_output = run_simulations_sync(
                config, policy=policy, hooks=ppo_trainer,
                return_traces=capture,
            )
            if capture:
                _results, _summary, msg_logs, trace_logs = sim_output
            else:
                _results, _summary = sim_output
                msg_logs = None
                trace_logs = None

            # Save replay for this episode if above threshold
            ep_stats = ppo_trainer.last_episode_stats
            if (capture
                    and msg_logs is not None
                    and trace_logs is not None
                    and args.save_top_games is not None
                    and ep_stats is not None
                    and ep_stats.total_reward >= args.save_top_games):
                _save_replay(replay_dir, episode_num + i + 1, seed, ep_stats, msg_logs[0], trace_logs[0])
                _prune_replays(replay_dir, keep=50)

        # PPO optimization
        episodes_data, batch_stats = ppo_trainer.harvest()
        transitions, advantages, returns = compute_gae(
            episodes_data, args.gamma, args.gae_lambda,
        )
        opt_stats = policy.optimize_ppo(
            transitions, advantages, returns,
            clip_epsilon=args.clip_epsilon,
            ppo_epochs=args.ppo_epochs,
            max_grad_norm=args.max_grad_norm,
            mini_batch_size=args.mini_batch_size,
        )

        # Log each episode in the batch
        for i, stats in enumerate(batch_stats):
            global_ep = resume_episode_offset + episode_num + i + 1
            seed = args.seed + episode_num + i

            _append_metrics_log_from_stats(
                path=metrics_path, episode=global_ep - 1, seed=seed,
                stats=_with_opt(stats, opt_stats),
            )

            print(
                f"ep={global_ep:04d} seed={seed} outcome={stats.outcome:<17} "
                f"steps={stats.steps:<6} reward={stats.total_reward:>8.3f} "
                f"loss={opt_stats.loss:>9.4f} entropy={opt_stats.entropy:>7.4f}"
            )

            if tb is not None:
                tb.log_episode(global_ep, _with_opt(stats, opt_stats))

        episode_num += len(batch_stats)

        # Checkpoint
        global_ep_end = resume_episode_offset + episode_num
        if args.checkpoint_every > 0 and global_ep_end % args.checkpoint_every < len(batch_stats):
            checkpoint_path = checkpoint_dir / f"policy_ep_{global_ep_end:06d}.pt"
            policy.save_checkpoint(
                checkpoint_path,
                metadata={
                    "episode": global_ep_end,
                    "seed": args.seed + episode_num - 1,
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
                "seed": args.seed + args.episodes - 1,
                "timestamp": datetime.now(UTC).isoformat(),
            },
        )
        print(f"Final checkpoint: {final_path}")

    print(f"Metrics log: {metrics_path}")
    return 0


def _train_ppo_distributed(
    args: argparse.Namespace,
    policy: Any,
    reward_config: Any,
    checkpoint_dir: Path,
    metrics_path: Path,
    components: dict[str, Any],
    replay_dir: Path | None = None,
    tb: _TBWriter | None = None,
    resume_episode_offset: int = 0,
) -> int:
    """Distributed PPO: workers collect transitions, main process optimizes."""
    DistributedPPOTrainer = components["DistributedPPOTrainer"]

    runner_config = RunnerConfig(
        bootstrap_api_base_url=args.bootstrap_url,
        ws_server_url=args.ws_url,
        player_count=args.player_count,
        runs=1,
        max_steps=args.max_steps,
        base_seed=args.seed,
        artifacts_dir=args.artifacts_dir,
        write_failure_artifacts=args.save_failures,
        allow_undo=not args.no_undo,
    )

    server_urls = _build_server_urls(args.base_port, args.workers)
    dist_trainer = DistributedPPOTrainer(
        policy=policy,
        reward_config=reward_config,
        runner_config=runner_config,
        num_workers=args.workers,
        episodes_per_sync=args.episodes_per_sync,
        ppo_epochs=args.ppo_epochs,
        clip_epsilon=args.clip_epsilon,
        gae_lambda=args.gae_lambda,
        max_grad_norm=args.max_grad_norm,
        mini_batch_size=args.mini_batch_size,
        replay_dir=replay_dir,
        replay_threshold=args.save_top_games,
        server_urls=server_urls,
    )

    episode = 0
    for stats in dist_trainer.train(total_episodes=args.episodes, start_seed=args.seed):
        global_ep = resume_episode_offset + episode + 1
        seed = args.seed + episode

        _append_metrics_log_from_stats(
            path=metrics_path, episode=global_ep - 1, seed=seed, stats=stats,
        )

        print(
            f"ep={global_ep:04d} seed={seed} outcome={stats.outcome:<17} "
            f"steps={stats.steps:<6} reward={stats.total_reward:>8.3f} "
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

        episode += 1

    if not args.no_final_checkpoint:
        final_ep = resume_episode_offset + args.episodes
        final_path = checkpoint_dir / "policy_final.pt"
        policy.save_checkpoint(
            final_path,
            metadata={
                "episode": final_ep,
                "seed": args.seed + args.episodes - 1,
                "timestamp": datetime.now(UTC).isoformat(),
            },
        )
        print(f"Final checkpoint: {final_path}")

    print(f"Metrics log: {metrics_path}")
    return 0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_server_urls(
    base_port: int | None, num_workers: int,
) -> list[tuple[str, str]] | None:
    """Build per-worker (bootstrap_url, ws_url) pairs from a base port."""
    if base_port is None:
        return None
    return [
        (f"http://127.0.0.1:{base_port + i}", f"ws://127.0.0.1:{base_port + i}")
        for i in range(num_workers)
    ]


def _with_opt(stats: Any, opt: Any) -> Any:
    """Return EpisodeTrainingStats with updated optimization info."""
    from mage_knight_sdk.sim.rl.trainer import EpisodeTrainingStats
    return EpisodeTrainingStats(
        outcome=stats.outcome,
        steps=stats.steps,
        total_reward=stats.total_reward,
        optimization=opt,
        scenario_triggered=stats.scenario_triggered,
        achievement_bonus=stats.achievement_bonus,
    )


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
        from mage_knight_sdk.sim.rl.distributed_trainer import (
            DistributedPPOTrainer,
            DistributedReinforceTrainer,
        )
        from mage_knight_sdk.sim.rl.policy_gradient import (
            PolicyGradientConfig,
            ReinforcePolicy,
            compute_gae,
        )
        from mage_knight_sdk.sim.rl.rewards import RewardConfig, VictoryRewardComponent
        from mage_knight_sdk.sim.rl.trainer import PPOTrainer, ReinforceTrainer
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
        "DistributedPPOTrainer": DistributedPPOTrainer,
        "DistributedReinforceTrainer": DistributedReinforceTrainer,
        "PolicyGradientConfig": PolicyGradientConfig,
        "ReinforcePolicy": ReinforcePolicy,
        "RewardConfig": RewardConfig,
        "ReinforceTrainer": ReinforceTrainer,
        "PPOTrainer": PPOTrainer,
        "VictoryRewardComponent": VictoryRewardComponent,
        "compute_gae": compute_gae,
    }


def _print_step_timings(agg: StepTimings, num_episodes: int) -> None:
    """Print per-step component timing breakdown."""
    summary = agg.summary()
    print(f"\n--- Step Timing Breakdown ({num_episodes} episodes, {agg.step_count} steps) ---")
    print(f"{'Component':<14} {'Total':>8}  {'Per-step':>10}  {'% of step':>9}")
    for name in ("enumerate", "sort", "policy", "server", "hooks", "overhead"):
        row = summary[name]
        total_s = row["total_ms"] / 1000
        print(f"{name:<14} {total_s:>7.1f}s  {row['per_step_ms']:>8.1f}ms  {row['pct']:>8.1f}%")
    print("\u2500" * 47)
    total_row = summary["total"]
    total_s = total_row["total_ms"] / 1000
    print(f"{'total':<14} {total_s:>7.1f}s  {total_row['per_step_ms']:>8.1f}ms  {total_row['pct']:>8.1f}%")


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


def _append_metrics_log_from_stats(
    path: Path,
    episode: int,
    seed: int,
    stats: Any,
) -> None:
    """Write metrics from EpisodeTrainingStats (distributed/PPO training path)."""
    record = {
        "episode": episode + 1,
        "seed": seed,
        "outcome": stats.outcome,
        "steps": stats.steps,
        "reason": None,
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


def _save_replay(
    replay_dir: Path,
    episode: int,
    seed: int,
    stats: Any,
    messages: list[Any],
    trace: list[Any] | None = None,
) -> None:
    """Save a notable game replay as JSON in viewer-compatible format."""
    from dataclasses import asdict

    record: dict[str, Any] = {
        "run": {
            "run_index": 0,
            "seed": seed,
            "outcome": stats.outcome,
            "steps": stats.steps,
            "game_id": f"rl_ep{episode}",
            "total_reward": stats.total_reward,
            "episode": episode,
        },
    }

    if trace is not None:
        record["actionTrace"] = [
            asdict(entry) if hasattr(entry, "__dataclass_fields__") else entry
            for entry in trace
        ]
    else:
        record["actionTrace"] = []

    record["messageLog"] = [
        asdict(msg) if hasattr(msg, "__dataclass_fields__") else msg
        for msg in messages
    ]

    path = replay_dir / f"replay_ep{episode:06d}_seed{seed}_r{stats.total_reward:.1f}.json"
    path.write_text(json.dumps(record, indent=2, sort_keys=True), encoding="utf-8")
    print(f"  -> Saved replay: {path.name}")


def _prune_replays(replay_dir: Path, keep: int = 50) -> None:
    """Keep only the top N replays by reward, delete the rest."""
    files = list(replay_dir.glob("replay_*.json"))
    if len(files) <= keep:
        return

    def _reward_from_name(p: Path) -> float:
        # filename: replay_ep000433_seed433_r5.9.json
        name = p.stem  # replay_ep000433_seed433_r5.9
        try:
            return float(name.rsplit("_r", 1)[1])
        except (IndexError, ValueError):
            return 0.0

    files.sort(key=_reward_from_name, reverse=True)
    for f in files[keep:]:
        f.unlink()
        print(f"  -> Pruned replay: {f.name}")


if __name__ == "__main__":
    raise SystemExit(main())
