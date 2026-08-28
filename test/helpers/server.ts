import Fastify, { type FastifyInstance } from "fastify";
import {
  createEchoBackend,
  type ExternalApiBackend,
  type LLMMimicSurfacePluginOptions,
  llmMimicSurfacePlugin,
  type ProtocolAdapter
} from "../../src/index.js";

type TestServerOptions = Omit<Partial<LLMMimicSurfacePluginOptions>, "protocols"> & {
  backend?: ExternalApiBackend;
  configureHost?: (app: FastifyInstance) => void | Promise<void>;
};

export async function withInjectedServer(
  protocols: ProtocolAdapter[],
  fn: (server: FastifyInstance) => Promise<void>,
  options?: TestServerOptions
): Promise<void> {
  const server = Fastify({ forceCloseConnections: true });
  await options?.configureHost?.(server);
  await server.register(llmMimicSurfacePlugin, {
    backend: options?.backend ?? createEchoBackend(),
    protocols,
    hooks: options?.hooks,
    lossyConversion: options?.lossyConversion
  });
  await server.ready();
  try {
    await fn(server);
  } finally {
    await server.close();
  }
}

export async function withListeningServer(
  protocols: ProtocolAdapter[],
  fn: (baseUrl: string, server: FastifyInstance) => Promise<void>,
  options?: TestServerOptions
): Promise<void> {
  const server = Fastify({ forceCloseConnections: true });
  await options?.configureHost?.(server);
  await server.register(llmMimicSurfacePlugin, {
    backend: options?.backend ?? createEchoBackend(),
    protocols,
    hooks: options?.hooks,
    lossyConversion: options?.lossyConversion
  });
  const baseUrl = await server.listen({ host: "127.0.0.1", port: 0 });
  try {
    await fn(baseUrl, server);
  } finally {
    await server.close();
  }
}

export async function readSse(response: Response): Promise<string> {
  if (!response.body) {
    return "";
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    out += decoder.decode(value, { stream: true });
  }
  return out;
}
