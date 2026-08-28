import { describe, expect, it } from "vitest";
import type { InvocationEvent } from "../../src/index.js";
import { collectTextFromEvents } from "../../src/boundary/events.js";
import { createStreamState } from "../../src/protocol/types.js";
import { DONE_EVENT, encodeChatCompletionsEvent, encodeResponsesEvent } from "../../src/protocol/openai-compatible/stream.js";
import { encodeAnthropicEvent } from "../../src/protocol/anthropic/stream.js";
import { encodeGeminiEvent } from "../../src/protocol/gemini/stream.js";

const events: InvocationEvent[] = [
  { type: "response.start", id: "id1", model: "echo" },
  { type: "text.delta", delta: "Hel" },
  { type: "text.delta", delta: "lo" },
  { type: "usage", inputTokens: 1, outputTokens: 2 },
  { type: "response.end", finishReason: "stop" }
];

describe("streaming event conversion", () => {
  it("keeps concatenated deltas equal to the final text", () => {
    expect(collectTextFromEvents(events)).toBe("Hello");
  });

  it("encodes OpenAI chat SSE chunks plus [DONE]", () => {
    const state = createStreamState("id1", "echo", 1);
    const frames = events.flatMap((event) => {
      const encoded = encodeChatCompletionsEvent(event, state);
      return encoded ? (Array.isArray(encoded) ? encoded : [encoded]) : [];
    });
    frames.push(DONE_EVENT);
    const payload = frames.map((frame) => frame.data).join("\n");
    expect(payload).toContain("chat.completion.chunk");
    expect(payload).toContain("Hel");
    expect(payload).toContain("lo");
    expect(payload).toContain("[DONE]");
  });

  it("encodes OpenAI/xAI Responses semantic events", () => {
    const state = createStreamState("resp1", "echo", 1);
    const types: string[] = [];
    for (const event of events) {
      const encoded = encodeResponsesEvent(event, state);
      for (const frame of encoded ? (Array.isArray(encoded) ? encoded : [encoded]) : []) {
        types.push((JSON.parse(frame.data) as { type: string }).type);
      }
    }
    expect(types).toContain("response.created");
    expect(types).toContain("response.output_text.delta");
    expect(types).toContain("response.completed");
  });

  it("encodes Anthropic named SSE events", () => {
    const state = createStreamState("msg1", "claude", 1);
    const names: string[] = [];
    for (const event of events) {
      const encoded = encodeAnthropicEvent(event, state);
      for (const frame of encoded ? (Array.isArray(encoded) ? encoded : [encoded]) : []) {
        if (frame.event) {
          names.push(frame.event);
        }
      }
    }
    expect(names).toContain("message_start");
    expect(names).toContain("content_block_delta");
    expect(names).toContain("message_stop");
  });

  it("encodes Gemini SSE data frames", () => {
    const state = createStreamState("g1", "gemini", 1);
    const encoded = encodeGeminiEvent({ type: "text.delta", delta: "Hi" }, state);
    expect(encoded && !Array.isArray(encoded) ? encoded.data : "").toContain("Hi");
  });
});
