#!/usr/bin/env python3
"""
Run a single seed with full artifact capture, using the sim harness server.
No need for external server - spawns harness, runs sim, analyzes fame.

Usage:
  python3 scripts/run_seed_with_artifact.py [--seed SEED]
"""
from __future__ import annotations

import asyncio
import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]  # scripts -> python-sdk -> packages
# Go up one more to repo root
REPO_ROOT = REPO_ROOT.parent
SDK_SRC = REPO_ROOT / "packages/python-sdk/src"
sys.path.insert(0, str(SDK_SRC))

from mage_knight_sdk.sim.runner import RunnerConfig, run_simulations


async def main() -> int:
    seed = 398
    if "--seed" in sys.argv:
        i = sys.argv.index("--seed")
        if i + 1 < len(sys.argv):
            seed = int(sys.argv[i + 1])

    harness = REPO_ROOT / "packages/python-sdk/tests/integration/sim_harness_test_server.ts"
    proc = subprocess.Popen(
        ["bun", "run", str(harness)],
        cwd=str(REPO_ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        line = proc.stdout.readline()
        if not line:
            stderr = proc.stderr.read() if proc.stderr else ""
            print(f"Harness failed to start: {stderr}", file=sys.stderr)
            return 1
        ports = json.loads(line)
        api_url = f"http://127.0.0.1:{ports['apiPort']}"
        ws_url = f"ws://127.0.0.1:{ports['wsPort']}"
    except Exception as e:
        print(f"Failed to parse harness output: {e}", file=sys.stderr)
        proc.terminate()
        return 1

    artifacts_dir = REPO_ROOT / "packages/python-sdk/sim-artifacts"
    config = RunnerConfig(
        bootstrap_api_base_url=api_url,
        ws_server_url=ws_url,
        player_count=2,
        runs=1,
        max_steps=10000,
        base_seed=seed,
        artifacts_dir=str(artifacts_dir),
        write_full_artifact=True,
        allow_undo=True,
    )

    try:
        results, _ = await run_simulations(config)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()

    result = results[0]
    print(f"\nSeed {seed}: outcome={result.outcome} steps={result.steps}")
    if result.failure_artifact_path:
        print(f"Artifact: {result.failure_artifact_path}")
        analyze_fame(result.failure_artifact_path)
    else:
        print("No artifact written (run may have crashed before finish)")
    return 0


def analyze_fame(artifact_path: str) -> None:
    """Scan artifact for fame-granting events and correlate with actions."""
    path = Path(artifact_path)
    if not path.exists():
        print(f"Artifact not found: {path}")
        return
    data = json.loads(path.read_text())
    action_trace = data.get("actionTrace") or []
    message_log = data.get("messageLog") or []

    # Build step -> action type for correlation
    step_to_action: dict[int, dict] = {}
    for t in action_trace:
        s = t.get("step")
        if s is not None:
            step_to_action[s] = t.get("action", {})

    # Scan state_update messages for events (FAME_GAINED, ENEMY_DEFEATED, etc.)
    # messageLog is per-player; state_update has events + state
    msg_index = 0
    fame_events: list[tuple[int, str, int, str]] = []

    for msg in message_log:
        payload = msg.get("payload") or {}
        if payload.get("type") != "state_update":
            continue
        events = payload.get("events") or []
        state = payload.get("state")
        # Step: count state_updates so far; last action step is our best guess
        last_step = max((t.get("step", -1) for t in action_trace if t.get("step") is not None), default=-1)
        for t in action_trace:
            if t.get("step") is not None and t.get("step") <= msg_index:
                last_step = t["step"]

        for ev in events:
            if not isinstance(ev, dict):
                continue
            ev_type = ev.get("type")
            if ev_type == "FAME_GAINED":
                pid = ev.get("playerId")
                amount = ev.get("amount", 0)
                source = ev.get("source", "?")
                if pid and amount:
                    fame_events.append((last_step, pid, amount, source))
            elif ev_type == "ENEMY_DEFEATED":
                pid = ev.get("playerId")
                amount = ev.get("fameGained", 0)
                enemy = ev.get("enemyName", "enemy")
                if pid and amount:
                    fame_events.append((last_step, pid, amount, f"defeated {enemy}"))
        msg_index += 1

    # If no FAME_GAINED/ENEMY_DEFEATED in events, fall back to state diff
    if not fame_events and message_log:
        prev_fame: dict[str, int] = {}
        for i, msg in enumerate(message_log):
            payload = msg.get("payload") or {}
            if payload.get("type") != "state_update":
                continue
            state = payload.get("state")
            if not isinstance(state, dict):
                continue
            step = next((t["step"] for t in reversed(action_trace) if t.get("step") is not None and t.get("step") <= i), -1)
            for p in state.get("players") or []:
                pid = p.get("id")
                fame = p.get("fame", 0)
                if pid is None:
                    continue
                prev = prev_fame.get(pid, 0)
                if fame > prev:
                    act = step_to_action.get(step, {})
                    fame_events.append((step, pid, fame - prev, act.get("type", "?")))
                prev_fame[pid] = fame

    print("\n--- Fame earned ---")
    for step, pid, delta, source in sorted(fame_events, key=lambda x: (x[0], x[1])):
        print(f"  Step {step}: {pid} +{delta} fame ({source})")


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
