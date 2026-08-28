#!/usr/bin/env node
import { createEchoBackend } from "../backend/mock.js";
import { anthropicProtocol } from "../protocol/anthropic/index.js";
import { geminiProtocol } from "../protocol/gemini/index.js";
import { openAIProtocol } from "../protocol/openai/index.js";
import type { ProtocolAdapter } from "../protocol/types.js";
import { xaiProtocol } from "../protocol/xai/index.js";
import { createSimpleProtocol } from "../protocol/simple.js";
import { createExternalApiServer } from "../transport/http/server.js";

type CliOptions = {
  command: string;
  protocols: string[];
  port: number;
  host: string;
  auth: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);
  const command = args[0] ?? "help";
  const protocols: string[] = [];
  let port = 8080;
  let host = "127.0.0.1";
  let auth = false;

  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === "--protocol" || arg === "-p") {
      if (!next) {
        throw new Error(`${arg} requires a value`);
      }
      protocols.push(...next.split(",").map((item) => item.trim()).filter(Boolean));
      i += 1;
    } else if (arg === "--port") {
      port = Number(next);
      i += 1;
    } else if (arg === "--host") {
      host = next ?? host;
      i += 1;
    } else if (arg === "--auth") {
      auth = true;
    }
  }

  return { command, protocols: protocols.length > 0 ? protocols : ["openai", "anthropic", "gemini"], port, host, auth };
}

function createProtocol(name: string, collide: boolean): ProtocolAdapter {
  switch (name) {
    case "openai":
      return openAIProtocol(collide ? { prefix: "/openai" } : undefined);
    case "xai":
    case "grok":
      return xaiProtocol(collide ? { prefix: "/xai" } : undefined);
    case "anthropic":
      return anthropicProtocol();
    case "gemini":
      return geminiProtocol();
    case "simple":
      return createSimpleProtocol();
    default:
      throw new Error(`Unknown protocol: ${name}. Expected openai, anthropic, gemini, xai, simple.`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  if (options.command === "help" || options.command === "--help" || options.command === "-h") {
    process.stdout.write(`Usage:
  llm-mimic-surface serve [--protocol openai] [--port 8080] [--host 127.0.0.1]

Protocols: openai, anthropic, gemini, xai, simple
If both openai and xai are enabled, CLI prefixes them as /openai and /xai to avoid route collision.
`);
    return;
  }
  if (options.command !== "serve") {
    throw new Error(`Unknown command: ${options.command}`);
  }
  if (options.host === "0.0.0.0") {
    process.stderr.write("Warning: binding to 0.0.0.0 exposes the server beyond localhost.\n");
  }

  const names = options.protocols;
  const collide = names.includes("openai") && (names.includes("xai") || names.includes("grok"));
  const protocols = names.map((name) => createProtocol(name, collide));
  const backend = createEchoBackend();
  const server = createExternalApiServer({
    backend,
    protocols,
    auth: options.auth
      ? {
          type: "bearer",
          validate: async (token) => token.length > 0
        }
      : false,
    cors: true
  });

  const address = await server.listen({ host: options.host, port: options.port });
  process.stdout.write(
    `llm-mimic-surface listening on http://${address.host}:${address.port}\n` +
      `protocols: ${names.join(", ")}${collide ? " (openai -> /openai, xai -> /xai)" : ""}\n` +
      `backend: echo mock\n`
  );

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };
  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
