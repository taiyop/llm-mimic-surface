import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { createEchoBackend, llmMimicSurfacePlugin, openAIProtocol, xaiProtocol } from "../../src/index.js";
import { RouteCollisionError } from "../../src/protocol/registry.js";

describe("route collision", () => {
  it("detects OpenAI and xAI default path collisions during registration", async () => {
    const app = Fastify();
    const registration = app.register(llmMimicSurfacePlugin, {
      backend: createEchoBackend(),
      protocols: [openAIProtocol(), xaiProtocol()]
    });
    await expect(registration).rejects.toBeInstanceOf(RouteCollisionError);
  });

  it("allows OpenAI and xAI together when prefixes differ", async () => {
    const app = Fastify();
    await app.register(llmMimicSurfacePlugin, {
        backend: createEchoBackend(),
      protocols: [openAIProtocol({ prefix: "/openai" }), xaiProtocol({ prefix: "/xai" })]
    });
    await expect(app.ready()).resolves.toBe(app);
    await app.close();
  });
});
