import { describe, expect, it } from "vitest";
import { openAIProtocol } from "../../src/index.js";
import { decodeResponsesRequest, encodeResponsesResponse } from "../../src/protocol/openai-compatible/responses.js";
import { openAIDialect } from "../../src/protocol/openai/dialect.js";
import { withInjectedServer, withListeningServer, readSse } from "../helpers/server.js";

describe("OpenAI Responses API", () => {
  it("decodes string and array input", () => {
    const asString = decodeResponsesRequest(
      { model: "gpt-4.1", input: "Hello there", instructions: "Be brief" },
      { protocol: "openai", endpoint: "responses", params: {}, query: {} },
      openAIDialect
    );
    expect(asString.messages[0]?.role).toBe("user");
    expect(asString.instructions).toBe("Be brief");

    const asArray = decodeResponsesRequest(
      {
        model: "gpt-4.1",
        input: [
          { type: "message", role: "user", content: [{ type: "input_text", text: "Hi" }] }
        ]
      },
      { protocol: "openai", endpoint: "responses", params: {}, query: {} },
      openAIDialect
    );
    expect(asArray.messages[0]?.content[0]).toMatchObject({ type: "text", text: "Hi" });
  });

  it("encodes a completed response object", () => {
    const request = decodeResponsesRequest(
      { model: "gpt-4.1", input: "Hello" },
      { protocol: "openai", endpoint: "responses", params: {}, query: {} },
      openAIDialect
    );
    const encoded = encodeResponsesResponse(
      {
        id: "resp_test",
        model: "gpt-4.1",
        message: { role: "assistant", content: [{ type: "text", text: "echo: Hello" }] },
        finishReason: "stop"
      },
      request
    );
    expect(encoded.object).toBe("response");
    expect(encoded.status).toBe("completed");
    const output = encoded.output as Array<{ content: Array<{ text: string }> }>;
    expect(output[0]?.content[0]?.text).toBe("echo: Hello");
  });

  it("serves non-streaming responses", async () => {
    await withInjectedServer([openAIProtocol()], async (server) => {
      const response = await server.inject({
        method: "POST",
        url: "/v1/responses",
        payload: { model: "echo", input: "ping" }
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.object).toBe("response");
      expect(JSON.stringify(body.output)).toContain("echo: ping");
    });
  });

  it("serves streaming responses", async () => {
    await withListeningServer([openAIProtocol()], async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/responses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: "echo", input: "ping", stream: true })
      });
      const sse = await readSse(response);
      expect(sse).toContain("response.created");
      expect(sse).toContain("response.output_text.delta");
      expect(sse).toContain("response.completed");
    });
  });
});
