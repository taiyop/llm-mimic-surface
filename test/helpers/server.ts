import {
  createEchoBackend,
  createExternalApiServer,
  type CreateServerOptions,
  type ExternalApiBackend,
  type ExternalApiServer,
  type ProtocolAdapter
} from "../../src/index.js";

export async function withInjectedServer(
  protocols: ProtocolAdapter[],
  fn: (server: ExternalApiServer) => Promise<void>,
  options?: Partial<CreateServerOptions> & { backend?: ExternalApiBackend }
): Promise<void> {
  const server = createExternalApiServer({
    backend: options?.backend ?? createEchoBackend(),
    protocols,
    auth: options?.auth ?? false,
    cors: options?.cors ?? true,
    hooks: options?.hooks,
    lossyConversion: options?.lossyConversion,
    requestTimeoutMs: options?.requestTimeoutMs,
    bodyLimit: options?.bodyLimit
  });
  try {
    await fn(server);
  } finally {
    await server.close();
  }
}

export async function withListeningServer(
  protocols: ProtocolAdapter[],
  fn: (baseUrl: string, server: ExternalApiServer) => Promise<void>,
  options?: Partial<CreateServerOptions> & { backend?: ExternalApiBackend }
): Promise<void> {
  const server = createExternalApiServer({
    backend: options?.backend ?? createEchoBackend(),
    protocols,
    auth: options?.auth ?? false,
    cors: options?.cors ?? true,
    hooks: options?.hooks,
    lossyConversion: options?.lossyConversion,
    requestTimeoutMs: options?.requestTimeoutMs
  });
  const address = await server.listen({ host: "127.0.0.1", port: 0 });
  const baseUrl = `http://127.0.0.1:${address.port}`;
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
