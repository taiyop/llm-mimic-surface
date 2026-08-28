import { describe, expect, it } from "vitest";
import { geminiProtocol } from "../../src/index.js";
import {
  decodeGeminiRequest,
  encodeGeminiResponse,
  parseGeminiModelAction
} from "../../src/protocol/gemini/generate-content.js";
import { withInjectedServer, withListeningServer, readSse } from "../helpers/server.js";

describe("Gemini generateContent", () => {
  it("parses colon actions from the path", () => {
    expect(parseGeminiModelAction("gemini-2.0-flash:generateContent")).toEqual({
      model: "gemini-2.0-flash",
      action: "generateContent"
    });
    expect(parseGeminiModelAction("models/gemini-2.0-flash:streamGenerateContent")).toEqual({
      model: "gemini-2.0-flash",
      action: "streamGenerateContent"
    });
  });

  it("decodes contents, systemInstruction, generationConfig, and tools", () => {
    const decoded = decodeGeminiRequest(
      {
        systemInstruction: { parts: [{ text: "Be brief" }] },
        contents: [{ role: "user", parts: [{ text: "Hello Gemini" }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 64 },
        tools: [{ functionDeclarations: [{ name: "lookup", parameters: { type: "object" } }] }],
        mystery: 1
      },
      { protocol: "gemini", endpoint: "generateContent", params: {}, query: {} },
      "gemini-2.0-flash",
      false
    );
    expect(decoded.instructions).toBe("Be brief");
    expect(decoded.generation?.temperature).toBe(0.4);
    expect(decoded.tools?.[0]).toMatchObject({ type: "function", name: "lookup" });
    expect(decoded.extensions?.gemini).toMatchObject({ mystery: 1 });
  });

  it("encodes a generateContent response", () => {
    const request = decodeGeminiRequest(
      { contents: [{ parts: [{ text: "Hi" }] }] },
      { protocol: "gemini", endpoint: "generateContent", params: {}, query: {} },
      "gemini-2.0-flash",
      false
    );
    const encoded = encodeGeminiResponse(
      {
        id: "g1",
        model: "gemini-2.0-flash",
        message: { role: "assistant", content: [{ type: "text", text: "echo: Hi" }] },
        finishReason: "stop"
      },
      request
    );
    const candidate = (encoded.candidates as Array<{ content: { parts: Array<{ text: string }> }; finishReason: string }>)[0];
    expect(candidate?.content.parts[0]?.text).toBe("echo: Hi");
    expect(candidate?.finishReason).toBe("STOP");
  });

  it("serves non-streaming generateContent", async () => {
    await withInjectedServer([geminiProtocol()], async (server) => {
      const response = await server.inject({
        method: "POST",
        url: "/v1beta/models/gemini-2.0-flash:generateContent",
        payload: {
          contents: [{ parts: [{ text: "hello" }] }]
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().candidates[0].content.parts[0].text).toBe("echo: hello");
    });
  });

  it("serves streamGenerateContent and alt=sse", async () => {
    await withListeningServer([geminiProtocol()], async (baseUrl) => {
      const streamed = await fetch(`${baseUrl}/v1beta/models/gemini-2.0-flash:streamGenerateContent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "hello" }] }] })
      });
      const sse = await readSse(streamed);
      expect(sse).toContain("data:");
      expect(sse).toContain("echo:");

      const alt = await fetch(`${baseUrl}/v1beta/models/gemini-2.0-flash:generateContent?alt=sse`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "hello" }] }] })
      });
      expect(await readSse(alt)).toContain("echo:");
    });
  });
});
