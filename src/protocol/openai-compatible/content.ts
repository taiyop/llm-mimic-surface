import type {
  ContentPart,
  FunctionTool,
  Message,
  ProviderTool,
  ResponseFormat,
  ToolChoice,
  ToolDefinition,
  UnknownTool
} from "../../boundary/content.js";
import { BackendError } from "../../boundary/errors.js";
import { collectUnknownFields, isRecord, mergeExtensions } from "../../util/objects.js";
import { joinNonEmpty } from "../../util/text.js";

const PROVIDER_TOOL_TYPES = new Set([
  "web_search",
  "web_search_preview",
  "x_search",
  "code_interpreter",
  "code_execution",
  "file_search",
  "mcp",
  "image_generation",
  "computer",
  "computer_use"
]);

export function decodeChatMessages(rawMessages: unknown[]): { messages: Message[]; instructions?: string } {
  const messages: Message[] = [];
  const instructionParts: string[] = [];
  for (const raw of rawMessages) {
    if (!isRecord(raw)) {
      throw new BackendError({ code: "invalid_request", message: "Invalid message", param: "messages" });
    }
    const role = String(raw.role ?? "unknown");
    const mappedRole =
      role === "system" || role === "developer" || role === "user" || role === "assistant" || role === "tool"
        ? role
        : "unknown";
    const content = decodeChatContent(raw.content, raw);
    if (mappedRole === "system" || mappedRole === "developer") {
      const text = content
        .filter((part): part is Extract<ContentPart, { type: "text" }> => part.type === "text")
        .map((part) => part.text)
        .join("\n");
      if (text) {
        instructionParts.push(text);
      }
    }
    messages.push({
      role: mappedRole,
      content,
      name: typeof raw.name === "string" ? raw.name : undefined,
      toolCallId: typeof raw.tool_call_id === "string" ? raw.tool_call_id : undefined,
      extensions: collectUnknownFields(raw, ["role", "content", "name", "tool_call_id", "tool_calls"]),
      raw
    });
  }
  return { messages, instructions: joinNonEmpty(instructionParts) };
}

export function decodeChatContent(content: unknown, parent: Record<string, unknown>): ContentPart[] {
  const parts: ContentPart[] = [];
  if (typeof content === "string" || content == null) {
    if (typeof content === "string") {
      parts.push({ type: "text", text: content, raw: content });
    }
  } else if (Array.isArray(content)) {
    for (const item of content) {
      parts.push(decodeChatContentPart(item));
    }
  } else {
    parts.push({ type: "unknown", kind: "content", raw: content });
  }

  if (Array.isArray(parent.tool_calls)) {
    for (const call of parent.tool_calls) {
      parts.push(decodeToolCall(call));
    }
  }
  return parts.length > 0 ? parts : [{ type: "text", text: "" }];
}

function decodeChatContentPart(item: unknown): ContentPart {
  if (typeof item === "string") {
    return { type: "text", text: item, raw: item };
  }
  if (!isRecord(item)) {
    return { type: "unknown", kind: "part", raw: item };
  }
  const type = typeof item.type === "string" ? item.type : "unknown";
  if (type === "text") {
    return {
      type: "text",
      text: String(item.text ?? ""),
      extensions: collectUnknownFields(item, ["type", "text"]),
      raw: item
    };
  }
  if (type === "image_url") {
    const image = isRecord(item.image_url) ? item.image_url : {};
    return {
      type: "image",
      url: typeof image.url === "string" ? image.url : undefined,
      detail: typeof image.detail === "string" ? image.detail : undefined,
      extensions: collectUnknownFields(item, ["type", "image_url"]),
      raw: item
    };
  }
  if (type === "file" || type === "input_file") {
    const file = isRecord(item.file) ? item.file : item;
    return {
      type: "file",
      filename: typeof file.filename === "string" ? file.filename : undefined,
      mimeType: typeof file.mime_type === "string" ? file.mime_type : undefined,
      data: typeof file.file_data === "string" ? file.file_data : undefined,
      fileId: typeof file.file_id === "string" ? file.file_id : undefined,
      extensions: collectUnknownFields(item, ["type", "file"]),
      raw: item
    };
  }
  if (type === "input_text" || type === "output_text") {
    return {
      type: "text",
      text: String(item.text ?? ""),
      extensions: collectUnknownFields(item, ["type", "text"]),
      raw: item
    };
  }
  if (type === "input_image") {
    return {
      type: "image",
      url: typeof item.image_url === "string" ? item.image_url : undefined,
      extensions: collectUnknownFields(item, ["type", "image_url"]),
      raw: item
    };
  }
  if (type === "refusal") {
    return {
      type: "text",
      text: String(item.refusal ?? ""),
      extensions: { refusal: true, ...collectUnknownFields(item, ["type", "refusal"]) },
      raw: item
    };
  }
  return {
    type: "unknown",
    kind: type,
    extensions: collectUnknownFields(item, ["type"]),
    raw: item
  };
}

