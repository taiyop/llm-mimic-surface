import { describe, expect, it } from "vitest";
import { anthropicProtocol } from "../../src/index.js";
import { decodeAnthropicRequest, encodeAnthropicResponse } from "../../src/protocol/anthropic/messages.js";
import { withInjectedServer, withListeningServer, readSse } from "../helpers/server.js";

const fixture = {
  model: "claude-sonnet-4-5",
  max_tokens: 256,
  temperature: 0.1,
  system: "You are Claude.",
  messages: [
    {
      role: "user",
      content: [{ type: "text", text: "Hello Claude" }]
    }
  ],
  tools: [
    {
      name: "lookup",
      description: "Look something up",
      input_schema: { type: "object", properties: { q: { type: "string" } } }
    }
  ],
  tool_choice: { type: "auto" },
  extra_anthropic_field: true
};

describe("Anthropic Messages API", () => {
  it("decodes system, content blocks, tools, and unknown fields", () => {
    const decoded = decodeAnthropicRequest(fixture, {
      protocol: "anthropic",
      endpoint: "messages",
      params: {},
      query: {}
    });
    expect(decoded.instructions).toBe("You are Claude.");
    expect(decoded.generation?.maxOutputTokens).toBe(256);
    expect(decoded.tools?.[0]).toMatchObject({ type: "function", name: "lookup" });
    expect(decoded.extensions?.anthropic).toMatchObject({ extra_anthropic_field: true });
  });

  it("encodes an Anthropic message response", () => {
    const request = decodeAnthropicRequest(fixture, {
      protocol: "anthropic",
      endpoint: "messages",
      params: {},
      query: {}
    });
    const encoded = encodeAnthropicResponse(
      {
        id: "msg_test",
        model: "claude-sonnet-4-5",
        message: { role: "assistant", content: [{ type: "text", text: "echo: Hello Claude" }] },
        finishReason: "stop"
      },
      request
    );
    expect(encoded.type).toBe("message");
    expect(encoded.stop_reason).toBe("end_turn");
    expect(encoded.content).toEqual([{ type: "text", text: "echo: Hello Claude" }]);
  });

  it("serves non-streaming messages", async () => {
    await withInjectedServer([anthropicProtocol()], async (server) => {
      const response = await server.inject({
        method: "POST",
        url: "/v1/messages",
        payload: {
          model: "claude-sonnet-4-5",
          max_tokens: 32,
          messages: [{ role: "user", content: "hello" }]
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().content[0].text).toBe("echo: hello");
    });
  });

  it("serves streaming messages", async () => {
    await withListeningServer([anthropicProtocol()], async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 32,
          stream: true,
          messages: [{ role: "user", content: "hello" }]
        })
      });
      const sse = await readSse(response);
      expect(sse).toContain("event: message_start");
      expect(sse).toContain("event: content_block_delta");
      expect(sse).toContain("event: message_stop");
    });
  });
});
