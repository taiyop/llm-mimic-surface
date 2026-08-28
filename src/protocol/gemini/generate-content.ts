import type { ContentPart, Message, ToolChoice, ToolDefinition } from "../../boundary/content.js";
import { BackendError } from "../../boundary/errors.js";
import type { InvocationRequest } from "../../boundary/request.js";
import type { InvocationResponse } from "../../boundary/response.js";
import { collectUnknownFields, isRecord, mergeExtensions } from "../../util/objects.js";
import { joinNonEmpty } from "../../util/text.js";
import type { DecodeMeta } from "../types.js";
import { GEMINI_KNOWN_KEYS, geminiGenerateContentSchema } from "./schemas.js";

export function parseGeminiModelAction(modelAction: string): {
  model: string;
  action: "generateContent" | "streamGenerateContent";
} {
  if (modelAction.endsWith(":streamGenerateContent")) {
    return {
      model: modelAction.slice(0, -":streamGenerateContent".length).replace(/^models\//, ""),
      action: "streamGenerateContent"
    };
  }
  if (modelAction.endsWith(":generateContent")) {
    return {
      model: modelAction.slice(0, -":generateContent".length).replace(/^models\//, ""),
      action: "generateContent"
    };
  }
  throw new BackendError({
    code: "invalid_request",
    message: "Gemini path must end with :generateContent or :streamGenerateContent",
    param: "model"
  });
}

export function decodeGeminiRequest(
  raw: unknown,
  meta: DecodeMeta,
  model: string,
  stream: boolean
): InvocationRequest {
  const parsed = geminiGenerateContentSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    throw new BackendError({
      code: "invalid_request",
      message: parsed.error.issues[0]?.message ?? "Invalid Gemini generateContent request"
    });
  }
  const body = parsed.data;
  const record = isRecord(raw) ? raw : {};
  const unknown = collectUnknownFields(record, GEMINI_KNOWN_KEYS);
  const system = decodeSystem(body.systemInstruction ?? body.system_instruction);
  const generation = decodeGeneration(body.generationConfig ?? body.generation_config);
  const tools = decodeGeminiTools(body.tools);
  const toolChoice = decodeGeminiToolConfig(body.toolConfig ?? body.tool_config);

  return {
    model,
    messages: decodeContents(body.contents ?? []),
    instructions: system,
    generation: generation.params,
    tools,
    toolChoice,
    responseFormat: generation.responseFormat,
    stream,
    extensions: mergeExtensions(unknown ? { gemini: unknown } : undefined, generation.extensions),
    source: { protocol: "gemini", endpoint: meta.endpoint },
    native: { protocol: "gemini", payload: raw },
    raw
  };
}

function decodeSystem(system: unknown): string | undefined {
  if (!system) {
    return undefined;
  }
  if (typeof system === "string") {
    return system;
  }
  if (!isRecord(system)) {
    return undefined;
  }
  const parts = Array.isArray(system.parts) ? system.parts : [];
  return joinNonEmpty(
    parts.map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : undefined))
  );
}

function decodeContents(contents: unknown[]): Message[] {
  return contents.map((content) => {
    if (typeof content === "string") {
      return { role: "user", content: [{ type: "text", text: content }], raw: content };
    }
    if (!isRecord(content)) {
      return { role: "unknown", content: [{ type: "unknown", raw: content }], raw: content };
    }
    const roleRaw = String(content.role ?? "user");
    const role = roleRaw === "model" ? "assistant" : roleRaw === "user" || roleRaw === "system" ? roleRaw : "unknown";
    const parts = Array.isArray(content.parts) ? content.parts : [];
    return {
      role,
      content: parts.map((part) => decodePart(part)),
      extensions: collectUnknownFields(content, ["role", "parts"]),
      raw: content
    };
  });
}

