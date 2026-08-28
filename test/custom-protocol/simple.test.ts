import { describe, expect, it } from "vitest";
import { createProtocolAdapter, createSimpleProtocol } from "../../src/index.js";
import { withInjectedServer, withListeningServer, readSse } from "../helpers/server.js";

describe("custom protocol", () => {
  it("serves createSimpleProtocol non-stream and stream", async () => {
    await withInjectedServer([createSimpleProtocol({ path: "/api/generate" })], async (server) => {
      const response = await server.inject({
        method: "POST",
        url: "/api/generate",
        payload: { model: "echo", prompt: "hello" }
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ text: "echo: hello" });
    });

    await withListeningServer([createSimpleProtocol()], async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "hello", stream: true })
      });
      const sse = await readSse(response);
      expect(sse).toContain("event: delta");
      expect(sse).toContain("event: done");
    });
  });

  it("allows a third party to register a protocol adapter", async () => {
    const ping = createProtocolAdapter({
      id: "ping",
      registerRoutes(registrar) {
        registrar.route({
          method: "GET",
          path: "/ping",
          protocolId: "ping",
          encodeError: (error) => ({ status: error.status, body: { error: error.message } }),
          handler: async (_request, reply) => {
            await reply.send({ pong: true });
          }
        });
      }
    });
    await withInjectedServer([ping], async (server) => {
      const response = await server.inject({ method: "GET", url: "/ping" });
      expect(response.json()).toEqual({ pong: true });
    });
  });
});
