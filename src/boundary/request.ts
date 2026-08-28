import type { Message, ResponseFormat, ToolChoice, ToolDefinition } from "./content.js";

export interface GenerationParams {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stop?: string[];
  presencePenalty?: number;
  frequencyPenalty?: number;
  seed?: number;
}

export interface NativePayload {
  protocol: string;
  payload: unknown;
}

export interface InvocationSource {
  protocol: string;
  endpoint: string;
}

export interface InvocationRequest {
  model: string;
  messages: Message[];
  instructions?: string;
  generation?: GenerationParams;
  tools?: ToolDefinition[];
  toolChoice?: ToolChoice;
  responseFormat?: ResponseFormat;
  reasoning?: {
    effort?: string;
    budgetTokens?: number;
  };
  metadata?: Record<string, unknown>;
  stream?: boolean;
  extensions?: Record<string, unknown>;
  source: InvocationSource;
  native?: NativePayload;
  raw?: unknown;
}

export type LossyConversionPolicy = "error" | "preserve" | "best-effort";
