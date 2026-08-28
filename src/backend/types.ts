import type { BackendCapabilities } from "../boundary/capabilities.js";
import type { InvocationEvent } from "../boundary/events.js";
import type { InvocationRequest } from "../boundary/request.js";
import type { InvocationResponse, ModelInfo } from "../boundary/response.js";

export interface InvocationContext {
  requestId: string;
  signal: AbortSignal;
  headers: Record<string, string | string[] | undefined>;
  protocol: string;
  remoteAddress?: string;
}

export interface ExternalApiBackend {
  invoke(request: InvocationRequest, context: InvocationContext): Promise<InvocationResponse>;
  stream?(request: InvocationRequest, context: InvocationContext): AsyncIterable<InvocationEvent>;
  listModels?(context: InvocationContext): Promise<ModelInfo[]>;
  capabilities?(): BackendCapabilities;
}