function decodeToolCall(call: unknown): ContentPart {
  if (!isRecord(call)) {
    return { type: "unknown", kind: "tool_call", raw: call };
  }
  const fn = isRecord(call.function) ? call.function : {};
  return {
    type: "tool_call",
    id: typeof call.id === "string" ? call.id : undefined,
    name: String(fn.name ?? call.name ?? "unknown"),
    arguments: typeof fn.arguments === "string" ? fn.arguments : JSON.stringify(fn.arguments ?? {}),
    extensions: collectUnknownFields(call, ["id", "type", "function"]),
    raw: call
  };
}

export function decodeTools(rawTools: unknown[] | undefined, provider: string): ToolDefinition[] | undefined {
  if (!rawTools) {
    return undefined;
  }
  return rawTools.map((tool) => decodeTool(tool, provider));
}

function decodeTool(tool: unknown, provider: string): ToolDefinition {
  if (!isRecord(tool)) {
    return { type: "unknown", raw: tool };
  }
  const type = typeof tool.type === "string" ? tool.type : "unknown";
  if (type === "function") {
    const fn = isRecord(tool.function) ? tool.function : tool;
    const functionTool: FunctionTool = {
      type: "function",
      name: String(fn.name ?? "unknown"),
      description: typeof fn.description === "string" ? fn.description : undefined,
      parameters: isRecord(fn.parameters) ? fn.parameters : undefined,
      strict: typeof fn.strict === "boolean" ? fn.strict : undefined,
      extensions: collectUnknownFields(tool, ["type", "function"]),
      raw: tool
    };
    return functionTool;
  }
  if (PROVIDER_TOOL_TYPES.has(type)) {
    const providerTool: ProviderTool = {
      type: "provider",
      provider,
      name: type,
      config: collectUnknownFields(tool, ["type"]),
      raw: tool
    };
    return providerTool;
  }
  const unknownTool: UnknownTool = {
    type: "unknown",
    name: type,
    extensions: collectUnknownFields(tool, ["type"]),
    raw: tool
  };
  return unknownTool;
}

export function decodeToolChoice(raw: unknown): ToolChoice | undefined {
  if (raw == null) {
    return undefined;
  }
  if (raw === "auto" || raw === "none" || raw === "required") {
    return { type: raw };
  }
  if (isRecord(raw)) {
    if (raw.type === "function" && isRecord(raw.function) && typeof raw.function.name === "string") {
      return { type: "tool", name: raw.function.name };
    }
    if (raw.type === "auto" || raw.type === "none" || raw.type === "required") {
      return { type: raw.type };
    }
    return { type: "unknown", raw };
  }
  return { type: "unknown", raw };
}

export function decodeResponseFormat(raw: unknown): ResponseFormat | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }
  if (raw.type === "text" || raw.type === "json_object") {
    return { type: raw.type };
  }
  if (raw.type === "json_schema") {
    const schema = isRecord(raw.json_schema) ? raw.json_schema : raw;
    return {
      type: "json_schema",
      name: typeof schema.name === "string" ? schema.name : undefined,
      schema: isRecord(schema.schema) ? schema.schema : undefined,
      strict: typeof schema.strict === "boolean" ? schema.strict : undefined
    };
  }
  return { type: "unknown", raw };
}

