import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import {
  llmMimicSurfacePlugin,
  type LLMMimicSurfacePluginOptions
} from "./transport/http/plugin.js";

export interface CreateStandaloneServerOptions extends LLMMimicSurfacePluginOptions {
  fastify?: FastifyServerOptions;
}

/**
 * Convenience API for examples and local verification.
 * Production applications should create their own Fastify host and register
 * llmMimicSurfacePlugin directly.
 */
export async function createStandaloneServer(
  options: CreateStandaloneServerOptions
): Promise<FastifyInstance> {
  const app = Fastify(options.fastify);
  await app.register(llmMimicSurfacePlugin, {
    backend: options.backend,
    protocols: options.protocols,
    hooks: options.hooks,
    lossyConversion: options.lossyConversion
  });
  await app.ready();
  return app;
}
