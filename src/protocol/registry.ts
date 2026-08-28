import { BackendError } from "../boundary/errors.js";
import type { ProtocolAdapter, RouteSpec } from "./types.js";

export class RouteCollisionError extends Error {
  readonly collisions: string[];

  constructor(collisions: string[]) {
    super(
      `Route collision detected: ${collisions.join(", ")}. ` +
        "OpenAI and xAI share the same default paths; set distinct prefixes, for example " +
        "openAIProtocol({ prefix: \"/openai\" }) and xaiProtocol({ prefix: \"/xai\" })."
    );
    this.name = "RouteCollisionError";
    this.collisions = collisions;
  }
}

export class ProtocolRegistry {
  private readonly adapters = new Map<string, ProtocolAdapter>();
  private readonly routes: RouteSpec[] = [];
  private readonly keys = new Set<string>();

  registerAdapter(adapter: ProtocolAdapter): void {
    if (this.adapters.has(adapter.id)) {
      throw new BackendError({
        code: "invalid_request",
        message: `Duplicate protocol adapter id: ${adapter.id}`
      });
    }
    this.adapters.set(adapter.id, adapter);
  }

  route(spec: RouteSpec): void {
    const key = `${spec.method} ${spec.path}`;
    if (this.keys.has(key)) {
      throw new RouteCollisionError([key]);
    }
    this.keys.add(key);
    this.routes.push(spec);
  }

  list(): RouteSpec[] {
    return [...this.routes];
  }

  get(id: string): ProtocolAdapter | undefined {
    return this.adapters.get(id);
  }
}
