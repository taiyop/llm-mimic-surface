import type { Citation, Message } from "./content.js";
import type { NativePayload } from "./request.js";

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  extensions?: Record<string, unknown>;
}

export interface ModelInfo {
  id: string;
  displayName?: string;
  ownedBy?: string;
  created?: number;
  extensions?: Record<string, unknown>;
}

export interface InvocationResponse {
  id: string;
  model: string;
  message: Message;
  finishReason?: string;
  usage?: Usage;
  citations?: Citation[];
  created?: number;
  extensions?: Record<string, unknown>;
  native?: NativePayload;
}
