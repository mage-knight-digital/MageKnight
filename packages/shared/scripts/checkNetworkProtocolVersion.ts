import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  CONTRACT_SOURCE_FILE,
  evaluateProtocolVersionPolicy,
  extractNetworkProtocolVersion,
} from "./protocolVersionGuard.js";

const BASE_REF = process.env.PROTOCOL_BASE_REF ?? "origin/main";

function runGit(args: readonly string[]): string {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed: ${result.stderr || result.stdout}`
    );
  }

  return result.stdout.trim();
}

function tryRunGit(args: readonly string[]): string | null {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    return null;
  }

  return result.stdout.trim();
}

function readCurrentSource(): string {
  const repoRoot = runGit(["rev-parse", "--show-toplevel"]);
  const filePath = join(repoRoot, CONTRACT_SOURCE_FILE);
  return readFileSync(filePath, "utf8");
}

function readBaseSource(baseRef: string): string {
  const source = tryRunGit(["show", `${baseRef}:${CONTRACT_SOURCE_FILE}`]);
  if (source === null) {
    return "";
  }

  return source;
}

function getChangedFiles(baseRef: string): string[] {
  const output = runGit(["diff", "--name-only", `${baseRef}...HEAD`]);
  if (!output) {
    return [];
  }

  return output.split("\n").filter((line) => line.length > 0);
}

function main(): void {
  const changedFiles = getChangedFiles(BASE_REF);
  const baseSource = readBaseSource(BASE_REF);
  const headSource = readCurrentSource();
  const baseVersion =
    baseSource.length > 0
      ? extractNetworkProtocolVersion(baseSource)
      : "__missing__";
  const headVersion = extractNetworkProtocolVersion(headSource);

  const result = evaluateProtocolVersionPolicy({
    changedFiles,
    baseVersion,
    headVersion,
  });

  if (result.shouldFail) {
    console.error(result.reason);
    process.exit(1);
  }

  console.log(
    `Protocol version policy passed (base=${baseVersion}, head=${headVersion}).`
  );
}

main();
