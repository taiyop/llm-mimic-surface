import { describe, expect, it } from "vitest";
import { createEchoBackend, createExternalApiServer, openAIProtocol, xaiProtocol } from "../../src/index.js";
import { RouteCollisionError } from "../../src/protocol/registry.js";

describe("route collision", () => {
  it("detects OpenAI and xAI default path collisions at startup", () => {
    expect(() =>
      createExternalApiServer({
        backend: createEchoBackend(),
        protocols: [openAIProtocol(), xaiProtocol()]
      })
    ).toThrow(RouteCollisionError);
  });

  it("allows OpenAI and xAI together when prefixes differ", () => {
    const server = createExternalApiServer({
      backend: createEchoBackend(),
      protocols: [openAIProtocol({ prefix: "/openai" }), xaiProtocol({ prefix: "/xai" })]
    });
    expect(server).toBeDefined();
    return server.close();
  });
});
