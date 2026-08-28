import { describe, expect, it } from "vitest";
import { xaiProtocol } from "../../src/index.js";
import { decodeChatCompletionsRequest, encodeChatCompletionsResponse } from "../../src/protocol/openai-compatible/chat-completions.js";
import { xaiDialect } from "../../src/protocol/xai/dialect.js";
import { withInjectedServer, withListeningServer, readSse } from "../helpers/server.js";
import xaiChatRequest from "../fixtures/xai/chat-completions.request.json" with { type: "json" };

describe("xAI chat completions", () => {
  it("keeps xAI-specific fields in extensions", () => {
    const decoded = decodeChatCompletionsRequest(xaiChatRequest, {
      protocol: "xai",
      endpoint: "chat.completions",
      params: {},
      query: {}
    }, xaiDialect);
    expect(decoded.source.protocol).toBe("xai");
    expect(decoded.extensions?.xai).toMatchObject({
      search_parameters: { mode: "auto" },
      deferred: false
    });
    expect(decoded.native?.protocol).toBe("xai");
  });

  it("encodes an xAI-shaped chat completion", () => {
    const request = decodeChatCompletionsRequest(xaiChatRequest, {
      protocol: "xai",
      endpoint: "chat.completions",
      params: {},
      query: {}
    }, xaiDialect);
    const encoded = encodeChatCompletionsResponse(
      {
        id: "xai-1",
        model: "grok-4.6",
        message: { role: "assistant", content: [{ type: "text", text: "echo: hi" }] },
        finishReason: "stop"
      },
      request,
      xaiDialect
    );
    expect(encoded.object).toBe("chat.completion");
    expect(encoded.model).toBe("grok-4.6");
  });

  it("serves non-streaming xAI chat completions", async () => {
    await withInjectedServer([xaiProtocol()], async (server) => {
      const response = await server.inject({
        method: "POST",
        url: "/v1/chat/completions",
        payload: xaiChatRequest
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().choices[0].message.content).toContain("echo:");
    });
  });

  it("serves streaming xAI chat completions", async () => {
    await withListeningServer([xaiProtocol()], async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...xaiChatRequest, stream: true })
      });
      const sse = await readSse(response);
      expect(sse).toContain("chat.completion.chunk");
      expect(sse).toContain("[DONE]");
    });
  });

  it("lists xAI models", async () => {
    await withInjectedServer([xaiProtocol()], async (server) => {
      const response = await server.inject({ method: "GET", url: "/v1/models" });
      expect(response.json().object).toBe("list");
      expect(response.json().data[0].object).toBe("model");
    });
  });
});
