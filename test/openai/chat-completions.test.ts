import { describe, expect, it } from "vitest";
import { MockBackend, openAIProtocol } from "../../src/index.js";
import { decodeChatCompletionsRequest, encodeChatCompletionsResponse } from "../../src/protocol/openai-compatible/chat-completions.js";
import { openAIDialect } from "../../src/protocol/openai/dialect.js";
import { withInjectedServer, withListeningServer, readSse } from "../helpers/server.js";
import chatRequest from "../fixtures/openai/chat-completions.request.json" with { type: "json" };

describe("OpenAI chat completions", () => {
  it("decodes a fixture request into the boundary contract", () => {
    const decoded = decodeChatCompletionsRequest(chatRequest, {
      protocol: "openai",
      endpoint: "chat.completions",
      params: {},
      query: {}
    }, openAIDialect);
    expect(decoded.model).toBe("gpt-4o-mini");
    expect(decoded.instructions).toContain("helpful");
    expect(decoded.messages.at(-1)?.role).toBe("user");
    expect(decoded.generation?.temperature).toBe(0.2);
    expect(decoded.native?.protocol).toBe("openai");
    expect(decoded.extensions?.openai).toMatchObject({ logit_bias: { "123": -1 } });
  });

  it("encodes an echo response as chat.completion", () => {
    const decoded = decodeChatCompletionsRequest(chatRequest, {
      protocol: "openai",
      endpoint: "chat.completions",
      params: {},
      query: {}
    }, openAIDialect);
    const encoded = encodeChatCompletionsResponse(
      {
        id: "chatcmpl-test",
        model: "gpt-4o-mini",
        message: { role: "assistant", content: [{ type: "text", text: "echo: Hello" }] },
        finishReason: "stop",
        usage: { inputTokens: 3, outputTokens: 11, totalTokens: 14 }
      },
      decoded,
      openAIDialect
    );
    expect(encoded.object).toBe("chat.completion");
    expect(encoded.choices).toEqual([
      {
        index: 0,
        message: { role: "assistant", content: "echo: Hello" },
        finish_reason: "stop"
      }
    ]);
  });

  it("serves non-streaming chat completions", async () => {
    await withInjectedServer([openAIProtocol()], async (server) => {
      const response = await server.inject({
        method: "POST",
        url: "/v1/chat/completions",
        payload: {
          model: "echo",
          messages: [{ role: "user", content: "hello" }]
        }
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.object).toBe("chat.completion");
      expect(body.choices[0].message.content).toBe("echo: hello");
    });
  });

  it("serves streaming chat completions", async () => {
    await withListeningServer([openAIProtocol()], async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: "echo",
          stream: true,
          messages: [{ role: "user", content: "hello" }]
        })
      });
      expect(response.ok).toBe(true);
      expect(response.headers.get("content-type")).toContain("text/event-stream");
      const sse = await readSse(response);
      expect(sse).toContain("chat.completion.chunk");
      expect(sse).toContain("echo:");
      expect(sse).toContain("data: [DONE]");
    });
  });

  it("lists models", async () => {
    await withInjectedServer([openAIProtocol()], async (server) => {
      const response = await server.inject({ method: "GET", url: "/v1/models" });
      expect(response.statusCode).toBe(200);
      expect(response.json().data[0].id).toBe("echo");
    });
  });

  it("rejects tools when the backend cannot use them", async () => {
    const backend = new MockBackend({
      capabilities: {
        streaming: true,
        tools: false,
        input: { text: true }
      }
    });
    await withInjectedServer([openAIProtocol()], async (server) => {
      const response = await server.inject({
        method: "POST",
        url: "/v1/chat/completions",
        payload: {
          model: "echo",
          messages: [{ role: "user", content: "call a tool" }],
          tools: [
            {
              type: "function",
              function: { name: "lookup", parameters: { type: "object", properties: {} } }
            }
          ]
        }
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("unsupported_value");
    }, { backend });
  });

  it("preserves unknown fields on the boundary request", () => {
    const decoded = decodeChatCompletionsRequest(
      {
        model: "gpt",
        messages: [{ role: "user", content: "hi" }],
        future_field: { nested: true }
      },
      { protocol: "openai", endpoint: "chat.completions", params: {}, query: {} },
      openAIDialect
    );
    expect(decoded.extensions?.openai).toMatchObject({ future_field: { nested: true } });
    expect(decoded.raw).toMatchObject({ future_field: { nested: true } });
  });
});


