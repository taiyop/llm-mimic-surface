import type { ContentPart, Message, ToolChoice, ToolDefinition } from "../../boundary/content.js";
import { BackendError } from "../../boundary/errors.js";
import type { InvocationRequest } from "../../boundary/request.js";
import type { InvocationResponse } from "../../boundary/response.js";
import { collectUnknownFields, isRecord, mergeExtensions } from "../../util/objects.js";
import { createId } from "../../util/id.js";
import { joinNonEmpty } from "../../util/text.js";
import type { DecodeMeta } from "../types.js";
import { ANTHROPIC_KNOWN_KEYS, anthropicMessagesRequestSchema } from "./schemas.js";

export function decodeAnthropicRequest(raw: unknown, meta: DecodeMeta): InvocationRequest {
  const parsed = anthropicMessagesRequestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BackendError({
      code: "invalid_request",
      message: parsed.error.issues[0]?.message ?? "Invalid Anthropic messages request",
      param: parsed.error.issues[0]?.path.join(".") || "body"
    });
  }
  const body = parsed.data;
  const record = isRecord(raw) ? raw : {};
  const unknown = collectUnknownFields(record, ANTHROPIC_KNOWN_KEYS);
  const systemText = decodeSystem(body.system);
  const thinking = isRecord(body.thinking) ? body.thinking : undefined;

  return {
    model: body.model,
    messages: decodeAnthropicMessages(body.messages),
    instructions: systemText,
    generation: {
      temperature: body.temperature,
      topP: body.top_p,
      topK: body.top_k,
      maxOutputTokens: body.max_tokens,
      stop: body.stop_sequences
    },
    tools: decodeAnthropicTools(body.tools),
    toolChoice: decodeAnthropicToolChoice(body.tool_choice),
    reasoning: thinking
      ? {
          effort: typeof thinking.type === "string" ? thinking.type : undefined,
          budgetTokens: typeof thinking.budget_tokens === "number" ? thinking.budget_tokens : undefined
        }
      : undefined,
    metadata: body.metadata,
    stream: body.stream,
    extensions: mergeExtensions(unknown ? { anthropic: unknown } : undefined, thinking ? { anthropic: { thinking } } : undefined),
    source: { protocol: "anthropic", endpoint: meta.endpoint },
    native: { protocol: "anthropic", payload: raw },
    raw
  };
}

function decodeSystem(system: unknown): string | undefined {
  if (typeof system === "string") {
    return system;
  }
  if (Array.isArray(system)) {
    return joinNonEmpty(
      system.map((block) => {
        if (isRecord(block) && typeof block.text === "string") {
          return block.text;
        }
        return undefined;
      })
    );
  }
  return undefined;
}

function decodeAnthropicMessages(rawMessages: unknown[]): Message[] {
  return rawMessages.map((raw) => {
    if (!isRecord(raw)) {
      return { role: "unknown", content: [{ type: "unknown", raw }], raw };
    }
    const roleRaw = String(raw.role ?? "user");
    const role = roleRaw === "assistant" || roleRaw === "user" || roleRaw === "system" ? roleRaw : "unknown";
    return {
      role,
      content: decodeBlocks(raw.content),
      extensions: collectUnknownFields(raw, ["role", "content"]),
      raw
    };
  });
}

function decodeBlocks(content: unknown): ContentPart[] {
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }
  if (!Array.isArray(content)) {
    return [{ type: "unknown", raw: content }];
  }
  return content.map((block) => decodeBlock(block));
}