function decodePart(part: unknown): ContentPart {
  if (!isRecord(part)) {
    return { type: "unknown", raw: part };
  }
  if (typeof part.text === "string") {
    return { type: "text", text: part.text, raw: part };
  }
  const inline = isRecord(part.inlineData) ? part.inlineData : isRecord(part.inline_data) ? part.inline_data : undefined;
  if (inline) {
    const mime = String(inline.mimeType ?? inline.mime_type ?? "");
    const data = typeof inline.data === "string" ? inline.data : undefined;
    if (mime.startsWith("image/")) {
      return { type: "image", mimeType: mime, data, raw: part };
    }
    return { type: "file", mimeType: mime, data, raw: part };
  }
  const file = isRecord(part.fileData) ? part.fileData : isRecord(part.file_data) ? part.file_data : undefined;
  if (file) {
    return {
      type: "file",
      mimeType: typeof file.mimeType === "string" ? file.mimeType : typeof file.mime_type === "string" ? file.mime_type : undefined,
      url: typeof file.fileUri === "string" ? file.fileUri : typeof file.file_uri === "string" ? file.file_uri : undefined,
      raw: part
    };
  }
  const functionCall = isRecord(part.functionCall) ? part.functionCall : isRecord(part.function_call) ? part.function_call : undefined;
  if (functionCall) {
    return {
      type: "tool_call",
      name: String(functionCall.name ?? "unknown"),
      arguments: JSON.stringify(functionCall.args ?? {}),
      raw: part
    };
  }
  const functionResponse =
    isRecord(part.functionResponse) ? part.functionResponse : isRecord(part.function_response) ? part.function_response : undefined;
  if (functionResponse) {
    return {
      type: "tool_result",
      name: typeof functionResponse.name === "string" ? functionResponse.name : undefined,
      content: JSON.stringify(functionResponse.response ?? {}),
      raw: part
    };
  }
  return { type: "unknown", kind: Object.keys(part)[0], raw: part };
}

function decodeGeneration(config: unknown): {
  params?: InvocationRequest["generation"];
  responseFormat?: InvocationRequest["responseFormat"];
  extensions?: Record<string, unknown>;
} {
  if (!isRecord(config)) {
    return {};
  }
  const params = {
    temperature: typeof config.temperature === "number" ? config.temperature : undefined,
    topP: typeof config.topP === "number" ? config.topP : typeof config.top_p === "number" ? config.top_p : undefined,
    topK: typeof config.topK === "number" ? config.topK : typeof config.top_k === "number" ? config.top_k : undefined,
    maxOutputTokens:
      typeof config.maxOutputTokens === "number"
        ? config.maxOutputTokens
        : typeof config.max_output_tokens === "number"
          ? config.max_output_tokens
          : undefined,
    stop: Array.isArray(config.stopSequences)
      ? config.stopSequences.map(String)
      : Array.isArray(config.stop_sequences)
        ? config.stop_sequences.map(String)
        : undefined
  };
  const mime = config.responseMimeType ?? config.response_mime_type;
  const schema = config.responseSchema ?? config.response_schema;
  const responseFormat =
    mime === "application/json"
      ? schema
        ? { type: "json_schema" as const, schema: isRecord(schema) ? schema : undefined }
        : { type: "json_object" as const }
      : undefined;
  const unknown = collectUnknownFields(config, [
    "temperature",
    "topP",
    "top_p",
    "topK",
    "top_k",
    "maxOutputTokens",
    "max_output_tokens",
    "stopSequences",
    "stop_sequences",
    "responseMimeType",
    "response_mime_type",
    "responseSchema",
    "response_schema"
  ]);
  return {
    params,
    responseFormat,
    extensions: unknown ? { gemini: { generationConfig: unknown } } : undefined
  };
}

