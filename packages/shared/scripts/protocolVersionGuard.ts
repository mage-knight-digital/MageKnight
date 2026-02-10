export const CONTRACT_SOURCE_FILE = "packages/shared/src/networkProtocol.ts" as const;
export const CONTRACT_SCHEMA_DIR = "packages/shared/schemas/network-protocol/" as const;

export interface ProtocolVersionPolicyInput {
  changedFiles: readonly string[];
  baseVersion: string;
  headVersion: string;
}

export interface ProtocolVersionPolicyResult {
  shouldFail: boolean;
  reason?: string;
}

export function hasProtocolContractChanges(changedFiles: readonly string[]): boolean {
  return changedFiles.some(
    (file) =>
      file === CONTRACT_SOURCE_FILE ||
      file.startsWith(CONTRACT_SCHEMA_DIR)
  );
}

export function evaluateProtocolVersionPolicy(
  input: ProtocolVersionPolicyInput
): ProtocolVersionPolicyResult {
  if (!hasProtocolContractChanges(input.changedFiles)) {
    return { shouldFail: false };
  }

  if (input.baseVersion === input.headVersion) {
    return {
      shouldFail: true,
      reason: "Protocol contract changed but NETWORK_PROTOCOL_VERSION was not bumped.",
    };
  }

  return { shouldFail: false };
}

function extractConstExpression(
  source: string,
  constName: string
): string | null {
  const escapedName = constName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const declarationRegex = new RegExp(
    `export\\s+const\\s+${escapedName}\\s*=\\s*([^;\\n]+)`,
    "m"
  );
  const match = declarationRegex.exec(source);
  return match?.[1]?.trim() ?? null;
}

function resolveExpression(
  source: string,
  expression: string,
  depth: number
): string | null {
  if (depth > 10) {
    return null;
  }

  const stringMatch = expression.match(/["']([^"']+)["']/);
  if (stringMatch?.[1]) {
    return stringMatch[1];
  }

  const identifierMatch = expression.match(/^([A-Za-z_][A-Za-z0-9_]*)$/);
  if (!identifierMatch?.[1]) {
    return null;
  }

  const nestedExpression = extractConstExpression(source, identifierMatch[1]);
  if (!nestedExpression) {
    return null;
  }

  return resolveExpression(source, nestedExpression, depth + 1);
}

export function extractNetworkProtocolVersion(source: string): string {
  const expression = extractConstExpression(source, "NETWORK_PROTOCOL_VERSION");
  if (!expression) {
    throw new Error("Could not find NETWORK_PROTOCOL_VERSION export.");
  }

  const resolved = resolveExpression(source, expression, 0);
  if (!resolved) {
    throw new Error("Could not resolve NETWORK_PROTOCOL_VERSION value.");
  }

  return resolved;
}

