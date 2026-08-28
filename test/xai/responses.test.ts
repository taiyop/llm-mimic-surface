import { describe, expect, it } from "vitest";
import { xaiProtocol } from "../../src/index.js";
import { decodeResponsesRequest } from "../../src/protocol/openai-compatible/responses.js";
import { xaiDialect } from "../../src/protocol/xai/dialect.js";
import { withInjectedServer, withListeningServer, readSse } from "../helpers/server.js";
import xaiResponsesRequest from "../fixtures/xai/responses.request.json" with { type: "json" };

describe("xAI Responses API", () => {
  it("preserves include, store, and server-side tools", () => {
    const decoded = decodeResponsesRequest(xaiResponsesRequest, {
      protocol: "xai",
      endpoint: "responses",
      params: {},
      query: {}
    }, xaiDialect);
    expect(decoded.tools?.some((tool) => tool.type === "provider" && tool.name === "web_search")).toBe(true);
    expect(decoded.tools?.some((tool) => tool.type === "provider" && tool.name === "x_search")).toBe(true);
    expect(decoded.tools?.some((tool) => tool.type === "provider" && tool.name === "code_interpreter")).toBe(true);
    expect(decoded.extensions?.xai).toMatchObject({
      include: ["web_search_call_output"]
    });
    expect(decoded.metadata?.store).toBe(false);
  });

  it("serves non-streaming xAI responses", async () => {
    await withInjectedServer([xaiProtocol()], async (server) => {
      const response = await server.inject({
        method: "POST",
        url: "/v1/responses",
        payload: {
          model: "grok-4.6",
          input: "hello from xai"
        }
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.stringify(response.json().output)).toContain("echo: hello from xai");
    });
  });

  it("serves streaming xAI responses", async () => {
    await withListeningServer([xaiProtocol()], async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/responses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: "grok-4.6", input: "hello", stream: true })
      });
      const sse = await readSse(response);
      expect(sse).toContain("response.created");
      expect(sse).toContain("response.output_text.delta");
    });
  });
});
