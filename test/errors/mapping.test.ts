import { describe, expect, it } from "vitest";
import { BackendError, MockBackend, openAIProtocol, anthropicProtocol, geminiProtocol, xaiProtocol } from "../../src/index.js";
import { encodeAnthropicError } from "../../src/protocol/anthropic/errors.js";
import { encodeGeminiError } from "../../src/protocol/gemini/errors.js";
import { openAIDialect } from "../../src/protocol/openai/dialect.js";
import { xaiDialect } from "../../src/protocol/xai/dialect.js";
import { withInjectedServer } from "../helpers/server.js";

describe("error mapping", () => {
  it("maps BackendError to OpenAI, xAI, Anthropic, and Gemini wire errors", () => {
    const error = new BackendError({ code: "invalid_request", message: "bad", param: "model" });
    expect(openAIDialect.encodeError(error).body).toMatchObject({
      error: { type: "invalid_request_error", message: "bad", param: "model" }
    });
    expect(xaiDialect.encodeError(error).body).toMatchObject({
      error: { message: "bad", code: "invalid_request" }
    });
    expect(encodeAnthropicError(error).body).toMatchObject({
      type: "error",
      error: { type: "invalid_request_error" }
    });
    expect(encodeGeminiError(error).body).toMatchObject({
      error: { status: "INVALID_ARGUMENT", message: "bad" }
    });
  });

  it("does not leak raw backend exceptions", async () => {
    const backend = new MockBackend({
      invoke: async () => {
        throw new Error("classified failure");
      }
    });
    await withInjectedServer([openAIProtocol()], async (server) => {
      const response = await server.inject({
        method: "POST",
        url: "/v1/chat/completions",
        payload: { model: "echo", messages: [{ role: "user", content: "hi" }] }
      });
      expect(response.statusCode).toBe(500);
      expect(response.json().error.type).toBe("api_error");
      expect(response.json().error).not.toHaveProperty("stack");
      expect(JSON.stringify(response.json())).not.toContain("at MockBackend");
    }, { backend });
  });

  it("returns protocol-specific 404 for model_not_found", async () => {
    const backend = new MockBackend({
      invoke: async () => {
        throw new BackendError({ code: "model_not_found", message: "nope" });
      }
    });
    await withInjectedServer([anthropicProtocol()], async (server) => {
      const response = await server.inject({
        method: "POST",
        url: "/v1/messages",
        payload: { model: "missing", max_tokens: 8, messages: [{ role: "user", content: "hi" }] }
      });
      expect(response.statusCode).toBe(404);
      expect(response.json().error.type).toBe("not_found_error");
    }, { backend });
    await withInjectedServer([geminiProtocol()], async (server) => {
      const response = await server.inject({
        method: "POST",
        url: "/v1beta/models/missing:generateContent",
        payload: { contents: [{ parts: [{ text: "hi" }] }] }
      });
      expect(response.json().error.status).toBe("NOT_FOUND");
    }, { backend });
    await withInjectedServer([xaiProtocol()], async (server) => {
      const response = await server.inject({
        method: "POST",
        url: "/v1/chat/completions",
        payload: { model: "missing", messages: [{ role: "user", content: "hi" }] }
      });
      expect(response.statusCode).toBe(404);
    }, { backend });
  });
});
