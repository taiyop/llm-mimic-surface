export type MessageRole = "system" | "developer" | "user" | "assistant" | "tool" | "unknown";

export interface TextPart {
  type: "text";
  text: string;
  extensions?: Record<string, unknown>;
  raw?: unknown;
}

export interface ImagePart {
  type: "image";
  url?: string;
  mimeType?: string;
  data?: string;
  detail?: string;
  extensions?: Record<string, unknown>;
  raw?: unknown;
}

export interface FilePart {
  type: "file";
  filename?: string;
  mimeType?: string;
  data?: string;
  url?: string;
  fileId?: string;
  extensions?: Record<string, unknown>;
  raw?: unknown;
}

export interface ToolCallPart {
  type: "tool_call";
  id?: string;
  name: string;
  arguments?: string;
  extensions?: Record<string, unknown>;
  raw?: unknown;
}

export interface ToolResultPart {
  type: "tool_result";
  toolCallId?: string;
  name?: string;
  content: string | ContentPart[];
  isError?: boolean;
  extensions?: Record<string, unknown>;
  raw?: unknown;
}

export interface ReasoningPart {
  type: "reasoning";
  text: string;
  extensions?: Record<string, unknown>;
  raw?: unknown;
}

export interface UnknownPart {
  type: "unknown";
  kind?: string;
  extensions?: Record<string, unknown>;
  raw?: unknown;
}

export type ContentPart =
  | TextPart
  | ImagePart
  | FilePart
  | ToolCallPart
  | ToolResultPart
  | ReasoningPart
  | UnknownPart;

export interface Message {
  role: MessageRole;
  content: ContentPart[];
  name?: string;
  toolCallId?: string;
  extensions?: Record<string, unknown>;
  raw?: unknown;
}

export interface FunctionTool {
  type: "function";
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  strict?: boolean;
  extensions?: Record<string, unknown>;
  raw?: unknown;
}

export interface ProviderTool {
  type: "provider";
  provider: string;
  name: string;
  config?: Record<string, unknown>;
  extensions?: Record<string, unknown>;
  raw?: unknown;
}

export interface UnknownTool {
  type: "unknown";
  name?: string;
  extensions?: Record<string, unknown>;
  raw?: unknown;
}

export type ToolDefinition = FunctionTool | ProviderTool | UnknownTool;

export type ToolChoice =
  | { type: "auto" }
  | { type: "none" }
  | { type: "required" }
  | { type: "tool"; name: string }
  | { type: "unknown"; raw?: unknown };

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; name?: string; schema?: Record<string, unknown>; strict?: boolean }
  | { type: "unknown"; raw?: unknown };

export interface Citation {
  type: string;
  url?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export function textPart(text: string, raw?: unknown): TextPart {
  return { type: "text", text, raw };
}

export function hasContentType(messages: Message[], type: ContentPart["type"]): boolean {
  return messages.some((message) =>
    message.content.some((part) => part.type === type)
  );
}
