import type { EncodedStreamEvent, InvocationEvent } from "../../boundary/events.js";
import { unixSeconds } from "../../util/id.js";
import type { StreamEncodeState } from "../types.js";

export const DONE_EVENT: EncodedStreamEvent = { data: "[DONE]" };

function jsonEvent(payload: unknown): EncodedStreamEvent {
  return { data: JSON.stringify(payload) };
}

export function encodeChatCompletionsEvent(
  event: InvocationEvent,
  state: StreamEncodeState
): EncodedStreamEvent | EncodedStreamEvent[] | null {
  const base = {
    id: state.id,
    object: "chat.completion.chunk",
    created: state.created || unixSeconds(),
    model: state.model,
    choices: [] as unknown[]
  };

  switch (event.type) {
    case "response.start":
      state.id = event.id || state.id;
      state.model = event.model ?? state.model;
      state.started = true;
      return jsonEvent({
        ...base,
        id: state.id,
        model: state.model,
        choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }]
      });
    case "text.delta":
      return jsonEvent({
        ...base,
        choices: [{ index: 0, delta: { content: event.delta }, finish_reason: null }]
      });
    case "reasoning.delta":
      return jsonEvent({
        ...base,
        choices: [
          {
            index: 0,
            delta: { reasoning_content: event.delta },
            finish_reason: null
          }
        ]
      });
    case "tool_call.start": {
      const index = state.toolCalls.size;
      state.toolCalls.set(event.id, { index, name: event.name, started: true, ended: false });
      return jsonEvent({
        ...base,
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index,
                  id: event.id,
                  type: "function",
                  function: { name: event.name, arguments: "" }
                }
              ]
            },
            finish_reason: null
          }
        ]
      });
    }
    case "tool_call.delta": {
      const call = state.toolCalls.get(event.id);
      return jsonEvent({
        ...base,
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: call?.index ?? 0,
                  id: event.id,
                  function: { arguments: event.delta }
                }
              ]
            },
            finish_reason: null
          }
        ]
      });
    }
    case "tool_call.end":
      return null;
    case "usage":
      return jsonEvent({
        ...base,
        choices: [],
        usage: {
          prompt_tokens: event.inputTokens ?? event.usage?.inputTokens ?? 0,
          completion_tokens: event.outputTokens ?? event.usage?.outputTokens ?? 0,
          total_tokens:
            (event.inputTokens ?? event.usage?.inputTokens ?? 0) +
            (event.outputTokens ?? event.usage?.outputTokens ?? 0)
        }
      });
    case "response.end":
      state.ended = true;
      return jsonEvent({
        ...base,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: mapStreamFinish(event.finishReason, state)
          }
        ]
      });
    case "extension":
      return jsonEvent({ ...base, choices: [], extension: event.data });
    case "citation":
      return jsonEvent({ ...base, choices: [], citations: [event.citation] });
    default:
      return null;
  }
}

export function encodeResponsesEvent(
  event: InvocationEvent,
  state: StreamEncodeState
): EncodedStreamEvent | EncodedStreamEvent[] | null {
  const events: EncodedStreamEvent[] = [];
  const push = (type: string, extra: Record<string, unknown> = {}) => {
    events.push({ data: JSON.stringify({ type, ...extra }) });
  };

  switch (event.type) {
    case "response.start":
      state.id = event.id || state.id;
      state.model = event.model ?? state.model;
      state.started = true;
      push("response.created", {
        response: skeletonResponse(state)
      });
      push("response.in_progress", { response: skeletonResponse(state) });
      return events;
    case "text.delta":
      if (!state.textStarted) {
        state.textStarted = true;
        push("response.output_item.added", {
          output_index: 0,
          item: { type: "message", id: "msg_output", role: "assistant", content: [] }
        });
        push("response.content_part.added", {
          output_index: 0,
          content_index: 0,
          part: { type: "output_text", text: "" }
        });
      }
      push("response.output_text.delta", {
        output_index: 0,
        content_index: 0,
        delta: event.delta
      });
      return events;
    case "reasoning.delta":
      push("response.reasoning_summary_text.delta", { delta: event.delta });
      return events;
    case "tool_call.start":
      state.toolCalls.set(event.id, {
        index: state.toolCalls.size,
        name: event.name,
        started: true,
        ended: false
      });
      push("response.output_item.added", {
        output_index: state.toolCalls.size,
        item: { type: "function_call", id: event.id, call_id: event.id, name: event.name, arguments: "" }
      });
      return events;
    case "tool_call.delta":
      push("response.function_call_arguments.delta", {
        output_index: state.toolCalls.get(event.id)?.index ?? 0,
        delta: event.delta
      });
      return events;
    case "tool_call.end":
      push("response.function_call_arguments.done", {
        output_index: state.toolCalls.get(event.id)?.index ?? 0,
        arguments: ""
      });
      return events;
    case "usage":
      push("response.completed", {
        response: {
          ...skeletonResponse(state),
          usage: {
            input_tokens: event.inputTokens ?? 0,
            output_tokens: event.outputTokens ?? 0,
            total_tokens: (event.inputTokens ?? 0) + (event.outputTokens ?? 0)
          }
        }
      });
      return events;
    case "response.end":
      if (!state.ended) {
        state.ended = true;
        push("response.completed", {
          response: {
            ...skeletonResponse(state),
            status: "completed"
          }
        });
      }
      return events;
    case "extension":
      push("response.extension", { protocol: event.protocol, data: event.data });
      return events;
    case "citation":
      push("response.output_text.annotation.added", { annotation: event.citation });
      return events;
    default:
      return null;
  }
}

function skeletonResponse(state: StreamEncodeState): Record<string, unknown> {
  return {
    id: state.id,
    object: "response",
    created_at: state.created,
    status: "in_progress",
    model: state.model,
    output: []
  };
}

function mapStreamFinish(reason: string | undefined, state: StreamEncodeState): string {
  if (state.toolCalls.size > 0) {
    return "tool_calls";
  }
  if (!reason) {
    return "stop";
  }
  if (reason === "end_turn" || reason === "STOP") {
    return "stop";
  }
  if (reason === "max_tokens" || reason === "MAX_TOKENS") {
    return "length";
  }
  return reason;
}
