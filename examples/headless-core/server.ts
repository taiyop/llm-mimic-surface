import Fastify from "fastify";
import { anthropicProtocol, llmMimicSurfacePlugin, openAIProtocol } from "../../src/index.js";
import { HeadlessCoreBackend, type HeadlessCoreLike } from "./backend.js";

async function loadHeadlessCore(): Promise<HeadlessCoreLike> {
  const mod = await import("@headless-core/core");
  return mod.createHeadlessCore({
    cwd: process.cwd(),
    timeoutMs: 120_000
  });
}

const core = await loadHeadlessCore();
const backend = new HeadlessCoreBackend({
  core,
  defaultAgent: "codex",
  models: {
    "local-codex": { provider: "codex", model: "default" },
    "claude-opus": { provider: "claude", model: "opus" }
  }
});

const server = Fastify();
await server.register(llmMimicSurfacePlugin, {
  backend,
  protocols: [openAIProtocol(), anthropicProtocol()]
});

await server.listen({ host: "127.0.0.1", port: 8080 });
console.log("headless_core backend at http://127.0.0.1:8080");
console.log("Try model ids such as codex/default, claude/sonnet, grok/default");
