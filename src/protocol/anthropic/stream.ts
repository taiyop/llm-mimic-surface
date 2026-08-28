import type { EncodedStreamEvent, InvocationEvent } from "../../boundary/events.js";
import type { StreamEncodeState } from "../types.js";

function named(event: string, payload: unknown): EncodedStreamEvent {
  return { event, data: JSON.stringify(payload) };
}

export function encodeAnthropicEvent(
  event: InvocationEvent,
  state: StreamEncodeState
): EncodedStreamEvent | EncodedStreamEvent[] | null {
  switch (event.type) {
    case "response.start":
      state.id = event.id || state.id;
      state.model = event.model ?? state.model;
      state.started = true;
      return named("message_start", {
        type: "message_start",
        message: {
          id: state.id.startsWith("msg_") ? state.id : `msg_${state.id}`,
          type: "message",
          role: "assistant",
          model: state.model,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 }
        }
      });
    case "text.delta": {
      const events: EncodedStreamEvent[] = [];
      if (!state.textStarted) {
        state.textStarted = true;
        events.push(
          named("content_block_start", {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" }
          })
        );
      }
      events.push(
        named("content_block_delta", {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: event.delta }
        })
      );
      return events;
    }
    case "reasoning.delta":
      return named("content_block_delta", {
        type: "content_block_delta",
        index: 0,
        delta: { type: "thinking_delta", thinking: event.delta }
      });
    case "tool_call.start": {
      const index = state.toolCalls.size + (state.textStarted ? 1 : 0);
      state.toolCalls.set(event.id, { index, name: event.name, started: true, ended: false });
      return named("content_block_start", {
        type: "content_block_start",
        index,
        content_block: { type: "tool_use", id: event.id, name: event.name, input: {} }
      });
    }
    case "tool_call.delta": {
      const call = state.toolCalls.get(event.id);
      return named("content_block_delta", {
        type: "content_block_delta",
        index: call?.index ?? 0,
        delta: { type: "input_json_delta", partial_json: event.delta }
      });
    }
    case "tool_call.end": {
      const call = state.toolCalls.get(event.id);
      return named("content_block_stop", { type: "content_block_stop", index: call?.index ?? 0 });
    }
    case "usage":
      return named("message_delta", {
        type: "message_delta",
        delta: { stop_reason: state.toolCalls.size > 0 ? "tool_use" : "end_turn", stop_sequence: null },
        usage: { output_tokens: event.outputTokens ?? 0 }
      });
    case "response.end": {
      const events: EncodedStreamEvent[] = [];
      if (state.textStarted) {
        events.push(named("content_block_stop", { type: "content_block_stop", index: 0 }));
      }
      events.push(
        named("message_delta", {
          type: "message_delta",
          delta: {
            stop_reason: state.toolCalls.size > 0 ? "tool_use" : mapStop(event.finishReason),
            stop_sequence: null
          },
          usage: { output_tokens: 0 }
        })
      );
      events.push(named("message_stop", { type: "message_stop" }));
      state.ended = true;
      return events;
    }
    default:
      return null;
  }
}

function mapStop(reason?: string): string {
  if (!reason || reason === "stop") {
    return "end_turn";
  }
  if (reason === "length" || reason === "max_tokens") {
    return "max_tokens";
  }
  if (reason === "tool_calls") {
    return "tool_use";
  }
  return reason;
}
