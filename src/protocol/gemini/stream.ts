import type { EncodedStreamEvent, InvocationEvent } from "../../boundary/events.js";
import type { StreamEncodeState } from "../types.js";

export function encodeGeminiEvent(
  event: InvocationEvent,
  state: StreamEncodeState
): EncodedStreamEvent | EncodedStreamEvent[] | null {
  switch (event.type) {
    case "response.start":
      state.id = event.id || state.id;
      state.model = event.model ?? state.model;
      return {
        data: JSON.stringify({
          candidates: [{ content: { role: "model", parts: [{ text: "" }] }, index: 0 }]
        })
      };
    case "text.delta":
      return {
        data: JSON.stringify({
          candidates: [{ content: { role: "model", parts: [{ text: event.delta }] }, index: 0 }]
        })
      };
    case "reasoning.delta":
      return {
        data: JSON.stringify({
          candidates: [{ content: { role: "model", parts: [{ text: event.delta, thought: true }] }, index: 0 }]
        })
      };
    case "tool_call.start":
      state.toolCalls.set(event.id, { index: state.toolCalls.size, name: event.name, started: true, ended: false });
      return {
        data: JSON.stringify({
          candidates: [
            {
              content: { role: "model", parts: [{ functionCall: { name: event.name, args: {} } }] },
              index: 0
            }
          ]
        })
      };
    case "usage":
      return {
        data: JSON.stringify({
          usageMetadata: {
            promptTokenCount: event.inputTokens ?? 0,
            candidatesTokenCount: event.outputTokens ?? 0,
            totalTokenCount: (event.inputTokens ?? 0) + (event.outputTokens ?? 0)
          }
        })
      };
    case "response.end":
      return {
        data: JSON.stringify({
          candidates: [
            {
              content: { role: "model", parts: [] },
              finishReason: event.finishReason === "length" ? "MAX_TOKENS" : "STOP",
              index: 0
            }
          ]
        })
      };
    default:
      return null;
  }
}
