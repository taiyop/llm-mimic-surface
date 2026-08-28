const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function omitForbiddenKeys<T extends Record<string, unknown>>(input: T): T {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (FORBIDDEN_KEYS.has(key)) {
      continue;
    }
    output[key] = value;
  }
  return output as T;
}

export function collectUnknownFields(
  raw: Record<string, unknown>,
  knownKeys: readonly string[]
): Record<string, unknown> | undefined {
  const known = new Set(knownKeys);
  const unknown: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(omitForbiddenKeys(raw))) {
    if (!known.has(key)) {
      unknown[key] = value;
    }
  }
  return Object.keys(unknown).length > 0 ? unknown : undefined;
}

export function mergeExtensions(
  ...parts: Array<Record<string, unknown> | undefined>
): Record<string, unknown> | undefined {
  const merged: Record<string, unknown> = {};
  for (const part of parts) {
    if (!part) {
      continue;
    }
    for (const [key, value] of Object.entries(omitForbiddenKeys(part))) {
      const existing = merged[key];
      if (isRecord(existing) && isRecord(value)) {
        merged[key] = { ...existing, ...omitForbiddenKeys(value) };
      } else {
        merged[key] = value;
      }
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

export function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
