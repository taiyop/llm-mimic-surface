import { BackendError } from "../boundary/errors.js";
import { headerValue } from "../util/objects.js";
import type { AuthConfig, AuthContext } from "./types.js";

const TOKEN_HEADERS = ["authorization", "x-api-key", "x-goog-api-key"] as const;

export function extractToken(headers: Record<string, string | string[] | undefined>): string | undefined {
  const authorization = headerValue(headers.authorization ?? headers.Authorization);
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }
  for (const name of TOKEN_HEADERS) {
    const value = headerValue(headers[name] ?? headers[name.replace(/(^|-)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase())]);
    if (value && name !== "authorization") {
      return value.trim();
    }
  }
  return undefined;
}

export async function authenticate(auth: AuthConfig | undefined, context: AuthContext): Promise<void> {
  if (!auth) {
    return;
  }
  if (auth.type === "bearer") {
    const token = extractToken(context.headers);
    if (!token) {
      throw new BackendError({
        code: "unauthorized",
        message: "Missing bearer token",
        status: 401
      });
    }
    const ok = await auth.validate(token, context);
    if (!ok) {
      throw new BackendError({
        code: "unauthorized",
        message: "Invalid bearer token",
        status: 401
      });
    }
    return;
  }
  const ok = await auth.authenticate(context);
  if (!ok) {
    throw new BackendError({
      code: "unauthorized",
      message: "Unauthorized",
      status: 401
    });
  }
}
