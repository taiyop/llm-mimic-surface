const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "proxy-authorization",
  "x-api-key",
  "x-goog-api-key",
  "cookie",
  "set-cookie"
]);

export function isSensitiveHeader(name: string): boolean {
  return SENSITIVE_HEADER_NAMES.has(name.toLowerCase());
}

export function redactHeaders(
  headers: Record<string, string | string[] | undefined>
): Record<string, string | string[] | undefined> {
  const redacted: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    redacted[key] = isSensitiveHeader(key) ? "[redacted]" : value;
  }
  return redacted;
}