export function decodeResponsesInput(input: unknown): Message[] {
  if (typeof input === "string") {
    return [{ role: "user", content: [{ type: "text", text: input, raw: input }], raw: input }];
  }
  if (!Array.isArray(input)) {
    return [{ role: "unknown", content: [{ type: "unknown", kind: "input", raw: input }], raw: input }];
  }
  const messages: Message[] = [];
  for (const item of input) {
    if (typeof item === "string") {
      messages.push({ role: "user", content: [{ type: "text", text: item }], raw: item });
      continue;
    }
    if (!isRecord(item)) {
      messages.push({ role: "unknown", content: [{ type: "unknown", raw: item }], raw: item });
      continue;
    }
    const type = typeof item.type === "string" ? item.type : undefined;
    if (!type || type === "message") {
      const roleRaw = String(item.role ?? "user");
      const role =
        roleRaw === "system" ||
        roleRaw === "developer" ||
        roleRaw === "user" ||
        roleRaw === "assistant" ||
        roleRaw === "tool"
          ? roleRaw
          : "unknown";
      messages.push({
        role,
        content: decodeResponsesContent(item.content),
        extensions: collectUnknownFields(item, ["type", "role", "content", "id"]),
        raw: item
      });
      continue;
    }
    if (type === "function_call") {
      messages.push({
        role: "assistant",
        content: [
          {
            type: "tool_call",
            id: typeof item.call_id === "string" ? item.call_id : typeof item.id === "string" ? item.id : undefined,
            name: String(item.name ?? "unknown"),
            arguments: typeof item.arguments === "string" ? item.arguments : JSON.stringify(item.arguments ?? {}),
            raw: item
          }
        ],
        raw: item
      });
      continue;
    }
    if (type === "function_call_output") {
      messages.push({
        role: "tool",
        toolCallId: typeof item.call_id === "string" ? item.call_id : undefined,
        content: [
          {
            type: "tool_result",
            toolCallId: typeof item.call_id === "string" ? item.call_id : undefined,
            content: String(item.output ?? ""),
            raw: item
          }
        ],
        raw: item
      });
      continue;
    }
    messages.push({
      role: "unknown",
      content: [{ type: "unknown", kind: type, raw: item }],
      raw: item
    });
  }
  return messages;
}

function decodeResponsesContent(content: unknown): ContentPart[] {
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }
  if (!Array.isArray(content)) {
    return content == null ? [{ type: "text", text: "" }] : [{ type: "unknown", raw: content }];
  }
  return content.map((item) => decodeChatContentPart(item));
}

export function encodeAssistantChatMessage(message: Message): Record<string, unknown> {
  const text = message.content
    .filter((part): part is Extract<ContentPart, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");
  const toolCalls = message.content.filter((part): part is Extract<ContentPart, { type: "tool_call" }> => part.type === "tool_call");
  const payload: Record<string, unknown> = {
    role: "assistant",
    content: toolCalls.length > 0 && !text ? null : text
  };
  if (toolCalls.length > 0) {
    payload.tool_calls = toolCalls.map((call) => ({
      id: call.id ?? "call_unknown",
      type: "function",
      function: {
        name: call.name,
        arguments: call.arguments ?? "{}"
      }
    }));
  }
  return payload;
}

export function encodeResponsesOutput(message: Message): unknown[] {
  const text = message.content
    .filter((part): part is Extract<ContentPart, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");
  const toolCalls = message.content.filter((part): part is Extract<ContentPart, { type: "tool_call" }> => part.type === "tool_call");
  const output: unknown[] = [];
  if (text || toolCalls.length === 0) {
    output.push({
      type: "message",
      id: "msg_output",
      status: "completed",
      role: "assistant",
      content: [
        {
          type: "output_text",
          text,
          annotations: []
        }
      ]
    });
  }
  for (const call of toolCalls) {
    output.push({
      type: "function_call",
      id: call.id ?? "fc_unknown",
      call_id: call.id ?? "call_unknown",
      name: call.name,
      arguments: call.arguments ?? "{}"
    });
  }
  return output;
}

export function finishReasonFor(message: Message, fallback = "stop"): string {
  const hasTools = message.content.some((part) => part.type === "tool_call");
  return hasTools ? "tool_calls" : fallback;
}

export function mergeDialectExtensions(
  protocolKey: string,
  unknown: Record<string, unknown> | undefined,
  extra?: Record<string, unknown>
): Record<string, unknown> | undefined {
  return mergeExtensions(unknown ? { [protocolKey]: unknown } : undefined, extra);
}
