"""Detect replay vs artifact format and convert replays to full artifacts via mk-cli."""

from __future__ import annotations

import subprocess
from pathlib import Path


def detect_format(json_path: Path) -> str:
    """Read first 4KB of a JSON file and classify its format.

    Returns:
        "replay"           – has 'actions', no 'messageLog' (lightweight eval replay)
        "artifact"         – has 'actionTrace' (old full artifact)
        "artifact_no_trace" – has 'messageLog' but no 'actionTrace' (mk-cli artifact)
        "unknown"          – none of the above
    """
    with open(json_path, "r", encoding="utf-8") as f:
        head = f.read(4096)

    has_actions = '"actions"' in head
    has_action_trace = '"actionTrace"' in head
    has_message_log = '"messageLog"' in head

    if has_action_trace:
        return "artifact"
    if has_message_log:
        return "artifact_no_trace"
    if has_actions and not has_message_log:
        return "replay"
    return "unknown"


def find_mk_cli() -> Path | None:
    """Walk up from this package to monorepo root, look for mk-cli binary."""
    # viewer/ -> mage_knight_sdk/ -> src/ -> python-sdk/ -> packages/ -> MageKnight/
    d = Path(__file__).resolve().parent
    for _ in range(10):
        candidate_release = d / "packages" / "engine-rs" / "target" / "release" / "mk-cli"
        candidate_debug = d / "packages" / "engine-rs" / "target" / "debug" / "mk-cli"
        if candidate_release.is_file():
            return candidate_release
        if candidate_debug.is_file():
            return candidate_debug
        parent = d.parent
        if parent == d:
            break
        d = parent
    return None


def convert_replay_to_artifact(replay_path: Path, artifact_path: Path) -> bool:
    """Run mk-cli --replay <replay> --to-artifact <artifact>. Returns True on success."""
    mk_cli = find_mk_cli()
    if mk_cli is None:
        return False

    artifact_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        result = subprocess.run(
            [str(mk_cli), "--replay", str(replay_path), "--to-artifact", str(artifact_path)],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode != 0:
            print(f"  mk-cli failed (exit {result.returncode}): {result.stderr.strip()}")
            return False
        return artifact_path.is_file()
    except subprocess.TimeoutExpired:
        print("  mk-cli timed out (120s)")
        return False
    except FileNotFoundError:
        print(f"  mk-cli not found at {mk_cli}")
        return False
