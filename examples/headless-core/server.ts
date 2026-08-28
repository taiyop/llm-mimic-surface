import { anthropicProtocol, createExternalApiServer, openAIProtocol } from "../../src/index.js";
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

const server = createExternalApiServer({
  backend,
  protocols: [openAIProtocol(), anthropicProtocol()],
  auth: false
});

const { host, port } = await server.listen({ host: "127.0.0.1", port: 8080 });
console.log(`headless_core backend at http://${host}:${port}`);
console.log("Try model ids such as codex/default, claude/sonnet, grok/default");
