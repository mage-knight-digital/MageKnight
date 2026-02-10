"""Run the sim artifact viewer server."""

from __future__ import annotations

import argparse
from pathlib import Path

from .server import run


def main() -> None:
    parser = argparse.ArgumentParser(description="Sim artifact viewer (streaming large JSON)")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host")
    parser.add_argument("--port", type=int, default=8765, help="Bind port")
    parser.add_argument(
        "--artifacts-dir",
        type=Path,
        default=None,
        help="Path to sim-artifacts (default: package sim-artifacts/)",
    )
    args = parser.parse_args()
    run(host=args.host, port=args.port, artifacts_dir=args.artifacts_dir)


if __name__ == "__main__":
    main()
