from __future__ import annotations

import asyncio
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[4]
SDK_SRC = REPO_ROOT / "packages/python-sdk/src"
if str(SDK_SRC) not in sys.path:
    sys.path.insert(0, str(SDK_SRC))

from mage_knight_sdk.sim.runner import RunnerConfig, run_simulations
from mage_knight_sdk.sim.invariants import InvariantViolation


class SimulationRunnerIntegrationTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.repo_root = REPO_ROOT
        self.server_script = self.repo_root / "packages/python-sdk/tests/integration/sim_harness_test_server.ts"

        self.server = await asyncio.create_subprocess_exec(
            "bun",
            "run",
            str(self.server_script),
            cwd=str(self.repo_root),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        assert self.server.stdout is not None
        line = await asyncio.wait_for(self.server.stdout.readline(), timeout=10)
        if not line:
            stderr = await self._read_stderr()
            raise RuntimeError(f"Sim test server failed to start. stderr: {stderr}")

        payload = json.loads(line.decode("utf-8"))
        self.ws_url = f"ws://127.0.0.1:{payload['wsPort']}"
        self.api_url = f"http://127.0.0.1:{payload['apiPort']}"

    async def asyncTearDown(self) -> None:
        if self.server.returncode is None:
            self.server.terminate()
            try:
                await asyncio.wait_for(self.server.wait(), timeout=5)
            except asyncio.TimeoutError:
                self.server.kill()
                await self.server.wait()

    async def test_smoke_run_is_ci_friendly(self) -> None:
        config = RunnerConfig(
            bootstrap_api_base_url=self.api_url,
            ws_server_url=self.ws_url,
            player_count=2,
            runs=1,
            base_seed=100,
            max_steps=20,
            artifacts_dir=str(self.repo_root / "packages/python-sdk/.sim-artifacts-test"),
        )

        results, summary = await run_simulations(config)

        self.assertEqual(1, len(results))
        self.assertEqual(1, summary.total_runs)
        self.assertIn(results[0].outcome, {"ended", "max_steps"})

    async def test_multi_run_fuzz_reports_outcomes(self) -> None:
        config = RunnerConfig(
            bootstrap_api_base_url=self.api_url,
            ws_server_url=self.ws_url,
            player_count=2,
            runs=3,
            base_seed=200,
            max_steps=10,
            artifacts_dir=str(self.repo_root / "packages/python-sdk/.sim-artifacts-test"),
        )

        results, summary = await run_simulations(config)

        self.assertEqual(3, len(results))
        self.assertEqual(3, summary.total_runs)
        self.assertEqual(3, summary.ended + summary.max_steps + summary.disconnect + summary.protocol_error + summary.invariant_failure)

    async def test_injected_invalid_action_is_detected(self) -> None:
        config = RunnerConfig(
            bootstrap_api_base_url=self.api_url,
            ws_server_url=self.ws_url,
            player_count=2,
            runs=1,
            base_seed=333,
            max_steps=15,
            forced_invalid_action_step=0,
            artifacts_dir=str(self.repo_root / "packages/python-sdk/.sim-artifacts-test"),
            write_failure_artifacts=True,
        )

        results, _summary = await run_simulations(config)
        result = results[0]

        self.assertEqual("protocol_error", result.outcome)
        self.assertIsNotNone(result.failure_artifact_path)

    async def test_invariant_violation_is_reported_as_invariant_failure(self) -> None:
        config = RunnerConfig(
            bootstrap_api_base_url=self.api_url,
            ws_server_url=self.ws_url,
            player_count=2,
            runs=1,
            base_seed=444,
            max_steps=5,
            artifacts_dir=str(self.repo_root / "packages/python-sdk/.sim-artifacts-test"),
            write_failure_artifacts=True,
        )

        with patch(
            "mage_knight_sdk.sim.invariants.StateInvariantTracker.check_state",
            side_effect=InvariantViolation("forced_invariant_failure"),
        ):
            results, _summary = await run_simulations(config)

        result = results[0]
        self.assertEqual("invariant_failure", result.outcome)
        self.assertIsNotNone(result.failure_artifact_path)

    async def _read_stderr(self) -> str:
        if self.server.stderr is None:
            return ""

        chunks: list[str] = []
        while True:
            line = await self.server.stderr.readline()
            if not line:
                break
            chunks.append(line.decode("utf-8"))

        return "".join(chunks)


if __name__ == "__main__":
    unittest.main()
