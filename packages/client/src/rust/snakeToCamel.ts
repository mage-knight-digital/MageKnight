/**
 * Deep key transform: snake_case -> camelCase.
 *
 * Applied to ClientGameState received from the Rust server so that
 * existing display components (which expect camelCase keys) work unchanged.
 *
 * Only transforms object keys — string values are left intact.
 */

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function snakeToCamel(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(snakeToCamel);
  }

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    result[toCamelCase(key)] = snakeToCamel(obj[key]);
  }
  return result;
}