function decodeGeminiTools(tools: unknown[] | undefined): ToolDefinition[] | undefined {
  if (!tools) {
    return undefined;
  }
  const definitions: ToolDefinition[] = [];
  for (const tool of tools) {
    if (!isRecord(tool)) {
      definitions.push({ type: "unknown", raw: tool });
      continue;
    }
    const decls = Array.isArray(tool.functionDeclarations)
      ? tool.functionDeclarations
      : Array.isArray(tool.function_declarations)
        ? tool.function_declarations
        : undefined;
    if (decls) {
      for (const decl of decls) {
        if (!isRecord(decl)) {
          continue;
        }
        definitions.push({
          type: "function",
          name: String(decl.name ?? "unknown"),
          description: typeof decl.description === "string" ? decl.description : undefined,
          parameters: isRecord(decl.parameters) ? decl.parameters : undefined,
          raw: decl
        });
      }
      continue;
    }
    if (tool.codeExecution || tool.code_execution) {
      definitions.push({ type: "provider", provider: "gemini", name: "code_execution", raw: tool });
      continue;
    }
    if (tool.googleSearch || tool.google_search) {
      definitions.push({ type: "provider", provider: "gemini", name: "google_search", raw: tool });
      continue;
    }
    definitions.push({ type: "unknown", raw: tool });
  }
  return definitions;
}

function decodeGeminiToolConfig(config: unknown): ToolChoice | undefined {
  if (!isRecord(config)) {
    return undefined;
  }
  const fcc = isRecord(config.functionCallingConfig)
    ? config.functionCallingConfig
    : isRecord(config.function_calling_config)
      ? config.function_calling_config
      : undefined;
  if (!fcc) {
    return undefined;
  }
  const mode = String(fcc.mode ?? "AUTO").toUpperCase();
  if (mode === "NONE") {
    return { type: "none" };
  }
  if (mode === "ANY") {
    const names = Array.isArray(fcc.allowedFunctionNames)
      ? fcc.allowedFunctionNames
      : Array.isArray(fcc.allowed_function_names)
        ? fcc.allowed_function_names
        : [];
    if (typeof names[0] === "string") {
      return { type: "tool", name: names[0] };
    }
    return { type: "required" };
  }
  return { type: "auto" };
}

export function encodeGeminiResponse(response: InvocationResponse, request: InvocationRequest): Record<string, unknown> {
  const parts = encodeParts(response.message.content);
  const finish = mapFinish(response.finishReason, response.message.content);
  return {
    candidates: [
      {
        content: {
          role: "model",
          parts
        },
        finishReason: finish,
        index: 0
      }
    ],
    usageMetadata: {
      promptTokenCount: response.usage?.inputTokens ?? 0,
      candidatesTokenCount: response.usage?.outputTokens ?? 0,
      totalTokenCount: response.usage?.totalTokens ?? (response.usage?.inputTokens ?? 0) + (response.usage?.outputTokens ?? 0)
    },
    modelVersion: response.model || request.model
  };
}

function encodeParts(content: ContentPart[]): unknown[] {
  const parts: unknown[] = [];
  for (const part of content) {
    if (part.type === "text") {
      parts.push({ text: part.text });
    } else if (part.type === "tool_call") {
      let args: unknown = {};
      try {
        args = part.arguments ? JSON.parse(part.arguments) : {};
      } catch {
        args = { raw: part.arguments };
      }
      parts.push({ functionCall: { name: part.name, args } });
    } else if (part.type === "reasoning") {
      parts.push({ text: part.text, thought: true });
    }
  }
  return parts.length > 0 ? parts : [{ text: "" }];
}

function mapFinish(reason: string | undefined, content: ContentPart[]): string {
  if (content.some((part) => part.type === "tool_call")) {
    return "STOP";
  }
  if (!reason || reason === "stop" || reason === "end_turn") {
    return "STOP";
  }
  if (reason === "length" || reason === "max_tokens") {
    return "MAX_TOKENS";
  }
  return reason.toUpperCase();
}

export function geminiWantsStream(query: Record<string, string | string[] | undefined>, action: string): boolean {
  if (action === "streamGenerateContent") {
    return true;
  }
  const alt = query.alt;
  return alt === "sse" || (Array.isArray(alt) && alt.includes("sse"));
}
