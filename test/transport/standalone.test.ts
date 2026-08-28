import { describe, expect, it } from "vitest";
import { createEchoBackend, openAIProtocol } from "../../src/index.js";
import { createStandaloneServer } from "../../src/standalone.js";

describe("standalone convenience API", () => {
  it("creates a ready Fastify app without listening", async () => {
    const app = await createStandaloneServer({
      backend: createEchoBackend(),
      protocols: [openAIProtocol()]
    });
    try {
      expect(app.server.listening).toBe(false);
      const response = await app.inject({ method: "GET", url: "/v1/models" });
      expect(response.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});