function decodeBlock(block: unknown): ContentPart {
  if (!isRecord(block)) {
    return { type: "unknown", raw: block };
  }
  const type = typeof block.type === "string" ? block.type : "unknown";
  if (type === "text") {
    return {
      type: "text",
      text: String(block.text ?? ""),
      extensions: collectUnknownFields(block, ["type", "text"]),
      raw: block
    };
  }
  if (type === "image") {
    const source = isRecord(block.source) ? block.source : {};
    return {
      type: "image",
      mimeType: typeof source.media_type === "string" ? source.media_type : undefined,
      data: typeof source.data === "string" ? source.data : undefined,
      url: typeof source.url === "string" ? source.url : undefined,
      extensions: collectUnknownFields(block, ["type", "source"]),
      raw: block
    };
  }
  if (type === "document") {
    const source = isRecord(block.source) ? block.source : {};
    return {
      type: "file",
      mimeType: typeof source.media_type === "string" ? source.media_type : undefined,
      data: typeof source.data === "string" ? source.data : undefined,
      url: typeof source.url === "string" ? source.url : undefined,
      extensions: collectUnknownFields(block, ["type", "source"]),
      raw: block
    };
  }
  if (type === "tool_use" || type === "server_tool_use") {
    return {
      type: "tool_call",
      id: typeof block.id === "string" ? block.id : undefined,
      name: String(block.name ?? "unknown"),
      arguments: JSON.stringify(block.input ?? {}),
      extensions: collectUnknownFields(block, ["type", "id", "name", "input"]),
      raw: block
    };
  }
  if (type === "tool_result") {
    return {
      type: "tool_result",
      toolCallId: typeof block.tool_use_id === "string" ? block.tool_use_id : undefined,
      content: typeof block.content === "string" ? block.content : decodeBlocks(block.content),
      isError: typeof block.is_error === "boolean" ? block.is_error : undefined,
      extensions: collectUnknownFields(block, ["type", "tool_use_id", "content", "is_error"]),
      raw: block
    };
  }
  if (type === "thinking") {
    return {
      type: "reasoning",
      text: String(block.thinking ?? ""),
      extensions: collectUnknownFields(block, ["type", "thinking", "signature"]),
      raw: block
    };
  }
  return {
    type: "unknown",
    kind: type,
    extensions: collectUnknownFields(block, ["type"]),
    raw: block
  };
}

function decodeAnthropicTools(tools: unknown[] | undefined): ToolDefinition[] | undefined {
  if (!tools) {
    return undefined;
  }
  return tools.map((tool) => {
    if (!isRecord(tool)) {
      return { type: "unknown", raw: tool };
    }
    if (typeof tool.name === "string" && isRecord(tool.input_schema)) {
      return {
        type: "function",
        name: tool.name,
        description: typeof tool.description === "string" ? tool.description : undefined,
        parameters: tool.input_schema,
        raw: tool
      };
    }
    if (typeof tool.type === "string") {
      return {
        type: "provider",
        provider: "anthropic",
        name: tool.type,
        config: collectUnknownFields(tool, ["type", "name"]),
        raw: tool
      };
    }
    return { type: "unknown", raw: tool };
  });
}

function decodeAnthropicToolChoice(raw: unknown): ToolChoice | undefined {
  if (!raw) {
    return undefined;
  }
  if (!isRecord(raw)) {
    return { type: "unknown", raw };
  }
  if (raw.type === "auto" || raw.type === "none") {
    return { type: raw.type };
  }
  if (raw.type === "any") {
    return { type: "required" };
  }
  if (raw.type === "tool" && typeof raw.name === "string") {
    return { type: "tool", name: raw.name };
  }
  return { type: "unknown", raw };
}

export function encodeAnthropicResponse(response: InvocationResponse, request: InvocationRequest): Record<string, unknown> {
  const content = encodeBlocks(response.message);
  const hasTools = response.message.content.some((part) => part.type === "tool_call");
  return {
    id: response.id.startsWith("msg_") ? response.id : `msg_${response.id}`,
    type: "message",
    role: "assistant",
    model: response.model || request.model,
    content,
    stop_reason: hasTools ? "tool_use" : mapStopReason(response.finishReason),
    stop_sequence: null,
    usage: {
      input_tokens: response.usage?.inputTokens ?? 0,
      output_tokens: response.usage?.outputTokens ?? 0
    }
  };
}

function encodeBlocks(message: Message): unknown[] {
  const blocks: unknown[] = [];
  for (const part of message.content) {
    if (part.type === "text") {
      blocks.push({ type: "text", text: part.text });
    } else if (part.type === "reasoning") {
      blocks.push({ type: "thinking", thinking: part.text });
    } else if (part.type === "tool_call") {
      let input: unknown = {};
      try {
        input = part.arguments ? JSON.parse(part.arguments) : {};
      } catch {
        input = { raw: part.arguments };
      }
      blocks.push({
        type: "tool_use",
        id: part.id ?? createId("toolu_"),
        name: part.name,
        input
      });
    } else if (part.type === "unknown") {
      blocks.push(part.raw ?? { type: part.kind ?? "unknown" });
    }
  }
  return blocks.length > 0 ? blocks : [{ type: "text", text: "" }];
}

function mapStopReason(reason?: string): string {
  if (!reason || reason === "stop" || reason === "end_turn") {
    return "end_turn";
  }
  if (reason === "length" || reason === "max_tokens") {
    return "max_tokens";
  }
  if (reason === "tool_calls" || reason === "tool_use") {
    return "tool_use";
  }
  return reason;
}
